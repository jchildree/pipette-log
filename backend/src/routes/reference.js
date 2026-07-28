const express = require('express');
const { sql, getPool } = require('../lib/db');
const { checkPin } = require('../lib/auth');

const router = express.Router();

router.get('/balances', async (req, res) => {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM equipment WHERE equipment_type = 'Balance' ORDER BY equipment_id");
    res.json(result.recordset);
});

router.get('/pipettes', async (req, res) => {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM equipment WHERE equipment_type = 'Pipette' ORDER BY equipment_id");
    res.json(result.recordset);
});

// Repeater tips (ADR-011): selecting a tip drives that entry's low/mid/high targets,
// same pre-fill pattern as a pipette's own low_ul/mid_ul/high_ul.
router.get('/tips', async (req, res) => {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM tips ORDER BY tip_id');
    res.json(result.recordset);
});

// Reference data is PipetteLog-owned (Build Plan section 1) but the blueprint never
// specified how it's entered -- reusing the same username+PIN auth as /entries rather
// than leaving these writes unauthenticated.
router.post('/balances', async (req, res) => {
    const { username, pin, equipment_id, calibration_due_date } = req.body;
    const auth = await checkPin(username, pin);
    if (!auth.ok) return res.status(401).json({ error: auth.reason });
    if (!equipment_id) return res.status(400).json({ error: 'equipment_id is required' });

    const pool = await getPool();
    const result = await pool.request()
        .input('equipmentId', sql.NVarChar, equipment_id)
        .input('calibrationDueDate', sql.Date, calibration_due_date ?? null)
        .query("INSERT INTO equipment (equipment_type, equipment_id, calibration_due_date) OUTPUT INSERTED.* VALUES ('Balance', @equipmentId, @calibrationDueDate)");
    res.status(201).json(result.recordset[0]);
});

router.post('/pipettes', async (req, res) => {
    const {
        username, pin, equipment_id, category, pipette_range, calibration_due_date,
        low_ul, mid_ul, high_ul, low_usage_ul, unit, status,
    } = req.body;
    const auth = await checkPin(username, pin);
    if (!auth.ok) return res.status(401).json({ error: auth.reason });
    if (!equipment_id) return res.status(400).json({ error: 'equipment_id is required' });

    const pool = await getPool();
    const result = await pool.request()
        .input('equipmentId', sql.NVarChar, equipment_id)
        .input('category', sql.NVarChar, category ?? null)
        .input('pipetteRange', sql.NVarChar, pipette_range ?? null)
        .input('calibrationDueDate', sql.Date, calibration_due_date ?? null)
        .input('lowUl', sql.Decimal(10, 3), low_ul ?? null)
        .input('midUl', sql.Decimal(10, 3), mid_ul ?? null)
        .input('highUl', sql.Decimal(10, 3), high_ul ?? null)
        .input('lowUsageUl', sql.Decimal(10, 3), low_usage_ul ?? null)
        .input('unit', sql.NVarChar(4), unit ?? null)
        .input('status', sql.NVarChar, status ?? null)
        .query(`
            INSERT INTO equipment (equipment_type, equipment_id, category, pipette_range, calibration_due_date, low_ul, mid_ul, high_ul, low_usage_ul, unit, status)
            OUTPUT INSERTED.*
            VALUES ('Pipette', @equipmentId, @category, @pipetteRange, @calibrationDueDate, @lowUl, @midUl, @highUl, @lowUsageUl, @unit, @status)
        `);
    res.status(201).json(result.recordset[0]);
});

router.post('/tips', async (req, res) => {
    const { username, pin, tip_id, low_ul, mid_ul, high_ul, low_usage_ul, unit } = req.body;
    const auth = await checkPin(username, pin);
    if (!auth.ok) return res.status(401).json({ error: auth.reason });
    if (!tip_id) return res.status(400).json({ error: 'tip_id is required' });

    const pool = await getPool();
    const result = await pool.request()
        .input('tipId', sql.NVarChar, tip_id)
        .input('lowUl', sql.Decimal(10, 3), low_ul ?? null)
        .input('midUl', sql.Decimal(10, 3), mid_ul ?? null)
        .input('highUl', sql.Decimal(10, 3), high_ul ?? null)
        .input('lowUsageUl', sql.Decimal(10, 3), low_usage_ul ?? null)
        .input('unit', sql.NVarChar(4), unit ?? null)
        .query(`
            INSERT INTO tips (tip_id, low_ul, mid_ul, high_ul, low_usage_ul, unit)
            OUTPUT INSERTED.*
            VALUES (@tipId, @lowUl, @midUl, @highUl, @lowUsageUl, @unit)
        `);
    res.status(201).json(result.recordset[0]);
});

module.exports = router;
