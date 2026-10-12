import type { Enrolment } from './programmes';
import type { Person } from './types';
export type ProgrammeEpisode = Pick<Enrolment, 'id' | 'packId' | 'packVersion' | 'episodeLabel' | 'startDate' | 'state' | 'registration'> & {
  packName: string;
  destination?: { state: string; name: string; receipt?: string; rejectionReason?: string; requestedAt?: string; acceptedAt?: string; rejectedAt?: string; activeAt?: string };
};
export type ProgrammeStatusResponse = { organisationId: string; actorId: string; person: Pick<Person, 'id' | 'name' | 'village' | 'version'>; episodes: ProgrammeEpisode[] };

// Copy only the documentary fields needed for this read screen. Delivery keys,
// payloads, provider configuration and unrelated patient partitions stay server-side.
export function programmeEpisode(e: Enrolment, packName: string): ProgrammeEpisode {
  if (!e || typeof e.id !== 'string' || !e.id || typeof e.packId !== 'string' || !e.packId || !Number.isSafeInteger(e.packVersion) || e.packVersion < 1 || typeof e.episodeLabel !== 'string' || !['active', 'closed'].includes(e.state) || !['not_submitted', 'submitted'].includes(e.registration)) throw Error('Programme episode source is unavailable.');
  const d = e.destinationEnrolment;
  if (d && (typeof d.state !== 'string' || typeof d.destinationName !== 'string')) throw Error('Destination status source is unavailable.');
  const text = (value: unknown) => typeof value === 'string' ? value : undefined;
  return { id: e.id, packId: e.packId, packVersion: e.packVersion, packName, episodeLabel: e.episodeLabel, startDate: e.startDate, state: e.state, registration: e.registration,
    ...(d ? { destination: { state: d.state, name: d.destinationName, receipt: text(d.destinationReceipt), rejectionReason: text(d.rejectionReason), requestedAt: text(d.requestedAt), acceptedAt: text(d.acceptedAt), rejectedAt: text(d.rejectedAt), activeAt: text(d.activeAt) } } : {}) };
}
export function programmeStatusText(e: ProgrammeEpisode) {
  const d = e.destination;
  const receipt = typeof d?.receipt === 'string' && d.receipt.trim();
  const rejectionReason = typeof d?.rejectionReason === 'string' && d.rejectionReason.trim();
  const unverified = { status: 'Destination evidence unavailable or inconsistent.', next: 'Ask the programme steward to check the recorded evidence. No acceptance or retry permission is inferred.' };
  if (!d) return e.registration === 'not_submitted' ? { status: 'Local episode recorded. Destination evidence not recorded.', next: 'Missing destination evidence does not prove no request was sent. Ask the programme steward to check existing receipts; do not resend automatically.' } : unverified;
  switch (d.state) {
    case 'requested': return { status: 'Simulation request pending.', next: 'A request is not acceptance. Check its existing workflow; this page sends nothing.' };
    case 'uncertain': return { status: 'Simulation outcome unresolved.', next: 'The original worker must look up the receipt before any resend. Uncertain is neither rejected nor safe to retry.' };
    case 'retryable': return { status: 'Simulation lookup recorded no destination entry.', next: 'Review the existing original-key workflow. This page does not retry.' };
    case 'rejected': return rejectionReason && e.registration === 'not_submitted'
      ? { status: 'Simulation rejected. Local episode retained; not externally enrolled.', next: d.rejectionReason }
      : unverified;
    case 'accepted': return receipt && e.registration === 'not_submitted'
      ? { status: 'Simulation accepted. Programme activation still required.', next: 'A recorded simulator reference is not real official registration. Use the existing authorised review workflow.' }
      : unverified;
    case 'active': return receipt && e.registration === 'submitted'
      ? { status: 'Simulation activated locally.', next: 'Real official registration is not established by this simulator record.' }
      : unverified;
    default: return unverified;
  }
}
