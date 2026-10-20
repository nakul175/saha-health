import { z } from 'zod';
import { fail } from './core.js';
import { ACCESS_PURPOSES, PROGRAMME_NAMES, ensurePurpose } from './purpose-scope.js';
const grants = z.object({ purposeGrants: z.array(z.object({ memberId: z.string().min(1), programme: z.enum(PROGRAMME_NAMES).nullish(), purposes: z.array(z.enum(ACCESS_PURPOSES)), revokedAt: z.string().nullish() }).passthrough()).nullish() }).passthrough();
// The proof is read in the SAME consistent batch as the unchanged assigned-record guard.
// Missing operations means no grant, as in the original policy. Malformed/ambiguous stored
// policy is unavailable. No subsequent asynchronous read can widen this snapshot.
export function assertFreshnessPurpose(member, source) {
    const rows = z.array(z.object({ root_type: z.string().nullable(), data: z.string() }).strict()).max(1).safeParse(source);
    if (!rows.success)
        fail(503, 'Current fact-review purpose is unavailable.');
    let value = {};
    if (rows.data[0]) {
        if (rows.data[0].root_type !== 'object')
            fail(503, 'Current fact-review purpose is unavailable.');
        try {
            value = JSON.parse(rows.data[0].data);
        }
        catch {
            fail(503, 'Current fact-review purpose is unavailable.');
        }
    }
    const parsed = grants.safeParse(value);
    if (!parsed.success)
        fail(503, 'Current fact-review purpose is unavailable.');
    const current = parsed.data.purposeGrants ?? [];
    if (current.filter(g => g.memberId === member.userId && !g.revokedAt).length > 1)
        fail(503, 'Current fact-review purpose is unavailable.');
    ensurePurpose(member, 'care-coordination', current);
}
