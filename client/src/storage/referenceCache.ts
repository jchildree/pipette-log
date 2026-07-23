import AsyncStorage from '@react-native-async-storage/async-storage';
import { Balance, Pipette, User } from '../types';

const KEYS = { users: 'pipette-log:cache:users', balances: 'pipette-log:cache:balances', pipettes: 'pipette-log:cache:pipettes' } as const;

async function readCache<T>(key: string): Promise<T[]> {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
}

// Reference-data staleness UX is an open ADR-002 item, out of scope for phase 1 --
// this cache is last-fetch-wins with no freshness indicator shown to the user.
export const getCachedUsers = () => readCache<User>(KEYS.users);
export const setCachedUsers = (users: User[]) => AsyncStorage.setItem(KEYS.users, JSON.stringify(users));

export const getCachedBalances = () => readCache<Balance>(KEYS.balances);
export const setCachedBalances = (balances: Balance[]) => AsyncStorage.setItem(KEYS.balances, JSON.stringify(balances));

export const getCachedPipettes = () => readCache<Pipette>(KEYS.pipettes);
export const setCachedPipettes = (pipettes: Pipette[]) => AsyncStorage.setItem(KEYS.pipettes, JSON.stringify(pipettes));
