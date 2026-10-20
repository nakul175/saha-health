import { db, identity, json, loadFor } from './server';
import { scope } from './store';
import { recordAccess } from './access-audit';
import { routeSuggestionView } from './route-suggestions';

export async function routeSuggestionsRead(request: Request) {
  const u = await identity();
  const state = await loadFor(u, request.headers.get('x-saha-organisation'));
  const member = scope(state, u.userId);
  const value = routeSuggestionView(state, member);
  await recordAccess(db(), state, u, member, { action: 'listPatients', subject: member.userId, detail: `Worker viewed ${value.suggestions.length} retained route suggestion${value.suggestions.length === 1 ? '' : 's'} and ${value.work.length} current assigned task summaries. Only current assigned work and existing locality labels were returned; no coordinates or provider call.` });
  return json(value);
}
