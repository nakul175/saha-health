import { identity, loadFor, json, rawRuntime } from './server.js';
import { fail } from './core.js';
import { scope } from './store.js';
import { boundedJsonBody } from './request-body.js';
import { environmentOf } from './environment.js';
import { importInput, planImport, publicPlan } from './patient-import.js';
// Slice 2f: read-only import dry run. The file travels in the request body, never in the URL; the response carries
// row numbers, ids, versions, counts and reasons only. Applying needs the returned plan hash and the same file.
export async function patientImportDryRun(request) {
    const u = await identity();
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
        fail(403, 'Cross-origin requests are not allowed.');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(415, 'Use JSON for this operation.');
    const parsed = importInput.safeParse(await boundedJsonBody(request, 20000));
    if (!parsed.success)
        fail(422, parsed.error.issues[0]?.message ?? 'Invalid import.');
    const e = environmentOf(rawRuntime());
    if (e.name === 'misconfigured')
        fail(409, 'The environment is not configured correctly. Imports are refused until it is corrected.');
    const s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId);
    return json({ ...publicPlan(await planImport(s, m, parsed.data.csv, e.name)), generatedAt: new Date().toISOString() });
}
