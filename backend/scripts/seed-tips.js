// One-off: load repeater tip reference data from T:\IL\QA Projects\Pipette docs\Simple table.xlsx
// (Repeater Dropdown tab, parsed to tips.json beforehand) into the tips table (ADR-011/ADR-013).
// Not part of the app runtime -- run manually: node scripts/seed-tips.js <path-to-tips.json>
const fs = require('fs');
const { sql, getPool } = require('../src/lib/db');

async function main() {
    const jsonPath = process.argv[2];
    if (!jsonPath) {
        console.error('Usage: node scripts/seed-tips.js <tips.json>');
        process.exit(1);
    }
    const records = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const pool = await getPool();

    let inserted = 0;
    for (const r of records) {
        await pool.request()
            .input('tipId', sql.NVarChar, r.tip_id)
            .input('low', sql.Decimal(10, 3), r.low_ul ?? null)
            .input('mid', sql.Decimal(10, 3), r.mid_ul ?? null)
            .input('high', sql.Decimal(10, 3), r.high_ul ?? null)
            .input('lowUsage', sql.Decimal(10, 3), r.low_usage_ul ?? null)
            .input('unit', sql.NVarChar(4), r.unit ?? null)
            .query(`
                INSERT INTO tips (tip_id, low_ul, mid_ul, high_ul, low_usage_ul, unit)
                VALUES (@tipId, @low, @mid, @high, @lowUsage, @unit)
            `);
        inserted++;
    }
    console.log(`Seeded ${inserted} tip rows.`);
    process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
