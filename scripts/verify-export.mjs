#!/usr/bin/env node
// Slice 6m: offline check of a Saha organisation export (saha-organisation-export-v1).
// Usage: node scripts/verify-export.mjs <export.tar | extracted directory>
// Needs only Node. Checks the manifest and SHA256SUMS, every file's size and SHA-256, row counts,
// relationships between tables, media content against its recorded SHA-256, FHIR documents, and
// recomputes the audit chain (and the genesis seal over earlier events when they are all present).
// Prints a JSON report; exits 0 when every check passes and 1 otherwise.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha = b => createHash('sha256').update(b).digest('hex');
const CHAIN = 'saha-audit-chain-v1', ZERO = '0'.repeat(64), PRIOR_PAGE = 500;

export function readTar(buf) {
  const files = new Map();
  for (let at = 0; at + 512 <= buf.length;) {
    const h = buf.subarray(at, at + 512);
    if (h.every(b => b === 0)) break;
    const str = (o, n) => { const s = h.subarray(o, o + n); const z = s.indexOf(0); return Buffer.from(z < 0 ? s : s.subarray(0, z)).toString('utf8'); };
    const stored = parseInt(str(148, 8).trim(), 8); const copy = Buffer.from(h); copy.fill(0x20, 148, 156);
    if (copy.reduce((n, b) => n + b, 0) !== stored) throw new Error(`Tar header checksum mismatch at byte ${at}.`);
    const prefix = str(345, 155), name = (prefix ? prefix + '/' : '') + str(0, 100), size = parseInt(str(124, 12).trim() || '0', 8), type = str(156, 1) || '0';
    at += 512;
    if (type === '0') files.set(name, Buffer.from(buf.subarray(at, at + size)));
    at += Math.ceil(size / 512) * 512;
  }
  return files;
}
function readDir(dir) {
  const files = new Map();
  const walk = d => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else files.set(relative(dir, p).split('\\').join('/'), readFileSync(p)); } };
  walk(dir); return files;
}
const lines = b => b.toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const content = e => sha(JSON.stringify([e.org_id, e.id, e.person_id ?? null, e.actor_id, e.actor_name, e.role, e.action, e.subject, e.detail, e.at]));

