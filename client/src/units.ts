import type { EquipmentUnit } from './types';

// ADR-013: canonical storage/calc stay uL/mg everywhere; `unit` only changes what
// the tech sees -- converted at this boundary. Shared by SignOffForm and AuditLog.
export const UNIT_FACTOR: Record<EquipmentUnit, number> = { uL: 1, mL: 1000 };

export function toDisplay(canonicalUl: string, unit: EquipmentUnit): string {
    if (canonicalUl === '') return '';
    const n = Number(canonicalUl);
    if (Number.isNaN(n)) return canonicalUl;
    const factor = UNIT_FACTOR[unit];
    return factor === 1 ? canonicalUl : String(n / factor);
}

export function toCanonical(displayValue: string, unit: EquipmentUnit): string {
    if (displayValue === '') return '';
    const n = Number(displayValue);
    if (Number.isNaN(n)) return displayValue;
    const factor = UNIT_FACTOR[unit];
    return factor === 1 ? displayValue : String(n * factor);
}
