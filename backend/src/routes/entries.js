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

// Multichannel entries (ADR-011): `channels` is an optional array of up to 8
// { channel: 1-8, points: { low, mid, high } } entries -- one per pipette channel.
// `points` (top-level) still carries channel 1's reading, mirrored onto the entries
// row's own columns so single-triplet audit queries keep working unchanged.
function validateChannels(channels) {
    if (channels == null) return null;
    if (!Array.isArray(channels) || channels.length === 0 || channels.length > 8) {
        return 'channels must be an array of 1-8 entries';
    }
    for (const c of channels) {
        if (!Number.isInteger(c.channel) || c.channel < 1 || c.channel > 8) {
            return 'each channel entry requires an integer channel number 1-8';
        }
        if (!validatePoints(c.points)) {
            return `channel ${c.channel} requires points.low, points.mid, and points.high (each with volume_ul and mass_mg)`;
        }
    }
    return null;
}

// Attempts (ADR-010) are the failed tries that came before a point's final passing
// reading -- tolerance_3pct only, since other verification types have no computed
// pass/fail to trigger a retry. `points.<point>.attempts` is an optional array of
// { volume_ul, mass_mg, channel? }, oldest first.
function validateAttempts(verification_type, points) {
    const withAttempts = POINTS.filter((p) => points[p]?.attempts?.length);
    if (withAttempts.length === 0) return null;
    if (verification_type !== 'tolerance_3pct') {
        return 'attempts are only supported for verification_type tolerance_3pct';
    }
    for (const p of withAttempts) {
        const bad = points[p].attempts.some((a) => a.volume_ul == null || a.mass_mg == null);
        if (bad) return `points.${p}.attempts entries require volume_ul and mass_mg`;
    }
    return null;
}

async function insertPointAttempts(transaction, entryId, pointKey, channel, attempts) {
    for (let i = 0; i < attempts.length; i++) {
        const a = attempts[i];
        await new sql.Request(transaction)
            .input('entryId', sql.Int, entryId)
            .input('pointKey', sql.NVarChar(4), pointKey)
            .input('channel', sql.TinyInt, channel)
            .input('attemptNumber', sql.Int, i + 1)
            .input('volumeUl', sql.Decimal(10, 3), a.volume_ul)
            .input('massMg', sql.Decimal(10, 3), a.mass_mg)
            .input('passFail', sql.Char(1), tolerance3pct(a.volume_ul, a.mass_mg))
            .query(`
                INSERT INTO entry_point_attempts
                    (entry_id, point_key, channel, attempt_number, volume_ul, mass_mg, pass_fail)
                VALUES
                    (@entryId, @pointKey, @channel, @attemptNumber, @volumeUl, @massMg, @passFail);
            `);
    }
}

