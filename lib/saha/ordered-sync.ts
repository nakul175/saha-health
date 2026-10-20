export type SyncEnvelope<T = unknown> = {
  commandId: string;
  dependencies: string[];
  baseVersion: number;
  localSequence: number;
  payload: T;
};

export type SyncOutcome = 'accepted' | 'rejected' | 'unresolved' | 'dependency-pending';

export type SyncResult = {
  commandId: string;
  outcome: SyncOutcome;
  completedAt?: string;
  reason?: string;
};

type Stored<T> = { envelope: SyncEnvelope<T>; result?: SyncResult };

export type SyncExecutor<T> = (envelope: Readonly<SyncEnvelope<T>>) => Promise<void>;
export type SyncAuthorizer<T> = (envelope: Readonly<SyncEnvelope<T>>) => Promise<boolean>;

/**
 * A bounded, in-memory projection of the encrypted device queue. Persistence is
 * deliberately owned by the caller: export() returns every envelope and its
 * last result so a reconnect can restore the same stable command identities.
 */
export class OrderedSyncQueue<T = unknown> {
  readonly #items = new Map<string, Stored<T>>();
  #running?: Promise<SyncResult[]>;

  constructor(items: Array<{ envelope: SyncEnvelope<T>; result?: SyncResult }> = []) {
    for (const item of items) this.enqueue(item.envelope, item.result);
  }

  enqueue(envelope: SyncEnvelope<T>, result?: SyncResult) {
    assertEnvelope(envelope);
    const prior = this.#items.get(envelope.commandId);
    if (prior) {
      if (JSON.stringify(prior.envelope) !== JSON.stringify(envelope)) {
        throw new Error(`Command ${envelope.commandId} cannot be reused with different content.`);
      }
      return;
    }
    if ([...this.#items.values()].some(item => item.envelope.localSequence === envelope.localSequence)) {
      throw new Error(`Local sequence ${envelope.localSequence} is already in use.`);
    }
    if (result && result.commandId !== envelope.commandId) throw new Error('Result command ID does not match its envelope.');
    this.#items.set(envelope.commandId, { envelope: structuredClone(envelope), result: result && structuredClone(result) });
  }

  export() {
    return [...this.#items.values()]
      .sort((a, b) => a.envelope.localSequence - b.envelope.localSequence)
      .map(item => structuredClone(item));
  }

  async recover(authorize: SyncAuthorizer<T>, execute: SyncExecutor<T>, now = () => new Date().toISOString()) {
    if (this.#running) return this.#running;
    this.#running = this.#recover(authorize, execute, now).finally(() => { this.#running = undefined; });
    return this.#running;
  }

  async #recover(authorize: SyncAuthorizer<T>, execute: SyncExecutor<T>, now: () => string) {
    const ordered = [...this.#items.values()].sort((a, b) => a.envelope.localSequence - b.envelope.localSequence);
    const known = new Set(ordered.map(item => item.envelope.commandId));
    let progressed = true;

    while (progressed) {
      progressed = false;
      for (const item of ordered) {
        if (item.result?.outcome === 'accepted' || item.result?.outcome === 'rejected') continue;
        const missing = item.envelope.dependencies.filter(id => !known.has(id));
        if (missing.length) {
          item.result = { commandId: item.envelope.commandId, outcome: 'unresolved', reason: `Missing dependencies: ${missing.join(', ')}` };
          continue;
        }
        const pending = item.envelope.dependencies.filter(id => this.#items.get(id)?.result?.outcome !== 'accepted');
        if (pending.length) {
          item.result = { commandId: item.envelope.commandId, outcome: 'dependency-pending', reason: `Pending dependencies: ${pending.join(', ')}` };
          continue;
        }
        if (!await authorize(item.envelope)) {
          item.result = { commandId: item.envelope.commandId, outcome: 'rejected', reason: 'Current authority refused the command.' };
          progressed = true;
          continue;
        }
        try {
          await execute(item.envelope);
          item.result = { commandId: item.envelope.commandId, outcome: 'accepted', completedAt: now() };
          progressed = true;
        } catch (error) {
          item.result = { commandId: item.envelope.commandId, outcome: 'unresolved', reason: error instanceof Error ? error.message : 'Transport outcome is unknown.' };
        }
      }
    }
    return ordered.map(item => structuredClone(item.result ?? {
      commandId: item.envelope.commandId,
      outcome: 'unresolved' as const,
      reason: 'No terminal result was recorded.',
    }));
  }
}

export function eligibleArrivalP95(startedAtMs: number, completedAtMs: number[]) {
  if (!Number.isFinite(startedAtMs) || !completedAtMs.length || completedAtMs.some(value => !Number.isFinite(value) || value < startedAtMs)) {
    throw new Error('Arrival measurements must be finite completion times after the start.');
  }
  const durations = completedAtMs.map(value => value - startedAtMs).sort((a, b) => a - b);
  return durations[Math.ceil(durations.length * 0.95) - 1];
}

function assertEnvelope<T>(envelope: SyncEnvelope<T>) {
  if (!envelope.commandId.trim()) throw new Error('Command ID is required.');
  if (!Number.isSafeInteger(envelope.baseVersion) || envelope.baseVersion < 0) throw new Error('Base version must be a non-negative integer.');
  if (!Number.isSafeInteger(envelope.localSequence) || envelope.localSequence < 1) throw new Error('Local sequence must be a positive integer.');
  if (new Set(envelope.dependencies).size !== envelope.dependencies.length || envelope.dependencies.includes(envelope.commandId)) {
    throw new Error('Dependencies must be unique and cannot include the command itself.');
  }
}
