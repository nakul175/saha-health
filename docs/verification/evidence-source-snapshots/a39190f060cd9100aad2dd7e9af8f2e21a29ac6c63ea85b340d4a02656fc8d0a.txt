import {readState} from './store';
import {clinicalAggregateAlert} from './aggregate-alert-disclosure';
import {normallyAllowed,purposePermits} from './access';
import {entryScope,activeEntry,governanceManager} from './governance';
import type { D1Database } from '@cloudflare/workers-types';
import { digest, fail } from './core';
import {z} from 'zod';
import { CHAIN_VERSION, HASHING, chainHead, contentDigest, verifyChain, type EventRow } from './audit-chain';
import { fhirDocument } from './fhir-document';
import { TERMINAL } from './referral-rules';
import type { Member } from './types';
// Slice 6m: organisation data exit (BR-OPS-07, NFR-22).
//
// An owner exports the organisation's stored records as one uncompressed POSIX tar archive:
//   README.txt            how to read and check the archive
//   manifest.json         export id, time, exporter, schema version, scope, and every file with rows and SHA-256
//   SHA256SUMS            `sha256sum -c` list over every other file, manifest included
//   tables/<table>.jsonl  one JSON object per stored row, columns exactly as stored (JSON text columns stay text)
//   media/<id>.<ext>      media content; the media row keeps its SHA-256, the `data` column is left out
//   handover/open-items.jsonl  unresolved external actions and open patient tasks with their named owner
//   fhir/<visit>.json     optional FHIR document Bundle per current confirmed visit
// Owner authority does not override patient scope: patient-linked rows are exported only for
// patients in the owner's normal care scope (team membership; ASHAs their assigned patients;
// administrators none; emergency grants are not export authority). Other patient-linked rows are
// counted as withheld; withheld audit events are listed with their digests so the chain still verifies.
// Secrets and credentials are never stored in these tables' exported columns: invitation token
// hashes, command receipt results (which can carry a newly issued invitation token), account email
// and other-organisation pointers are left out, and credential bindings are names, not values.
export const EXPORT_FORMAT = 'saha-organisation-export-v1';
// The last migration this code expects; the contract test ties it to the drizzle directory.
export const SCHEMA_MIGRATION = '0031_installed_pack_work';
export const PAGE = 1000;
export const MAX_ROWS = 250000;
export const MAX_BYTES = 60 * 1024 * 1024;
type Value = string | number | null;
type Row = Record<string, Value>;
// Slice 6z: 'self' rows are one member's own (their in-app alert inbox); only the exporter's own rows are exported.
type Scope = 'org' | 'person' | 'visit' | 'team' | 'identity' | 'receipt' | 'audit' | 'self' | 'figure' | 'protected' | 'calendar' | 'completeness';
export type TableSpec = { table: string; order: string; scope: Scope; omit?: string[]; note?: string };
export const TABLES: TableSpec[] = [
  {table:'installed_pack_work_events',order:'at,id',scope:'protected',note:'Append-only installed programme policy and patient work events contain protected source/occurrence bodies. Withheld from ordinary operational export; protected reconstruction remains separately governed.'},
  { table: 'organisations', order: 'id', scope: 'org' },
  { table: 'teams', order: 'id', scope: 'org' },
  { table: 'memberships', order: 'user_id', scope: 'org' },
  { table: 'team_members', order: 'team_id,user_id', scope: 'org' },
  { table: 'invitations', order: 'id', scope: 'org', omit: ['token_hash'], note: 'The token hash is a credential verifier and is left out.' },
  { table: 'integrations', order: 'id', scope: 'org', note: 'credentialBinding names a server secret; no secret value is stored or exported.' },
  { table: 'operations', order: 'org_id', scope: 'org', note: 'The indicator differencing ledger (indicatorReleases) is server-side protection state and is left out of data.' },
  { table: 'pilot', order: 'org_id', scope: 'org' },
  { table: 'outreach', order: 'org_id', scope: 'org' },
  { table: 'expansions', order: 'org_id', scope: 'org' },
  { table: 'governance', order: 'org_id', scope: 'org' },
  { table: 'retention', order: 'org_id', scope: 'org' },
  { table: 'legacy_migrations', order: 'owner_id', scope: 'org' },
  { table: 'availability_samples', order: 'slot,source', scope: 'org', note: 'Immutable fixed-cadence synthetic operational observations, no patient identifiers or raw errors; hosted availability remains unmeasured.' },
  { table: 'work_burden_samples', order: 'at,actor_id,id', scope: 'person', note: 'Protected client-reported work time and exact mutation receipt bindings; no facts or ticket text.' },
  { table: 'work_support_events', order: 'request_id,sequence', scope: 'person', note: 'Immutable scoped fixed-category support workflow; no external send or ticket text.' },
  { table: 'device_work_grants', order: 'actor_id,lease_id', scope: 'person', note: 'Immutable original-worker grant metadata; no clinical packet or device fingerprint.' },
  { table: 'device_registration_grants', order: 'actor_id,registration_id', scope: 'person', note: 'Original accepted registration ownership and immutable baseline; legacy history explicitly unavailable.' },
  { table: 'device_registration_receipts', order: 'actor_id,receipt_key', scope: 'person', note: 'Exact accepted original-worker registration receipt bindings.' },
  { table: 'clinical_source_documents', order: 'id', scope: 'org', note: 'Immutable bounded synthetic acquired source documents; licensing/clinical acceptance pending.' },
  { table: 'device_registration_wire_receipts', order: 'actor_id,receipt_key,wire_hash', scope: 'person', note: 'Exact authenticated registration wire digests; no command bodies.' },
  { table: 'device_match_copies', order: 'actor_id,id', scope: 'self', note: 'Only original actor protected candidate ID/version and query hash provenance; whole receipts outside current candidate scope are withheld; no raw search.' },
  { table: 'device_work_events', order: 'at,id', scope: 'self', note: 'Only the exporter\'s redacted diagnostics, deletion instructions and client-attested acknowledgements; server evidence is not pruned.' },
  { table: 'offline_open_reports', order: 'received_at,id', scope: 'self', note: 'Only this exporter’s fixed historical client-reported metadata and opaque references; no patient pointers or raw material.' },
  { table: 'offline_open_subjects', order: 'report_id,actor_id,person_id', scope: 'person', note: 'Trusted server-derived subject provenance, filtered by current patient visibility; client occurrence is not proof of authorized access.' },
  { table: 'request_metrics', order: 'bucket,route,status', scope: 'org' },
  { table: 'alert_occurrences', order: 'opened_at,id', scope: 'org', note: 'Slice 6v: alert occurrences and escalations; alert ids, titles and member ids only.' },
  { table: 'alert_notifications', order: 'delivered_at,id', scope: 'self', note: 'Slice 6v: in-app alert notifications; no patient names or clinical content. Slice 6z: only the exporter\'s own notifications; other members\' notifications carry counts from their own care scope and are left out (not counted as withheld patient rows).' },
  { table: 'notification_messages', order: 'sent_at,id', scope: 'self', note: 'Slice 10b: simulated out-of-app messages (demonstration simulator) with their receipts; alert ids, titles, counts and member ids only, no patient names, identifiers or contact detail. Slice 10k: only the exporter\'s own messages, as for in-app notifications (6z): other members\' messages carry counts from their own care scopes. The channel settings are in the operations row.' },
  { table: 'patients', order: 'id', scope: 'person' },
  { table: 'visits', order: 'id', scope: 'person' },
  { table: 'plans', order: 'id', scope: 'visit' },
  { table: 'ai_results', order: 'id', scope: 'visit' },
  { table: 'submissions', order: 'id', scope: 'person' },
  { table: 'referrals', order: 'id', scope: 'person' },
  { table: 'record_revisions', order: 'created_at,id', scope: 'person' },
  { table: 'media', order: 'id', scope: 'person', omit: ['data','storage_ref'], note: 'Content is in media/<id>.<ext>; the row sha256 column is the base64-encoded SHA-256 of that content.' },
  { table: 'households', order: 'id', scope: 'team' },
  { table: 'caseload_transfers', order: 'id', scope: 'team' },
  { table: 'identity_cases', order: 'id', scope: 'identity' },
  { table: 'rights_requests', order: 'id', scope: 'person' },
  { table:'indicator_figures',order:'created_at,id',scope:'figure',omit:['data'],note:'Immutable original figure metadata and parent lineage only; data contains protected cells/unit hashes and is omitted. Every original cohort member must remain in current normal reporting scope.' },
  { table:'indicator_figure_units',order:'figure_id,person_id',scope:'protected',note:'Server-only unsuppressed per-person counting material is withheld. Ordinary operational export is not a full report reconstruction archive.' },
  { table:'indicator_figure_events',order:'figure_id,sequence',scope:'figure',note:'Exact immutable lifecycle history for included figures; historical actor/reviewer evidence does not confer current authority.' },
  { table:'indicator_figure_receipts',order:'figure_id,actor_id,key',scope:'figure',note:'Exact receipt metadata only for included figures with validated fixed outcome shape and matching immutable event; no protected cells or source units.' },
  { table:'indicator_figure_disclosures',order:'actor_id,figure_id,release_hash',scope:'protected',note:'Retained viewer edition disclosure ledger is server-side privacy protection state and is withheld.' },
  {table:'reporting_calendars',order:'id,version',scope:'calendar',note:'Exact immutable configured calendar JSON, only with current normal reporting access to every configured team member.'},
  {table:'reporting_calendar_events',order:'calendar_id,calendar_version,sequence',scope:'calendar',note:'Original independent review/release history, never current clinical or source acceptance.'},
  {table:'reporting_coverage',order:'calendar_id,calendar_version,team_id,source_id,period_id,version',scope:'calendar',note:'Exact operator-declared source evidence including immutable original producer version when present; no inferred clinical denominator.'},
  {table:'reporting_completeness_receipts',order:'calendar_id,calendar_version,actor_id,key',scope:'calendar',note:'Validated fixed lifecycle/declaration outcome references only; no raw request or private snapshot body.'},
  {table:'reporting_completeness_snapshots',order:'created_at,id',scope:'completeness',omit:['data'],note:'Scoped immutable snapshot digest/basis and included figure linkage only. Private per-source timing/coverage body is withheld; this archive cannot reconstruct that body.'},
  { table: 'command_receipts', order: 'created_at,actor_id,key', scope: 'receipt', omit: ['result'], note: 'The stored result is left out: it can carry a newly issued invitation token.' },
  { table: 'audit_events', order: '(seq IS NOT NULL),seq,at,id', scope: 'audit', note: 'Events without seq were written before the chain and are sealed by the genesis marker (seq 0).' },
];
export const PROTECTED_ALERT_EXPORT_NOTICE='Uncertified historical care-reporting alert records are omitted from ordinary export. Linked protected audit content retains only its existing chain digest. Original server history is retained; no historical aggregate reconstruction is certified.';
export const EXCLUDED = [
  {what:'Uncertified historical care-reporting alert records and linked audit content',why:PROTECTED_ALERT_EXPORT_NOTICE},
  {what:'reporting_completeness_snapshots.data',why:'Private original per-source timing/coverage sidecars are withheld. Calendar/declaration history and scoped snapshot hashes are portable, but original report/completeness reconstruction requires separately governed protected material and remains open.'},
  {what:'indicator_figures.data, indicator_figure_units, indicator_figure_disclosures',why:'Protected report cells, unsuppressed per-person counting material and retained disclosure privacy ledger. Metadata/history portability does not provide full report reconstruction; governed privileged reproducibility/portability remains open.'},
  { what: 'abha_review_reservations', why: 'Server-side anti-enumeration protection state; opaque request fingerprints and review-event references, never clinical records.' },
  { what: 'workspaces', why: 'Release 0.1 per-account source kept unchanged for rollback; its migrated content is in the organisation tables and legacy_migrations records the source hash.' },
  { what: 'accounts.email, accounts.active_org_id', why: 'Sign-in contact and a pointer to other organisations; members are identified by user_id, account_code and display_name.' },
  { what: 'invitations.token_hash', why: 'Credential verifier.' },
  { what: 'command_receipts.result', why: 'Can carry a newly issued invitation token.' },
  { what: 'media_custody', why: 'Private object keys, staged/quarantined intents and request keys are internal custody metadata. Only scoped verified linked bytes and portable media metadata are exported.' },
  { what: 'server configuration and credentials', why: 'Held as deployment secrets, never in the database.' },
];
const MEDIA_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a' };
export type ExportFile = { path: string; bytes: Uint8Array; table?: string; rows?: number; withheld?: number; withheldEntries?: number; otherMembersRows?: number; columns?: string[]; omitted?: string[]; note?: string };
export type ExportInput = { orgId: string; member: Member; exporter: { userId: string; name: string; accountCode: string }; exportId: string; now: string; includeFhir: boolean; environment: string; mediaBytes?:(row:Row)=>Promise<Uint8Array> };
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
export const sha256Bytes = async (b: Uint8Array) => hex(await crypto.subtle.digest('SHA-256', b as unknown as ArrayBuffer));
const fromB64 = (s: string) => { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const jsonl = (rows: unknown[]) => enc.encode(rows.map(r => JSON.stringify(r) + '\n').join(''));

async function readAll(db: D1Database, spec: TableSpec, orgId: string): Promise<Row[]> {
  const out: Row[] = [];
  const where = spec.table === 'organisations' ? 'id=?' : 'org_id=?';
  for (let offset = 0; ; offset += PAGE) {
    const page = (await db.prepare(`SELECT * FROM ${spec.table} WHERE ${where} ORDER BY ${spec.order} LIMIT ${PAGE} OFFSET ?`).bind(orgId, offset).all<Row>()).results;
    out.push(...page);
    if (out.length > MAX_ROWS) fail(413, 'This organisation is larger than a single export can hold. Ask the operator for a staged export.');
    if (page.length < PAGE) break;
  }
  return out;
}
const without = (r: Row, omit: string[] = []) => Object.fromEntries(Object.entries(r).filter(([k]) => !omit.includes(k)));
// Slice 6p (independent review): organisation-level documents (governance, outreach, retention and the
// other org-scope JSON aggregates) hold patient-linked entries — safety cases, shadow results, outreach
// items and messages, person holds. Any entry, at any depth, that carries a personId outside the exported
// patient set is left out and counted; an array element is removed, an object property is removed.
// Entries without a personId (organisation holds, templates, plan headers) are kept.
// Slice 6u (fourth review): team-scoped rows (households, caseload transfers) are scoped the same way, and
// patient references held as bare ids are scoped too: `idLists` names properties whose value is an array of
// patient ids (caseload `personIds`, `moved`), `idMaps` names properties keyed by patient id (`assignments`).
export const PATIENT_ID_LISTS = ['personIds', 'moved'], PATIENT_ID_MAPS = ['assignments'];
export function scopeEntries(value: unknown, keep: (personId: string) => boolean, idLists: string[] = [], idMaps: string[] = []): { value: unknown; withheld: number } {
  let withheld = 0;
  const linked = (x: unknown) => !!x && typeof x === 'object' && !Array.isArray(x) && (x as Record<string, unknown>).personId != null;
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.filter(e => { if (linked(e) && !keep(String((e as Record<string, unknown>).personId))) { withheld++; return false; } return true; }).map(walk);
    if (x && typeof x === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(x)) {
        if (linked(v) && !keep(String((v as Record<string, unknown>).personId))) { withheld++; continue; }
        if (idLists.includes(k) && Array.isArray(v)) { out[k] = v.filter(e => { if (typeof e === 'string' && !keep(e)) { withheld++; return false; } return true; }); continue; }
        if (idMaps.includes(k) && v && typeof v === 'object' && !Array.isArray(v)) { out[k] = Object.fromEntries(Object.entries(v).filter(([id]) => { if (!keep(id)) { withheld++; return false; } return true; })); continue; }
        out[k] = walk(v);
      }
      return out;
    }
    return x;
  };
  return { value: walk(value), withheld };
}

