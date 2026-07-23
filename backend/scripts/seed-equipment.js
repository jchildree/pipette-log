// One-off: load real inventory from T:\IL\QA Projects\Pipette docs\Simple table.xlsx
// (parsed to equipment.json beforehand) into the equipment table. Not part of the
// app runtime -- run manually: node scripts/seed-equipment.js <path-to-equipment.json>
const fs = require('fs');
const { sql, getPool } = require('../src/lib/db');

async function main() {
    const jsonPath = process.argv[2];
    if (!jsonPath) {
        console.error('Usage: node scripts/seed-equipment.js <equipment.json>');
        process.exit(1);
    }
    const records = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const pool = await getPool();

    let inserted = 0;
    for (const r of records) {
        await pool.request()
            .input('type', sql.NVarChar, r.type)
            .input('equipmentId', sql.NVarChar, r.equipmentId)
            .input('category', sql.NVarChar, r.category)
            .input('pipetteRange', sql.NVarChar, r.pipetteRange)
            .input('calDate', sql.Date, r.calDate)
            .input('low', sql.Decimal(10, 3), r.low ? Number(r.low) : null)
            .input('mid', sql.Decimal(10, 3), r.mid ? Number(r.mid) : null)
            .input('high', sql.Decimal(10, 3), r.high ? Number(r.high) : null)
            .query(`
                INSERT INTO equipment (equipment_type, equipment_id, category, pipette_range, calibration_due_date, low_ul, mid_ul, high_ul)
                VALUES (@type, @equipmentId, @category, @pipetteRange, @calDate, @low, @mid, @high)
            `);
        inserted++;
    }
    console.log(`Seeded ${inserted} equipment rows.`);
    process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
