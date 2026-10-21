import { fail } from './core.js';
// Slice 2b: visit media (BR-DATA-08). Small photographs and voice notes attached to a draft visit,
// checked for type, content signature, size and a stated purpose; immutable once the visit is
// confirmed; removable only from drafts, leaving a tombstone.
export const MEDIA_TYPES = { 'image/jpeg': 'photo', 'image/png': 'photo', 'image/webp': 'photo', 'audio/webm': 'audio', 'audio/ogg': 'audio', 'audio/mpeg': 'audio', 'audio/mp4': 'audio' };
export const MEDIA_PURPOSES = ['wound-or-skin', 'document-or-card', 'medicine-packaging', 'voice-note', 'other-clinical'];
export const MAX_MEDIA_BYTES = 256 * 1024, MIN_MEDIA_BYTES = 512, MAX_MEDIA_PER_VISIT = 10;
export const MEDIA_RETENTION = ['draft-only', 'visit-record'];
const text = (value, min, max, label) => { if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    fail(422, `${label} must be ${min}-${max} characters.`); return value.trim(); };
// Review is deliberately local and human-recorded. It never invokes a provider and every
// extracted value stays an unconfirmed draft, distinct from visit facts.
export function reviewMediaInput(input, actor, at = new Date().toISOString()) {
    if (!input || !['clean', 'blocked', 'unavailable'].includes(input.scan))
        fail(422, 'Record the current scan result.');
    if (!['acceptable', 'low', 'unusable'].includes(input.quality))
        fail(422, 'Record the current media quality.');
    if (typeof input.personMatch !== 'boolean')
        fail(422, 'Confirm whether the media belongs to this person and encounter.');
    if (!MEDIA_RETENTION.includes(input.retention))
        fail(422, 'Choose an approved media retention class.');
    const note = text(input.note, 10, 1000, 'Review note'), raw = input.extractionDrafts ?? [];
    if (!Array.isArray(raw) || raw.length > 20)
        fail(422, 'At most 20 extracted draft fields may be recorded.');
    const available = input.personMatch && input.scan === 'clean' && input.quality === 'acceptable';
    if (!available && raw.length)
        fail(422, 'Unqualified media cannot produce extracted draft fields.');
    const extractionDrafts = raw.map((x, i) => ({ field: text(x?.field, 1, 80, `Extracted field ${i + 1}`), value: text(x?.value, 1, 500, `Extracted value ${i + 1}`), sourceOffset: text(x?.sourceOffset, 1, 120, `Source offset ${i + 1}`), status: 'unconfirmed' }));
    return { review: { stage: available ? 'available' : 'quarantined', scan: input.scan, quality: input.quality, personMatch: input.personMatch, retention: input.retention, note, by: actor, at }, extractionDrafts };
}
const starts = (b, sig, at = 0) => sig.every((x, i) => b[at + i] === x);
// The declared type must match the file's own signature; a renamed file is refused.
export function sniff(bytes, mime) {
    switch (mime) {
        case 'image/jpeg': return starts(bytes, [0xff, 0xd8, 0xff]);
        case 'image/png': return starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        case 'image/webp': return starts(bytes, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, [0x57, 0x45, 0x42, 0x50], 8);
        case 'audio/webm': return starts(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
        case 'audio/ogg': return starts(bytes, [0x4f, 0x67, 0x67, 0x53]);
        case 'audio/mpeg': return starts(bytes, [0x49, 0x44, 0x33]) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
        case 'audio/mp4': return starts(bytes, [0x66, 0x74, 0x79, 0x70], 4);
        default: return false;
    }
}
export function checkMedia(bytes, mime, purpose, max = MAX_MEDIA_BYTES) {
    if (!(mime in MEDIA_TYPES))
        fail(415, 'Attach a JPEG, PNG or WebP photo, or a WebM, Ogg, MP3 or MP4 audio note.');
    if (!MEDIA_PURPOSES.includes(purpose))
        fail(422, 'Choose why this media is being attached.');
    if (purpose === 'voice-note' && MEDIA_TYPES[mime] !== 'audio')
        fail(422, 'A voice note must be audio.');
    if (bytes.byteLength < MIN_MEDIA_BYTES)
        fail(422, 'This file is too small to be a usable photo or recording.');
    if (bytes.byteLength > max)
        fail(413, `Media must be ${max / 1024} KB or smaller. Reduce the photo size or shorten the note.`);
    if (!sniff(bytes, mime))
        fail(422, 'The file content does not match its declared type.');
}
// Over-limit bodies are read and discarded up to 1 MB before refusing, because cancelling an
// unread request body mid-stream restarts the local Worker runtime (seen since R10).
const DRAIN_LIMIT = 1024 * 1024;
export const MEDIA_READ_BUDGET_MS = 30000;
export async function readBounded(request, max) {
    const reader = request.body?.getReader();
    if (!reader)
        fail(400, 'A file body is required.');
    const chunks = [];
    let size = 0, over = false;
    const deadline = Date.now() + MEDIA_READ_BUDGET_MS;
    const declared = request.headers.get('content-length');
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > max))
        over = true;
    try {
        while (true) {
            let timer;
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                try {
                    await reader.cancel();
                }
                catch { }
                fail(408, 'Media upload exceeded its request time budget. Retry with the original key.');
            }
            const chunk = await Promise.race([reader.read(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('media-time-budget')), remaining); })]).finally(() => { if (timer)
                clearTimeout(timer); }).catch(async () => { try {
                await reader.cancel();
            }
            catch { } return fail(408, 'Media upload exceeded its request time budget. Retry with the original key.'); });
            const { value, done } = chunk;
            if (done)
                break;
            size += value.byteLength;
            if (size > max)
                over = true;
            if (over) {
                chunks.length = 0;
                if (size > Math.max(DRAIN_LIMIT, max + 1024 * 1024)) {
                    await reader.cancel();
                    break;
                }
                continue;
            }
            chunks.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    if (over)
        fail(413, `Media must be ${max / 1024} KB or smaller. Reduce the photo size or shorten the note.`);
    const out = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
        out.set(c, at);
        at += c.byteLength;
    }
    return out;
}
export const toB64 = (b) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000)
    s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
export const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
// Transport-only discard for authority/parser refusal before reading. Holds no chunks and
// reads at most the supported online limit plus one MiB; never changes a clinical outcome.
export async function discardUnreadMedia(request) {
    if (!request.body || request.bodyUsed)
        return;
    let reader, timer;
    try {
        reader = request.body.getReader();
        let total = 0;
        await Promise.race([(async () => { while (total < 5 * 1024 * 1024) {
                const part = await reader.read();
                if (part.done)
                    return;
                total += part.value.length;
            } await reader.cancel(); })(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('media-discard-budget')), MEDIA_READ_BUDGET_MS); })]);
    }
    catch {
        try {
            await reader?.cancel();
        }
        catch { }
    }
    finally {
        if (timer)
            clearTimeout(timer);
        try {
            reader?.releaseLock();
        }
        catch { }
    }
}