// Builds every file of the archive. Pure over the database: nothing is written.
export async function buildExport(db: D1Database, input: ExportInput) {
  const { orgId, member: m } = input;
  const data: Record<string, Row[]> = {};
  // The chain is verified and its head read before any table, and audit events chained after that head
  // are left out, so the exported chain ends at a recorded head even while commands continue.
  // Other tables are read page by page, not in one transaction: records changed during the export may
  // appear in their newer state.
  const chain = await verifyChain(db, orgId, undefined, input.now), cut = await chainHead(db, orgId);
  for (const spec of TABLES) data[spec.table] = await readAll(db, spec, orgId);
  // Actor ownership and today's scope cannot certify a historical clinical aggregate.
  // Filter before any row/withheld/other-member/column totals; do not expose an omitted count.
  const protectedAlertSubjects=new Set<string>(),protectedAlertAuditIds=new Set<string>();
  for(const table of ['alert_occurrences','alert_notifications','notification_messages']){
    for(const r of data[table])if(clinicalAggregateAlert(String(r.alert_id))){protectedAlertSubjects.add(String(r.id));if(r.audit_id)protectedAlertAuditIds.add(String(r.audit_id));}
    data[table]=data[table].filter(r=>!clinicalAggregateAlert(String(r.alert_id)));
  }
  const sourceState=data.clinical_source_documents.length?await readState(db,orgId,[],m.userId,true):null;
  data.audit_events = data.audit_events.filter(r => r.seq == null || (cut !== null && Number(r.seq) <= cut.seq));
  const org = data.organisations[0];
  if (!org) fail(404, 'Organisation not found.');
  // Normal care scope, as access.ts normallyAllowed, over the stored patient columns.
  // Slice 6p: the sandbox provider role has no patient scope either (defence in depth; a sandbox holds none).
  const noPatients = m.role === 'admin' || m.role === 'provider';
  const inScope = (p: Row) => {try{return m.status==='active'&&!noPatients&&normallyAllowed(m,storedExportPerson(p));}catch{return false;}};
  const people = new Set(data.patients.filter(inScope).map(p => String(p.id)));
  const visits = new Set(data.visits.filter(v => people.has(String(v.person_id))).map(v => String(v.id)));
  const teamScope = (r: Row) => m.status === 'active' && !noPatients && m.role !== 'asha' && m.teamIds.includes(String(r.team_id));
  const allowed = (spec: TableSpec, r: Row) => spec.scope === 'org' ? true : spec.scope === 'person' ? people.has(String(r.person_id ?? r.id)) : spec.scope === 'visit' ? visits.has(String(r.visit_id)) : spec.scope === 'team' ? teamScope(r) : spec.scope === 'identity' ? people.has(String(r.survivor_id)) && people.has(String(r.duplicate_id)) : r.person_id == null || people.has(String(r.person_id));
  // Figure metadata cannot be narrowed by deleting individual counting units: the original cohort is indivisible.
  const reporting=m.status==='active'&&m.role!=='admin'&&m.role!=='provider'&&m.role!=='asha'&&(m.role==='supervisor'||m.isOwner)&&purposePermits(m,'reporting');
  const figurePeople=new Set(data.patients.filter(r=>{let p:any;try{p=JSON.parse(String(r.data));}catch{return false;}return people.has(String(r.id))&&!p.mergedInto&&normallyAllowed(m,{...p,id:String(r.id),teamId:String(r.team_id),assignedTo:r.assigned_to} as any);}).map(r=>String(r.id)));
  const figureById=new Map(data.indicator_figures.map(f=>[String(f.id),f])),eventById=new Map(data.indicator_figure_events.map(e=>[String(e.id),e])),unitsByFigure=new Map<string,Row[]>();for(const u of data.indicator_figure_units){const id=String(u.figure_id);unitsByFigure.set(id,[...(unitsByFigure.get(id)??[]),u]);}
  const figures=new Set(data.indicator_figures.filter(f=>{const units=unitsByFigure.get(String(f.id))??[];return reporting&&units.length>0&&units.every(u=>figurePeople.has(String(u.person_id)));}).map(f=>String(f.id)));
  for(const f of data.indicator_figures){const seen=new Set<string>();let at:Row|undefined=f;while(at){const id=String(at.id);if(seen.has(id)||!figures.has(id)){figures.delete(String(f.id));break;}seen.add(id);if(!at.parent_id)break;at=figureById.get(String(at.parent_id));if(!at){figures.delete(String(f.id));break;}}}
  const figureCohort=[...new Set(data.indicator_figure_units.filter(u=>figures.has(String(u.figure_id))).map(u=>String(u.person_id)))];
  const safeFigureReceipt=(r:Row)=>{let x:any;try{x=JSON.parse(String(r.result));}catch{return false;}if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join()!=='eventId,figureId,sequence,status'||x.figureId!==r.figure_id||!Number.isInteger(x.sequence))return false;const e=eventById.get(String(x.eventId));return !!e&&e.figure_id===r.figure_id&&e.sequence===x.sequence&&e.kind===x.status&&e.actor_id===r.actor_id;};
  // Completeness metadata follows whole configured teams, never owner or administrator privilege.
  const calendarKey=(id:unknown,v:unknown)=>JSON.stringify([id,v]), calendars=new Map<string,any>();
  if(data.reporting_calendars.length){const {validateCalendar}=await import('./reporting-completeness');for(const r of data.reporting_calendars){try{const sp=validateCalendar(JSON.parse(String(r.data)));if(await digest(sp)!==r.digest)continue;if(!reporting||!sp.teamIds.every(id=>m.teamIds.includes(id))||data.patients.some(p=>{let d:any;try{d=JSON.parse(String(p.data));}catch{return true;}return sp.teamIds.includes(String(p.team_id))&&!d.mergedInto&&!figurePeople.has(String(p.id));}))continue;calendars.set(calendarKey(r.id,r.version),sp);}catch{/* Malformed immutable evidence is withheld as a whole, never rewritten. */}}}
  const coverageShape=z.object({id:z.string(),calendarId:z.string(),calendarVersion:z.number().int().positive(),teamId:z.string(),sourceId:z.string(),periodId:z.string(),version:z.number().int().positive(),status:z.enum(['complete','partial','outage','unknown']),through:z.string().datetime().nullable(),evidenceHash:z.string().regex(/^[a-f0-9]{64}$/),sourceVersion:z.object({contractVersion:z.literal(1),kind:z.enum(['online-visits','field-syncs','imports','programme-receipts','mis','ehr']),integrationId:z.string().nullable(),integrationVersion:z.number().int().positive().nullable()}).strict().optional(),actorId:z.string(),memberVersion:z.number().int().positive(),role:z.enum(['clinician','supervisor']),at:z.string().datetime()}).strict();
  const eventShape=z.object({id:z.string(),sequence:z.number().int().positive(),kind:z.enum(['proposed','approved','rejected','released']),actorId:z.string(),memberVersion:z.number().int().positive(),role:z.enum(['clinician','supervisor']),at:z.string().datetime(),effectiveAt:z.string().datetime().optional(),reviewId:z.string().optional()}).strict();
  const safeEvents=new Set<string>(),safeCoverage=new Set<string>(),safeReceipts=new Set<string>(),safeSnapshots=new Set<string>();
  for(const [key] of calendars){const [id,version]=JSON.parse(key),cr=data.reporting_calendars.find(r=>r.id===id&&r.version===version)!,es=data.reporting_calendar_events.filter(r=>r.calendar_id===id&&r.calendar_version===version);let valid=es.length>0&&es.every((r,i)=>{let raw;try{raw=JSON.parse(String(r.data));}catch{return false;}const e=eventShape.safeParse(raw);return e.success&&e.data.id===r.id&&e.data.sequence===r.sequence&&r.sequence===i+1&&e.data.kind===r.kind&&e.data.actorId===r.actor_id&&e.data.memberVersion===r.member_version&&e.data.role===r.role&&e.data.at===r.at;});if(valid){const e=es.map(r=>JSON.parse(String(r.data)));valid=e[0].kind==='proposed'&&e[0].actorId===cr.author_id&&e[0].memberVersion===cr.author_version&&e.length<=3&&e.every((x,i)=>i===0?!x.reviewId&&!x.effectiveAt:i===1?['approved','rejected'].includes(x.kind)&&x.actorId!==cr.author_id&&!x.reviewId&&!x.effectiveAt:x.kind==='released'&&e[1].kind==='approved'&&x.actorId===cr.author_id&&x.reviewId===e[1].id&&!!x.effectiveAt);}if(!valid){calendars.delete(key);continue;}es.forEach(r=>safeEvents.add(String(r.id)));}
  for(const r of data.reporting_coverage){try{const sp=calendars.get(calendarKey(r.calendar_id,r.calendar_version)),d=coverageShape.parse(JSON.parse(String(r.data)));if(!sp||d.id!==r.id||d.calendarId!==r.calendar_id||d.calendarVersion!==r.calendar_version||d.teamId!==r.team_id||d.sourceId!==r.source_id||d.periodId!==r.period_id||d.version!==r.version||!sp.teamIds.includes(d.teamId)||!sp.sources.some((x:any)=>x.id===d.sourceId&&(!d.sourceVersion||x.kind===d.sourceVersion.kind&&x.integrationId===d.sourceVersion.integrationId))||!sp.periods.some((x:any)=>x.id===d.periodId))continue;safeCoverage.add(String(r.id));}catch{}}
  const outcome=z.object({calendarId:z.string(),calendarVersion:z.number().int().positive(),eventId:z.string(),sequence:z.number().int().positive(),type:z.enum(['propose','review','release','declare'])}).strict();
  for(const r of data.reporting_completeness_receipts){try{const x=outcome.parse(JSON.parse(String(r.result)));if(!calendars.has(calendarKey(r.calendar_id,r.calendar_version))||x.calendarId!==r.calendar_id||x.calendarVersion!==r.calendar_version)continue;const e=x.type==='declare'?data.reporting_coverage.find(e=>e.id===x.eventId&&safeCoverage.has(String(e.id))):data.reporting_calendar_events.find(e=>e.id===x.eventId&&safeEvents.has(String(e.id)));if(!e||e.calendar_id!==r.calendar_id||e.calendar_version!==r.calendar_version)continue;const d=JSON.parse(String(e.data));if((x.type==='declare'?d.actorId:e.actor_id)!==r.actor_id||(x.type==='declare'?d.version:e.sequence)!==x.sequence||x.type!=='declare'&&!({propose:['proposed'],review:['approved','rejected'],release:['released']}[x.type]).includes(String(e.kind)))continue;safeReceipts.add(JSON.stringify([r.actor_id,r.key]));}catch{}}
  for(const r of data.reporting_completeness_snapshots){try{const d=JSON.parse(String(r.data));if(!reporting||await digest(d)!==r.digest||!Array.isArray(d.calendars)||!d.calendars.length&&!r.figure_id||d.calendars.some((x:any)=>!calendars.has(calendarKey(x.id,x.version)))||r.figure_id&&!figures.has(String(r.figure_id)))continue;safeSnapshots.add(String(r.id));}catch{}}
  const calendarTeams=[...new Set<string>([...calendars.values()].flatMap(sp=>sp.teamIds))];
  const completenessBasis=data.reporting_calendars.length||data.reporting_completeness_snapshots.length?await digest(COMPLETENESS_BASIS_TABLES.map(table=>({table,rows:data[table]}))):null;
  const files: ExportFile[] = [];
  let totalRows = 0, totalWithheld = 0, totalEntries = 0;
  const media: ExportFile[] = [];
  for (const spec of TABLES) {
    const rows = data[spec.table], lines: unknown[] = [];
    let withheld = 0, entries = 0, others = 0;
    for (const r of rows) {
      if(spec.scope==='audit'&&(protectedAlertAuditIds.has(String(r.id))||protectedAlertSubjects.has(String(r.subject)))){
        // Preserve chain position without time/action/subject/detail. This retains structural
        // event cardinality, an existing audit-export boundary, never a certified clinical count.
        lines.push({org_id:r.org_id,id:r.id,seq:r.seq??null,prev_hash:r.prev_hash??null,hash:r.hash??null,content:await contentDigest(r as unknown as EventRow),withheld:'Protected event content; digest only.'});continue;
      }
      if(spec.scope==='calendar'&&!(spec.table==='reporting_calendars'?calendars.has(calendarKey(r.id,r.version)):spec.table==='reporting_calendar_events'?safeEvents.has(String(r.id)):spec.table==='reporting_coverage'?safeCoverage.has(String(r.id)):safeReceipts.has(JSON.stringify([r.actor_id,r.key])))||spec.scope==='completeness'&&!safeSnapshots.has(String(r.id))){withheld++;continue;}
      if(spec.scope==='protected'||spec.scope==='figure'&&(!figures.has(String(spec.table==='indicator_figures'?r.id:r.figure_id))||spec.table==='indicator_figure_receipts'&&!safeFigureReceipt(r))){withheld++;continue;}

      if (spec.scope === 'self' && String(r.user_id ?? r.actor_id) !== m.userId) { others++; continue; }
      if(spec.table==='clinical_source_documents'){const e=sourceState?.governance?.entries.find(e=>e.id===r.entry_id);if(!e||!entryScope(m,e)||!((governanceManager(m)&&m.role!=='provider')||['asha','clinician'].includes(m.role)&&activeEntry(sourceState!,e))){withheld++;continue;}try{await (await import('./clinical-source')).verifiedSourceDocument(db,orgId,e,input.now);}catch{withheld++;continue;}}
      if(spec.table==='device_match_copies'){let candidates:any;try{candidates=JSON.parse(String(r.candidate_versions));}catch{candidates=null;}if(!Array.isArray(candidates)||candidates.some(x=>!people.has(String(x.id)))){withheld++;continue;}}
      if (spec.table === 'patients' ? !people.has(String(r.id)) : !allowed(spec, r)) {
        withheld++;
        // Audit events outside scope keep their place in the chain as digests.
        if (spec.scope === 'audit') lines.push({ org_id: r.org_id, id: r.id, seq: r.seq ?? null, prev_hash: r.prev_hash ?? null, hash: r.hash ?? null, content: await contentDigest(r as unknown as EventRow), withheld: 'Patient-linked event outside the exporter\'s care scope; content digest only.' });
        continue;
      }
      if (spec.table === 'media' && !r.deleted_at && (r.data || r.storage_ref)) { if(r.storage_ref&&!input.mediaBytes)fail(503,'Private media resolver unavailable; no incomplete archive was produced.'); if(media.reduce((n,f)=>n+f.bytes.length,0)+Number(r.size)>MAX_BYTES)fail(413,'Media exceeds the bounded export budget. Ask for a staged export.'); const content=input.mediaBytes?await input.mediaBytes(r):fromB64(String(r.data)); if(media.reduce((n,f)=>n+f.bytes.length,0)+content.length>MAX_BYTES)fail(413,'Media exceeds the bounded export budget. Ask for a staged export.'); media.push({path:`media/${r.id}.${MEDIA_EXT[String(r.mime)]??'bin'}`,bytes:content,note:`Media ${r.id} for visit ${r.visit_id}`}); }
      const out = without(r, spec.omit);
      // Slice 6p: patient-linked entries inside an organisation document follow the same care scope.
      // The data text is re-serialised only when something was left out; otherwise it stays as stored.
      // Slice 6u: team-scoped rows (households, caseload transfers) too: a member or transferred patient outside
      // the exporter's patient scope is left out of the row's data, with its relationship and any end reason.
      if ((spec.scope === 'org' || spec.scope === 'team') && typeof r.data === 'string' && r.data) {
        let doc: unknown = null; try { doc = JSON.parse(r.data); } catch { doc = null; }
        if (doc && typeof doc === 'object') { const scoped = spec.scope === 'team' ? scopeEntries(doc, id => people.has(id), PATIENT_ID_LISTS, PATIENT_ID_MAPS) : scopeEntries(doc, id => people.has(id)); if (scoped.withheld) { out.data = JSON.stringify(scoped.value); entries += scoped.withheld; } }
      }
      // Slice 6w (fifth review, finding 6): the indicator differencing ledger is server-side protection state
      // (hashed filters and unsuppressed per-cell counts from every viewer's queries); it is not exported.
      if (spec.table === 'operations' && typeof out.data === 'string' && out.data) {
        let doc: Record<string, unknown> | null = null; try { doc = JSON.parse(out.data as string); } catch { doc = null; }
        if (doc && typeof doc === 'object' && 'indicatorReleases' in doc) { delete doc.indicatorReleases; out.data = JSON.stringify(doc); }
      }
      lines.push(out);
    }
    totalRows += lines.length; totalWithheld += withheld; totalEntries += entries;
    const stored = rows.length ? Object.keys(rows[0]) : [];
    files.push({ path: `tables/${spec.table}.jsonl`, bytes: jsonl(lines), table: spec.table, rows: lines.length, withheld, ...(spec.scope === 'self' ? { otherMembersRows: others } : {}), ...(spec.scope === 'org' || spec.scope === 'team' ? { withheldEntries: entries } : {}), columns: stored.filter(c => !(spec.omit ?? []).includes(c)), omitted: spec.omit ?? [], note: entries ? `${spec.note ? spec.note + ' ' : ''}${entries} patient-linked entries inside data are left out (outside the exporter's care scope); data is re-serialised without them.` : spec.note });
  }
  // Member accounts: identifiers and names only.
  const accounts = (await db.prepare('SELECT user_id,account_code,display_name,created_at FROM accounts WHERE user_id IN (SELECT user_id FROM memberships WHERE org_id=?) ORDER BY user_id').bind(orgId).all<Row>()).results;
  files.splice(2, 0, { path: 'tables/accounts.jsonl', bytes: jsonl(accounts), table: 'accounts', rows: accounts.length, withheld: 0, columns: ['user_id', 'account_code', 'display_name', 'created_at'], omitted: ['email', 'active_org_id'], note: 'Accounts of this organisation\'s members only.' });
  totalRows += accounts.length;
  files.push(...media);

  // Hand-over list: unresolved external actions and open patient tasks with a named owner.
  const names = new Map(data.memberships.map(x => [String(x.user_id), { name: accounts.find(a => a.user_id === x.user_id)?.display_name ?? null, status: String(x.status) }]));
  const owner = (id: unknown) => { const n = id ? names.get(String(id)) : undefined; return { ownerId: id ?? null, ownerName: n?.name ?? null, ownerStatus: !id ? 'unassigned' : !n ? 'not-a-member' : n.status }; };
  const handover: Record<string, unknown>[] = [];
  const parsed = (r: Row) => { try { return JSON.parse(String(r.data)); } catch { return {}; } };
  const patientRows = data.patients.filter(p => people.has(String(p.id)));
  for (const s of data.submissions.filter(x => people.has(String(x.person_id)))) {
    const d = parsed(s);
    if (['queued', 'sending', 'uncertain', 'retryable'].includes(String(s.state))) handover.push({ kind: 'external-action', system: 'programme-mis', id: s.id, personId: s.person_id, visitId: s.visit_id, destination: d.connectorName ?? d.connectorId ?? null, state: s.state, since: d.updatedAt ?? d.createdAt ?? null, disposition: 'Unresolved. Look up the destination receipt before any retry; never resend blindly.' });
  }
  for (const p of patientRows) {
    const d = parsed(p);
    for (const o of d.ehr?.operations ?? []) if (['running', 'uncertain', 'conflict'].includes(o.state)) handover.push({ kind: 'external-action', system: 'ehr', id: o.id, personId: p.id, visitId: o.visitId, state: o.state, since: o.at, disposition: o.state === 'conflict' ? 'Conflict: several or different documents carry this identifier at the EHR. The reconciliation owner resolves it with the partner; never resend.' : 'Unresolved. Look up the EHR receipt before any retry; never resend blindly.' });
    for (const f of d.followUps ?? []) if (f.state === 'open') handover.push({ kind: 'patient-task', task: 'follow-up', id: f.id, personId: p.id, title: f.title, due: f.due, ...owner(f.ownerId) });
  }
  const assigned = new Map(patientRows.map(p => [String(p.id), p.assigned_to]));
  for (const r of data.referrals.filter(x => people.has(String(x.person_id)))) {
    const d = parsed(r);
    if (!TERMINAL.has(d.state)) handover.push({ kind: 'patient-task', task: 'referral', id: r.id, personId: r.person_id, title: `Referral to ${d.facility ?? 'facility'} (${d.state})`, due: d.due ?? null, ...owner(d.ownerId ?? assigned.get(String(r.person_id))), ownerSource: d.ownerId ? 'referral owner' : 'patient assignee' });
  }
  const tasks = handover.filter(h => h.kind === 'patient-task');
  files.push({ path: 'handover/open-items.jsonl', bytes: jsonl(handover), rows: handover.length, note: 'Unresolved external actions and open patient tasks with their named owner, within the exported scope.' });

  // Optional FHIR document per current confirmed visit, authored by the confirming member.
  let fhirCount = 0;
  if (input.includeFhir) {
    const confirmer = new Map<string, string>();
    for (const r of data.record_revisions) if (r.entity_type === 'visit' && r.action === 'confirmVisit') confirmer.set(String(r.entity_id), String(r.actor_name));
    const byId = new Map(patientRows.map(p => [String(p.id), p]));
    for (const v of data.visits.filter(x => people.has(String(x.person_id)))) {
      const d = parsed(v);
      // Slice 10i: an imported visit is historical content from another system; it is exported in the visits table with its lineage but is not written as a FHIR document of a Saha visit.
      if (v.state !== 'confirmed' || d.voidedAt || d.supersededBy || d.imported) continue;
      const p = byId.get(String(v.person_id))!;
      const doc = fhirDocument({ ...parsed(p), id: String(p.id) }, { ...d, id: String(v.id), personId: String(v.person_id) }, String(org.name), confirmer.get(String(v.id)) ?? 'Confirming member (see audit)');
      files.push({ path: `fhir/${v.id}.json`, bytes: enc.encode(JSON.stringify(doc, null, 2) + '\n'), note: `FHIR R4 document for visit ${v.id}` });
      fhirCount++;
    }
  }
  // Slice 6p: no empty, '.' or '..' path segments (the character class alone allowed them).
  for (const f of files) if (!safePath(f.path)) fail(422, 'An export file name cannot be written to the archive.');

  const described = await Promise.all(files.map(async f => ({ path: f.path, ...(f.table ? { table: f.table } : {}), ...(f.rows !== undefined ? { rows: f.rows } : {}), ...(f.withheld !== undefined ? { withheld: f.withheld } : {}), ...(f.otherMembersRows !== undefined ? { otherMembersRows: f.otherMembersRows } : {}), ...(f.withheldEntries !== undefined ? { withheldEntries: f.withheldEntries } : {}), bytes: f.bytes.byteLength, sha256: await sha256Bytes(f.bytes), ...(f.columns ? { columns: f.columns } : {}), ...(f.omitted?.length ? { omittedColumns: f.omitted } : {}), ...(f.note ? { note: f.note } : {}) })));
  const bytes = described.reduce((n, f) => n + f.bytes, 0);
  if (bytes > MAX_BYTES) fail(413, 'This organisation is larger than a single export can hold. Ask the operator for a staged export.');
  const patientsWithheld = data.patients.length - people.size;
  const manifest = {
    format: EXPORT_FORMAT, exportId: input.exportId, generatedAt: input.now, environment: input.environment,
    status: 'Organisation data export for exit or transfer. Not a clinical summary and not a reviewed submission.',
    organisation: { id: orgId, name: org.name, createdAt: org.created_at, revision: org.revision },
    exporter: { userId: input.exporter.userId, name: input.exporter.name, accountCode: input.exporter.accountCode, role: m.role, owner: m.isOwner },
    schema: { migration: SCHEMA_MIGRATION, workspaceSchemaVersion: 1, rowEncoding: 'One JSON object per line; keys are the stored column names; columns named data, changes, counts and team_ids hold JSON text.' },
    scope: { rule: 'Patient-linked rows only for patients in the exporter\'s normal care scope (team membership; ASHAs their assigned patients; administrators and sandbox providers none). Emergency access grants are not export authority. Households and caseload transfers follow team scope, and members or transferred patients outside the patient scope are left out of their data. Patient-linked entries inside organisation documents (safety cases, shadow results, outreach items and messages, person holds) follow the same patient scope. Figure metadata/history requires current reporting purpose and normal access to every original cohort member and included parent. Calendar governance and declared evidence require normal reporting scope for every configured team member. Private completeness snapshot bodies are omitted even when operational row scope is complete; scoped digest/basis metadata is not the original body. Protected counting material and disclosure ledgers are withheld; ordinary export is not full report or completeness reconstruction.', patients: data.patients.length, patientsExported: people.size, patientsWithheld, entriesWithheld: totalEntries, complete: totalWithheld === 0 && totalEntries === 0 },
    totals: { files: described.length, rows: totalRows, withheld: totalWithheld, withheldEntries: totalEntries, bytes },
    files: described,
    auditChain: { chainVersion: CHAIN_VERSION, hashing: HASHING, priorSeal: 'The genesis event (seq 0) detail carries count, last and digest over events without seq, hashed in (at,id) order 500 at a time: digest0 = SHA-256(JSON.stringify([chainVersion,"prior",org_id])), then digest = SHA-256(JSON.stringify([digest, page of content arrays])).', verification: { status: chain.status, events: chain.events, priorEvents: chain.priorEvents, head: chain.head, firstBreak: chain.firstBreak }, exportedHead: cut, note: 'Verified by the server immediately before export; exportedHead is the last chained event in this archive (events chained after it are left out). The export itself is recorded as a later audit event, so it is not in this archive.' },
    handover: { externalActions: handover.length - tasks.length, patientTasks: tasks.length, withoutActiveOwner: tasks.filter(t => t.ownerStatus !== 'active').length },
    fhir: { included: input.includeFhir, documents: fhirCount, note: input.includeFhir ? 'One FHIR R4 document Bundle per current confirmed visit in scope. Structural subset only; not profile-validated.' : 'Not requested.' },
    excluded: EXCLUDED,
    verify: 'tar xf the archive, then sha256sum -c SHA256SUMS; node scripts/verify-export.mjs <archive> also checks row counts, relationships, media and the audit chain.',
  };
  const manifestBytes = enc.encode(JSON.stringify(manifest, null, 2) + '\n');
  const readme = enc.encode(README(input.exportId, String(org.name), input.now));
  const listed = [{ path: 'README.txt', bytes: readme }, { path: 'manifest.json', bytes: manifestBytes }, ...files];
  const sums = enc.encode((await Promise.all(listed.map(async f => `${await sha256Bytes(f.bytes)}  ${f.path}`))).join('\n') + '\n');
  const archive = tar([...listed, { path: 'SHA256SUMS', bytes: sums }], Math.floor(Date.parse(input.now) / 1000));
  return { archive, manifest, figureCohort, calendarTeams, completenessBasis, exportedPeople:[...people], manifestSha256: await sha256Bytes(manifestBytes), archiveSha256: await sha256Bytes(archive) };
}

