// Care work first, then oversight, then administration.
export const VIEW_ORDER = ['work', 'people', 'receipts', 'outreach', 'continuity', 'governance', 'pilot', 'expansion', 'operations', 'programmes', 'ai', 'connections', 'activity', 'organisation'];
// Views a non-owner ASHA or supervisor has nothing to do in. An ASHA still gets Pilot readiness while they hold a training
// record of their own in the current rehearsal (only they can acknowledge it), see `pilotTask`.
export const HIDDEN_FOR = { asha: ['governance', 'pilot', 'expansion', 'operations', 'programmes', 'ai', 'connections', 'activity'], supervisor: ['governance', 'programmes', 'ai'] };
export function shownViews(m, pilotTask = false) {
    return VIEW_ORDER.filter(id => {
        if (m?.role === 'provider')
            return ['governance', 'activity', 'organisation'].includes(id);
        if (id === 'continuity')
            return m?.role !== 'admin';
        if (id === 'expansion')
            return !!m && (m.isOwner || m.role === 'admin');
        if (id === 'operations')
            return !!m && (m.isOwner || m.role === 'supervisor' || m.role === 'admin' || m.reporting);
        if (!m || m.isOwner)
            return true;
        if (id === 'pilot' && m.role === 'asha')
            return pilotTask;
        return !(HIDDEN_FOR[m.role] ?? []).includes(id);
    });
}
