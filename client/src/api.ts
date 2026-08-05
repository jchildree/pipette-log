import type { AdminCredentials, AuditEntry, AuditListFilters, Balance, BalancePayload, CorrectionPayload, EntryPayload, EquipmentPatchPayload, FullUser, Pipette, PipettePayload, Tip, User } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}/api${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? body.error ?? `Request failed: ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
}

export const fetchUsers = () => apiFetch<User[]>('/users');
export const setupUser = (payload: { username: string; pin: string; is_admin?: boolean } & Partial<AdminCredentials>) =>
    apiFetch<void>('/users/setup', { method: 'POST', body: JSON.stringify(payload) });

export const fetchAllUsers = (creds: AdminCredentials) =>
    apiFetch<FullUser[]>('/users/list', { method: 'POST', body: JSON.stringify(creds) });

export const updateUser = (id: number, payload: { is_admin?: boolean; is_active?: boolean; unlock?: boolean } & AdminCredentials) =>
    apiFetch<FullUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const fetchBalances = () => apiFetch<Balance[]>('/balances');
export const fetchPipettes = () => apiFetch<Pipette[]>('/pipettes');
export const fetchTips = () => apiFetch<Tip[]>('/tips');

export const addBalance = (payload: BalancePayload) =>
    apiFetch<Balance>('/balances', { method: 'POST', body: JSON.stringify(payload) });

export const addPipette = (payload: PipettePayload) =>
    apiFetch<Pipette>('/pipettes', { method: 'POST', body: JSON.stringify(payload) });

export const updateEquipment = (id: number, payload: EquipmentPatchPayload) =>
    apiFetch<Pipette | Balance>(`/equipment/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const deleteEquipment = (id: number, creds: AdminCredentials) =>
    apiFetch<void>(`/equipment/${id}`, { method: 'DELETE', body: JSON.stringify(creds) });

export const submitEntry = (payload: EntryPayload) =>
    apiFetch<{ id: number; signed_at: string; out_of_service: ('pipette' | 'balance')[] }>('/entries', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

export const fetchEntries = (filters: AuditListFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
    });
    const query = params.toString();
    return apiFetch<AuditEntry[]>(`/entries${query ? `?${query}` : ''}`);
};

export const fetchEntryHistory = (id: number) => apiFetch<AuditEntry[]>(`/entries/${id}/history`);

export const fetchLatestEntry = (equipmentId: number) => apiFetch<AuditEntry | null>(`/entries/latest/${equipmentId}`);

export const correctEntry = (id: number, payload: CorrectionPayload) =>
    apiFetch<AuditEntry>(`/entries/${id}/correct`, { method: 'POST', body: JSON.stringify(payload) });
