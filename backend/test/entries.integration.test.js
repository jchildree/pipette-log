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

test('consecutive-failure signer gate: same signer ok for 2 straight fails, blocked on 3rd, different signer unblocks, pass resets streak', async () => {
    const userA = `itest_gateA_${Date.now()}`;
    const userB = `itest_gateB_${Date.now()}`;
    await api('/users/setup', { method: 'POST', body: JSON.stringify({ username: userA, pin: '333333' }) });
    await api('/users/setup', { method: 'POST', body: JSON.stringify({ username: userB, pin: '444444' }) });

    const pool = await getPool();
    await pool.request().input('username', sql.NVarChar, userA).query('UPDATE users SET is_admin = 1 WHERE username = @username');

    const balance = await api('/balances', {
        method: 'POST',
        body: JSON.stringify({ username: userA, pin: '333333', equipment_id: `BAL-GATE-${Date.now()}` }),
    });
    const pipette = await api('/pipettes', {
        method: 'POST',
        body: JSON.stringify({
            username: userA, pin: '333333', equipment_id: `PI-GATE-${Date.now()}`,
            category: 'single channel', low_ul: 20, mid_ul: 100, high_ul: 200,
        }),
    });
    const pipetteId = pipette.body.id;
    const balanceId = balance.body.id;

    function failingPoints() {
        return points({ low: { mass_mg: 1 } }); // grossly out of tolerance -> N
    }

    async function submit(username, pin, pts) {
        return api('/entries', {
            method: 'POST',
            body: JSON.stringify({ username, pin, pipette_id: pipetteId, balance_id: balanceId, verification_type: 'tolerance_3pct', points: pts }),
        });
    }

    const first = await submit(userA, '333333', failingPoints());
    assert.equal(first.status, 201);
    assert.equal(first.body.pass_low, 'N');

    const second = await submit(userA, '333333', failingPoints());
    assert.equal(second.status, 201, '2 consecutive fails by the same signer are allowed');

    const third = await submit(userA, '333333', failingPoints());
    assert.equal(third.status, 403, '3rd consecutive fail by the same signer is blocked');
    assert.equal(third.body.error, 'different_signer_required');

    const thirdByOther = await submit(userB, '444444', failingPoints());
    assert.equal(thirdByOther.status, 201, '3rd consecutive fail by a different signer is allowed');

    const passing = await submit(userA, '333333', points());
    assert.equal(passing.status, 201, 'a passing entry always succeeds and resets the streak');

    const afterResetFirst = await submit(userA, '333333', failingPoints());
    assert.equal(afterResetFirst.status, 201, 'streak reset by the pass -- same signer ok for fail #1 again');
    const afterResetSecond = await submit(userA, '333333', failingPoints());
    assert.equal(afterResetSecond.status, 201, 'streak reset by the pass -- same signer ok for fail #2 again');
});

test('3rd consecutive failure (different signer) auto-flips equipment to Out of Service', async () => {
    const userA = `itest_oosA_${Date.now()}`;
    const userB = `itest_oosB_${Date.now()}`;
    await api('/users/setup', { method: 'POST', body: JSON.stringify({ username: userA, pin: '555555' }) });
    await api('/users/setup', { method: 'POST', body: JSON.stringify({ username: userB, pin: '666666' }) });

    const pool = await getPool();
    await pool.request().input('username', sql.NVarChar, userA).query('UPDATE users SET is_admin = 1 WHERE username = @username');

    const balance = await api('/balances', {
        method: 'POST',
        body: JSON.stringify({ username: userA, pin: '555555', equipment_id: `BAL-OOS-${Date.now()}` }),
    });
    const pipette = await api('/pipettes', {
        method: 'POST',
        body: JSON.stringify({
            username: userA, pin: '555555', equipment_id: `PI-OOS-${Date.now()}`,
            category: 'single channel', low_ul: 20, mid_ul: 100, high_ul: 200,
        }),
    });
    const pipetteId = pipette.body.id;
    const balanceId = balance.body.id;

    function failingPoints() {
        return points({ low: { mass_mg: 1 } });
    }

    async function submit(username, pin, pts) {
        return api('/entries', {
            method: 'POST',
            body: JSON.stringify({ username, pin, pipette_id: pipetteId, balance_id: balanceId, verification_type: 'tolerance_3pct', points: pts }),
        });
    }

    const first = await submit(userA, '555555', failingPoints());
    assert.equal(first.status, 201);
    assert.deepEqual(first.body.out_of_service, []);

    const second = await submit(userA, '555555', failingPoints());
    assert.equal(second.status, 201);
    assert.deepEqual(second.body.out_of_service, []);

    const third = await submit(userB, '666666', failingPoints());
    assert.equal(third.status, 201, '3rd consecutive fail by a different signer is allowed through');
    assert.deepEqual(third.body.out_of_service, ['pipette'], 'balance never auto-flips, only the pipette side');

    const equipment = await api('/pipettes');
    const flipped = equipment.body.find((p) => p.id === pipetteId);
    assert.equal(flipped.status, 'Out of Service');

    const balances = await api('/balances');
    const unflippedBalance = balances.body.find((b) => b.id === balanceId);
    assert.notEqual(unflippedBalance.status, 'Out of Service');
});