const README = (id: string, name: string, at: string) => `Saha organisation data export ${id}
${PROTECTED_ALERT_EXPORT_NOTICE}
Organisation: ${name}
Generated (UTC): ${at}

This archive holds the organisation's stored records in the exporter's authorised scope.
Synthetic development data only; no real patient data is permitted in this system.

Files
  manifest.json     export id, time, exporter, schema version, scope, and every file with row count, bytes and SHA-256
  SHA256SUMS        checksums of every other file (check with: sha256sum -c SHA256SUMS)
  tables/*.jsonl    one JSON object per stored row; keys are the stored column names
  media/*           photo and voice-note content; the sha256 column of tables/media.jsonl is its
                    SHA-256 in base64 (as computed at upload); SHA256SUMS lists it in hex
  handover/open-items.jsonl  unresolved external actions and open patient tasks with their named owner
  fhir/*.json       optional FHIR R4 document per current confirmed visit

Relationships
  patients.id is referenced by person_id in visits, submissions, referrals, record_revisions,
  media, rights_requests, audit_events and command_receipts; visits.id by visit_id in plans,
  ai_results, submissions and media; teams.id by team_id; accounts.user_id by user_id,
  actor_id, created_by and assigned_to. Included indicator_figures.parent_id refers to another
  included figure; indicator_figure_events and validated receipts refer to included figure/event ids.
  Figure data, counting units and private completeness snapshot bodies are protected and omitted; this is not full report or completeness reconstruction. Calendar policy, review/release history, declared source evidence and fixed receipt references follow current whole configured-team reporting scope. Exported snapshot hashes cannot reconstruct the omitted original body.
  Columns named data, changes, counts and team_ids are JSON text.

Audit chain
  audit_events rows with seq form one chain. content = SHA-256 of
  JSON.stringify([org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at]);
  hash = SHA-256 of JSON.stringify(['saha-audit-chain-v1',seq,prev_hash,content]); seq 0 is the
  genesis marker with prev_hash of 64 zeros. Rows marked "withheld" carry only their content digest.

Checking
  Files are listed in the manifest in an order that satisfies foreign keys for re-import.
  node scripts/verify-export.mjs <archive.tar>   (from the Saha source) checks the manifest,
  checksums, row counts, relationships, media and the audit chain without the application.
`;