export function verifyFiles(files) {
  const report = { format: null, exportId: null, ok: true, checks: [], failures: [] };
  const pass = (name, detail) => report.checks.push({ name, ok: true, ...(detail !== undefined ? { detail } : {}) });
  const bad = (name, detail) => { report.ok = false; report.checks.push({ name, ok: false, detail }); report.failures.push(`${name}: ${detail}`); };
  const m = files.get('manifest.json');
  if (!m) { bad('manifest', 'manifest.json is missing.'); return report; }
  let manifest; try { manifest = JSON.parse(m.toString('utf8')); } catch { bad('manifest', 'manifest.json is not JSON.'); return report; }
  report.format = manifest.format; report.exportId = manifest.exportId;
  if (manifest.format !== 'saha-organisation-export-v1') bad('format', `Unknown format ${manifest.format}.`); else pass('format', manifest.format);
  // SHA256SUMS covers every other file.
  const sums = files.get('SHA256SUMS');
  if (!sums) bad('sha256sums', 'SHA256SUMS is missing.');
  else {
    const listed = sums.toString('utf8').split('\n').filter(Boolean).map(l => { const [h, ...p] = l.split('  '); return [p.join('  '), h]; });
    const wrong = listed.filter(([p, h]) => !files.has(p) || sha(files.get(p)) !== h).map(([p]) => p);
    const unlisted = [...files.keys()].filter(p => p !== 'SHA256SUMS' && !listed.some(([q]) => q === p));
    if (wrong.length || unlisted.length) bad('sha256sums', `Mismatched: ${wrong.join(', ') || 'none'}; not listed: ${unlisted.join(', ') || 'none'}.`); else pass('sha256sums', `${listed.length} files`);
  }
  // Manifest entries: size, checksum, and row counts for JSONL files.
  const described = new Map((manifest.files ?? []).map(f => [f.path, f]));
  let fileProblems = [];
  for (const f of manifest.files ?? []) {
    const b = files.get(f.path);
    if (!b) { fileProblems.push(`${f.path} missing`); continue; }
    if (b.length !== f.bytes) fileProblems.push(`${f.path} has ${b.length} bytes, manifest says ${f.bytes}`);
    if (sha(b) !== f.sha256) fileProblems.push(`${f.path} SHA-256 differs`);
    if (f.rows !== undefined) { try { const n = lines(b).length; if (n !== f.rows) fileProblems.push(`${f.path} has ${n} rows, manifest says ${f.rows}`); } catch { fileProblems.push(`${f.path} has a line that is not JSON`); } }
  }
  const extra = [...files.keys()].filter(p => !['manifest.json', 'SHA256SUMS', 'README.txt'].includes(p) && !described.has(p));
  if (extra.length) fileProblems.push(`not in manifest: ${extra.join(', ')}`);
  if (fileProblems.length) bad('manifest-files', fileProblems.slice(0, 20).join('; ')); else pass('manifest-files', `${described.size} files match size, SHA-256 and row count`);
  // Slice 6p: withheldEntries counts patient-linked entries left out of organisation documents (absent in earlier archives).
  const totals = (manifest.files ?? []).filter(f => f.table).reduce((t, f) => ({ rows: t.rows + f.rows, withheld: t.withheld + (f.withheld ?? 0), withheldEntries: t.withheldEntries + (f.withheldEntries ?? 0) }), { rows: 0, withheld: 0, withheldEntries: 0 });
  const complete = totals.withheld === 0 && totals.withheldEntries === 0;
  if (totals.rows !== manifest.totals?.rows || totals.withheld !== manifest.totals?.withheld || totals.withheldEntries !== (manifest.totals?.withheldEntries ?? 0) || described.size !== manifest.totals?.files || (manifest.scope?.complete !== undefined && manifest.scope.complete !== complete)) bad('totals', `Manifest totals do not add up (${JSON.stringify(totals)} vs ${JSON.stringify(manifest.totals)}).`); else pass('totals', totals);
  if (report.failures.some(f => f.startsWith('manifest-files'))) return report;

  const t = name => files.has(`tables/${name}.jsonl`) ? lines(files.get(`tables/${name}.jsonl`)) : [];
  const orgId = manifest.organisation?.id;
  // Every row belongs to the exported organisation.
  const foreign = (manifest.files ?? []).filter(f => f.table && !['accounts', 'organisations'].includes(f.table)).flatMap(f => t(f.table).filter(r => r.org_id !== orgId).map(() => f.table));
  if (foreign.length || t('organisations').some(o => o.id !== orgId)) bad('organisation', `Rows from another organisation in ${[...new Set(foreign)].join(', ')}.`); else pass('organisation', orgId);
  // Relationships: each reference resolves inside the export (withheld audit rows carry no reference).
  const ids = (name, key = 'id') => new Set(t(name).map(r => r[key]));
  const figures=ids('indicator_figures'), figureEvents=ids('indicator_figure_events');
  const patients = ids('patients'), visits = ids('visits'), teams = ids('teams'), accounts = ids('accounts', 'user_id');
  const rel = [
    ['visits', 'person_id', patients], ['submissions', 'person_id', patients], ['submissions', 'visit_id', visits], ['referrals', 'person_id', patients],
    ['record_revisions', 'person_id', patients], ['media', 'person_id', patients], ['media', 'visit_id', visits], ['plans', 'visit_id', visits], ['ai_results', 'visit_id', visits],
    ['rights_requests', 'person_id', patients], ['patients', 'team_id', teams], ['team_members', 'team_id', teams], ['team_members', 'user_id', accounts],
    ['memberships', 'user_id', accounts], ['households', 'team_id', teams], ['caseload_transfers', 'team_id', teams],
    ['indicator_figures','author_id',accounts],['indicator_figure_events','actor_id',accounts],['indicator_figure_receipts','actor_id',accounts],['indicator_figures','parent_id',figures],['indicator_figure_events','figure_id',figures],['indicator_figure_events','review_id',figureEvents],['indicator_figure_receipts','figure_id',figures],
    ['identity_cases', 'survivor_id', patients], ['identity_cases', 'duplicate_id', patients],
  ];
  const dangling = [];
  let references = 0;
  for (const [name, col, target] of rel) for (const r of t(name)) { if (r[col] == null) continue; references++; if (!target.has(r[col])) dangling.push(`${name}.${col}=${r[col]}`); }
  for (const r of t('audit_events')) if (!r.withheld && r.person_id != null) { references++; if (!patients.has(r.person_id)) dangling.push(`audit_events.person_id=${r.person_id}`); }
  for (const r of t('command_receipts')) if (r.person_id != null) { references++; if (!patients.has(r.person_id)) dangling.push(`command_receipts.person_id=${r.person_id}`); }
  // Slice 6p: every personId inside an organisation document (governance, outreach, retention, ...) is an exported patient.
  const personIds = (x, out = []) => { if (Array.isArray(x)) x.forEach(e => personIds(e, out)); else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (k === 'personId' && v != null) out.push(v); else personIds(v, out); } return out; };
  for (const f of (manifest.files ?? []).filter(f => f.table && ['integrations', 'operations', 'pilot', 'outreach', 'expansions', 'governance', 'retention'].includes(f.table))) for (const r of t(f.table)) { let doc = null; try { doc = typeof r.data === 'string' ? JSON.parse(r.data) : null; } catch { doc = null; } for (const id of personIds(doc)) { references++; if (!patients.has(id)) dangling.push(`${f.table}.data personId=${id}`); } }
  // Slice 6u: team-scoped rows too: household members, caseload transfer patients (personIds, moved, skipped,
  // assignments keys) must be exported patients.
  const caseloadIds = d => [...(d?.personIds ?? []), ...(d?.applied?.moved ?? []), ...Object.keys(d?.applied?.assignments ?? {})];
  for (const name of ['households', 'caseload_transfers']) for (const r of t(name)) { let doc = null; try { doc = typeof r.data === 'string' ? JSON.parse(r.data) : null; } catch { doc = null; } for (const id of [...personIds(doc), ...(name === 'caseload_transfers' ? caseloadIds(doc) : [])]) { references++; if (!patients.has(id)) dangling.push(`${name}.data personId=${id}`); } }
  if (dangling.length) bad('relationships', `${dangling.length} references do not resolve: ${dangling.slice(0, 10).join(', ')}`); else pass('relationships', `${references} references resolve`);
  // Slice 6w: the indicator differencing ledger is server-side protection state and is never exported.
  const ledgerRows = t('operations').filter(r => { try { return typeof r.data === 'string' && 'indicatorReleases' in (JSON.parse(r.data) ?? {}); } catch { return false; } });
  if (ledgerRows.length) bad('protection-state', 'operations.data carries the indicator differencing ledger, which an export must leave out'); else pass('protection-state', 'no indicator differencing ledger in the operations document');
  // 0030 operational completeness portability: immutable configured governance/evidence only.
  // Earlier archives retain their original schema contract and do not need these later tables.
  const calendarProblems=[],ck=(id,v)=>JSON.stringify([id,v]),cs=t('reporting_calendars'),ce=t('reporting_calendar_events'),cv=t('reporting_coverage'),cr=t('reporting_completeness_receipts'),ss=t('reporting_completeness_snapshots');
  const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join()===keys.split(',').sort().join(),subset=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>keys.split(',').includes(k)),positive=x=>Number.isInteger(x)&&x>0,utc=x=>typeof x==='string'&&x.endsWith('Z')&&Number.isFinite(Date.parse(x)),unique=xs=>new Set(xs).size===xs.length;
  const byCalendar=new Map(cs.map(r=>[ck(r.id,r.version),r])),parse=x=>{try{return JSON.parse(x);}catch{return null;}};
  const later=(manifest.schema?.migration??'')>='0030_reporting_completeness';
  if(later)for(const table of ['reporting_calendars','reporting_calendar_events','reporting_coverage','reporting_completeness_receipts','reporting_completeness_snapshots'])if(!files.has('tables/'+table+'.jsonl'))calendarProblems.push('missing '+table);
  if(!unique(ce.map(x=>x.id))||!unique(cv.map(x=>x.id))||!unique(cv.map(x=>JSON.stringify([x.calendar_id,x.calendar_version,x.team_id,x.source_id,x.period_id,x.version])))||!unique(cr.map(x=>JSON.stringify([x.actor_id,x.key])))||!unique(ss.map(x=>x.id)))calendarProblems.push('duplicate immutable evidence/receipt/snapshot key');
  if(byCalendar.size!==cs.length)calendarProblems.push('duplicate calendar version');
  for(const r of cs){const d=parse(r.data);if(!exact(r,'org_id,id,version,author_id,author_version,created_at,digest,data')||!positive(r.version)||!positive(r.author_version)||!accounts.has(r.author_id)||!exact(d,'title,teamIds,definitions,periods,sources')||!Array.isArray(d.teamIds)||d.teamIds.some(id=>!teams.has(id))||!d.teamIds.length||!unique(d.teamIds)||!Array.isArray(d.definitions)||!d.definitions.length||!unique(d.definitions)||d.definitions.some(x=>typeof x!=='string'||!/^[a-z][a-z0-9-]{1,39}(?:@\d{1,4})?$/.test(x))||!Array.isArray(d.periods)||!d.periods.length||!unique(d.periods.map(x=>x.id))||!Array.isArray(d.sources)||!d.sources.length||!unique(d.sources.map(x=>x.id))||sha(JSON.stringify(d))!==r.digest){calendarProblems.push('invalid calendar metadata/spec/digest');continue;}for(const p of d.periods)if(!exact(p,'id,start,end,deadline')||!p.id||!utc(p.start)||!utc(p.end)||!utc(p.deadline)||p.start>=p.end||p.end>p.deadline)calendarProblems.push('invalid configured UTC period');for(const x of d.sources)if(!exact(x,'id,label,kind,integrationId,lateHours,syncHours,affects')||!['online-visits','field-syncs','imports','programme-receipts','mis','ehr'].includes(x.kind)||!Number.isInteger(x.lateHours)||x.lateHours<0||x.lateHours>8760||!Number.isInteger(x.syncHours)||x.syncHours<0||x.syncHours>8760||['mis','ehr'].includes(x.kind)!==!!x.integrationId||!Array.isArray(x.affects)||x.affects.some(a=>!exact(a,'definitionRef,component')||!d.definitions.includes(a.definitionRef)||!['numerator','denominator','cohort'].includes(a.component)))calendarProblems.push('invalid configured source attribution');
    const es=ce.filter(e=>e.calendar_id===r.id&&e.calendar_version===r.version).sort((a,b)=>a.sequence-b.sequence);if(!es.length||es.length>3||es.some((e,i)=>e.sequence!==i+1))calendarProblems.push('incomplete calendar lifecycle');for(const [i,e] of es.entries()){const x=parse(e.data);if(!exact(e,'org_id,calendar_id,calendar_version,id,sequence,kind,actor_id,member_version,role,at,data')||!exact(x,e.kind==='released'?'id,sequence,kind,actorId,memberVersion,role,at,effectiveAt,reviewId':'id,sequence,kind,actorId,memberVersion,role,at')||x?.id!==e.id||x?.sequence!==e.sequence||x?.kind!==e.kind||x?.actorId!==e.actor_id||x?.memberVersion!==e.member_version||x?.role!==e.role||x?.at!==e.at||!accounts.has(e.actor_id)||!positive(e.member_version)||!utc(e.at)||e.kind==='released'&&!utc(x?.effectiveAt)||!['clinician','supervisor'].includes(e.role))calendarProblems.push('invalid calendar event/protected fields');if(i===0&&(e.kind!=='proposed'||e.actor_id!==r.author_id||e.member_version!==r.author_version)||i===1&&(!['approved','rejected'].includes(e.kind)||e.actor_id===r.author_id)||i===2&&(e.kind!=='released'||es[1].kind!=='approved'||e.actor_id!==r.author_id||x?.reviewId!==es[1].id||!x?.effectiveAt))calendarProblems.push('invalid independent calendar lifecycle');}}
  for(const e of ce)if(!byCalendar.has(ck(e.calendar_id,e.calendar_version)))calendarProblems.push('dangling calendar event');
  for(const r of cv){const c=byCalendar.get(ck(r.calendar_id,r.calendar_version)),sp=parse(c?.data),d=parse(r.data),v=d?.sourceVersion;if(!exact(r,'org_id,calendar_id,calendar_version,team_id,source_id,period_id,version,id,data')||!exact(d,'id,calendarId,calendarVersion,teamId,sourceId,periodId,version,status,through,evidenceHash,actorId,memberVersion,role,at'+(v?',sourceVersion':''))||!c||d?.id!==r.id||d?.calendarId!==r.calendar_id||d?.calendarVersion!==r.calendar_version||d?.teamId!==r.team_id||d?.sourceId!==r.source_id||d?.periodId!==r.period_id||d?.version!==r.version||!positive(d?.version)||!positive(d?.memberVersion)||!utc(d?.at)||d?.through!==null&&!utc(d?.through)||!/^[a-f0-9]{64}$/.test(d?.evidenceHash??'')||!accounts.has(d?.actorId)||!['clinician','supervisor'].includes(d?.role)||!['complete','partial','outage','unknown'].includes(d?.status)||!sp?.teamIds?.includes(r.team_id)||!sp?.sources?.some(x=>x.id===r.source_id)||!sp?.periods?.some(x=>x.id===r.period_id)||v&&(!exact(v,'contractVersion,kind,integrationId,integrationVersion')||v.contractVersion!==1||!sp.sources.some(x=>x.id===r.source_id&&x.kind===v.kind&&x.integrationId===v.integrationId)||v.integrationVersion!==null&&!positive(v.integrationVersion)))calendarProblems.push('invalid or dangling source evidence/protected fields');}
  for(const r of cr){const d=parse(r.result),e=d?.type==='declare'?cv.find(e=>e.id===d?.eventId):ce.find(e=>e.id===d?.eventId),x=parse(e?.data);if(!exact(r,'org_id,actor_id,key,body_hash,calendar_id,calendar_version,result')||!/^[a-f0-9]{64}$/.test(r.body_hash??'')||!exact(d,'calendarId,calendarVersion,eventId,sequence,type')||!byCalendar.has(ck(r.calendar_id,r.calendar_version))||d.calendarId!==r.calendar_id||d.calendarVersion!==r.calendar_version||e?.calendar_id!==r.calendar_id||e?.calendar_version!==r.calendar_version||(d.type==='declare'?x?.actorId:e?.actor_id)!==r.actor_id||(d.type==='declare'?x?.version:e?.sequence)!==d.sequence||!['propose','review','release','declare'].includes(d.type)||d.type==='propose'&&e.kind!=='proposed'||d.type==='review'&&!['approved','rejected'].includes(e.kind)||d.type==='release'&&e.kind!=='released')calendarProblems.push('invalid receipt outcome or evidence lineage');}
  for(const r of ss)if(!exact(r,'org_id,id,figure_id,created_at,digest,basis')||!utc(r.created_at)||r.figure_id&&!figures.has(r.figure_id)||!/^([a-f0-9]{64})$/.test(r.digest)||!/^([a-f0-9]{64})$/.test(r.basis))calendarProblems.push('private snapshot body exported or invalid metadata/figure relationship');
  if(later&&!manifest.excluded?.some(x=>x.what==='reporting_completeness_snapshots.data'))calendarProblems.push('snapshot private-body exclusion is not explicit');
  if(calendarProblems.length)bad('completeness-portability',[...new Set(calendarProblems)].join('; '));else pass('completeness-portability','configured governance/evidence and scoped snapshot hashes only; private snapshot bodies cannot be reconstructed');
  // Operational portability never bypasses current viewer/edition screening by releasing raw report material.
  const figureProblems=[];
  const eventColumns='actor_id,at,figure_id,id,kind,member_version,org_id,reason,review_id,role,sequence',receiptColumns='actor_id,body_hash,figure_id,key,org_id,result';
  const seenFigures=new Set(),seenFigureEvents=new Set(),seenFigureReceipts=new Set();
  for(const f of t('indicator_figures')){if(seenFigures.has(f.id))figureProblems.push('duplicate figure identifier');seenFigures.add(f.id);}
  for(const e of t('indicator_figure_events')){if(Object.keys(e).sort().join()!==eventColumns)figureProblems.push('unsupported figure event columns');if(seenFigureEvents.has(e.id))figureProblems.push('duplicate figure event identifier');seenFigureEvents.add(e.id);}
  for(const r of t('indicator_figure_receipts')){if(Object.keys(r).sort().join()!==receiptColumns)figureProblems.push('unsupported figure receipt columns');const key=JSON.stringify([r.actor_id,r.key]);if(seenFigureReceipts.has(key))figureProblems.push('duplicate figure receipt key');seenFigureReceipts.add(key);}
  if(t('indicator_figure_units').length||t('indicator_figure_disclosures').length)figureProblems.push('protected counting units or disclosure ledger exported');
  for(const f of t('indicator_figures')){if(Object.keys(f).sort().join()!=='author_id,author_version,created_at,digest,id,org_id,parent_id')figureProblems.push('unsupported figure metadata columns or protected original data exported');const seen=new Set();let at=f;while(at){if(seen.has(at.id)){figureProblems.push('cyclic figure parent lineage');break;}seen.add(at.id);at=at.parent_id?t('indicator_figures').find(x=>x.id===at.parent_id):null;}}
  for(const f of t('indicator_figures')){const events=t('indicator_figure_events').filter(e=>e.figure_id===f.id).sort((a,b)=>a.sequence-b.sequence);if(!events.length||events[0].kind!=='prepared'||events[0].actor_id!==f.author_id||events.some((e,i)=>e.sequence!==i+1))figureProblems.push('incomplete immutable figure event history');for(const [i,e] of events.entries()){if(!['clinician','supervisor'].includes(e.role))figureProblems.push('unsupported historical report actor role');if(!['prepared','approved','rejected','published'].includes(e.kind)||i===0&&(e.kind!=='prepared'||e.review_id!==null)||i===1&&(!['approved','rejected'].includes(e.kind)||e.review_id!==null)||i===2&&(e.kind!=='published'||events[1]?.kind!=='approved')||i>2)figureProblems.push('invalid immutable figure lifecycle transition');if(['approved','rejected'].includes(e.kind)&&e.actor_id===f.author_id)figureProblems.push('self-reviewed figure history');if(e.kind==='published'){const review=events.find(x=>x.id===e.review_id);if(!review||review.kind!=='approved'||review.sequence!==e.sequence-1||review.actor_id===e.actor_id||e.actor_id!==f.author_id)figureProblems.push('invalid historical independent review/publication lineage');}}}
  for(const r of t('indicator_figure_receipts')){let x;try{x=JSON.parse(r.result);}catch{}if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join()!=='eventId,figureId,sequence,status'||x.figureId!==r.figure_id||!t('indicator_figure_events').some(e=>e.figure_id===r.figure_id&&e.id===x.eventId&&e.sequence===x.sequence&&e.kind===x.status&&e.actor_id===r.actor_id))figureProblems.push('receipt carries unsupported outcome or dangling lifecycle event');}
  if(figureProblems.length)bad('figure-portability', [...new Set(figureProblems)].join('; '));else pass('figure-portability','metadata and immutable lifecycle/receipt references only; no raw counting units, cells or privacy ledger');
  // Media content matches the recorded SHA-256 and size.
  const mediaProblems = [];
  let mediaFiles = 0;
  for (const r of t('media')) {
    const path = [...files.keys()].find(p => p.startsWith(`media/${r.id}.`));
    if (!path) { if (!r.deleted_at) mediaProblems.push(`${r.id} content missing`); continue; }
    mediaFiles++;
    const b = files.get(path);
    // The media row stores the SHA-256 in base64, as the application computed it at upload.
    if (createHash('sha256').update(b).digest('base64') !== r.sha256 || b.length !== r.size) mediaProblems.push(`${r.id} content differs from its row`);
  }
  if (mediaProblems.length) bad('media', mediaProblems.join('; ')); else pass('media', `${mediaFiles} files match their rows`);
  // FHIR documents: a document Bundle for a confirmed visit in the export.
  const fhirProblems = [];
  const fhir = [...files.keys()].filter(p => p.startsWith('fhir/'));
  for (const p of fhir) {
    try { const b = JSON.parse(files.get(p).toString('utf8')), id = p.slice(5, -5), v = t('visits').find(x => x.id === id); if (b.resourceType !== 'Bundle' || b.type !== 'document' || !b.identifier?.value || b.entry?.[0]?.resource?.resourceType !== 'Composition') fhirProblems.push(`${p} is not a FHIR document Bundle`); if (!v || v.state !== 'confirmed') fhirProblems.push(`${p} has no confirmed visit in the export`); } catch { fhirProblems.push(`${p} is not JSON`); }
  }
  if (fhirProblems.length) bad('fhir', fhirProblems.join('; ')); else pass('fhir', `${fhir.length} documents`);
  // Audit chain: contiguous sequence from 0, every link and hash recomputed.
  const audit = t('audit_events'), chained = audit.filter(r => r.seq != null).sort((a, b) => a.seq - b.seq), prior = audit.filter(r => r.seq == null);
  let chainProblem = null, prev = ZERO;
  for (let i = 0; i < chained.length && !chainProblem; i++) {
    const e = chained[i];
    if (e.seq !== i) { chainProblem = `event ${i} is missing`; break; }
    if (e.prev_hash !== prev) { chainProblem = `event ${i}: link to the previous event does not match`; break; }
    const c = e.withheld ? e.content : content(e);
    if (e.withheld && !/^[0-9a-f]{64}$/.test(c ?? '')) { chainProblem = `event ${i}: withheld without a digest`; break; }
    if (sha(JSON.stringify([CHAIN, e.seq, prev, c])) !== e.hash) { chainProblem = `event ${i}: content or hash altered`; break; }
    prev = e.hash;
  }
  // The archive's chain must end at the head recorded when it was read (exportedHead; earlier archives: verification.head).
  const head = chained.at(-1), expected = manifest.auditChain?.exportedHead !== undefined ? manifest.auditChain.exportedHead : manifest.auditChain?.verification?.head;
  if (!chainProblem && expected && (!head || head.seq !== expected.seq || head.hash !== expected.hash)) chainProblem = 'the exported chain does not end at the head recorded in the manifest';
  if (chainProblem) bad('audit-chain', chainProblem); else pass('audit-chain', chained.length ? `${chained.length} events, head ${head.seq} ${head.hash.slice(0, 12)}` : 'not started');
  // Genesis seal over events written before the chain: recomputable only when none is withheld.
  const genesis = chained[0];
  if (genesis && !genesis.withheld) {
    const g = /count=(\d+); last=([^|;]*)\|([^;]*); digest=([0-9a-f]{64}); page=(\d+)\./.exec(genesis.detail ?? '');
    if (!g) bad('genesis-seal', 'The genesis marker cannot be read.');
    else if (Number(g[1]) !== prior.length) bad('genesis-seal', `Genesis sealed ${g[1]} earlier events; the export has ${prior.length}.`);
    else if (prior.some(r => r.withheld)) pass('genesis-seal', `${prior.length} earlier events; ${prior.filter(r => r.withheld).length} withheld, so the seal digest cannot be recomputed from this export`);
    else {
      const ordered = [...prior].sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      let digest = sha(JSON.stringify([CHAIN, 'prior', orgId]));
      for (let i = 0; i < ordered.length; i += PRIOR_PAGE) digest = sha(JSON.stringify([digest, ordered.slice(i, i + PRIOR_PAGE).map(e => [e.org_id, e.id, e.person_id ?? null, e.actor_id, e.actor_name, e.role, e.action, e.subject, e.detail, e.at])]));
      if (digest !== g[4]) bad('genesis-seal', 'An event sealed by the genesis marker differs from the export.'); else pass('genesis-seal', `${prior.length} earlier events reproduce the genesis digest`);
    }
  }
  report.summary = { organisation: orgId, generatedAt: manifest.generatedAt, exporter: manifest.exporter?.name, tables: (manifest.files ?? []).filter(f => f.table).length, rows: totals.rows, withheld: totals.withheld, complete: manifest.scope?.complete, fhir: fhir.length, handoverItems: (manifest.files ?? []).find(f => f.path === 'handover/open-items.jsonl')?.rows ?? 0 };
  return report;
}
export function verifyExport(path) {
  const files = statSync(path).isDirectory() ? readDir(path) : readTar(readFileSync(path));
  return verifyFiles(files);
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const path = process.argv[2];
  if (!path) { console.error('Usage: node scripts/verify-export.mjs <export.tar | directory>'); process.exit(2); }
  let report; try { report = verifyExport(path); } catch (e) { report = { ok: false, failures: [String(e.message ?? e)] }; }
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
