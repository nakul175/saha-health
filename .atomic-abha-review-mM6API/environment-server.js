import { identity, loadFor, json, rawRuntime } from './server.js';
import { fail } from './core.js';
import { scope } from './store.js';
import { configurationReport } from './environment.js';
// Slice 6n: owner-only, read-only configuration check. Reports names and states, never secret values.
export async function environmentRead(request) {
    const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId);
    if (!m.isOwner)
        fail(403, 'Only an organisation owner can view the configuration check.');
    return json(configurationReport(rawRuntime(), s));
}
