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

// low/mid/high all pass +/-3% tolerance at their respective volumes by default.
function points({ low = {}, mid = {}, high = {} } = {}) {
    return {
        low: { volume_ul: 20, mass_mg: 20, ...low },
        mid: { volume_ul: 100, mass_mg: 100, ...mid },
        high: { volume_ul: 200, mass_mg: 200, ...high },
    };
}

const username = `itest_${Date.now()}`;
const pin = '123456';

test('user setup + reference data + full entry lifecycle', async () => {
    const setup = await api('/users/setup', { method: 'POST', body: JSON.stringify({ username, pin }) });
    assert.equal(setup.status, 204);

    const users = await api('/users');
    assert.ok(users.body.some((u) => u.username === username));

    const balances = await api('/balances');
    const pipettes = await api('/pipettes');
    assert.ok(balances.body.length > 0, 'expected at least one seeded balance');
    assert.ok(pipettes.body.length > 0, 'expected at least one seeded pipette');

    const balanceId = balances.body[0].id;
    const pipetteId = pipettes.body[0].id;

    // tolerance_3pct: server computes pass/fail per point (low/mid/high independently)
    const entry = await api('/entries', {
        method: 'POST',
        body: JSON.stringify({
            username, pin, pipette_id: pipetteId, balance_id: balanceId,
            verification_type: 'tolerance_3pct',
            points: points({ low: { mass_mg: 19.4 } }), // 19.4 on volume 20 -> N (below 0.97*20=19.4... exactly at bound -> Y actually)
        }),
    });
    assert.equal(entry.status, 201);
    assert.ok(entry.body.signed_at);
    assert.equal(entry.body.pass_low, 'Y'); // 19.4 == 0.97*20, inclusive bound
    assert.equal(entry.body.pass_mid, 'Y');
    assert.equal(entry.body.pass_high, 'Y');
    const entryId = entry.body.id;

    // missing a point -> rejected
    const missingPoint = await api('/entries', {
        method: 'POST',
        body: JSON.stringify({
            username, pin, pipette_id: pipetteId, balance_id: balanceId,
            verification_type: 'tolerance_3pct',
            points: { low: { volume_ul: 20, mass_mg: 20 }, mid: { volume_ul: 100, mass_mg: 100 } }, // no high
        }),
    });
    assert.equal(missingPoint.status, 400);

    // manufacturer_spec with no note -> rejected
    const rejected = await api('/entries', {
        method: 'POST',
        body: JSON.stringify({
            username, pin, pipette_id: pipetteId, balance_id: balanceId,
            verification_type: 'manufacturer_spec', points: points(),
        }),
    });
    assert.equal(rejected.status, 400);

    // wrong pin -> 401, original entry untouched
    const wrongPin = await api('/entries', {
        method: 'POST',
        body: JSON.stringify({
            username, pin: '000000', pipette_id: pipetteId, balance_id: balanceId,
            verification_type: 'tolerance_3pct', points: points(),
        }),
    });
    assert.equal(wrongPin.status, 401);

    // correction: new row, corrects_entry_id set, original never mutated
    const correction = await api(`/entries/${entryId}/correct`, {
        method: 'POST',
        body: JSON.stringify({
            username, pin, pipette_id: pipetteId, balance_id: balanceId,
            verification_type: 'tolerance_3pct', points: points({ mid: { mass_mg: 98 } }),
            note: 'corrected mid mass reading',
        }),
    });
    assert.equal(correction.status, 201);

    const history = await api(`/entries/${entryId}/history`);
    assert.equal(history.body.length, 2, 'expected original + one correction');
    assert.equal(history.body[0].id, entryId);
    assert.equal(history.body[1].corrects_entry_id, entryId);

    // audit list: shows only the current-state (leaf) row, joined to readable names
    const list = await api(`/entries?pipette_id=${pipetteId}&balance_id=${balanceId}`);
    assert.ok(!list.body.some((e) => e.id === entryId), 'original (superseded) row should not appear');
    const correctionRow = list.body.find((e) => e.corrects_entry_id === entryId);
    assert.ok(correctionRow, 'correction row should appear in the list');
    assert.equal(correctionRow.corrected, 1);
    assert.equal(correctionRow.signed_by_username, username);
});

test('reference data creation requires an admin PIN', async () => {
    const refUser = `itest_ref_${Date.now()}`;
    await api('/users/setup', { method: 'POST', body: JSON.stringify({ username: refUser, pin: '222222' }) });

    const unauthorized = await api('/balances', {
        method: 'POST',
        body: JSON.stringify({ username: refUser, pin: 'wrong', equipment_id: `BAL-ITEST-${Date.now()}` }),
    });
    assert.equal(unauthorized.status, 401);

    const nonAdmin = await api('/balances', {
        method: 'POST',
        body: JSON.stringify({ username: refUser, pin: '222222', equipment_id: `BAL-ITEST-${Date.now()}` }),
    });
    assert.equal(nonAdmin.status, 403);
    assert.equal(nonAdmin.body.error, 'admin_required');

    const pool = await getPool();
    await pool.request().input('username', sql.NVarChar, refUser).query('UPDATE users SET is_admin = 1 WHERE username = @username');

    const newBalance = await api('/balances', {
        method: 'POST',
        body: JSON.stringify({ username: refUser, pin: '222222', equipment_id: `BAL-ITEST-${Date.now()}` }),
    });
    assert.equal(newBalance.status, 201);
    assert.ok(newBalance.body.id);
    assert.equal(newBalance.body.equipment_type, 'Balance');

    const newPipette = await api('/pipettes', {
        method: 'POST',
        body: JSON.stringify({
            username: refUser, pin: '222222', equipment_id: `PI-ITEST-${Date.now()}`,
            category: 'single channel', pipette_range: '10-100 uL', low_ul: 10, mid_ul: 50, high_ul: 100,
        }),
    });
    assert.equal(newPipette.status, 201);
    assert.ok(newPipette.body.id);
    assert.equal(newPipette.body.equipment_type, 'Pipette');
});

test('PIN lockout after repeated failures', async () => {
    const lockUser = `itest_lock_${Date.now()}`;
    await api('/users/setup', { method: 'POST', body: JSON.stringify({ username: lockUser, pin: '111111' }) });

    const balances = await api('/balances');
    const pipettes = await api('/pipettes');
    const balanceId = balances.body[0].id;
    const pipetteId = pipettes.body[0].id;

    let last;
    for (let i = 0; i < 5; i++) {
        last = await api('/entries', {
            method: 'POST',
            body: JSON.stringify({
                username: lockUser, pin: '999999', pipette_id: pipetteId, balance_id: balanceId,
                verification_type: 'tolerance_3pct', points: points(),
            }),
        });
    }
    assert.equal(last.status, 401);
    assert.equal(last.body.error, 'locked');

    // even correct PIN is rejected while locked
    const stillLocked = await api('/entries', {
        method: 'POST',
        body: JSON.stringify({
            username: lockUser, pin: '111111', pipette_id: pipetteId, balance_id: balanceId,
            verification_type: 'tolerance_3pct', points: points(),
        }),
    });
    assert.equal(stillLocked.status, 401);
    assert.equal(stillLocked.body.error, 'locked');
});
