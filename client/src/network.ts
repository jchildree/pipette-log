import { submitEntry } from './api';
import { listQueue, removeFromQueue } from './storage/queue';

export const isOnline = () => navigator.onLine;

// Drains the local queue against the API. Each item is a single POST retry --
// never a second auth event (PIN was already validated at time of entry).
// Failures (network or auth) stay queued and are surfaced, never silently dropped.
export async function drainQueue(onError: (message: string) => void): Promise<void> {
    for (const entry of listQueue()) {
        try {
            await submitEntry(entry.payload);
            removeFromQueue(entry.queueId);
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to sync queued entry');
        }
    }
}

// Subscribes to connectivity changes and drains the queue on the offline->online transition.
export function watchConnectivityAndDrain(onError: (message: string) => void): () => void {
    const handleOnline = () => {
        drainQueue(onError).catch((err) => onError(err instanceof Error ? err.message : 'Queue drain failed'));
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
}
