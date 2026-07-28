// One-off: load real inventory from T:\IL\QA Projects\Pipette docs\Simple table.xlsx
// (parsed to equipment.json beforehand) into the equipment table. Not part of the
// app runtime -- run manually: node scripts/seed-equipment.js <path-to-equipment.json>
//
// Upserts by equipment_id (MERGE) rather than blind INSERT -- entries.pipette_id/
// balance_id FK equipment.id, so a wipe-and-reinsert would orphan any existing
// signed entries. Matching rows get their fields updated in place; unmatched
// equipment_ids get inserted as new rows. Existing rows not present in the
// source file are left untouched (never deleted).
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

    let upserted = 0;
    for (const r of records) {
        await pool.request()
            .input('type', sql.NVarChar, r.equipment_type)
            .input('equipmentId', sql.NVarChar, r.equipment_id)
            .input('category', sql.NVarChar, r.category ?? null)
            .input('pipetteRange', sql.NVarChar, r.pipette_range ?? null)
            .input('calDate', sql.Date, r.calibration_due_date ?? null)
            .input('low', sql.Decimal(10, 3), r.low_ul ?? null)
            .input('mid', sql.Decimal(10, 3), r.mid_ul ?? null)
            .input('high', sql.Decimal(10, 3), r.high_ul ?? null)
            .input('lowUsage', sql.Decimal(10, 3), r.low_usage_ul ?? null)
            .input('unit', sql.NVarChar(4), r.unit ?? null)
            .input('status', sql.NVarChar, r.status ?? null)
            .input('rackNumber', sql.NVarChar, r.rack_number ?? null)
            .input('serialNumber', sql.NVarChar, r.serial_number ?? null)
            .input('subLocation', sql.NVarChar, r.sub_location ?? null)
            .input('lastCalDate', sql.Date, r.last_calibration_date ?? null)
            .input('mechanism', sql.NVarChar, r.mechanism ?? null)
            .input('calConductedBy', sql.NVarChar, r.calibration_conducted_by ?? null)
            .input('rangesUsed', sql.NVarChar, r.ranges_used ?? null)
            .input('department', sql.NVarChar, r.department ?? null)
            .input('manufacturer', sql.NVarChar, r.manufacturer ?? null)
            .input('oldId', sql.NVarChar, r.old_id ?? null)
            .input('reviewComment', sql.NVarChar, r.review_comment ?? null)
            .input('adjustmentComment', sql.NVarChar, r.adjustment_comment ?? null)
            .input('comments2', sql.NVarChar, r.comments_2 ?? null)
            .query(`
                MERGE equipment AS target
                USING (SELECT @equipmentId AS equipment_id) AS src
                    ON target.equipment_id = src.equipment_id
                WHEN MATCHED THEN UPDATE SET
                    equipment_type = @type, category = @category, pipette_range = @pipetteRange,
                    calibration_due_date = @calDate, low_ul = @low, mid_ul = @mid, high_ul = @high,
                    low_usage_ul = @lowUsage, unit = @unit, status = @status,
                    rack_number = @rackNumber, serial_number = @serialNumber, sub_location = @subLocation,
                    last_calibration_date = @lastCalDate, mechanism = @mechanism,
                    calibration_conducted_by = @calConductedBy, ranges_used = @rangesUsed,
                    department = @department, manufacturer = @manufacturer, old_id = @oldId,
                    review_comment = @reviewComment, adjustment_comment = @adjustmentComment, comments_2 = @comments2
                WHEN NOT MATCHED THEN INSERT (
                    equipment_type, equipment_id, category, pipette_range, calibration_due_date,
                    low_ul, mid_ul, high_ul, low_usage_ul, unit, status,
                    rack_number, serial_number, sub_location, last_calibration_date, mechanism,
                    calibration_conducted_by, ranges_used, department, manufacturer, old_id,
                    review_comment, adjustment_comment, comments_2
                ) VALUES (
                    @type, @equipmentId, @category, @pipetteRange, @calDate,
                    @low, @mid, @high, @lowUsage, @unit, @status,
                    @rackNumber, @serialNumber, @subLocation, @lastCalDate, @mechanism,
                    @calConductedBy, @rangesUsed, @department, @manufacturer, @oldId,
                    @reviewComment, @adjustmentComment, @comments2
                );
            `);
        upserted++;
    }
    console.log(`Upserted ${upserted} equipment rows.`);
    process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
