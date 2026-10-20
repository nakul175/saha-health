// BR-AG-10: this is deliberately non-generative. It describes controls and
// state already present in the visit; it never substitutes a provider result.
export function clinicalContinuity(providers, visit) {
    const unavailable = providers.filter(provider => provider.mode !== 'local' && !provider.available);
    const current = !visit.voidedAt && !visit.supersededBy;
    const draft = current && visit.state === 'draft';
    const pinnedPacks = visit.programmeCapture?.packs ?? [];
    const items = [
        { id: 'capture', label: 'Structured capture and review', detail: draft ? 'Available through the ordinary visual visit form; saving does not wait for an assistant.' : current ? 'The saved visit remains available for visual review.' : 'This visit is no longer current; open the current visit before editing.', available: current },
        { id: 'protocol', label: 'Pinned protocol context', detail: pinnedPacks.length ? `${pinnedPacks.map(item => `${item.pack.name} version ${item.pack.version}`).join(', ')} already ${pinnedPacks.length === 1 ? 'is' : 'are'} pinned to this visit. Existing rules stay unchanged.` : 'No protocol pack is pinned to this visit; the app does not invent guidance.', available: pinnedPacks.length > 0 },
        { id: 'referral', label: 'Local draft referral', detail: current ? 'The ordinary referral form remains available and creates a draft for human review.' : 'Open the current visit before preparing a referral draft.', available: current },
        { id: 'urgent-work', label: 'Urgent-task visibility', detail: 'Existing urgent work remains visible in the work list; no assistant result is required.', available: true },
    ];
    return {
        assistance: unavailable.length ? 'unavailable' : 'available',
        unavailable: unavailable.map(provider => ({ id: provider.id, name: provider.name, reason: provider.reason })),
        items,
        notice: unavailable.length ? 'Optional AI assistance is unavailable. No AI result was created. Continue with the ordinary visual workflow below.' : 'Optional assistance is available. The ordinary visual workflow remains independent of it.',
    };
}
