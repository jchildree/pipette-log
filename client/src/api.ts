import type { AuditEntry, AuditListFilters, Balance, BalancePayload, EntryPayload, Pipette, PipettePayload, Tip, User } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}/api${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed: ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
}

export const fetchUsers = () => apiFetch<User[]>('/users');
export const setupUser = (payload: { username: string; pin: string }) =>
    apiFetch<void>('/users/setup', { method: 'POST', body: JSON.stringify(payload) });
export const fetchBalances = () => apiFetch<Balance[]>('/balances');
export const fetchPipettes = () => apiFetch<Pipette[]>('/pipettes');
export const fetchTips = () => apiFetch<Tip[]>('/tips');

export const addBalance = (payload: BalancePayload) =>
    apiFetch<Balance>('/balances', { method: 'POST', body: JSON.stringify(payload) });

export const addPipette = (payload: PipettePayload) =>
    apiFetch<Pipette>('/pipettes', { method: 'POST', body: JSON.stringify(payload) });

export const submitEntry = (payload: EntryPayload) =>
    apiFetch<{ id: number; signed_at: string }>('/entries', {
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
