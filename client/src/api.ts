import { AuditEntry, AuditListFilters, Balance, EntryPayload, Pipette, User } from './types';

// Set via app.json "extra.apiUrl" or EXPO_PUBLIC_API_URL env var at build time.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

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
export const fetchBalances = () => apiFetch<Balance[]>('/balances');
export const fetchPipettes = () => apiFetch<Pipette[]>('/pipettes');

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