async function insertEntry(pool, { pipette_id, balance_id, verification_type, points, channels, note, signedByUserId, correctsEntryId }) {
    const passFail = Object.fromEntries(POINTS.map((p) => [p, computePointPassFail(verification_type, points[p])]));

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const entryResult = await new sql.Request(transaction)
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
            .input('correctsEntryId', sql.Int, correctsEntryId ?? null)
            .query(`
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

        const entryId = entryResult.recordset[0].id;

        if (channels && channels.length) {
            // Multichannel: all per-channel points + attempts live in the child tables;
            // the top-level `points` above only mirrored channel 1 onto entries' own columns.
            for (const c of channels) {
                for (const p of POINTS) {
                    const point = c.points[p];
                    const channelPassFail = computePointPassFail(verification_type, point);
                    await new sql.Request(transaction)
                        .input('entryId', sql.Int, entryId)
                        .input('channel', sql.TinyInt, c.channel)
                        .input('pointKey', sql.NVarChar(4), p)
                        .input('volumeUl', sql.Decimal(10, 3), point.volume_ul)
                        .input('massMg', sql.Decimal(10, 3), point.mass_mg)
                        .input('passFail', sql.Char(1), channelPassFail)
                        .query(`
                            INSERT INTO entry_channel_points
                                (entry_id, channel, point_key, volume_ul, mass_mg, pass_fail)
                            VALUES
                                (@entryId, @channel, @pointKey, @volumeUl, @massMg, @passFail);
                        `);
                    await insertPointAttempts(transaction, entryId, p, c.channel, point.attempts ?? []);
                }
            }
        } else {
            for (const p of POINTS) {
                await insertPointAttempts(transaction, entryId, p, null, points[p].attempts ?? []);
            }
        }

        await transaction.commit();
        return entryResult;
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

router.post('/entries', async (req, res) => {
    const { username, pin, pipette_id, balance_id, verification_type, points, channels, note } = req.body;

    if (NOTE_REQUIRED_TYPES.includes(verification_type) && !note) {
        return res.status(400).json({ error: 'note is required for this verification_type' });
    }
    if (!validatePoints(points)) {
        return res.status(400).json({ error: 'points.low, points.mid, and points.high (each with volume_ul and mass_mg) are required' });
    }
    const attemptsError = validateAttempts(verification_type, points);
    if (attemptsError) return res.status(400).json({ error: attemptsError });
    const channelsError = validateChannels(channels);
    if (channelsError) return res.status(400).json({ error: channelsError });
    if (channels) {
        for (const c of channels) {
            const channelAttemptsError = validateAttempts(verification_type, c.points);
            if (channelAttemptsError) return res.status(400).json({ error: `channel ${c.channel}: ${channelAttemptsError}` });
        }
    }

    const auth = await checkPin(username, pin);
    if (!auth.ok) return res.status(401).json({ error: auth.reason });

    const pool = await getPool();
    const result = await insertEntry(pool, { pipette_id, balance_id, verification_type, points, channels, note, signedByUserId: auth.userId });

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
    const { username, pin, pipette_id, balance_id, verification_type, points, channels, note } = req.body;

    if (!note) return res.status(400).json({ error: 'note is required for corrections' });
    if (!validatePoints(points)) {
        return res.status(400).json({ error: 'points.low, points.mid, and points.high (each with volume_ul and mass_mg) are required' });
    }
    const attemptsError = validateAttempts(verification_type, points);
    if (attemptsError) return res.status(400).json({ error: attemptsError });
    const channelsError = validateChannels(channels);
    if (channelsError) return res.status(400).json({ error: channelsError });
    if (channels) {
        for (const c of channels) {
            const channelAttemptsError = validateAttempts(verification_type, c.points);
            if (channelAttemptsError) return res.status(400).json({ error: `channel ${c.channel}: ${channelAttemptsError}` });
        }
    }

    const auth = await checkPin(username, pin);
    if (!auth.ok) return res.status(401).json({ error: auth.reason });

    const pool = await getPool();
    const result = await insertEntry(pool, {
        pipette_id, balance_id, verification_type, points, channels, note,
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

// Retry history for one entry (ADR-010), grouped for the client's collapsed
// "N attempts" chip per point/channel. Read-only -- attempts lock with the entry
// at sign-off same as everything else (ADR-005), no correction path of their own.
router.get('/entries/:id/attempts', async (req, res) => {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool.request()
        .input('entryId', sql.Int, id)
        .query(`
            SELECT id, point_key, channel, attempt_number, volume_ul, mass_mg, pass_fail, created_at
            FROM entry_point_attempts
            WHERE entry_id = @entryId
            ORDER BY point_key, channel, attempt_number;
        `);

    res.json(result.recordset);
});

// Full per-channel record for a multichannel entry (ADR-011). Empty array for
// single-channel/repeater entries -- their data lives on entries.* directly (ADR-009).
router.get('/entries/:id/channels', async (req, res) => {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool.request()
        .input('entryId', sql.Int, id)
        .query(`
            SELECT id, channel, point_key, volume_ul, mass_mg, pass_fail
            FROM entry_channel_points
            WHERE entry_id = @entryId
            ORDER BY channel, point_key;
        `);

    res.json(result.recordset);
});

module.exports = router;
