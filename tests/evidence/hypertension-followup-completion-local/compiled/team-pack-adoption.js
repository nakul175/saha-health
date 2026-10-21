import { transitionVerified } from './installed-transition-authority.js';
import { adoptedVersion, enrollableAt } from './programmes.js';
// A published team adoption remains historical after its reviewer leaves. Current
// enrolment/import permissions still apply; retiring its exact target fails closed.
export function adoptedVersionForTeam(s, id, teamId, at = new Date().toISOString()) {
    const ops = s.operations, entries = (ops?.teamPackAdoptions ?? []).filter((a) => a.teamId === teamId && a.packId === id && Date.parse(a.at) <= Date.parse(at));
    const a = entries.at(-1);
    if (!a)
        return adoptedVersion(s, id);
    const t = (ops.installedTransitions ?? []).find((t) => t.id === a.transitionId && t.state === 'applied' && t.hash === a.declarationHash && t.teamId === teamId && t.reviewer && t.reviewer !== t.proposer && t.history.some((h) => h.id === a.eventId && h.kind === 'applied'));
    const applied = t?.history.find((h) => h.id === a.eventId && h.kind === 'applied');
    const p = enrollableAt(id, a.version, s);
    return t && applied?.at === a.at && applied?.by === a.by && t.toId === a.installationId && t.toHash === a.manifestHash && transitionVerified(s, t) && p?.installed?.installationId === a.installationId && p?.installed?.manifestHash === a.manifestHash ? a.version : 0;
}
