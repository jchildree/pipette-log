import AsyncStorage from '@react-native-async-storage/async-storage';
import { EntryPayload, QueuedEntry } from '../types';

const QUEUE_KEY = 'pipette-log:entry-queue';

async function readQueue(): Promise<QueuedEntry[]> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
}

async function writeQueue(queue: QueuedEntry[]): Promise<void> {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// Entry is already signed (username+PIN captured) at time of entry -- queueing
// never re-prompts for auth. Drain (see network.ts) is a plain retry of the POST.
export async function enqueueEntry(payload: EntryPayload): Promise<void> {
    const queue = await readQueue();
    queue.push({ queueId: `${Date.now()}-${Math.random().toString(36).slice(2)}`, payload, queuedAt: new Date().toISOString() });
    await writeQueue(queue);
}

export async function listQueue(): Promise<QueuedEntry[]> {
    return readQueue();
}

export async function removeFromQueue(queueId: string): Promise<void> {
    const queue = await readQueue();
    await writeQueue(queue.filter((entry) => entry.queueId !== queueId));
}
