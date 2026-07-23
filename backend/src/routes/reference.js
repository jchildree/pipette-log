const express = require('express');
const { getPool } = require('../lib/db');

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

module.exports = router;