export const safePath = (p: string) => /^[A-Za-z0-9._/-]{1,99}$/.test(p) && p.split('/').every(x => x !== '' && x !== '.' && x !== '..');
// Minimal POSIX ustar writer: regular files only, names under 100 bytes.
export function tar(files: { path: string; bytes: Uint8Array }[], mtime: number) {
  const blocks: Uint8Array[] = [];
  for (const f of files) {
    const h = new Uint8Array(512);
    const put = (s: string, at: number, len: number) => h.set(enc.encode(s).subarray(0, len), at);
    put(f.path, 0, 100); put('0000644\0', 100, 8); put('0000000\0', 108, 8); put('0000000\0', 116, 8);
    put(f.bytes.byteLength.toString(8).padStart(11, '0') + '\0', 124, 12); put(mtime.toString(8).padStart(11, '0') + '\0', 136, 12);
    put('        ', 148, 8); put('0', 156, 1); put('ustar\0', 257, 6); put('00', 263, 2); put('saha', 265, 32); put('saha', 297, 32);
    let sum = 0; for (const b of h) sum += b;
    put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
    blocks.push(h, f.bytes);
    const pad = (512 - (f.bytes.byteLength % 512)) % 512; if (pad) blocks.push(new Uint8Array(pad));
  }
  blocks.push(new Uint8Array(1024));
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.byteLength, 0));
  let at = 0; for (const b of blocks) { out.set(b, at); at += b.byteLength; }
  return out;
}

