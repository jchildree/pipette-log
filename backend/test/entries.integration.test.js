// Requires a live MSSQL matching backend/.env (see docs: docker container `pipette-log-mssql`).
// Run separately from the unit suite: `npm run test:integration`.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');

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

    // tolerance_3pct: server computes pass_fail, 97 on volume 100 -> Y (inclusive bound)
    const entry = await api('/entries', {
        method: 'POST',
        body: JSON.stringify({
            username, pin, pipette_id: pipetteId, balance_id: balanceId,
            verification_type: 'tolerance_3pct', volume_ul: 100, mass_mg: 97,
        }),
    });
    assert.equal(entry.status, 201);
    assert.ok(entry.body.signed_at);
    const entryId = entry.body.id;

    // manufacturer_spec with no note -> rejected
    const rejected = await api('/entries', {
        method: 'POST',
        body: JSON.stringify({
            username, pin, pipette_id: pipetteId, balance_id: balanceId,
            verification_type: 'manufacturer_spec', volume_ul: 100, mass_mg: 100,
        }),
    });
    assert.equal(rejected.status, 400);

    // wrong pin -> 401, original entry untouched
    const wrongPin = await api('/entries', {
        method: 'POST',
        body: JSON.stringify({
            username, pin: '000000', pipette_id: pipetteId, balance_id: balanceId,
            verification_type: 'tolerance_3pct', volume_ul: 100, mass_mg: 100,
        }),
    });
    assert.equal(wrongPin.status, 401);

    // correction: new row, corrects_entry_id set, original never mutated
    const correction = await api(`/entries/${entryId}/correct`, {
        method: 'POST',
        body: JSON.stringify({
            username, pin, pipette_id: pipetteId, balance_id: balanceId,
            verification_type: 'tolerance_3pct', volume_ul: 100, mass_mg: 98,
            note: 'corrected mass reading',
        }),
    });
    assert.equal(correction.status, 201);

    const history = await api(`/entries/${entryId}/history`);
    assert.equal(history.body.length, 2, 'expected original + one correction');
    assert.equal(history.body[0].id, entryId);
    assert.equal(history.body[1].corrects_entry_id, entryId);
});

test('reference data creation requires valid PIN', async () => {
    const refUser = `itest_ref_${Date.now()}`;
    await api('/users/setup', { method: 'POST', body: JSON.stringify({ username: refUser, pin: '222222' }) });

    const unauthorized = await api('/balances', {
        method: 'POST',
        body: JSON.stringify({ username: refUser, pin: 'wrong', name: 'Should Not Exist' }),
    });
    assert.equal(unauthorized.status, 401);

    const newBalance = await api('/balances', {
        method: 'POST',
        body: JSON.stringify({ username: refUser, pin: '222222', name: `Balance ${Date.now()}`, location: 'Bench 2' }),
    });
    assert.equal(newBalance.status, 201);
    assert.ok(newBalance.body.id);

    const newPipette = await api('/pipettes', {
        method: 'POST',
        body: JSON.stringify({ username: refUser, pin: '222222', pipette_number: `P-${Date.now()}`, min_range: 1, max_range: 10 }),
    });
    assert.equal(newPipette.status, 201);
    assert.ok(newPipette.body.id);
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
                verification_type: 'tolerance_3pct', volume_ul: 100, mass_mg: 100,
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
            verification_type: 'tolerance_3pct', volume_ul: 100, mass_mg: 100,
        }),
    });
    assert.equal(stillLocked.status, 401);
    assert.equal(stillLocked.body.error, 'locked');
});
