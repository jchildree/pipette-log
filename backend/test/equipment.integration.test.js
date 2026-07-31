// Requires a live MSSQL matching backend/.env (see docs: docker container `pipette-log-mssql`).
// Run separately from the unit suite: `npm run test:integration`.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { sql, getPool } = require('../src/lib/db');

let server;
let baseUrl;

before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://localhost:${server.address().port}/api`;
});

after(() => new Promise((resolve) => server.close(resolve)));

async function api(path, options) {
    const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    const body = res.status === 204 ? null : await res.json();
    return { status: res.status, body };
}

async function makeAdmin(username, pin) {
    await api('/users/setup', { method: 'POST', body: JSON.stringify({ username, pin }) });
    const pool = await getPool();
    await pool.request().input('username', sql.NVarChar, username).query('UPDATE users SET is_admin = 1 WHERE username = @username');
}

const adminUser = `itest_eq_admin_${Date.now()}`;
const adminPin = '333333';

test('equipment PATCH: happy path updates calibration/department/status', async () => {
    await makeAdmin(adminUser, adminPin);

    const created = await api('/pipettes', {
        method: 'POST',
        body: JSON.stringify({
            username: adminUser, pin: adminPin, equipment_id: `PI-ITEST-PATCH-${Date.now()}`,
            category: 'single channel', pipette_range: '10-100 uL', low_ul: 10, mid_ul: 50, high_ul: 100,
        }),
    });
    assert.equal(created.status, 201);
    const id = created.body.id;

    const patched = await api(`/equipment/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
            admin_username: adminUser, admin_pin: adminPin,
            calibration_due_date: '2027-01-15', department: 'QC', status: 'Inactive',
        }),
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.department, 'QC');
    assert.equal(patched.body.status, 'Inactive');
    assert.match(patched.body.calibration_due_date, /^2027-01-15/);
});

test('equipment PATCH: requires an admin PIN', async () => {
    const nonAdminUser = `itest_eq_nonadmin_${Date.now()}`;
    await api('/users/setup', { method: 'POST', body: JSON.stringify({ username: nonAdminUser, pin: '444444' }) });

    const pipettes = await api('/pipettes');
    const id = pipettes.body[0].id;

    const wrongPin = await api(`/equipment/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ admin_username: nonAdminUser, admin_pin: 'wrong', department: 'QC' }),
    });
    assert.equal(wrongPin.status, 401);

    const nonAdmin = await api(`/equipment/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ admin_username: nonAdminUser, admin_pin: '444444', department: 'QC' }),
    });
    assert.equal(nonAdmin.status, 403);
    assert.equal(nonAdmin.body.error, 'admin_required');
});

test('equipment PATCH: no editable fields -> 400, unknown id -> 404', async () => {
    const pipettes = await api('/pipettes');
    const id = pipettes.body[0].id;

    const empty = await api(`/equipment/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ admin_username: adminUser, admin_pin: adminPin }),
    });
    assert.equal(empty.status, 400);

    const notFound = await api('/equipment/0', {
        method: 'PATCH',
        body: JSON.stringify({ admin_username: adminUser, admin_pin: adminPin, department: 'QC' }),
    });
    assert.equal(notFound.status, 404);
});

test('equipment DELETE: happy path removes an unreferenced pipette', async () => {
    const created = await api('/pipettes', {
        method: 'POST',
        body: JSON.stringify({
            username: adminUser, pin: adminPin, equipment_id: `PI-ITEST-DEL-${Date.now()}`,
            category: 'single channel', pipette_range: '10-100 uL', low_ul: 10, mid_ul: 50, high_ul: 100,
        }),
    });
    const id = created.body.id;

    const deleted = await api(`/equipment/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ admin_username: adminUser, admin_pin: adminPin }),
    });
    assert.equal(deleted.status, 204);

    const gone = await api(`/equipment/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ admin_username: adminUser, admin_pin: adminPin, department: 'QC' }),
    });
    assert.equal(gone.status, 404);
});

test('equipment DELETE: requires an admin PIN', async () => {
    const nonAdminUser = `itest_eq_del_nonadmin_${Date.now()}`;
    await api('/users/setup', { method: 'POST', body: JSON.stringify({ username: nonAdminUser, pin: '555555' }) });

    const pipettes = await api('/pipettes');
    const id = pipettes.body[0].id;

    const nonAdmin = await api(`/equipment/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ admin_username: nonAdminUser, admin_pin: '555555' }),
    });
    assert.equal(nonAdmin.status, 403);
    assert.equal(nonAdmin.body.error, 'admin_required');
});

test('equipment DELETE: unknown id -> 404, equipment with entries -> 409', async () => {
    const notFound = await api('/equipment/0', {
        method: 'DELETE',
        body: JSON.stringify({ admin_username: adminUser, admin_pin: adminPin }),
    });
    assert.equal(notFound.status, 404);

    const balance = await api('/balances', {
        method: 'POST',
        body: JSON.stringify({ username: adminUser, pin: adminPin, equipment_id: `BAL-ITEST-DEL-${Date.now()}` }),
    });
    const pipette = await api('/pipettes', {
        method: 'POST',
        body: JSON.stringify({
            username: adminUser, pin: adminPin, equipment_id: `PI-ITEST-DEL409-${Date.now()}`,
            category: 'single channel', pipette_range: '10-100 uL', low_ul: 10, mid_ul: 50, high_ul: 100,
        }),
    });

    await api('/entries', {
        method: 'POST',
        body: JSON.stringify({
            username: adminUser, pin: adminPin, pipette_id: pipette.body.id, balance_id: balance.body.id,
            verification_type: 'tolerance_3pct',
            points: {
                low: { volume_ul: 10, mass_mg: 10 },
                mid: { volume_ul: 50, mass_mg: 50 },
                high: { volume_ul: 100, mass_mg: 100 },
            },
        }),
    });

    const blocked = await api(`/equipment/${pipette.body.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ admin_username: adminUser, admin_pin: adminPin }),
    });
    assert.equal(blocked.status, 409);
});
