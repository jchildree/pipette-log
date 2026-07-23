const express = require('express');
const { sql, getPool } = require('../lib/db');
const { checkPin } = require('../lib/auth');
const { tolerance3pct } = require('../lib/tolerance');

const router = express.Router();

const NOTE_REQUIRED_TYPES = ['manufacturer_spec', 'after_external_cal'];
const POINTS = ['low', 'mid', 'high'];

function computePointPassFail(verificationType, point) {
    if (verificationType === 'tolerance_3pct') return tolerance3pct(point.volume_ul, point.mass_mg);
    return point.pass_fail ?? null; // manual for manufacturer_spec / after_external_cal
}

function validatePoints(points) {
    return points && POINTS.every((p) => points[p] && points[p].volume_ul != null && points[p].mass_mg != null);
}

async function insertEntry(pool, { pipette_id, balance_id, verification_type, points, note, signedByUserId, correctsEntryId }) {
    const passFail = Object.fromEntries(POINTS.map((p) => [p, computePointPassFail(verification_type, points[p])]));

    const request = pool.request()
        .input('pipetteId', sql.Int, pipette_id)
        .input('balanceId', sql.Int, balance_id)
        .input('verificationType', sql.NVarChar, verification_type)
        .input('volumeLowUl', sql.Decimal(10, 3), points.low.volume_ul)
        .input('massLowMg', sql.Decimal(10, 3), points.low.mass_mg)
        .input('passLow', sql.Char(1), passFail.low)
        .input('volumeMidUl', sql.Decimal(10, 3), points.mid.volume_ul)
        .input('massMidMg', sql.Decimal(10, 3), points.mid.mass_mg)
        .input('passMid', sql.Char(1), passFail.mid)
        .input('volumeHighUl', sql.Decimal(10, 3), points.high.volume_ul)
        .input('massHighMg', sql.Decimal(10, 3), points.high.mass_mg)
        .input('passHigh', sql.Char(1), passFail.high)
        .input('note', sql.NVarChar(sql.MAX), note ?? null)
        .input('signedByUserId', sql.Int, signedByUserId)
        .input('correctsEntryId', sql.Int, correctsEntryId ?? null);

    return request.query(`
        INSERT INTO entries
            (pipette_id, balance_id, verification_type,
             volume_low_ul, mass_low_mg, pass_low,
             volume_mid_ul, mass_mid_mg, pass_mid,
             volume_high_ul, mass_high_mg, pass_high,
             note, signed_by_user_id, signed_at, corrects_entry_id)
        OUTPUT INSERTED.*
        VALUES
            (@pipetteId, @balanceId, @verificationType,
             @volumeLowUl, @massLowMg, @passLow,
             @volumeMidUl, @massMidMg, @passMid,
             @volumeHighUl, @massHighMg, @passHigh,
             @note, @signedByUserId, SYSUTCDATETIME(), @correctsEntryId);
    `);
}

router.post('/entries', async (req, res) => {
    const { username, pin, pipette_id, balance_id, verification_type, points, note } = req.body;

    if (NOTE_REQUIRED_TYPES.includes(verification_type) && !note) {
        return res.status(400).json({ error: 'note is required for this verification_type' });
    }
    if (!validatePoints(points)) {
        return res.status(400).json({ error: 'points.low, points.mid, and points.high (each with volume_ul and mass_mg) are required' });
    }

    const auth = await checkPin(username, pin);
    if (!auth.ok) return res.status(401).json({ error: auth.reason });

    const pool = await getPool();
    const result = await insertEntry(pool, { pipette_id, balance_id, verification_type, points, note, signedByUserId: auth.userId });

    res.status(201).json(result.recordset[0]);
});

// Audit/review list: current-state entries only (the latest row in each correction
// chain -- ADR-005), with pipette/balance/technician resolved to readable names.
// A row where corrects_entry_id is set is itself a correction, so `corrected: true`
// flags that history exists behind it (fetch via /entries/:id/history).
router.get('/entries', async (req, res) => {
    const { pipette_id, balance_id, username, verification_type, from, to } = req.query;

    const pool = await getPool();
    const result = await pool.request()
        .input('pipetteId', sql.Int, pipette_id ? Number(pipette_id) : null)
        .input('balanceId', sql.Int, balance_id ? Number(balance_id) : null)
        .input('username', sql.NVarChar, username ?? null)
        .input('verificationType', sql.NVarChar, verification_type ?? null)
        .input('from', sql.DateTime2, from ?? null)
        .input('to', sql.DateTime2, to ?? null)
        .query(`
            SELECT
                e.*,
                p.equipment_id AS pipette_equipment_id,
                b.equipment_id AS balance_equipment_id,
                u.username AS signed_by_username,
                CASE WHEN e.corrects_entry_id IS NOT NULL THEN 1 ELSE 0 END AS corrected
            FROM entries e
            JOIN equipment p ON p.id = e.pipette_id
            JOIN equipment b ON b.id = e.balance_id
            LEFT JOIN users u ON u.id = e.signed_by_user_id
            WHERE NOT EXISTS (SELECT 1 FROM entries c WHERE c.corrects_entry_id = e.id)
                AND (@pipetteId IS NULL OR e.pipette_id = @pipetteId)
                AND (@balanceId IS NULL OR e.balance_id = @balanceId)
                AND (@username IS NULL OR u.username = @username)
                AND (@verificationType IS NULL OR e.verification_type = @verificationType)
                AND (@from IS NULL OR e.signed_at >= @from)
                AND (@to IS NULL OR e.signed_at <= @to)
            ORDER BY e.signed_at DESC
        `);

    res.json(result.recordset);
});

router.post('/entries/:id/correct', async (req, res) => {
    const { id } = req.params;
    const { username, pin, pipette_id, balance_id, verification_type, points, note } = req.body;

    if (!note) return res.status(400).json({ error: 'note is required for corrections' });
    if (!validatePoints(points)) {
        return res.status(400).json({ error: 'points.low, points.mid, and points.high (each with volume_ul and mass_mg) are required' });
    }

    const auth = await checkPin(username, pin);
    if (!auth.ok) return res.status(401).json({ error: auth.reason });

    const pool = await getPool();
    const result = await insertEntry(pool, {
        pipette_id, balance_id, verification_type, points, note,
        signedByUserId: auth.userId, correctsEntryId: id,
    });

    res.status(201).json(result.recordset[0]);
});

router.get('/entries/:id/history', async (req, res) => {
    const { id } = req.params;
    const pool = await getPool();

    // Walk the correction chain back to the original, then fetch original + all corrections.
    const rootResult = await pool.request()
        .input('id', sql.Int, id)
        .query(`
            WITH chain AS (
                SELECT id, corrects_entry_id FROM entries WHERE id = @id
                UNION ALL
                SELECT e.id, e.corrects_entry_id FROM entries e
                JOIN chain c ON e.id = c.corrects_entry_id
            )
            SELECT TOP 1 id FROM chain WHERE corrects_entry_id IS NULL;
        `);

    const rootId = rootResult.recordset[0]?.id ?? id;

    const history = await pool.request()
        .input('rootId', sql.Int, rootId)
        .query(`
            WITH chain AS (
                SELECT * FROM entries WHERE id = @rootId
                UNION ALL
                SELECT e.* FROM entries e
                JOIN chain c ON e.corrects_entry_id = c.id
            )
            SELECT * FROM chain ORDER BY created_at;
        `);

    res.json(history.recordset);
});

module.exports = router;
