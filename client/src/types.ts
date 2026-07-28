export type VerificationType = 'tolerance_3pct' | 'manufacturer_spec' | 'after_external_cal';

export const NOTE_REQUIRED_TYPES: VerificationType[] = ['manufacturer_spec', 'after_external_cal'];

export interface User {
    id: number;
    username: string;
}

export type EquipmentUnit = 'uL' | 'mL';

export interface Balance {
    id: number;
    equipment_type: 'Balance';
    equipment_id: string;
    calibration_due_date: string | null;
}

// Fields beyond id/category/range/low-mid-high/unit/status come from the full
// Joanne's Cleaned Pipette DB import (ADR-013) -- seed-only, no manual edit UI yet.
export interface Pipette {
    id: number;
    equipment_type: 'Pipette';
    equipment_id: string;
    category: string | null;
    pipette_range: string | null;
    calibration_due_date: string | null;
    low_ul: number | null;
    mid_ul: number | null;
    high_ul: number | null;
    low_usage_ul: number | null;
    unit: EquipmentUnit | null;
    status: string | null;
    rack_number: string | null;
    serial_number: string | null;
    sub_location: string | null;
    last_calibration_date: string | null;
    mechanism: string | null;
    calibration_conducted_by: string | null;
    ranges_used: string | null;
    department: string | null;
    manufacturer: string | null;
    old_id: string | null;
    review_comment: string | null;
    adjustment_comment: string | null;
    comments_2: string | null;
}

export interface BalancePayload {
    username: string;
    pin: string;
    equipment_id: string;
    calibration_due_date?: string;
}

export interface PipettePayload {
    username: string;
    pin: string;
    equipment_id: string;
    category?: string;
    pipette_range?: string;
    calibration_due_date?: string;
    low_ul?: number;
    mid_ul?: number;
    high_ul?: number;
    low_usage_ul?: number;
    unit?: EquipmentUnit;
    status?: string;
}

export interface MeasurementPoint {
    volume_ul: number;
    mass_mg: number;
    pass_fail?: 'Y' | 'N'; // manual only, ignored for tolerance_3pct (server computes)
    attempts?: { volume_ul: number; mass_mg: number }[]; // failed retries before this reading, tolerance_3pct only (ADR-010)
}

export type PointKey = 'low' | 'mid' | 'high';

// Repeater tip reference data (ADR-011): selecting a tip drives that entry's
// low/mid/high targets, same pre-fill pattern as a pipette's own reference values.
export interface Tip {
    id: number;
    tip_id: string;
    low_ul: number | null;
    mid_ul: number | null;
    high_ul: number | null;
    low_usage_ul: number | null;
    unit: EquipmentUnit | null;
}

// One multichannel channel's low/mid/high triplet (ADR-011).
export interface ChannelPoints {
    channel: number; // 1-8
    points: Record<PointKey, MeasurementPoint>;
}

export interface EntryPayload {
    username: string;
    pin: string;
    pipette_id: number;
    balance_id: number;
    verification_type: VerificationType;
    points: Record<PointKey, MeasurementPoint>; // channel 1 (or the only channel) -- always required
    channels?: ChannelPoints[]; // present for multichannel pipettes only (ADR-011)
    note?: string;
}

export interface QueuedEntry {
    queueId: string;
    payload: EntryPayload;
    queuedAt: string;
}

// Shape returned by GET /api/entries and /api/entries/:id/history --
// raw entries row plus the joined readable names (list endpoint only).
export interface AuditEntry {
    id: number;
    pipette_id: number;
    balance_id: number;
    verification_type: VerificationType;
    volume_low_ul: number;
    mass_low_mg: number;
    pass_low: 'Y' | 'N' | null;
    volume_mid_ul: number;
    mass_mid_mg: number;
    pass_mid: 'Y' | 'N' | null;
    volume_high_ul: number;
    mass_high_mg: number;
    pass_high: 'Y' | 'N' | null;
    note: string | null;
    signed_by_user_id: number | null;
    signed_at: string | null;
    corrects_entry_id: number | null;
    created_at: string;
    pipette_equipment_id?: string;
    balance_equipment_id?: string;
    signed_by_username?: string;
    corrected?: 0 | 1;
}

export interface AuditListFilters {
    pipette_id?: number;
    balance_id?: number;
    username?: string;
    verification_type?: VerificationType;
    from?: string;
    to?: string;
}
