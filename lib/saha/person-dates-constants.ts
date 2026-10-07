// Slice 14b/14c: person-date vocabularies and pure readers, shared by the server and the client (no server imports).
export const DATE_KINDS = ['lmp', 'edd', 'birthDate', 'dob'] as const;
export const DATE_SOURCES = ['reported', 'document', 'measured', 'estimated'] as const;
export type DateKind = typeof DATE_KINDS[number];
export type PersonDateEntry = { id: string; kind: DateKind; value: string; source: typeof DATE_SOURCES[number]; recordedAt: string; recordedBy: string; supersedes?: string; reason?: string; withdrawn?: { at: string; by: string; reason: string } };
export const currentDate = (entries: PersonDateEntry[] | undefined, kind: DateKind): PersonDateEntry | undefined => {
  const list = entries ?? [], superseded = new Set(list.map(e => e.supersedes).filter(Boolean));
  return list.filter(e => e.kind === kind && !e.withdrawn && !superseded.has(e.id)).at(-1);
};
export const currentDates = (entries: PersonDateEntry[] | undefined) => Object.fromEntries(DATE_KINDS.map(k => [k, currentDate(entries, k)?.value]).filter(([, v]) => v)) as Partial<Record<DateKind, string>>;
