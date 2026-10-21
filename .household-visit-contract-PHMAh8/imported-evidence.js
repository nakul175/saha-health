import { z } from 'zod';
import { digest, fail, person, uuid, visit } from './core.js';
import { normallyAllowed } from './access.js';
import { packAt } from './programmes.js';
import { checkMedia, fromB64, toB64, MEDIA_PURPOSES, MEDIA_TYPES } from './media.js';
const id = z.string().trim().min(1).max(100), reason = z.string().trim().min(10).max(500), sha = z.string().regex(/^[a-f0-9]{64}$/);
export const evidenceRowSchema = z.object({ visitId: id, sourceSystem: z.string().trim().min(1).max(80), sourceId: id, includeVisit: z.literal(true).optional(), answers: z.array(z.object({ packId: id, packVersion: z.number().int().positive(), questionId: id, value: z.string().trim().min(1).max(1000) }).strict()).max(30), notes: z.array(z.object({ kind: z.enum(['history', 'observation', 'assessment', 'plan', 'other']), text: z.string().trim().min(1).max(3000) }).strict()).max(5), attachments: z.array(z.object({ mime: z.enum(Object.keys(MEDIA_TYPES)), purpose: z.enum(MEDIA_PURPOSES), data: z.string().min(1).max(349528) }).strict()).max(3) }).strict().refine(r => r.includeVisit === true || r.answers.length + r.notes.length + r.attachments.length > 0, 'Include at least one answer, note or attachment.');
export const evidenceManifestSchema = z.object({ rows: z.array(evidenceRowSchema).min(1).max(20) }).strict();
export const evidenceInput = z.discriminatedUnion('operation', [
    z.object({ operation: z.literal('overlap-review'), csv: z.string().min(1).max(16000), row: z.number().int().min(1).max(100), fingerprint: sha, decision: z.enum(['keep-separate', 'reject-source', 'reference-existing']), referenceVisitId: id.optional(), reason }).strict(),
    z.object({ operation: z.literal('visits-reverse-plan'), batchId: id }).strict(),
    z.object({ operation: z.literal('visits-reverse'), batchId: id, planHash: sha, reason }).strict(),
    z.object({ operation: z.literal('dry-run'), manifest: evidenceManifestSchema }).strict(),
    z.object({ operation: z.literal('apply'), manifest: evidenceManifestSchema, planHash: sha, reason }).strict(),
    z.object({ operation: z.literal('review'), personId: id, evidenceId: id, fingerprint: sha, decision: z.enum(['accepted', 'rejected', 'reference-existing']), referenceVisitId: id.optional(), reason }).strict(),
    z.object({ operation: z.literal('use'), personId: id, evidenceId: id, fingerprint: sha, reason }).strict(),
    z.object({ operation: z.literal('reverse-plan'), batchId: id }).strict(),
    z.object({ operation: z.literal('reverse'), batchId: id, planHash: sha, reason }).strict()
]);
export function evidenceCare(s, m, personId, clinical = false, readOnlyHistory = false) { const p = person(s.workspace, personId); if (m.status !== 'active' || (clinical ? m.role !== 'clinician' : !(m.role === 'clinician' || (m.role === 'supervisor' && m.isOwner))) || !normallyAllowed(m, p))
    fail(403, 'Current clinical import permission and patient scope are required.'); if (p.mergedInto && !readOnlyHistory)
    fail(409, 'Open the surviving patient record.'); return p; }
export function evidenceFor(s, m, personId, evidenceId, clinical = false, readOnlyHistory = false) { const p = evidenceCare(s, m, personId, clinical, readOnlyHistory), e = p.importedVisitEvidence?.find(x => x.id === evidenceId); if (!e)
    fail(404, 'Imported evidence not found.'); const v = visit(s.workspace, e.visitId); if (!v.imported || v.personId !== p.id)
    fail(409, 'The imported visit lineage is unavailable.'); return { p, e, v }; }
