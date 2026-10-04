// Slice 14g (BR-REP-04, BR-REP-05): the inventory of every path that emits data out of Saha, and what protects it.
// tests/export-suppression-contract.mjs fails when a route handler, an attachment-producing source file or an outbound command
// is added without a line here, so a new export cannot ship unclassified. This is a classification, not a policy engine: the
// protection itself lives in the named source files, and the contract checks that the named evidence is still there.
//
// kind
//   file-export      a file (CSV, JSON, tar, JSONL) a member downloads
//   aggregate-view   an in-app JSON view of counts or rates over the viewer's scope (not a file)
//   record-view      an in-app JSON view of records the viewer is authorised to open (not a file)
//   outbound         a request that can start a flow to an external system (provider, partner, programme, EHR, ABDM)
//   inbound          receives data or a callback; emits nothing about patients
//   mutation         changes state; its response carries only the changed record
// content (what a file or send carries): aggregate | record | config | audit | none
// suppression: applied (before 14g) | added-14g | record-level (rows are records, withheld by scope) | in-app-unsuppressed (see note) | not-applicable
export type RouteClass = {
  kind: 'file-export' | 'aggregate-view' | 'record-view' | 'outbound' | 'inbound' | 'mutation';
  content: 'aggregate' | 'record' | 'config' | 'audit' | 'none';
  suppression: 'applied' | 'added-14g' | 'record-level' | 'in-app-unsuppressed' | 'not-applicable';
  purpose?: string;           // access purpose checked (purpose-scope.ts), when the flow names one
  audit?: string;             // audit action written before the file or send leaves
  evidence?: { file: string; text: string };  // text that must still appear in the named source file
  note?: string;
};
const view = (note?: string): RouteClass => ({ kind: 'record-view', content: 'record', suppression: 'not-applicable', note });
const config = (note?: string): RouteClass => ({ kind: 'record-view', content: 'config', suppression: 'not-applicable', note });
const inbound = (note?: string): RouteClass => ({ kind: 'inbound', content: 'none', suppression: 'not-applicable', note });
const mutation = (note?: string): RouteClass => ({ kind: 'mutation', content: 'none', suppression: 'not-applicable', note });
const outbound = (note: string): RouteClass => ({ kind: 'outbound', content: 'record', suppression: 'not-applicable', note });
const unsuppressedView = (note: string): RouteClass => ({ kind: 'aggregate-view', content: 'aggregate', suppression: 'in-app-unsuppressed', note });
export const ROUTES: Record<string, RouteClass> = {
  // ---- files and sends carrying aggregates -------------------------------------------------------------------------
  'GET /api/operations': { kind: 'file-export', content: 'aggregate', suppression: 'added-14g', purpose: 'reporting', audit: 'opsExport', evidence: { file: 'lib/saha/report-export.ts', text: 'suppressCareReport' }, note: 'format=csv is suppressed (slice 14g); format=support is configuration counters only; the JSON view is the unsuppressed in-app view of the viewer\'s own authorised scope (see the slice document).' },
  'GET /api/exports': { kind: 'file-export', content: 'aggregate', suppression: 'added-14g', purpose: 'reporting', audit: 'exportDownload', evidence: { file: 'lib/saha/held-exports-server.ts', text: 'heldDecision' }, note: 'Delivers a held, already-suppressed operational CSV once before it expires.' },
  'POST /api/exports': { kind: 'file-export', content: 'aggregate', suppression: 'added-14g', purpose: 'reporting', audit: 'opsExport', evidence: { file: 'lib/saha/held-exports-server.ts', text: 'operationsRead' }, note: 'Prepares and holds the suppressed operational CSV through the ordinary operations export.' },
  'GET /api/indicators': { kind: 'aggregate-view', content: 'aggregate', suppression: 'applied', purpose: 'reporting', evidence: { file: 'lib/saha/indicators.ts', text: 'function suppress' }, note: 'Catalogue and interpretation only; results are POST.' },
  'POST /api/indicators': { kind: 'file-export', content: 'aggregate', suppression: 'applied', purpose: 'reporting', audit: 'indicatorExport', evidence: { file: 'lib/saha/indicators.ts', text: 'function suppress' }, note: 'Query results and the CSV (format=csv) share the suppression, minimum cohorts and differencing ledger (slices 6d, 6s, 6w, 6aa).' },
  'GET /api/aggregate-reports': { kind: 'aggregate-view', content: 'aggregate', suppression: 'applied', purpose: 'reporting', evidence: { file: 'lib/saha/aggregate-delivery.ts', text: 'MIN_CELL' }, note: 'History of reports prepared for aggregate-only destinations; cells are the suppressed indicator cells (slice 7g).' },
  // ---- files carrying records, configuration or audit evidence -----------------------------------------------------
  'GET /api/data-exit': { kind: 'file-export', content: 'record', suppression: 'record-level', purpose: 'patient-export', audit: 'organisationExport', evidence: { file: 'lib/saha/data-exit.ts', text: 'withheld' }, note: 'Owner only; patient-linked rows outside the owner\'s care scope are withheld and counted (slice 6m). Patient-export purpose added in 14g.' },
  'GET /api/fhir/[id]': { kind: 'file-export', content: 'record', suppression: 'record-level', purpose: 'patient-export', audit: 'downloadFhir', evidence: { file: 'app/api/fhir/[id]/route.ts', text: 'ensureNotRestricted' }, note: 'One confirmed visit as a FHIR document; scope, restriction and exceptional-access checks apply. Patient-export purpose added in 14g.' },
  'GET /api/audit/chain': { kind: 'file-export', content: 'audit', suppression: 'record-level', audit: 'auditChainExport', evidence: { file: 'lib/saha/audit-chain.ts', text: 'redacted' }, note: 'Owners and administrators; patient-linked events are exported as digests only. Checkpoints carry a hash and sequence number.' },
  'GET /api/incentive-claims': { kind: 'file-export', content: 'record', suppression: 'record-level', audit: 'incentiveExport', evidence: { file: 'lib/saha/incentives-server.ts', text: 'incentiveExport' }, note: 'format=csv; approved synthetic claims in the viewer\'s scope, no patient name or identifier. One row is one claim, not an aggregate.' },
  'POST /api/import-rejections': { kind: 'file-export', content: 'record', suppression: 'record-level', audit: 'importRejectionsExport', evidence: { file: 'lib/saha/record-import-server.ts', text: 'importRejectionsExport' }, note: 'Row numbers and reasons from the importer\'s own upload; no clinical value.' },
  'GET /api/pilot': { kind: 'file-export', content: 'config', suppression: 'not-applicable', audit: 'pilotExport', evidence: { file: 'lib/saha/pilot-server.ts', text: 'pilotExport' }, note: 'format=export; the dossier lists configuration, accounts and measurements the viewer may already read.' },
  'GET /api/expansion': { kind: 'file-export', content: 'config', suppression: 'not-applicable', audit: 'expansionExport', evidence: { file: 'lib/saha/outreach-server.ts', text: 'expansionExport' }, note: 'format=pack; configuration only.' },
  'GET /api/media/[id]': view('Streams one visit\'s photo or voice note to a viewer who may open that patient; recorded as viewMedia.'),
  // ---- in-app aggregate views ---------------------------------------------------------------------------------------
  'GET /api/worker-activity': unsuppressedView('Per-worker counts of actions on patients in the viewer\'s scope; counts about workers, shown to their supervisors in the app.'),
  'GET /api/alerts': unsuppressedView('In-app alert inbox; counts are from the member\'s own scope.'),
  'GET /api/caseload': unsuppressedView('Caseload sizes per worker for the viewer\'s teams.'),
  'GET /api/governance': config('Governance register for owners; no patient data.'),
  'GET /api/retention': config('Retention schedules and holds for owners; review only.'),
  'GET /api/environment': config(), 'GET /api/delegations': config(), 'GET /api/facility-scope': config(), 'GET /api/purpose-scope': config(), 'GET /api/notification-channel': config(),
  'GET /api/pack-installations': config(), 'GET /api/programme-migration': config(), 'GET /api/fixture-migration': config(), 'GET /api/provider-sandbox': config(), 'GET /api/frontline-providers': config(), 'POST /api/frontline-providers': mutation('Owner configuration of a provider.'),
  'GET /api/anaemia-provider': config(), 'POST /api/anaemia-provider': mutation('Owner configuration of the demonstration provider.'),
  // ---- record views for authorised viewers ------------------------------------------------------------------------
  'GET /api/workspace': view('Scoped, paged workspace snapshot; recorded as viewWorkspace.'), 'GET /api/patients': view('Scoped list; recorded as listPatients.'), 'POST /api/patients': view('Search; recorded as searchPatients.'),
  'GET /api/patients/detail': view('One record; recorded as viewPatientRecord.'), 'GET /api/history': view('Revision history; recorded as viewRecordHistory.'), 'GET /api/worklists': view(), 'GET /api/household': view('Recorded as viewHousehold.'),
  'GET /api/identity-cases': view(), 'GET /api/reassignment': view('Reassignment queue for the viewer\'s teams.'), 'GET /api/referral-escalations': view(), 'GET /api/referral-requests': view(), 'GET /api/action-plan': view(), 'GET /api/continuity': view(), 'GET /api/exceptional': view(), 'GET /api/exceptions': view(),
  'GET /api/audit': view('Scoped audit trail for the viewer.'), 'GET /api/rights': view(), 'GET /api/trace': view(), 'GET /api/abdm': view('Received external records; recorded as viewExternalRecords.'), 'GET /api/outreach': view(),
  // ---- sends and requests to external systems ----------------------------------------------------------------------
  'POST /api/commands': outbound('Every command; the outbound ones are classified by name in COMMANDS below and checked against their purpose.'),
  'POST /api/anaemia-screenings': outbound('Demonstration anaemia provider; synthetic image, disabled on hosted staging.'),
  'POST /api/anaemia-connection-test': outbound('Connection test with a synthetic payload.'), 'POST /api/anaemia-demo-visit': mutation('Creates a synthetic demonstration visit.'),
  'POST /api/frontline-assessments': outbound('Frontline assessment through a configured provider; purpose ai-assistance.'), 'POST /api/frontline-connection-test': outbound('Connection test with a synthetic payload.'),
  // ---- inbound and mutations ---------------------------------------------------------------------------------------
  'POST /api/mis/callback': inbound('Signed programme callback.'), 'POST /api/record-import': inbound('Dry run or apply of an uploaded CSV.'), 'POST /api/patient-import': inbound('Dry run or apply of an uploaded CSV.'), 'POST /api/workforce-import': inbound('Dry run of an uploaded roster.'),
  'POST /api/roster': inbound('Roster preview.'), 'POST /api/media': mutation('Visit media upload.'), 'DELETE /api/media/[id]': mutation('Draft media removal.'), 'POST /api/record-opened': mutation('Browser-reported record open, recorded as openRecord.'),
  'POST /api/identifier-search': view('Issuer-identifier search; one matching record in scope; recorded.'), 'POST /api/patient-matches': view('Possible matches inside the searcher\'s scope.'),
};
// Outbound and disclosing commands (the keys of COMMAND_PURPOSE in purpose-scope.ts). Every key must be classified here.
// aggregate: carries only suppressed aggregate cells (aggregate-delivery.ts). record: carries one person's data to a named destination under consent and a purpose.
export const COMMANDS: Record<string, { carries: 'aggregate' | 'record' | 'none'; note: string }> = {
  preparePlan: { carries: 'none', note: 'Prepares an outbound plan; nothing leaves.' }, approvePlan: { carries: 'none', note: 'Approval step.' }, executePlan: { carries: 'record', note: 'Programme submission of one person\'s plan.' },
  sendSubmission: { carries: 'record', note: 'Programme submission of one visit.' }, requestDestinationEnrolment: { carries: 'record', note: 'One person\'s enrolment request.' }, activateDestinationEnrolment: { carries: 'record', note: 'Activation of that enrolment.' },
  prepareIdentifierCorrection: { carries: 'none', note: 'Prepared; nothing leaves.' }, approveIdentifierCorrection: { carries: 'none', note: 'Approval step.' }, sendIdentifierCorrection: { carries: 'record', note: 'Identifier correction to a destination.' },
  prepareIncentiveClaim: { carries: 'none', note: 'Prepared claim; leaves only through the audited CSV.' }, prepareIncentiveCorrection: { carries: 'none', note: 'Prepared correction.' },
  prepareEhrPublish: { carries: 'none', note: 'Prepared.' }, executeEhrPublish: { carries: 'record', note: 'One visit document to a linked EHR.' }, retrieveEhrDocument: { carries: 'none', note: 'Inbound retrieval.' }, importEhrDocument: { carries: 'none', note: 'Inbound import.' },
  linkEhr: { carries: 'record', note: 'Identity link request.' }, grantEhrPermission: { carries: 'none', note: 'Permission record.' }, abdmConsentRequest: { carries: 'record', note: 'ABDM consent request.' }, abdmCareContextLink: { carries: 'record', note: 'ABDM care context link.' }, abdmFetch: { carries: 'none', note: 'Inbound fetch.' },
  prepareAgent: { carries: 'none', note: 'Minimised request prepared.' }, executeAgent: { carries: 'record', note: 'Minimised request to the AI provider.' }, applyAgent: { carries: 'none', note: 'Applies a returned result.' },
  prepareAggregateReport: { carries: 'none', note: 'Prepares suppressed cells.' }, approveAggregateReport: { carries: 'none', note: 'Second-person approval.' }, sendAggregateReport: { carries: 'aggregate', note: 'Sends suppressed cells with a manifest to an aggregate-only destination (slices 7g, 6ab, 6ad, 13d).' },
  householdAddMember: { carries: 'none', note: 'Disclosure inside the organisation.' }, householdVisitSchedule: { carries: 'none', note: 'Disclosure inside the organisation.' }, proxyGrant: { carries: 'none', note: 'Proxy access record.' },
};
// Every source file that sets a Content-Disposition header, with the routes it serves. A new file that does so must be listed.
export const DISPOSITION_SOURCES: Record<string, string[]> = {
  'app/api/fhir/[id]/route.ts': ['GET /api/fhir/[id]'],
  'lib/saha/audit-chain-server.ts': ['GET /api/audit/chain'],
  'lib/saha/data-exit-server.ts': ['GET /api/data-exit'],
  'lib/saha/held-exports-server.ts': ['GET /api/exports'],
  'lib/saha/incentives-server.ts': ['GET /api/incentive-claims'],
  'lib/saha/indicators-server.ts': ['POST /api/indicators'],
  'lib/saha/media-server.ts': ['GET /api/media/[id]'],
  'lib/saha/operations-server.ts': ['GET /api/operations'],
  'lib/saha/outreach-server.ts': ['GET /api/expansion'],
  'lib/saha/pilot-server.ts': ['GET /api/pilot'],
  'lib/saha/record-import-server.ts': ['POST /api/import-rejections'],
};
// Screens that save a file from the browser (createObjectURL). Each only saves the response of the routes named here, never data it
// assembled itself, so the server-side protections above are the only ones that matter. A new screen that saves a file must be listed.
export const CLIENT_DOWNLOADS: Record<string, string[]> = {
  'app/audit-chain-panel.tsx': ['GET /api/audit/chain'],
  'app/data-exit-panel.tsx': ['GET /api/data-exit'],
  'app/expansion-panel.tsx': ['GET /api/expansion'],
  'app/incentive-claims-panel.tsx': ['GET /api/incentive-claims'],
  'app/indicators-panel.tsx': ['POST /api/indicators'],
  'app/operations-panel.tsx': ['GET /api/operations'],
  'app/pilot-panel.tsx': ['GET /api/pilot'],
  'app/record-import-panel.tsx': ['POST /api/import-rejections'],
  'app/anaemia-panel.tsx': [],  // previews the member's own chosen image; nothing leaves
};
