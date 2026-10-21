import { z } from 'zod';
import { fail } from './core.js';
import { sourceDocumentRef, SOURCE_DOCUMENT_BYTES, entryScope } from './governance.js';
export { sourceDocumentRef };
export const SOURCE_BYTES = SOURCE_DOCUMENT_BYTES;
const acquisitionCommon = { entryId: z.string().uuid(), version: z.number().int().positive(), mime: z.enum(['text/plain', 'application/pdf']), expiresAt: z.string().datetime(), licenceReference: z.string().trim().min(3).max(200) };
export const SOURCE_BODY_BYTES = 1100000;
export const sourceUploadSchema = z.discriminatedUnion('acquisition', [
    z.object({ ...acquisitionCommon, acquisition: z.literal('synthetic-upload'), content: z.string().min(1).max(700000) }).strict(),
    z.object({ ...acquisitionCommon, acquisition: z.literal('approved-origin-retrieval'), url: z.string().url().max(500), expectedSha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict()
]);
export async function sourceBytes(content, mime) { let bytes; if (mime === 'text/plain') {
    if (content.includes('\0'))
        fail(422, 'Source text contains unsupported controls.');
    bytes = new TextEncoder().encode(content);
}
else {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(content) || content.length % 4)
        fail(422, 'Use standard base64 PDF content.');
    try {
        bytes = Uint8Array.from(atob(content), x => x.charCodeAt(0));
    }
    catch {
        fail(422, 'Invalid PDF encoding.');
    }
    const text = new TextDecoder('latin1').decode(bytes);
    if (!text.startsWith('%PDF-') || /\/(JavaScript|JS|OpenAction|Launch|EmbeddedFile|RichMedia)\b/i.test(text))
        fail(422, 'PDF magic or active content markers are unsupported.');
} if (!bytes.length || bytes.length > SOURCE_BYTES)
    fail(413, 'Source document is limited to 512 KiB decoded bytes.'); return bytes; }
export async function sourceSha(bytes) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join(''); }
export async function verifiedSourceDocument(d, org, e, now = new Date().toISOString()) {
    const ref = e.spec.document;
    if (!ref)
        fail(409, 'This source is a citation only; no acquired document is registered.');
    const row = await d.prepare('SELECT * FROM clinical_source_documents WHERE org_id=? AND id=? AND entry_id=?').bind(org, ref.id, e.id).first();
    if (!row || row.manifest_hash !== e.manifestHash || row.reference !== JSON.stringify(ref))
        fail(409, 'Source document binding is unavailable.');
    if (ref.expiresAt <= now)
        fail(409, 'Acquired source document expired.');
    const bytes = await sourceBytes(row.content, ref.mime);
    if (bytes.length !== ref.bytes || await sourceSha(bytes) !== ref.sha256)
        fail(409, 'Source document integrity check failed.');
    return { ref, row, bytes };
}
export async function checkSourceCommand(d, s, c, m) {
    if (c.type === 'createGovernance' && c.spec.kind === 'source' && c.spec.document)
        fail(422, 'Acquire a source document through its controlled acquisition workflow.');
    if (['reviewGovernance', 'transitionGovernance'].includes(c.type)) {
        const e = s.governance?.entries.find(e => e.id === c.entryId);
        if (e?.spec.kind === 'source' && e.spec.document && m && !entryScope(m, e))
            fail(403, 'Current source scope required.');
        if (e?.spec.kind === 'source' && e.spec.document && (c.type === 'reviewGovernance' || c.state === 'active'))
            await verifiedSourceDocument(d, s.organisation.id, e);
        if (e?.spec.kind === 'protocol' && (c.type === 'reviewGovernance' || c.state === 'active'))
            for (const id of e.spec.sourceIds) {
                const source = s.governance?.entries.find(source => source.id === id);
                if (source?.spec.kind === 'source' && source.spec.document) {
                    if (m && !entryScope(m, source))
                        fail(403, 'Current source scope required.');
                    await verifiedSourceDocument(d, s.organisation.id, source);
                }
            }
    }
    if (['checkProtocol', 'reviewProtocol', 'createDirectoryReferral'].includes(c.type)) {
        const v = s.workspace.visits.find(v => v.id === c.visitId), p = s.workspace.people.find(p => p.id === v?.personId);
        for (const e of s.governance?.entries ?? [])
            if (e.spec.kind === 'protocol' && e.state === 'active' && p && e.spec.teamIds.includes(p.teamId))
                for (const id of e.spec.sourceIds) {
                    const source = s.governance?.entries.find(e => e.id === id);
                    if (source?.spec.kind === 'source' && source.spec.document)
                        await verifiedSourceDocument(d, s.organisation.id, source);
                }
    }
    if (c.type === 'createGovernance' && c.spec.kind === 'protocol')
        for (const id of c.spec.sourceIds) {
            const e = s.governance?.entries.find(e => e.id === id);
            if (e?.spec.kind === 'source' && e.spec.document)
                await verifiedSourceDocument(d, s.organisation.id, e);
        }
}
