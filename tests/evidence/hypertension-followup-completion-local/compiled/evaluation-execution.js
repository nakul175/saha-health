import { serviceDispatch } from './service-dispatch.js';
import { AppError, digest, fail, uuid } from './core.js';
import { AGENT_VERSION, providers } from './agent.js';
import { invokeAgent } from './agent-provider.js';
import { authorizeEvaluation, EVALUATION_CASES, scoreEvaluation } from './evaluation.js';
import { entryFor, governanceState } from './governance.js';
import { persist, readState, scope } from './store.js';
import { checkMonthlyBudget } from './ai-budget.js';
import { versionPin } from './ai-version-pin.js';
export async function executeEvaluation(db, s, c, u, m, key, hash, runtime) {
    authorizeEvaluation(s, m, c);
    const ev = governanceState(s).evaluations.find(e => e.id === c.evaluationId);
    const check = (state, member) => { const e = entryFor(state, ev.entryId), p = providers(state.workspace.integrations, runtime).find(x => x.id === ev.provider.id); if (e.manifestHash !== ev.manifestHash || ev.agentVersion !== AGENT_VERSION || member.version !== ev.memberVersion || !p?.available || p.model !== ev.provider.model || p.version !== ev.provider.version)
        fail(409, 'Evaluation scope, authority or provider changed. Prepare a new evaluation.'); };
    check(s, m);
    if (['cancelled', 'completed'].includes(ev.state))
        fail(409, 'Evaluation is closed.');
    const previous = ev.results.find(x => x.caseId === c.caseId);
    if (previous)
        return { evaluationId: ev.id, caseId: c.caseId, state: previous.state };
    if (ev.results.some(r => r.state === 'running'))
        fail(409, 'A case is already running. Refresh or cancel; it will not be resent.');
    if (ev.caseIds[ev.results.length] !== c.caseId)
        fail(409, 'Run the next pending evaluation case.');
    if (ev.corpusHash !== await digest(ev.caseIds.map(id => EVALUATION_CASES.find(x => x.id === id))))
        fail(409, 'Evaluation corpus changed. Prepare a new evaluation.');
    const entry = entryFor(s, ev.entryId);
    checkMonthlyBudget(s, entry);
    const test = EVALUATION_CASES.find(x => x.id === c.caseId);
    if (!test)
        fail(409, 'The evaluation corpus changed.');
    const before = structuredClone(s), startedAt = new Date().toISOString();
    ev.state = 'running';
    ev.version++;
    ev.results.push({ caseId: c.caseId, state: 'running', startedAt });
    s.workspace.audit.push({ id: uuid(), at: startedAt, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: ev.id, detail: 'Synthetic case ' + test.id + ' reserved before provider invocation.' });
    await persist(db, before, s, u, c, key, hash, { evaluationId: ev.id, caseId: c.caseId, state: 'running' });
    // A candidate capability cannot yet carry an approved-evaluation pin: this run
    // creates that evidence. Pin the complete provider and release contract while
    // deliberately leaving the capability binding empty until evaluation passes.
    const run = { id: ev.id + '_' + test.id, task: 'extract', input: test.input, provider: ev.provider, version: AGENT_VERSION, versionPin: versionPin(s, ev.provider, AGENT_VERSION, null), context: { language: test.language, setting: 'community', device: 'browser', jurisdiction: 'IN', connectivity: 'online', inputQuality: 'adequate', intendedUse: 'synthetic-evaluation' } };
    let outcome, error = '';
    const started = performance.now();
    try {
        await serviceDispatch(db, s, u, m, ev.provider.id, null, { intent: 'send', authorize: (latest, member) => { authorizeEvaluation(latest, member, c); check(latest, member); const le = governanceState(latest).evaluations.find(x => x.id === ev.id); if (le?.state !== 'running' || le.results.find(x => x.caseId === test.id)?.state !== 'running')
                fail(409, 'Evaluation checkpoint changed.'); } });
        outcome = await invokeAgent(run, { programmeCapture: { packs: [], answers: {}, absence: {} } }, runtime, s.workspace.integrations);
    }
    catch (e) {
        error = e instanceof AppError ? e.message : 'Provider evaluation unavailable; no automatic retry.';
    }
    for (let n = 0; n < 3; n++) {
        const state = await readState(db, s.organisation.id), old = structuredClone(state), target = governanceState(state).evaluations.find(x => x.id === ev.id);
        if (!target)
            fail(409, 'Evaluation checkpoint unavailable.');
        const row = target.results.find(x => x.caseId === test.id);
        if (row.state !== 'running')
            return { evaluationId: ev.id, caseId: test.id, state: row.state };
        try {
            const member = scope(state, u.userId);
            authorizeEvaluation(state, member, c);
            check(state, member);
            if (target.state === 'cancelled')
                fail(409, 'Evaluation was cancelled; output withheld.');
        }
        catch {
            error = 'Result withheld: evaluation, membership or provider changed.';
        }
        row.state = error ? 'failed' : 'completed';
        row.finishedAt = new Date().toISOString();
        row.latencyMs = Math.round(performance.now() - started);
        if (error)
            row.error = error;
        else {
            row.output = outcome.output;
            row.usage = 'usage' in outcome ? outcome.usage : undefined;
        }
        target.version++;
        if (target.state !== 'cancelled' && target.results.length === target.caseIds.length) {
            target.state = 'completed';
            target.metrics = scoreEvaluation(target.caseIds.map(id => EVALUATION_CASES.find(x => x.id === id)), target.results);
        }
        state.workspace.audit.push({ id: uuid(), at: row.finishedAt, actorId: u.userId, actor: u.displayName, role: m.role, action: 'evaluationResult', subject: ev.id, detail: `Synthetic case ${test.id}: ${row.state}.` });
        try {
            await persist(db, old, state, u, { type: 'evaluationResult' }, 'evaluation_finish_' + ev.id + '_' + test.id, await digest({ manifest: ev.manifestHash, case: test.id }), { evaluationId: ev.id, caseId: test.id, state: row.state });
            return { evaluationId: ev.id, caseId: test.id, state: row.state };
        }
        catch (e) {
            if (!(e instanceof AppError && e.status === 409) || n === 2)
                throw e;
        }
    }
    fail(409, 'Evaluation result unconfirmed. Do not resend the provider call.');
}
