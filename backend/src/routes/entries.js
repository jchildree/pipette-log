const express = require('express');
const { sql, getPool } = require('../lib/db');
const { checkPin } = require('../lib/auth');
const { tolerance3pct } = require('../lib/tolerance');

const router = express.Router();

const NOTE_REQUIRED_TYPES = ['manufacturer_spec', 'after_external_cal'];

function computePassFail(verificationType, volumeUl, massMg, bodyPassFail) {
    if (verificationType === 'tolerance_3pct') return tolerance3pct(volumeUl, massMg);
    return bodyPassFail ?? null; // manual for manufacturer_spec / after_external_cal
}

router.post('/entries', async (req, res) => {
    const { username, pin, pipette_id, balance_id, verification_type, volume_ul, mass_mg, note, pass_fail } = req.body;

    if (NOTE_REQUIRED_TYPES.includes(verification_type) && !note) {
        return res.status(400).json({ error: 'note is required for this verification_type' });
    }

    const auth = await checkPin(username, pin);
    if (!auth.ok) return res.status(401).json({ error: auth.reason });

    const computedPassFail = computePassFail(verification_type, volume_ul, mass_mg, pass_fail);

    const pool = await getPool();
    const result = await pool.request()
        .input('pipetteId', sql.Int, pipette_id)
        .input('balanceId', sql.Int, balance_id)
        .input('verificationType', sql.NVarChar, verification_type)
        .input('volumeUl', sql.Decimal(10, 3), volume_ul)
        .input('massMg', sql.Decimal(10, 3), mass_mg)
        .input('passFail', sql.Char(1), computedPassFail)
        .input('note', sql.NVarChar(sql.MAX), note ?? null)
        .input('signedByUserId', sql.Int, auth.userId)
        .query(`
            INSERT INTO entries
                (pipette_id, balance_id, verification_type, volume_ul, mass_mg, pass_fail, note, signed_by_user_id, signed_at)
            OUTPUT INSERTED.id, INSERTED.signed_at
            VALUES
                (@pipetteId, @balanceId, @verificationType, @volumeUl, @massMg, @passFail, @note, @signedByUserId, SYSUTCDATETIME());
        `);

    res.status(201).json(result.recordset[0]);
});

router.post('/entries/:id/correct', async (req, res) => {
    const { id } = req.params;
    const { username, pin, pipette_id, balance_id, verification_type, volume_ul, mass_mg, note, pass_fail } = req.body;

    if (!note) return res.status(400).json({ error: 'note is required for corrections' });

    const auth = await checkPin(username, pin);
    if (!auth.ok) return res.status(401).json({ error: auth.reason });

    const computedPassFail = computePassFail(verification_type, volume_ul, mass_mg, pass_fail);

    const pool = await getPool();
    const result = await pool.request()
        .input('pipetteId', sql.Int, pipette_id)
        .input('balanceId', sql.Int, balance_id)
        .input('verificationType', sql.NVarChar, verification_type)
        .input('volumeUl', sql.Decimal(10, 3), volume_ul)
        .input('massMg', sql.Decimal(10, 3), mass_mg)
        .input('passFail', sql.Char(1), computedPassFail)
        .input('note', sql.NVarChar(sql.MAX), note)
        .input('signedByUserId', sql.Int, auth.userId)
        .input('correctsEntryId', sql.Int, id)
        .query(`
            INSERT INTO entries
                (pipette_id, balance_id, verification_type, volume_ul, mass_mg, pass_fail, note, signed_by_user_id, signed_at, corrects_entry_id)
            OUTPUT INSERTED.id, INSERTED.signed_at
            VALUES
                (@pipetteId, @balanceId, @verificationType, @volumeUl, @massMg, @passFail, @note, @signedByUserId, SYSUTCDATETIME(), @correctsEntryId);
        `);

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
