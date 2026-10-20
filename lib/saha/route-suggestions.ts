import { z } from 'zod';
import { allowed } from './access';
import { fail, uuid } from './core';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';

const id = z.string().trim().min(1).max(200);
const ids = z.array(id).min(1, 'Choose at least one assigned task.').max(25, 'A route suggestion holds at most 25 tasks.').refine(x => new Set(x).size === x.length, 'Choose each task once.');
const reason = z.string().trim().min(5, 'Write at least 5 characters.').max(500);
const expectedVersion = z.number().int().positive();
export const ROUTE_SUGGESTION_BYTES = 200_000;

export const routeSuggestionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('routeSuggestionCreate'), personIds: ids }).strict(),
  z.object({ type: z.literal('routeSuggestionReorder'), suggestionId: id, expectedVersion, personIds: ids }).strict(),
  z.object({ type: z.literal('routeSuggestionOverride'), suggestionId: id, expectedVersion, personIds: ids, reason }).strict(),
  z.object({ type: z.literal('routeSuggestionDecline'), suggestionId: id, expectedVersion, reason }).strict(),
]);
export type RouteSuggestionTask = { personId: string; personVersion: number };
export type RouteSuggestion = { id: string; workerId: string; workerMembershipVersion: number; version: number; state: 'active' | 'declined'; strategy: 'due-locality-local-v1'; tasks: RouteSuggestionTask[]; createdAt: string; updatedAt: string; history: { at: string; by: string; action: 'created' | 'reordered' | 'overridden' | 'declined'; reason?: string }[] };
export type RouteSuggestionState = { version: number; entries: RouteSuggestion[] };
type RouteOperations = NonNullable<OrgState['operations']> & { routeSuggestions?: RouteSuggestionState };

const TYPES: ReadonlySet<string> = new Set(routeSuggestionSchema.options.map(x => x.shape.type.value));
const commandType = (input: unknown): string | null => {
  if (!input || typeof input !== 'object' || !('type' in input)) return null;
  return typeof input.type === 'string' ? input.type : null;
};
const routeState = (s: OrgState): RouteSuggestionState => ((s.operations as RouteOperations | undefined)?.routeSuggestions ?? { version: 0, entries: [] });
const routePerson = (s: OrgState, m: Member, personId: string, now: string): Person => {
  const p = s.workspace.people.find(x => x.id === personId);
  if (!p || !allowed(m, p, now) || p.assignedTo !== m.userId || p.status === 'completed' || !!p.mergedInto) fail(403, 'Choose current assigned work that is available in your care scope.');
  return p;
};
const suggestion = (s: OrgState, m: Member, suggestionId: string) => {
  const value = routeState(s).entries.find(x => x.id === suggestionId && x.workerId === m.userId);
  if (!value) fail(404, 'Route suggestion not found in your current work.');
  return value;
};
const asRefs = (people: Person[]): RouteSuggestionTask[] => people.map(p => ({ personId: p.id, personVersion: p.version }));
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every(x => b.includes(x));
const routeOrder = (people: Person[]) => [...people].sort((a, b) => a.due.localeCompare(b.due) || a.village.trim().localeCompare(b.village.trim()) || a.id.localeCompare(b.id));
function careWorker(m: Member) { if (m.status !== 'active' || m.role !== 'asha') fail(403, 'Only a current ASHA worker can manage route suggestions for her assigned work.'); }

export function authorizeRouteSuggestion(s: OrgState, m: Member, input: unknown, now = new Date().toISOString()) {
  const type = commandType(input);
  if (!type || !TYPES.has(type)) return;
  careWorker(m);
  const parsed = routeSuggestionSchema.safeParse(input);
  if (!parsed.success) fail(422, parsed.error.issues[0]?.message ?? 'Check the route suggestion.');
  const c = parsed.data;
  if (c.type === 'routeSuggestionCreate') { for (const personId of c.personIds) routePerson(s, m, personId, now); return; }
  const current = suggestion(s, m, c.suggestionId);
  if (current.workerMembershipVersion !== m.version) fail(409, 'Your care assignment authority changed. Start a new route suggestion from your current work.');
  if (c.type !== 'routeSuggestionDecline') for (const personId of c.personIds) routePerson(s, m, personId, now);
}

function saveRouteState(s: OrgState, next: RouteSuggestionState) {
  const existing = s.operations ?? { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null };
  const projected = { ...existing, routeSuggestions: next };
  const routeBytes = new TextEncoder().encode(JSON.stringify(next)).length;
  if (routeBytes > ROUTE_SUGGESTION_BYTES) fail(413, 'The retained route-suggestion history is full, so this change was not saved. Ask for archival review.');
  s.operations = projected;
}

export type RouteSuggestionResult = { suggestionId: string; version: number; state: RouteSuggestion['state']; tasks: number; assignmentChanged: false; completionChanged: false; externalProviderCalled: false };

