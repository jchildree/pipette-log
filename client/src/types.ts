export type VerificationType = 'tolerance_3pct' | 'manufacturer_spec' | 'after_external_cal';

export const NOTE_REQUIRED_TYPES: VerificationType[] = ['manufacturer_spec', 'after_external_cal'];

export interface User {
    id: number;
    username: string;
}

export interface Balance {
    id: number;
    name: string;
    location: string | null;
}

export interface Pipette {
    id: number;
    pipette_number: string;
    min_range: number;
    max_range: number;
}

export interface EntryPayload {
    username: string;
    pin: string;
    pipette_id: number;
    balance_id: number;
    verification_type: VerificationType;
    volume_ul: number;
    mass_mg: number;
    note?: string;
    pass_fail?: 'Y' | 'N';
}

export interface QueuedEntry {
    queueId: string;
    payload: EntryPayload;
    queuedAt: string;
}
