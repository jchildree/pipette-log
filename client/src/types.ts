export type VerificationType = 'tolerance_3pct' | 'manufacturer_spec' | 'after_external_cal';

export const NOTE_REQUIRED_TYPES: VerificationType[] = ['manufacturer_spec', 'after_external_cal'];

export interface User {
    id: number;
    username: string;
}

export interface Balance {
    id: number;
    equipment_type: 'Balance';
    equipment_id: string;
    calibration_due_date: string | null;
}

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
}

export interface MeasurementPoint {
    volume_ul: number;
    mass_mg: number;
    pass_fail?: 'Y' | 'N'; // manual only, ignored for tolerance_3pct (server computes)
}

export type PointKey = 'low' | 'mid' | 'high';

export interface EntryPayload {
    username: string;
    pin: string;
    pipette_id: number;
    balance_id: number;
    verification_type: VerificationType;
    points: Record<PointKey, MeasurementPoint>;
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
