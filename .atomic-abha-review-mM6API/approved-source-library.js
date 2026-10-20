import { z } from 'zod';
import { fail } from './core.js';
import { activeEntry, entryScope, governanceState } from './governance.js';
export const approvedSourceProgramme = z.enum([
    'General care',
    'Maternal care',
    'TB screening',
    'Chronic care',
    'Child health',
]);
function currentSource(state, member, entry, now) {
    return entry.spec.kind === 'source' && entryScope(member, entry) && activeEntry(state, entry, now);
}
export function approvedSourceLibrary(state, member, programme, now = new Date().toISOString()) {
    if (member.status !== 'active' || !['asha', 'clinician'].includes(member.role)) {
        fail(403, 'A current care role is required to read approved guidance.');
    }
    const governance = governanceState(state);
    const protocols = governance.entries.filter(entry => {
        if (entry.spec.kind !== 'protocol' || !activeEntry(state, entry, now) || !entryScope(member, entry))
            return false;
        if (!entry.spec.roles.includes(member.role))
            return false;
        return !programme || entry.spec.programme === programme;
    });
    const sourceIds = new Set(protocols.flatMap(entry => entry.spec.kind === 'protocol' ? entry.spec.sourceIds : []));
    const rows = governance.entries
        .filter(entry => sourceIds.has(entry.id) && currentSource(state, member, entry, now))
        .map(entry => {
        if (entry.spec.kind !== 'source' || !entry.review)
            throw new Error('Current source invariant failed.');
        const reviewer = state.members.find(candidate => candidate.userId === entry.review?.by);
        const uses = protocols
            .filter(protocol => protocol.spec.kind === 'protocol' && protocol.spec.sourceIds.includes(entry.id))
            .map(protocol => ({
            programme: protocol.spec.kind === 'protocol' ? protocol.spec.programme : 'General care',
            roles: protocol.spec.kind === 'protocol' ? protocol.spec.roles : [],
            protocolEntryId: protocol.id,
            protocolRevision: protocol.revision,
            protocolManifestHash: protocol.manifestHash,
            recommendation: protocol.spec.title,
        }))
            .sort((a, b) => a.programme.localeCompare(b.programme) || a.recommendation.localeCompare(b.recommendation));
        return {
            sourceEntryId: entry.id,
            sourceRevision: entry.revision,
            sourceManifestHash: entry.manifestHash,
            title: entry.spec.title,
            publisher: entry.spec.publisher,
            edition: entry.spec.edition,
            sourceUrl: entry.spec.url,
            effectiveFrom: entry.spec.effectiveFrom,
            reviewBy: entry.spec.reviewBy,
            applicability: entry.spec.applicability,
            summary: entry.spec.summary,
            reviewer: { id: entry.review.by, name: reviewer?.displayName ?? entry.review.by },
            reviewedAt: entry.review.at,
            programmes: uses,
        };
    })
        .filter(row => row.programmes.length)
        .sort((a, b) => a.title.localeCompare(b.title) || b.sourceRevision - a.sourceRevision);
    return {
        asOf: now,
        programme: programme ?? null,
        role: member.role,
        rows,
        notice: 'Only current independently reviewed sources linked to an active programme protocol are shown. Local clinical approval remains required.',
    };
}
