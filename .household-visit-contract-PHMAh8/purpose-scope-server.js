import { identity, loadFor, json } from './server.js';
import { fail } from './core.js';
import { scope } from './store.js';
import { allowedFor } from './access.js';
import { ACCESS_PURPOSES, purposeScopeView } from './purpose-scope.js';
// Slice r09: view and manage purpose-specific authorisation. Owners see every programme/purpose
// grant and the members they can narrow; a member sees their own. The optional `check` query
// answers whether a named member may see a named person for a named purpose, using the same
// scope check (allowedFor) that data-flow checkpoints will apply.
export async function purposeScopeRead(request) {
    const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation'));
    const m = scope(s, u.userId);
    const url = new URL(request.url);
    if (url.searchParams.get('check') !== null) {
        const memberId = url.searchParams.get('member') ?? u.userId;
        const personId = url.searchParams.get('person') ?? '';
        const purposeParam = url.searchParams.get('purpose');
        const purpose = purposeParam && ACCESS_PURPOSES.includes(purposeParam) ? purposeParam : undefined;
        if (memberId !== u.userId && !m.isOwner)
            fail(403, 'Only an owner can check another member’s purpose scope.');
        const target = s.members.find(x => x.userId === memberId);
        const person = personId ? s.workspace.people.find(p => p.id === personId) : undefined;
        return json({
            memberId,
            personId,
            purpose: purpose ?? null,
            allowed: !!(target && person && allowedFor(target, person, s.operations?.purposeGrants, purpose)),
            programmeScope: target ? (s.operations?.purposeGrants ?? []).find(g => g.memberId === target.userId && !g.revokedAt)?.programme ?? null : null,
        });
    }
    return json(purposeScopeView(s, m));
}
