const express = require('express');
const { sql, getPool } = require('../lib/db');
const { setPin } = require('../lib/auth');

const router = express.Router();

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
