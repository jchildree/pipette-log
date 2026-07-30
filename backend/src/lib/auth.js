const bcrypt = require('bcrypt');
const { sql, getPool } = require('./db');

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Validates username+PIN against the DB, applying lockout after
 * MAX_ATTEMPTS consecutive failures (PIN-guess rate limiting).
 * Returns { ok: true, userId, isAdmin } or { ok: false, reason }.
 */
async function checkPin(username, pin) {
    const pool = await getPool();
    const result = await pool.request()
        .input('username', sql.NVarChar, username)
        .query('SELECT id, pin_hash, failed_attempts, locked_until, is_admin, is_active FROM users WHERE username = @username');

    const user = result.recordset[0];
    if (!user || !user.pin_hash) return { ok: false, reason: 'invalid_credentials' };

    if (!user.is_active) return { ok: false, reason: 'deactivated' };

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return { ok: false, reason: 'locked' };
    }

    const match = await bcrypt.compare(pin, user.pin_hash);

    if (!match) {
        const attempts = user.failed_attempts + 1;
        const lockedUntil = attempts >= MAX_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
            : null;
        await pool.request()
            .input('id', sql.Int, user.id)
            .input('attempts', sql.Int, lockedUntil ? 0 : attempts)
            .input('lockedUntil', sql.DateTime2, lockedUntil)
            .query('UPDATE users SET failed_attempts = @attempts, locked_until = @lockedUntil WHERE id = @id');
        return { ok: false, reason: lockedUntil ? 'locked' : 'invalid_credentials' };
    }

    await pool.request()
        .input('id', sql.Int, user.id)
        .query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = @id');

    return { ok: true, userId: user.id, isAdmin: !!user.is_admin };
}

/** Same as checkPin, but also requires the account to be an admin. */
async function checkAdminPin(username, pin) {
    const auth = await checkPin(username, pin);
    if (!auth.ok) return auth;
    if (!auth.isAdmin) return { ok: false, reason: 'admin_required' };
    return auth;
}

async function setPin(username, pin) {
    const pool = await getPool();
    const pinHash = await bcrypt.hash(pin, 10);
    await pool.request()
        .input('username', sql.NVarChar, username)
        .input('pinHash', sql.NVarChar, pinHash)
        .query(`
            MERGE users AS target
            USING (SELECT @username AS username) AS src
            ON target.username = src.username
            WHEN MATCHED THEN UPDATE SET pin_hash = @pinHash, failed_attempts = 0, locked_until = NULL
            WHEN NOT MATCHED THEN INSERT (username, pin_hash) VALUES (@username, @pinHash);
        `);
}

module.exports = { checkPin, checkAdminPin, setPin, MAX_ATTEMPTS, LOCKOUT_MINUTES };