export function overlaps(s, v) { return s.workspace.visits.filter(x => x.personId === v.personId && x.id !== v.id && !x.voidedAt && !x.supersededBy && x.facts.date.slice(0, 10) === v.facts.date.slice(0, 10)).map(x => ({ id: x.id, source: x.imported?.sourceSystem ?? 'Saha', state: x.state, version: x.version, recordVersion: x.recordVersion })).sort((a, b) => a.id.localeCompare(b.id)); }
export async function reviewContentHash(s, pid, e) { const p = s.workspace.people.find(x => x.id === pid), v = s.workspace.visits.find(x => x.id === e.visitId); if (!p || !v)
    fail(409, 'The source lineage is unavailable.'); return digest({ source: e.sourceHash, visit: v, overlaps: overlaps(s, v), context: { age: p.age, sex: p.sex, programmes: p.programmes, identityReview: p.identityReview, mergedInto: p.mergedInto } }); }
export async function reviewFingerprint(s, pid, e) { const p = s.workspace.people.find(x => x.id === pid), v = s.workspace.visits.find(x => x.id === e.visitId); if (!p || !v)
    fail(409, 'The source lineage is unavailable.'); return digest({ personVersion: p.version, source: e.sourceHash, visit: v, overlaps: overlaps(s, v), reviews: e.reviews, withdrawal: e.withdrawal ?? null }); }
export async function planEvidence(s, m, manifest) {
    const rows = [], seen = new Set(), planned = new Map();
    for (const [i, r] of manifest.rows.entries()) {
        try {
            const v = visit(s.workspace, r.visitId), p = evidenceCare(s, m, v.personId);
            if (p.identityReview?.state === 'provisional' || p.restrictions?.some(x => !x.liftedAt))
                fail(409, 'Resolve provisional identity or processing restriction before importing source evidence.');
            if (!v.imported || v.voidedAt || v.supersededBy || p.importedVisitWithdrawals?.some(x => x.batchId === v.imported?.batchId))
                fail(409, 'Choose an unchanged imported historical visit.');
            if ((p.importedVisitEvidence?.length ?? 0) + (planned.get(p.id) ?? 0) >= 100)
                fail(422, 'This record has reached the retained source evidence limit.');
            const sourceKey = p.id + '|' + r.sourceSystem.toLowerCase() + '|' + r.sourceId;
            if (seen.has(sourceKey) || (p.importedVisitEvidence ?? []).some(e => e.sourceSystem.toLowerCase() === r.sourceSystem.toLowerCase() && e.sourceId === r.sourceId))
                fail(409, 'This source reference already has retained evidence; review its existing lineage.');
            seen.add(sourceKey);
            const answerKeys = new Set(), answers = [];
            for (const a of r.answers) {
                const pack = packAt(a.packId, a.packVersion, s), q = pack?.questions.find(x => x.id === a.questionId);
                if (!pack || !q || q.fact)
                    fail(422, 'Use a known pinned documentary question; measurements belong in historical visit import.');
                if (q.options && !q.options.includes(a.value))
                    fail(422, 'The source answer is not a listed option for its pinned question.');
                const k = a.packId + ':' + a.packVersion + ':' + a.questionId;
                if (answerKeys.has(k))
                    fail(422, 'Duplicate source question.');
                answerKeys.add(k);
                answers.push({ ...a, manifestHash: await digest(pack), label: q.label });
            }
            const attachments = [];
            for (const a of r.attachments) {
                let b;
                try {
                    b = fromB64(a.data);
                }
                catch {
                    fail(422, 'Invalid attachment encoding.');
                }
                if (toB64(b) !== a.data)
                    fail(422, 'Use canonical base64 attachment bytes.');
                checkMedia(b, a.mime, a.purpose);
                attachments.push({ mime: a.mime, purpose: a.purpose, size: b.byteLength, sha256: toB64(new Uint8Array(await crypto.subtle.digest('SHA-256', b))), data: a.data });
            }
            planned.set(p.id, (planned.get(p.id) ?? 0) + 1);
            rows.push({ row: i + 1, status: 'accepted', personId: p.id, visitId: v.id, sourceHash: await digest(r), sourceSystem: r.sourceSystem, sourceId: r.sourceId, answers, notes: r.notes, attachments, personVersion: p.version, visitVersion: v.recordVersion, overlaps: overlaps(s, v) });
        }
        catch (e) {
            if (!(e instanceof Error && 'status' in e))
                throw e;
            rows.push({ row: i + 1, status: 'rejected', reason: e.message });
        }
    }
    const counts = { rows: rows.length, accepted: rows.filter(x => x.status === 'accepted').length, rejected: rows.filter(x => x.status === 'rejected').length, overlaps: rows.filter(x => x.status === 'accepted' && x.overlaps.length).length };
    return { planHash: await digest({ actor: m.userId, org: s.organisation.id, manifest, rows }), rows, counts };
}
export function publicEvidencePlan(p) { return { planHash: p.planHash, counts: p.counts, rows: p.rows.map(r => ({ row: r.row, status: r.status, reason: r.reason, personId: r.personId, visitId: r.visitId, overlaps: r.overlaps })) }; }
export function evidenceBatch(s, m, batchId, readOnlyHistory = false) { const found = s.workspace.people.flatMap(p => (p.importedVisitEvidence ?? []).filter(e => e.batchId === batchId).map(e => ({ p, e }))); if (!found.length)
    fail(404, 'Imported evidence batch not found.'); for (const { p, e } of found) {
    evidenceCare(s, m, p.id, false, readOnlyHistory);
    visit(s.workspace, e.visitId);
} return found; }
export async function reversalEvidencePlan(s, m, batchId) { const found = evidenceBatch(s, m, batchId); if (found.some(x => x.e.withdrawal))
    fail(409, 'This source batch is already withdrawn.'); return { planHash: await digest({ org: s.organisation.id, actor: m.userId, batchId, rows: found.map(({ p, e }) => ({ personVersion: p.version, e })) }), counts: { rows: found.length, accepted: found.length, rejected: 0 }, usedDrafts: found.reduce((n, x) => n + x.e.uses.length, 0) }; }
