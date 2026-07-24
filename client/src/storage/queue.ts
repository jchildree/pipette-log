import type { EntryPayload, QueuedEntry } from '../types';

const QUEUE_KEY = 'pipette-log:entry-queue';

function readQueue(): QueuedEntry[] {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
}

function writeQueue(queue: QueuedEntry[]): void {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// Entry is already signed (username+PIN captured) at time of entry -- queueing
// never re-prompts for auth. Drain (see network.ts) is a plain retry of the POST.
export function enqueueEntry(payload: EntryPayload): void {
    const queue = readQueue();
    queue.push({ queueId: `${Date.now()}-${Math.random().toString(36).slice(2)}`, payload, queuedAt: new Date().toISOString() });
    writeQueue(queue);
}

export function listQueue(): QueuedEntry[] {
    return readQueue();
}

export function removeFromQueue(queueId: string): void {
    writeQueue(readQueue().filter((entry) => entry.queueId !== queueId));
}
