// Presentation adapter only. The existing Saha server remains the access authority.
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export class WorkspaceUnavailable extends Error {}

export function readWork(value) {
  if (!object(value) || !['synthetic', 'training'].includes(value.environment)) {
    throw new WorkspaceUnavailable('This preview is available only in a synthetic or training workspace.');
  }
  if (value.role !== 'asha' || !object(value.membership) || value.membership.status !== 'active' ||
      value.membership.role !== 'asha' || !object(value.user) || !text(value.user.userId) ||
      value.membership.userId !== value.user.userId) {
    throw new WorkspaceUnavailable('Open your assigned ASHA workspace to use this preview.');
  }
  if (!object(value.organisation) || !text(value.organisation.id) || !text(value.organisation.name) ||
      !Array.isArray(value.people) || value.people.length > 10000) {
    throw new WorkspaceUnavailable('The work list could not be read. Open the existing workspace.');
  }
  if (value.patientPaging) {
    throw new WorkspaceUnavailable('This preview cannot display the complete paged list. Use the existing workspace.');
  }
  if (value.maintenance?.active) {
    throw new WorkspaceUnavailable('Your workspace is paused. Open the existing workspace for its current status.');
  }
  const seen = new Set();
  const people = [];
  for (const p of value.people) {
    if (!object(p)) throw new WorkspaceUnavailable('A work-list record could not be read.');
    if (p.assigned !== true) continue;
    if (!text(p.id) || !text(p.name) || typeof p.village !== 'string' || p.village.length > 500 ||
        typeof p.task !== 'string' || p.task.length > 1000 || typeof p.due !== 'string' ||
        p.due.length > 100 || !['due', 'in_progress', 'completed'].includes(p.status) || seen.has(p.id)) {
      throw new WorkspaceUnavailable('A work-list record could not be read. Open the existing workspace.');
    }
    seen.add(p.id);
    people.push({ id: p.id, name: p.name, village: p.village, task: p.task, due: p.due, status: p.status });
  }
  return { organisation: value.organisation.name,
    worker: text(value.membership.displayName) ? value.membership.displayName : 'Your workspace',
    people, work: people.filter((p) => p.status !== 'completed') };
}

export function personPath(id) {
  if (!text(id)) throw new WorkspaceUnavailable('Choose a valid person.');
  return '/app?patient=' + encodeURIComponent(id);
}

export function findPeople(people, query) {
  const q = String(query).trim().toLocaleLowerCase();
  return people.filter((p) => `${p.name} ${p.village} ${p.id}`.toLocaleLowerCase().includes(q));
}
