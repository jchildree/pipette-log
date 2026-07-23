import NetInfo from '@react-native-community/netinfo';
import { submitEntry } from './api';
import { listQueue, removeFromQueue } from './storage/queue';

export function isOnline(state: { isConnected: boolean | null; isInternetReachable: boolean | null }): boolean {
    return state.isConnected === true && state.isInternetReachable !== false;
}

// Drains the local queue against the API. Each item is a single POST retry --
// never a second auth event (PIN was already validated at time of entry).
// Failures (network or auth) stay queued and are surfaced, never silently dropped.
export async function drainQueue(onError: (message: string) => void): Promise<void> {
    const queue = await listQueue();
    for (const entry of queue) {
        try {
            await submitEntry(entry.payload);
            await removeFromQueue(entry.queueId);
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to sync queued entry');
        }
    }
}

// Subscribes to connectivity changes and drains the queue on the offline->online transition.
export function watchConnectivityAndDrain(onError: (message: string) => void): () => void {
    let wasOnline = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
        const online = isOnline(state);
        if (online && !wasOnline) {
            drainQueue(onError).catch((err) => onError(err instanceof Error ? err.message : 'Queue drain failed'));
        }
        wasOnline = online;
    });
    return unsubscribe;
}
