// One-off: rebuild scripts/equipment.json from the source workbook
// (T:\IL\QA Projects\Pipette docs\Simple table.xlsx). Not part of app runtime.
// Run: node scripts/xlsx-to-equipment-json.js <path-to-xlsx> <output-json>
//
// Merge rule (reverse-engineered, no original script exists in history --
// review output before seeding a real DB):
//   - "EQP" sheet: authoritative for low/mid/high/low_usage targets. Balances
//     only ever appear here (calibration_due_date only, no other fields).
//   - "Joanne's Cleaned Pipette DB" sheet: authoritative for rack/serial/
//     location/status/mechanism/etc. metadata. Rows not present in EQP get
//     null low/mid/high/low_usage/unit rather than a guessed default.
//   - Row present in both: EQP wins for category/pipette_range/
//     calibration_due_date (it's the smaller, more curated sheet); Joanne's
//     sheet fills in everything EQP doesn't have.
//   - unit: no unit column in either sheet -- inferred from pipette_range
//     text (whichever sheet supplied it), 'mL' if it contains "mL"
//     anywhere, else 'uL'. Display-only per ADR-013, not enforced.
const XLSX = require('xlsx');
const fs = require('fs');

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
function serialToISODate(serial) {
    if (serial === null || serial === undefined || serial === '') return null;
    if (typeof serial !== 'number') return null;
    return new Date(EXCEL_EPOCH_MS + serial * 86400000).toISOString().slice(0, 10);
}

function inferUnit(range) {
    if (!range) return null;
    return /mL/i.test(range) ? 'mL' : 'uL';
}

function main() {
    const xlsxPath = process.argv[2];
    const outPath = process.argv[3];
    if (!xlsxPath || !outPath) {
        console.error('Usage: node scripts/xlsx-to-equipment-json.js <xlsx> <out.json>');
        process.exit(1);
    }

    const wb = XLSX.readFile(xlsxPath);
    const eqpRows = XLSX.utils.sheet_to_json(wb.Sheets['EQP'], { defval: null });
    const joanneRows = XLSX.utils.sheet_to_json(wb.Sheets["Joanne's Cleaned Pipette DB"], { defval: null });

    const eqpById = new Map(eqpRows.map((r) => [r['Equiptment ID'], r]));
    const joanneById = new Map(joanneRows.map((r) => [r['ID'], r]));

    const ids = new Set([...eqpById.keys(), ...joanneById.keys()]);
    const records = [];

    for (const id of ids) {
        const eqp = eqpById.get(id);
        const joanne = joanneById.get(id);
        const isBalance = id.startsWith('BAL');

        if (isBalance) {
            records.push({
                equipment_type: 'Balance',
                equipment_id: id,
                calibration_due_date: serialToISODate(eqp?.['Calibration Due Date']),
            });
            continue;
        }

        const category = (eqp?.['Pipette Type'] ?? joanne?.['Pipette Type'] ?? null)?.toLowerCase() ?? null;
        const pipetteRange = eqp?.['Pipette Range'] ?? joanne?.['Pipette Range'] ?? null;
        const calDate = serialToISODate(eqp?.['Calibration Due Date'] ?? joanne?.['Calibration Due Date']);

        records.push({
            equipment_type: 'Pipette',
            equipment_id: id,
            category,
            pipette_range: pipetteRange,
            calibration_due_date: calDate,
            low_ul: eqp?.['Low'] ?? null,
            mid_ul: eqp?.['Mid'] ?? null,
            high_ul: eqp?.['High'] ?? null,
            low_usage_ul: eqp?.['Low usage'] ?? null,
            unit: inferUnit(pipetteRange),
            status: joanne?.['Status'] ?? null,
            rack_number: joanne?.['Rack Number'] ?? null,
            serial_number: joanne?.['Serial Number'] ?? null,
            sub_location: joanne?.['Sub Location'] ?? null,
            last_calibration_date: serialToISODate(joanne?.['Last Calibration']),
            mechanism: joanne?.['Mechanism'] ?? null,
            calibration_conducted_by: joanne?.['Calibration Conducted By'] ?? null,
            ranges_used: joanne?.['Ranges Used'] ?? null,
            department: joanne?.['Department'] ?? null,
            manufacturer: joanne?.['Manufacturer'] ?? null,
            old_id: joanne?.['Old ID #'] ?? null,
            review_comment: joanne?.['Review During Calibration Cycle'] ?? null,
            adjustment_comment: joanne?.['Adjustments or Comments During Calibration Cycle'] ?? null,
            comments_2: joanne?.['Comments 2'] || null,
        });
    }

    records.sort((a, b) => a.equipment_id.localeCompare(b.equipment_id));
    fs.writeFileSync(outPath, JSON.stringify(records, null, 2));
    console.log(`Wrote ${records.length} records to ${outPath}`);
    console.log(`  Balances: ${records.filter((r) => r.equipment_type === 'Balance').length}`);
    console.log(`  Pipettes: ${records.filter((r) => r.equipment_type === 'Pipette').length}`);
    console.log(`  Pipettes missing EQP targets (low/mid/high null): ${records.filter((r) => r.equipment_type === 'Pipette' && r.low_ul === null && r.mid_ul === null && r.high_ul === null).length}`);
}

main();