export function applyRouteSuggestion(s: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()): RouteSuggestionResult | null {
  const parsed = routeSuggestionSchema.safeParse(input);
  if (!parsed.success) { const type = commandType(input); if (type && TYPES.has(type)) fail(422, parsed.error.issues[0]?.message ?? 'Check the route suggestion.'); return null; }
  const c = parsed.data;
  authorizeRouteSuggestion(s, m, c, now);
  const current = routeState(s), entries = current.entries.map(x => structuredClone(x));
  let value: RouteSuggestion;
  if (c.type === 'routeSuggestionCreate') {
    if (entries.filter(x => x.workerId === m.userId && x.state === 'active').length >= 10) fail(422, 'Decline an older active suggestion before creating another.');
    if (entries.length >= 500) fail(422, 'The retained route-suggestion history is full; an archive policy is required.');
    const people = routeOrder(c.personIds.map(x => routePerson(s, m, x, now)));
    value = { id: uuid(), workerId: m.userId, workerMembershipVersion: m.version, version: 1, state: 'active', strategy: 'due-locality-local-v1', tasks: asRefs(people), createdAt: now, updatedAt: now, history: [{ at: now, by: u.userId, action: 'created' }] };
    entries.push(value);
  } else {
    const index = entries.findIndex(x => x.id === c.suggestionId && x.workerId === m.userId);
    value = entries[index]!;
    if (c.expectedVersion !== value.version) fail(409, 'This route suggestion changed. Refresh before changing it.');
    if (value.state !== 'active') fail(409, 'This route suggestion is no longer active.');
    if (c.type === 'routeSuggestionReorder') {
      if (!sameSet(value.tasks.map(x => x.personId), c.personIds)) fail(422, 'Reordering must keep the same assigned tasks. Use override to replace the selection.');
      const currentPeople = c.personIds.map(x => routePerson(s, m, x, now));
      if (value.tasks.some(ref => currentPeople.find(person => person.id === ref.personId)?.version !== ref.personVersion)) fail(409, 'Assigned work changed after this suggestion was created. Inspect the ordinary work list and use override.');
    }
    value.version++;
    value.updatedAt = now;
    if (c.type === 'routeSuggestionDecline') { value.state = 'declined'; value.history.push({ at: now, by: u.userId, action: 'declined', reason: c.reason }); }
    else if (c.type === 'routeSuggestionReorder') { value.tasks = asRefs(c.personIds.map(x => routePerson(s, m, x, now))); value.history.push({ at: now, by: u.userId, action: 'reordered' }); }
    else { value.tasks = asRefs(c.personIds.map(x => routePerson(s, m, x, now))); value.history.push({ at: now, by: u.userId, action: 'overridden', reason: c.reason }); }
  }
  saveRouteState(s, { version: current.version + 1, entries });
  s.workspace.audit.push({ id: uuid(), at: now, actor: u.displayName, actorId: u.userId, role: m.role, action: c.type, subject: value.id, detail: `Worker-controlled route suggestion ${c.type === 'routeSuggestionCreate' ? 'created' : c.type === 'routeSuggestionDecline' ? 'declined' : c.type === 'routeSuggestionReorder' ? 'reordered' : 'overridden'} at version ${value.version}; ${value.tasks.length} assigned task reference${value.tasks.length === 1 ? '' : 's'}. Assignment, completion, pay and service access were unchanged. No mapping provider was called.` });
  return { suggestionId: value.id, version: value.version, state: value.state, tasks: value.tasks.length, assignmentChanged: false, completionChanged: false, externalProviderCalled: false };
}

export function routeSuggestionView(s: OrgState, m: Member, now = new Date().toISOString()) {
  careWorker(m);
  const eligible = s.workspace.people.filter(p => allowed(m, p, now) && p.assignedTo === m.userId && p.status !== 'completed' && !p.mergedInto);
  const byId = new Map(eligible.map(p => [p.id, p]));
  const work = routeOrder(eligible).map(p => ({ personId: p.id, personVersion: p.version, name: p.name, task: p.task, due: p.due, localityLabel: p.village.trim() || null, status: p.status }));
  const suggestions = routeState(s).entries.filter(x => x.workerId === m.userId).slice(-20).reverse().map(x => {
    const authorityCurrent = x.workerMembershipVersion === m.version;
    const tasks = x.tasks.map((ref, position) => {
      const p = byId.get(ref.personId);
      if (!authorityCurrent || !p || p.version !== ref.personVersion) return { position: position + 1, availability: 'unavailable' as const, reason: 'This task is stale, missing or outside your current assigned work. Its record and location are withheld.' };
      if (!p.village.trim()) return { position: position + 1, availability: 'unavailable' as const, personId: p.id, name: p.name, task: p.task, due: p.due, localityLabel: null, reason: 'No approved locality label is available. Keep using the ordinary assigned-work list.' };
      return { position: position + 1, availability: 'available' as const, personId: p.id, name: p.name, task: p.task, due: p.due, localityLabel: p.village };
    });
    const available = x.state === 'active' && authorityCurrent && tasks.every(t => t.availability === 'available');
    return { id: x.id, version: x.version, state: x.state, strategy: x.strategy, createdAt: x.createdAt, updatedAt: x.updatedAt, available, tasks, fallback: available ? null : 'Route suggestion unavailable. Your ordinary permitted task list remains available and unchanged.' };
  });
  return { capability: { available: work.some(x => !!x.localityLabel), mode: 'local-due-and-locality-label-v1', approvedInputs: ['current assigned task identifier', 'due date', 'existing locality label'], externalMappingProvider: 'disabled', navigation: false, continuousTracking: false }, work, suggestions, fallback: work.length ? (work.some(x => !!x.localityLabel) ? null : 'No approved locality labels are available. Continue from the ordinary assigned-work list.') : 'No current assigned work is available. No route suggestion was created.', assignmentChanged: false, completionChanged: false, consequence: 'Ignoring, declining or overriding a suggestion does not change assignment, completion, service access, pay or sanctions.' };
}
