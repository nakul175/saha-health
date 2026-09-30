import type { Snapshot } from './types';

// Slice 0b: a certified patient command can answer with a partition snapshot (organisation-level
// fields complete, patient collections limited to the named patients) instead of rebuilding the
// whole organisation. The client merges it into the snapshot it already holds. The result must
// equal a freshly loaded full snapshot; tests/delta-smoke.mjs checks that property.
export function mergeDelta(current: Snapshot, delta: Snapshot, partition: string[]): Snapshot {
  const ids = new Set(partition);
  const replace = <T extends { id: string }>(before: T[], after: T[], owner: (x: T) => string) => {
    const fresh = new Map(after.map(x => [x.id, x]));
    const kept = before.flatMap(x => {
      if (!ids.has(owner(x))) return [x];
      const next = fresh.get(x.id);
      fresh.delete(x.id);
      return next ? [next] : [];
    });
    return [...kept, ...fresh.values()];
  };
  // Same order as the server's full load: visits by creation time then id, the rest by id.
  const byId = <T extends { id: string }>(xs: T[]) => xs.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const visits = replace(current.visits, delta.visits, v => v.personId)
    .sort((a, b) => a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    ...delta,
    people: byId(replace(current.people, delta.people, p => p.id)),
    visits,
    submissions: byId(replace(current.submissions, delta.submissions, s => s.personId)),
    referrals: byId(replace(current.referrals, delta.referrals, r => r.personId)),
    // Slice 0b-3: a paged workspace keeps its paging and adds merged patients to the opened window.
    ...(current.patientPaging ? { patientPaging: { ...current.patientPaging, window: [...new Set([...current.patientPaging.window, ...delta.people.filter(p => ids.has(p.id)).map(p => p.id)])].filter(id => !ids.has(id) || delta.people.some(p => p.id === id)) } } : {}),
  };
}
