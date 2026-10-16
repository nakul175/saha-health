import { recordAccess } from './access-audit';
import { approvedSourceLibrary, approvedSourceProgramme } from './approved-source-library';
import { verifiedSourceDocument } from './clinical-source';
import { digest, fail } from './core';
import { db, identity, json, loadFor } from './server';
import { scope } from './store';

export async function approvedSourceLibraryRead(request: Request) {
  const actor = await identity();
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some(key => key !== 'programme') || url.searchParams.getAll('programme').length > 1) {
    fail(400, 'Choose at most one supported programme.');
  }
  const rawProgramme = url.searchParams.get('programme');
  const parsed = rawProgramme === null ? undefined : approvedSourceProgramme.safeParse(rawProgramme);
  if (parsed && !parsed.success) fail(400, 'Choose a supported programme.');
  const programme = parsed?.success ? parsed.data : undefined;
  const organisation = request.headers.get('x-saha-organisation');
  const now = new Date().toISOString();
  const read = async () => {
    const state = await loadFor(actor, organisation);
    const member = scope(state, actor.userId);
    const value = approvedSourceLibrary(state, member, programme, now);
    for (const row of value.rows) {
      const entry = state.governance?.entries.find(candidate => candidate.id === row.sourceEntryId);
      if (entry?.spec.kind === 'source' && entry.spec.document) {
        await verifiedSourceDocument(db(), state.organisation.id, entry, now);
      }
    }
    return { state, member, value, fingerprint: await digest(value) };
  };
  const before = await read();
  await recordAccess(db(), before.state, actor, before.member, {
    action: 'viewWorkspace',
    subject: before.state.organisation.id,
    personId: null,
    detail: `Approved source library opened for ${programme ?? 'all current programmes'}; ${before.value.rows.length} current source entries; no patient data.`,
  });
  const after = await read();
  if (before.member.version !== after.member.version || before.fingerprint !== after.fingerprint) {
    fail(409, 'Guidance or care authority changed while opening. Refresh before using it.');
  }
  return json(after.value);
}
