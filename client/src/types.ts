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
