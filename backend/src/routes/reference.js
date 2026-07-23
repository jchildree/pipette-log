const express = require('express');
const { sql, getPool } = require('../lib/db');
const { checkPin } = require('../lib/auth');

const router = express.Router();

router.get('/balances', async (req, res) => {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM balances ORDER BY name');
    res.json(result.recordset);
});

router.get('/pipettes', async (req, res) => {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM pipettes ORDER BY pipette_number');
    res.json(result.recordset);
});

// Reference data is PipetteLog-owned (Build Plan section 1) but the blueprint never
// specified how it's entered -- reusing the same username+PIN auth as /entries rather
// than leaving these writes unauthenticated.
router.post('/balances', async (req, res) => {
    const { username, pin, name, location } = req.body;
    const auth = await checkPin(username, pin);
    if (!auth.ok) return res.status(401).json({ error: auth.reason });
    if (!name) return res.status(400).json({ error: 'name is required' });

    const pool = await getPool();
    const result = await pool.request()
        .input('name', sql.NVarChar, name)
        .input('location', sql.NVarChar, location ?? null)
        .query('INSERT INTO balances (name, location) OUTPUT INSERTED.* VALUES (@name, @location)');
    res.status(201).json(result.recordset[0]);
});

router.post('/pipettes', async (req, res) => {
    const { username, pin, pipette_number, min_range, max_range } = req.body;
    const auth = await checkPin(username, pin);
    if (!auth.ok) return res.status(401).json({ error: auth.reason });
    if (!pipette_number || min_range == null || max_range == null) {
        return res.status(400).json({ error: 'pipette_number, min_range, and max_range are required' });
    }

    const pool = await getPool();
    const result = await pool.request()
        .input('pipetteNumber', sql.NVarChar, pipette_number)
        .input('minRange', sql.Decimal(10, 2), min_range)
        .input('maxRange', sql.Decimal(10, 2), max_range)
        .query('INSERT INTO pipettes (pipette_number, min_range, max_range) OUTPUT INSERTED.* VALUES (@pipetteNumber, @minRange, @maxRange)');
    res.status(201).json(result.recordset[0]);
});

module.exports = router;
