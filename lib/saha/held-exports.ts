import { digest } from './core';
import type { Member, OrgState } from './types';
import { reportingScope } from './delegation';

// Slice 14g (BR-REP-05): protected expiry of a downloaded aggregate file. A prepared, suppressed operational report can be held
// for ONE download by the member who prepared it. The hold expires after HELD_EXPORT_TTL_MS, is refused after one delivery
// (replay), is delivered only to the same member under the same role, purpose and reporting reach, and its content is blanked after
// delivery or expiry. Only the checksum, size and times stay. A pure module (no storage), shared by the route and the contract test.
export const HELD_EXPORT_TTL_MS = 15 * 60 * 1000;
export const HELD_EXPORT_KINDS = ['operations-csv'] as const;
export type HeldExportKind = typeof HELD_EXPORT_KINDS[number];
export const MAX_HELD_PER_MEMBER = 3, MAX_HELD_PER_ORG = 50, MAX_HELD_BYTES = 1024 * 1024, KEEP_ROWS_DAYS = 30;
export type HeldRow = { org_id: string; id: string; user_id: string; kind: string; created_at: string; expires_at: string; downloaded_at: string | null; sha256: string; bytes: number; fingerprint: string; content: string };
// What a held file was prepared under; any change refuses the download and blanks the file.
export async function reachFingerprint(s: OrgState, m: Member, now = new Date().toISOString()) {
  const reach = reportingScope(s, m, now);
  return digest({ role: m.role, owner: m.isOwner, teams: [...reach.teams].sort(), delegations: reach.delegations.map(d => d.id).sort() });
}
export type HeldDecision = { ok: true } | { ok: false; status: 404 | 409 | 410; reason: 'missing' | 'not-yours' | 'downloaded' | 'expired' | 'scope-changed'; message: string };
// The checks a download goes through before the atomic claim. `fingerprint` is the member's current one.
export function heldDecision(row: HeldRow | null, userId: string, fingerprint: string, now = new Date().toISOString()): HeldDecision {
  if (!row) return { ok: false, status: 404, reason: 'missing', message: 'No held export with that identifier.' };
  if (row.user_id !== userId) return { ok: false, status: 404, reason: 'not-yours', message: 'No held export with that identifier.' };
  if (row.downloaded_at) return { ok: false, status: 410, reason: 'downloaded', message: 'This export has already been downloaded. Prepare it again.' };
  if (row.expires_at <= now || !row.content) return { ok: false, status: 410, reason: 'expired', message: 'This export has expired. Prepare it again.' };
  if (row.fingerprint !== fingerprint) return { ok: false, status: 409, reason: 'scope-changed', message: 'Your role or reporting reach changed after this export was prepared, so it is not delivered. Prepare it again.' };
  return { ok: true };
}
