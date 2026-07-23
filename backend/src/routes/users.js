const express = require('express');
const { sql, getPool } = require('../lib/db');
const { setPin } = require('../lib/auth');

const router = express.Router();

// Usernames only, never pin_hash -- populates the client sign-off dropdown (Build Plan section 3).
router.get('/users', async (req, res) => {
    const pool = await getPool();
    const result = await pool.request().query('SELECT id, username FROM users ORDER BY username');
    res.json(result.recordset);
});

router.post('/users/setup', async (req, res) => {
    const { username, pin } = req.body;
    if (!username || !pin) return res.status(400).json({ error: 'username and pin are required' });

    const pool = await getPool();
    const existing = await pool.request()
        .input('username', sql.NVarChar, username)
        .query('SELECT id, pin_hash FROM users WHERE username = @username');

    if (existing.recordset[0]?.pin_hash) {
        return res.status(409).json({ error: 'pin already set for this user' });
    }

    await setPin(username, pin);
    res.status(204).send();
});

module.exports = router;