// Exact immutable/new-source basis, excluding export audit rows and org revision changed by this read.
const COMPLETENESS_BASIS_TABLES=['reporting_calendars','reporting_calendar_events','reporting_coverage','reporting_completeness_receipts','reporting_completeness_snapshots','integrations','memberships','patients','operations'];
export async function dataExitCompletenessBasis(db:D1Database,orgId:string){const rows=[];for(const table of COMPLETENESS_BASIS_TABLES){const spec=TABLES.find(s=>s.table===table)!;rows.push({table,rows:await readAll(db,spec,orgId)});}return digest(rows);}

// Database columns are authoritative; JSON keeps programme/facility/locality policy fields.
function storedExportPerson(r:Row){return {...JSON.parse(String(r.data)),id:String(r.id),teamId:String(r.team_id),assignedTo:r.assigned_to} as import('./types').Person;}
export async function assertDataExitPatientScope(db:D1Database,orgId:string,m:Member,ids:string[]){if(!ids.length)return;const rows=(await db.prepare('SELECT id,team_id,assigned_to,data FROM patients WHERE org_id=? AND id IN (SELECT value FROM json_each(?))').bind(orgId,JSON.stringify(ids)).all<Row>()).results;if(rows.length!==ids.length||rows.some(r=>{try{return !normallyAllowed(m,storedExportPerson(r));}catch{return true;}}))fail(403,'Normal patient export scope changed. Nothing was downloaded.');}
