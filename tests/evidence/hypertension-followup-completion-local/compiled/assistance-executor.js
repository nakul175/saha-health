// Counters are executor-owned. Provider/model output cannot raise the reviewed bounds.
export class AssistanceLimiter {
    limits;
    now;
    cancelled;
    started;
    steps = 0;
    toolCalls = 0;
    retries = 0;
    actions = [];
    stopped = null;
    constructor(limits, now = Date.now, cancelled = () => false) {
        this.limits = limits;
        this.now = now;
        this.cancelled = cancelled;
        this.started = now();
    }
    deadline() { return (this.limits?.timeMinutes ?? 15) * 60000; }
    stop(reason) { this.stopped ??= reason; return this.snapshot(); }
    beforeStep() { if (this.cancelled())
        return this.stop('cancelled'); if (this.now() - this.started >= this.deadline())
        return this.stop('deadline'); if (this.steps >= (this.limits?.steps ?? 1))
        return this.stop('step-limit'); this.steps++; return null; }
    beforeToolCall() { if (this.cancelled())
        return this.stop('cancelled'); if (this.toolCalls >= (this.limits?.toolCalls ?? 0))
        return this.stop('tool-call-limit'); this.toolCalls++; return null; }
    beforeRetry() { if (this.cancelled())
        return this.stop('cancelled'); if (this.retries >= (this.limits?.retries ?? 0))
        return this.stop('retry-limit'); this.retries++; return null; }
    record(id, state, detail, externallyAccepted = false) { if (!id.trim() || !detail.trim())
        throw Error('Action evidence requires an identifier and detail.'); this.actions.push({ id, state, detail, externallyAccepted }); }
    finish() { return this.stop(this.cancelled() ? 'cancelled' : 'completed'); }
    snapshot() { return { reason: this.stopped ?? 'completed', steps: this.steps, toolCalls: this.toolCalls, retries: this.retries, actions: this.actions.map(x => ({ ...x })) }; }
}