export function applyEvidence(s, plan, m, now) { const batchId = uuid(), mediaRows = []; for (const r of plan.rows.filter(x => x.status === 'accepted')) {
    const p = evidenceCare(s, m, r.personId), attachments = r.attachments.map((a) => { const ref = { id: uuid(), mime: a.mime, purpose: a.purpose, size: a.size, sha256: a.sha256, at: now, by: m.userId }; mediaRows.push({ table: 'media', keys: ['org_id', 'id'], values: { org_id: s.organisation.id, id: ref.id, person_id: p.id, visit_id: r.visitId, mime: a.mime, purpose: a.purpose, size: a.size, sha256: a.sha256, created_at: now, deleted_at: null, data: a.data } }); return ref; });
    (p.importedVisitEvidence ??= []).push({ id: uuid(), batchId, visitId: r.visitId, sourceSystem: r.sourceSystem, sourceId: r.sourceId, sourceHash: r.sourceHash, planHash: plan.planHash, at: now, by: m.userId, answers: r.answers, notes: r.notes, attachments, reviews: [], uses: [] });
} return { batchId, mediaRows }; }
export function visitBatch(s, m, batchId, readOnlyHistory = false) { const vs = s.workspace.visits.filter(v => v.imported?.batchId === batchId); if (!vs.length)
    fail(404, 'Imported visit batch not found.'); if (vs.length > 100)
    fail(422, 'Historical batch exceeds the supported 100-visit review bound; no partial withdrawal is applied.'); for (const v of vs)
    evidenceCare(s, m, v.personId, false, readOnlyHistory); return vs; }
export async function visitReversalPlan(s, m, batchId) { const vs = visitBatch(s, m, batchId); if (vs.some(v => s.workspace.people.find(p => p.id === v.personId)?.importedVisitWithdrawals?.some(x => x.batchId === batchId)))
    fail(409, 'This historical visit batch is already withdrawn.'); if (vs.some(v => v.voidedAt || v.supersededBy))
    fail(409, 'An imported visit already has a clinical correction; review it individually.'); return { planHash: await digest({ org: s.organisation.id, actor: m.userId, batchId, visits: vs, people: vs.map(v => { const p = s.workspace.people.find(p => p.id === v.personId); return { id: p.id, version: p.version, evidence: p.importedVisitEvidence ?? [] }; }) }), counts: { rows: vs.length, accepted: vs.length, rejected: 0 }, notice: 'Append withdrawn source-batch evidence. Original visit facts, clinical rows, receipts, attachments and independently captured care remain unchanged.' }; }
