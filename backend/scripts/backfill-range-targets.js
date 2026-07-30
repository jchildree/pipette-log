// One-off: derive low_ul/mid_ul/high_ul for pipettes whose EQP sheet row never
// had them, from their free-text pipette_range instead. Not part of the app
// runtime. Dry-run by default (prints the proposed table, writes nothing);
// pass --apply to actually update the DB.
//
// Rule (stakeholder-specified):
//   - 2 numbers in the range ("10-100 uL"): low = min, high = max,
//     mid = high / 2 (NOT the average of low/high).
//   - 1 number ("100 uL"): if that value is >10 uL (canonical), it's the max
//     -- low = 1, mid = value / 2, high = value. If <=10 uL, it's read as the
//     low bound instead -- low = value, mid/high stay null (not derivable).
//   - Units: each number keeps its own unit if the text gives one ("1 uL- 10
//     mL" is genuinely mixed); a number with no unit inherits the nearest
//     unit later in the string; with no unit anywhere, defaults to uL.
const { sql, getPool } = require('../src/lib/db');

function unitFactor(token) {
    if (!token) return null;
    const t = token.toLowerCase().replace(/[^a-zµ]/g, '');
    if (t === 'ml') return 1000;
    if (t === 'ul' || t === 'mcl' || t === 'µl' || t === 'u') return 1;
    return null;
}

function extractNumbers(rangeText) {
    const matches = [...rangeText.matchAll(/(\d+(?:\.\d+)?)\s*(µl|ul|mcl|ml)?/gi)];
    const nums = matches.map((m) => ({ value: Number(m[1]), unitToken: m[2] ?? null }));
    // forward-fill missing units from the next number that has one; default uL.
    for (let i = nums.length - 1; i >= 0; i--) {
        if (!nums[i].unitToken && i + 1 < nums.length) nums[i].unitToken = nums[i + 1].unitToken;
    }
    return nums.map((n) => ({ ...n, canonicalUl: n.value * (unitFactor(n.unitToken) ?? 1) }));
}

function deriveTargets(rangeText) {
    if (!rangeText) return { low: null, mid: null, high: null };
    const nums = extractNumbers(rangeText);
    if (nums.length === 0) return { low: null, mid: null, high: null };

    if (nums.length === 1) {
        const value = nums[0].canonicalUl;
        if (value <= 10) return { low: value, mid: null, high: null };
        return { low: 1, mid: value / 2, high: value };
    }

    let [a, b] = [nums[0].canonicalUl, nums[1].canonicalUl];
    if (a > b) [a, b] = [b, a];
    return { low: a, mid: b / 2, high: b };
}

async function main() {
    const apply = process.argv.includes('--apply');
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT id, equipment_id, pipette_range FROM equipment
        WHERE equipment_type = 'Pipette' AND low_ul IS NULL AND mid_ul IS NULL AND high_ul IS NULL AND pipette_range IS NOT NULL
        ORDER BY equipment_id
    `);

    const rows = result.recordset.map((r) => ({ ...r, targets: deriveTargets(r.pipette_range) }));

    console.log(`${rows.length} pipettes with a range but no targets:\n`);
    for (const r of rows) {
        console.log(`${r.equipment_id.padEnd(10)} "${r.pipette_range}" -> low=${r.targets.low ?? 'null'} mid=${r.targets.mid ?? 'null'} high=${r.targets.high ?? 'null'} (uL)`);
    }

    if (!apply) {
        console.log('\nDry run only -- rerun with --apply to write these values.');
        process.exit(0);
    }

    let updated = 0;
    for (const r of rows) {
        if (r.targets.low === null && r.targets.mid === null && r.targets.high === null) continue;
        await pool.request()
            .input('id', sql.Int, r.id)
            .input('low', sql.Decimal(10, 3), r.targets.low)
            .input('mid', sql.Decimal(10, 3), r.targets.mid)
            .input('high', sql.Decimal(10, 3), r.targets.high)
            .query('UPDATE equipment SET low_ul = @low, mid_ul = @mid, high_ul = @high WHERE id = @id');
        updated++;
    }
    console.log(`\nUpdated ${updated} rows.`);
    process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
