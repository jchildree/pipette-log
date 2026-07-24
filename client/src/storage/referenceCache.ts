import type { Balance, Pipette, Tip, User } from '../types';

const KEYS = {
    users: 'pipette-log:cache:users',
    balances: 'pipette-log:cache:balances',
    pipettes: 'pipette-log:cache:pipettes',
    tips: 'pipette-log:cache:tips',
} as const;

function readCache<T>(key: string): T[] {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
}

// Reference-data staleness UX is an open ADR-002 item, out of scope for phase 1 --
// this cache is last-fetch-wins with no freshness indicator shown to the user.
export const getCachedUsers = () => readCache<User>(KEYS.users);
export const setCachedUsers = (users: User[]) => localStorage.setItem(KEYS.users, JSON.stringify(users));

export const getCachedBalances = () => readCache<Balance>(KEYS.balances);
export const setCachedBalances = (balances: Balance[]) => localStorage.setItem(KEYS.balances, JSON.stringify(balances));

export const getCachedPipettes = () => readCache<Pipette>(KEYS.pipettes);
export const setCachedPipettes = (pipettes: Pipette[]) => localStorage.setItem(KEYS.pipettes, JSON.stringify(pipettes));

export const getCachedTips = () => readCache<Tip>(KEYS.tips);
export const setCachedTips = (tips: Tip[]) => localStorage.setItem(KEYS.tips, JSON.stringify(tips));
