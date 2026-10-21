import { planContactReversal } from './contact-import.js';
import { db, identity, loadFor, json, rawRuntime } from './server.js';
import { fail, uuid } from './core.js';
import { scope } from './store.js';
import { z } from 'zod';
import { boundedJsonBody } from './request-body.js';
import { environmentOf } from './environment.js';
import { mayImport, planImport, publicPlan, csvBytes, MAX_CSV } from './patient-import.js';
import { mayImportVisits, VISIT_REFUSED } from './visit-import.js';
import { planLegacyImportReversal, planRecordImport, publicRecordPlan, recordImportInput } from './record-import.js';
import { rejectionReport, REJECTIONS_DEFINITION, REJECTION_KINDS } from './import-rejections.js';
import { recordAccess } from './access-audit.js';
import { planWorkforceImport, WORKFORCE_REFUSED, workforceReportPlan } from './workforce-import.js';
// Slice 2h: read-only dry run for enrolment and identifier imports, and the rejection report for any import dry run.
// The file travels in the request body, never in the URL.
async function body(request) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
        fail(403, 'Cross-origin requests are not allowed.');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(415, 'Use JSON for this operation.');
    const input = await boundedJsonBody(request, 20000);
    const e = environmentOf(rawRuntime());
    if (e.name === 'misconfigured')
        fail(409, 'The environment is not configured correctly. Imports are refused until it is corrected.');
    return { input, env: e.name };
}
export async function recordImportDryRun(request) {
    const u = await identity(), { input, env } = await body(request);
    const reversal = z.object({ kind: z.literal('contacts-reversal'), batchId: z.string().min(1).max(100) }).strict().safeParse(input);
    if (reversal.success) {
        const s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId);
        return json(await planContactReversal(s, m, reversal.data.batchId, env));
    }
    const legacyReversal = z.object({ kind: z.enum(['enrolments-reversal', 'identifiers-reversal']), batchId: z.string().min(1).max(100) }).strict().safeParse(input);
    if (legacyReversal.success) {
        const s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId);
        return json(await planLegacyImportReversal(s, m, legacyReversal.data.kind.replace('-reversal', ''), legacyReversal.data.batchId, env));
    }
    const parsed = recordImportInput.safeParse(input);
    if (!parsed.success)
        fail(422, parsed.error.issues[0]?.message ?? 'Invalid import.');
    const s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId);
    return json({ ...publicRecordPlan(await planRecordImport(s, m, parsed.data.kind, parsed.data.csv, env)), generatedAt: new Date().toISOString() });
}
const tooLarge = `The file is larger than ${MAX_CSV.toLocaleString('en-IN')} bytes. Split it into smaller batches.`;
const rejectionInput = z.object({ kind: z.enum(REJECTION_KINDS), csv: z.string().min(1, 'Paste or choose a CSV file.').max(MAX_CSV, tooLarge).refine(x => csvBytes(x) <= MAX_CSV, tooLarge) }).strict();
const REFUSED = 'Only an owner or supervisor with a clinician or supervisor role can import, for teams they belong to.';
export async function importRejections(request) {
    const u = await identity(), { input, env } = await body(request);
    const parsed = rejectionInput.safeParse(input);
    if (!parsed.success)
        fail(422, parsed.error.issues[0]?.message ?? 'Invalid import.');
    const { kind, csv } = parsed.data, s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId);
    // Slice 10d: a workforce roster is imported by organisation owners, not by the people-import importers.
    if (kind === 'workforce') {
        if (!m.isOwner)
            fail(403, WORKFORCE_REFUSED);
    }
    else if (!(kind === 'visits' ? mayImportVisits(m) : mayImport(s, m)))
        fail(403, kind === 'visits' ? VISIT_REFUSED : REFUSED);
    const plan = kind === 'workforce' ? workforceReportPlan(await planWorkforceImport(s, m, csv, env)) : kind === 'people' ? publicPlan(await planImport(s, m, csv, env)) : publicRecordPlan(await planRecordImport(s, m, kind, csv, env));
    const exportId = uuid(), generatedAt = new Date().toISOString(), report = await rejectionReport(plan, { exportId, kind, role: m.role, generatedAt });
    // Slice 6aa (seventh review, finding 6): the export's audit event is an access-audit commit (slice 6t pattern): it is
    // written before the file is returned, appends the event only and moves no organisation or patient revision.
    await recordAccess(db(), s, u, m, { action: 'importRejectionsExport', subject: s.organisation.id, detail: `Import rejection report exported for a ${kind} dry run (plan ${plan.planHash}); definition ${REJECTIONS_DEFINITION.id} ${REJECTIONS_DEFINITION.version}; export ${exportId}; ${plan.counts.rows} rows in file, ${report.listed} listed; ${report.rows} data rows; SHA-256 ${report.sha256}; control total ${report.reconciled ? 'reconciled' : 'NOT reconciled'}. Row numbers and reasons only.` }, generatedAt);
    return new Response(report.csv, { headers: { 'X-Saha-Export-Id': exportId, 'X-Saha-Content-SHA256': report.sha256, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="saha-import-rejections.csv"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
