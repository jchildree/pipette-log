const express = require('express');
const { sql, getPool } = require('../lib/db');
const { setPin, checkAdminPin } = require('../lib/auth');

const router = express.Router();

// Usernames only, never pin_hash -- populates the client sign-off dropdown (Build Plan section 3).
router.get('/users', async (req, res) => {
    const pool = await getPool();
    const result = await pool.request().query('SELECT id, username FROM users ORDER BY username');
    res.json(result.recordset);
});

// Admin-only: full roster for the Users tab table (still never pin_hash).
router.post('/users/list', async (req, res) => {
    const { admin_username, admin_pin } = req.body;
    const auth = await checkAdminPin(admin_username, admin_pin);
    if (!auth.ok) return res.status(auth.reason === 'admin_required' ? 403 : 401).json({ error: auth.reason });

    const pool = await getPool();
    const result = await pool.request()
        .query('SELECT id, username, is_admin, is_active, failed_attempts, locked_until, created_at FROM users ORDER BY username');
    res.json(result.recordset);
});

router.post('/users/setup', async (req, res) => {
    const { username, pin, is_admin, admin_username, admin_pin } = req.body;
    if (!username || !pin) return res.status(400).json({ error: 'username and pin are required' });

    if (is_admin) {
        const auth = await checkAdminPin(admin_username, admin_pin);
        if (!auth.ok) return res.status(auth.reason === 'admin_required' ? 403 : 401).json({ error: auth.reason });
    }

    const pool = await getPool();
    const existing = await pool.request()
        .input('username', sql.NVarChar, username)
        .query('SELECT id, pin_hash FROM users WHERE username = @username');

    if (existing.recordset[0]?.pin_hash) {
        return res.status(409).json({ error: 'pin already set for this user' });
    }

    await setPin(username, pin);
    if (is_admin) {
        await pool.request()
            .input('username', sql.NVarChar, username)
            .query('UPDATE users SET is_admin = 1 WHERE username = @username');
    }
    res.status(204).send();
});

// Admin-only: promote/demote, activate/deactivate, or clear a lockout.
router.patch('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { admin_username, admin_pin, is_admin, is_active, unlock } = req.body;
    const auth = await checkAdminPin(admin_username, admin_pin);
    if (!auth.ok) return res.status(auth.reason === 'admin_required' ? 403 : 401).json({ error: auth.reason });

    const pool = await getPool();
    if (is_admin !== undefined) {
        await pool.request()
            .input('id', sql.Int, id)
            .input('isAdmin', sql.Bit, is_admin ? 1 : 0)
            .query('UPDATE users SET is_admin = @isAdmin WHERE id = @id');
    }
    if (is_active !== undefined) {
        await pool.request()
            .input('id', sql.Int, id)
            .input('isActive', sql.Bit, is_active ? 1 : 0)
            .query('UPDATE users SET is_active = @isActive WHERE id = @id');
    }
    if (unlock) {
        await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = @id');
    }

    const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT id, username, is_admin, is_active, failed_attempts, locked_until, created_at FROM users WHERE id = @id');
    res.json(result.recordset[0]);
});

module.exports = router;
