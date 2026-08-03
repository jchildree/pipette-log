const express = require('express');
const { sql, getPool } = require('../lib/db');
const { checkAdminPin } = require('../lib/auth');

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
    const auth = await checkAdminPin(username, pin);
    if (!auth.ok) return res.status(auth.reason === 'admin_required' ? 403 : 401).json({ error: auth.reason });
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
    const auth = await checkAdminPin(username, pin);
    if (!auth.ok) return res.status(auth.reason === 'admin_required' ? 403 : 401).json({ error: auth.reason });
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

// Admin-only edit of any equipment row (pipette or balance) -- e.g. calibration
// due date, department, active/inactive status. Shared table (002_equipment.sql),
// so one PATCH covers both types rather than duplicating per-type routes.
const EQUIPMENT_FIELDS = {
    category: sql.NVarChar,
    pipette_range: sql.NVarChar,
    calibration_due_date: sql.Date,
    low_ul: sql.Decimal(10, 3),
    mid_ul: sql.Decimal(10, 3),
    high_ul: sql.Decimal(10, 3),
    low_usage_ul: sql.Decimal(10, 3),
    unit: sql.NVarChar(4),
    status: sql.NVarChar,
    rack_number: sql.NVarChar,
    serial_number: sql.NVarChar,
    sub_location: sql.NVarChar,
    last_calibration_date: sql.Date,
    mechanism: sql.NVarChar,
    calibration_conducted_by: sql.NVarChar,
    ranges_used: sql.NVarChar,
    department: sql.NVarChar,
    manufacturer: sql.NVarChar,
    old_id: sql.NVarChar,
    review_comment: sql.NVarChar,
    adjustment_comment: sql.NVarChar,
    comments_2: sql.NVarChar,
};

const EQUIPMENT_STATUSES = ['Active', 'Inactive', 'Out of Service'];

router.patch('/equipment/:id', async (req, res) => {
    const { id } = req.params;
    const { admin_username, admin_pin, ...fields } = req.body;
    const auth = await checkAdminPin(admin_username, admin_pin);
    if (!auth.ok) return res.status(auth.reason === 'admin_required' ? 403 : 401).json({ error: auth.reason });
    if (fields.status !== undefined && fields.status !== '' && !EQUIPMENT_STATUSES.includes(fields.status)) {
        return res.status(400).json({ error: `status must be one of: ${EQUIPMENT_STATUSES.join(', ')}` });
    }

    const pool = await getPool();
    const request = pool.request().input('id', sql.Int, id);
    const setClauses = [];
    for (const [key, type] of Object.entries(EQUIPMENT_FIELDS)) {
        if (fields[key] === undefined) continue;
        request.input(key, type, fields[key] === '' ? null : fields[key]);
        setClauses.push(`${key} = @${key}`);
    }
    if (!setClauses.length) return res.status(400).json({ error: 'no fields to update' });

    const result = await request.query(
        `UPDATE equipment SET ${setClauses.join(', ')} OUTPUT INSERTED.* WHERE id = @id`
    );
    if (!result.recordset[0]) return res.status(404).json({ error: 'equipment not found' });
    res.json(result.recordset[0]);
});

router.delete('/equipment/:id', async (req, res) => {
    const { id } = req.params;
    const { admin_username, admin_pin } = req.body;
    const auth = await checkAdminPin(admin_username, admin_pin);
    if (!auth.ok) return res.status(auth.reason === 'admin_required' ? 403 : 401).json({ error: auth.reason });

    const pool = await getPool();
    try {
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM equipment OUTPUT DELETED.id WHERE id = @id');
        if (!result.recordset[0]) return res.status(404).json({ error: 'equipment not found' });
        res.status(204).send();
    } catch (err) {
        if (err.number === 547) return res.status(409).json({ error: 'equipment has entries on record and cannot be deleted' });
        throw err;
    }
});

router.post('/tips', async (req, res) => {
    const { username, pin, tip_id, low_ul, mid_ul, high_ul, low_usage_ul, unit } = req.body;
    const auth = await checkAdminPin(username, pin);
    if (!auth.ok) return res.status(auth.reason === 'admin_required' ? 403 : 401).json({ error: auth.reason });
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
