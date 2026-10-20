import type { ReminderOptoutEvidence } from './reminder-optout';
import type {FrontlineRun} from './frontline';
import type {AnaemiaRun} from './anaemia';
import type { Governance, ProtocolCheck } from './governance';
import type { IdentityReview, AssignmentEvent } from './continuity';
import type { Pilot } from './pilot';
import type { ContactPreferences, Outreach } from './outreach';
import type { Expansion } from './expansion';
import type { Operations } from './operations';
import type { FieldLease } from './field';
import type { Household, ProxyGrant } from './household';
import type { CaseloadTransfer } from './caseload';
import type { MergeCase, MergeLink } from './merge';
import type { ExceptionalGrant } from './exceptional';
import type { RightsRequest, Restriction } from './rights';
import type { ConsentEvent } from './consent';
import type { DelegationUse } from './delegation';
import type { Retention } from './retention';
import type { ReferralState, Urgency } from './referral-rules';
import type { Abha, AbdmConsent, AbdmConfig } from './abdm';
import type { CareContext, ReceivedRecord, Transfer } from './abdm-transfer';
import type { MediaRef } from './media';
import type { EhrConfig, EhrState } from './ehr';
import type { MisConfig, Delivery } from './mis';
import type { AdapterOperations, Refusal } from './adapter-operations';
import type { AgentRun, AgentProvider } from './agent';
import type { Enrolment, FollowUp, ProgrammeCapture } from './programmes';
import type { FieldRegistration, ReferralRequest } from './field-registration';
import type { PackRequest, ReferralNeed } from './referral-needs';
// Slice 5b: 'provider' exists only in provider sandbox organisations (lib/saha/provider-sandbox.ts).
export type Role = 'asha' | 'clinician' | 'supervisor' | 'admin' | 'provider';
export type Programme = 'Maternal care' | 'Chronic care' | 'TB screening' | 'Child health' | 'General care';
// Slice 4d: one dependency between two plan items of the same patient; removal is appended, never deleted.
export type PlanItemRef={kind:'follow-up'|'referral'|'protocol-review';id:string};
export type PlanDependency={id:string;dependent:PlanItemRef;blocker:PlanItemRef;at:string;by:string;reason:string;removed?:{at:string;by:string;reason:string}};
// Slice 4d: an additional source of a referral (the referral's own visit remains its first source).
export type ReferralSource={id:string;kind:'visit'|'protocol-evaluation'|'programme-episode';refId:string;visitId?:string;sourceAt:string;linkedAt:string;by:string;note:string};
// Slice 2h: external identifiers recorded for a person (issuer and value). Slice 10e: the list is an append-only ledger
// (a programme identity crosswalk). Imported entries (source 'import', verified false) are unchanged; a crosswalk entry
// (source 'crosswalk') names who recorded it and when, where the identifier came from (origin) and its verification state,
// which a person attests: Saha never contacts an issuer. An entry is never edited or removed: a correction is a later 'correct'
// entry and a withdrawal a later 'withdraw' entry, each naming the entry it replaces in `corrects` (identifierRef). The
// identifiers a record holds now are currentIdentifiers(person).
export type IdentifierOrigin='programme-card'|'programme-system'|'person-reported'|'referral-document';
export type IdentifierVerification='unverified'|'document-seen'|'issuer-checked';
export type ExternalIdentifier={issuer:string;value:string;verified:boolean;recordedAt:string;recordedBy:string;source:'import'|'crosswalk';imported?:{batchId:string;row:number;planHash:string};id?:string;kind?:'link'|'correct'|'withdraw';corrects?:string;origin?:IdentifierOrigin;verification?:IdentifierVerification;evidence?:string;reason?:string};
// The reference a later entry uses to point at an entry: its id, or for an entry from a slice 2h import its batch and row.
export const identifierRef=(e:ExternalIdentifier)=>e.id??(e.imported?`import:${e.imported.batchId}:${e.imported.row}`:'');
// Entries not replaced by a later correction or withdrawal, withdrawal entries themselves excluded: what the record holds now.
export function currentIdentifiers(p:{identifiers?:ExternalIdentifier[]}):ExternalIdentifier[]{const list=p.identifiers??[],replaced=new Set(list.map(e=>e.corrects).filter((x):x is string=>!!x));return list.filter(e=>e.kind!=='withdraw'&&!replaced.has(identifierRef(e)));}
export type Person = {importedVisitOverlapReviews?:import('./imported-evidence').ImportedVisitOverlapReview[];importedVisitWithdrawals?:import('./imported-evidence').ImportedVisitWithdrawal[];importedVisitEvidence?:import('./imported-evidence').ImportedEvidence[];importedContacts?:import('./contact-import').ImportedContact[];reminderOptouts?:ReminderOptoutEvidence[];identifiers?:ExternalIdentifier[];packMigration?:{batchId:string;enrolmentId:string;packId:string;from:number;to:number;at:string};planDependencies?:PlanDependency[];imported?:{batchId:string;row:number;at:string;by:string;planHash:string};synthetic?:boolean;syntheticMark?:{batchId:string;at:string;by:string};consentHistory?:ConsentEvent[];fieldRegistration?:FieldRegistration;abha?:Abha;abdmConsents?:AbdmConsent[];careContexts?:CareContext[];abdmTransfers?:Transfer[];abdmReceived?:ReceivedRecord[];restrictions?:Restriction[];exceptionalAccess?:ExceptionalGrant[];mergedInto?:MergeLink;mergedFrom?:MergeLink[];householdId?:string;proxies?:ProxyGrant[];identityReview?:IdentityReview;assignmentHistory?:AssignmentEvent[];contactPreferences?:ContactPreferences;fieldLeases?:FieldLease[];ehr?:EhrState;enrolments?:Enrolment[]; followUps?:FollowUp[]; id:string; name:string; age:number; sex:string; village:string; programmes:Programme[]; task:string; due:string; status:'due'|'in_progress'|'completed'; aiConsent:boolean; exchangeConsent:boolean; consentVersion:number; assigned:boolean; createdAt:string; version:number; teamId:string; assignedTo:string|null; facilityId?:string; localityId?:string};
// Slice 2c: optional source and observation time for each measurement (BR-DATA-02). A value is measured or reported;
// a blank measurement may say why it is missing. Absent entries fall back to the visit-level source and time.
export type FactSource='measured'|'reported'|'not-asked'|'declined'|'unknown'|'not-applicable';
export type Measure='bloodPressure'|'weight'|'temperature'|'weeks'|'coughDays';
export type FactProvenance={source:FactSource;at?:string};
// Slice 2e: who recorded each measurement (server identity at save time) and its clinician verification state.
// Reviews are appended, never rewritten; the latest review for a measurement is its current state.
export type FactAuthor={userId:string;name:string;accountCode:string;role:Role;at:string};
export type FactReview={id:string;measure:Measure;state:'verified'|'disputed';by:string;byName:string;at:string;reason?:string};
// Slice 2g: who recorded the visit notes and each programme answer (server identity at save time), clinician reviews of
// them (appended, latest wins; entry is 'notes' or 'answer:<question id>'), and supervisor sign-off before sending.
export type EntryReview={id:string;entry:string;state:'verified'|'disputed';by:string;byName:string;at:string;reason?:string};
export type SignOff={id:string;by:string;byName:string;accountCode:string;role:Role;at:string;visitVersion:number;contentHash:string;delegationId?:string;note?:string};
// Slice 10g (BR-DATA-02): an enforced dispute on one confirmed fact, note or programme answer (target 'fact:<measure>',
// 'notes' or 'answer:<question id>'), appended with its reason and reference and never edited. It blocks every send that
// would carry the target until a clinician appends a resolution (the dispute itself stays). contentHash binds the dispute
// to the content disputed; an explicitly legacy-unbound verification hold uses an empty hash, never an invented
// historical binding. Its resolution records a new current hash. A sign-off withdrawal is appended the same way and leaves the sign-off it withdraws unchanged.
export type Dispute={id:string;target:string;reason:string;reference:string;by:string;byName:string;accountCode:string;role:Role;at:string;visitVersion:number;contentHash:string;valueText:string;carriedFrom?:string;verification?:{reviewId:string;binding:'exact-content'|'legacy-unbound';carryContent?:string;recorderIds?:string[]}};
export type DisputeResolution={id:string;disputeId:string;outcome:'stands'|'corrected';by:string;byName:string;accountCode:string;at:string;evidence:string;reference?:string;currentContentHash?:string};
export type SignOffWithdrawal={id:string;signOffId:string;by:string;byName:string;accountCode:string;role:Role;at:string;reason:string;delegationId?:string};
// Slice 10g: a send stopped by an open dispute or by sign-off after its delivery checkpoint was stored (closed as not sent).
export type SendBlockRecord={kind:'dispute'|'sign-off';stage:'checkpoint';at:string;disputeIds?:string[]};
// Slice 2i: a value entered in an alternative unit (converted on the server; the original is kept) and the recorder's
// reason for a value outside the expected range. Overrides are appended by the server with who/when; a clinician who
// did not record the value confirms one outside the wider confirmation range.
export type ValueField='systolic'|'diastolic'|'weight'|'temperature'|'weeks'|'coughDays';
export type ConvertibleField='weight'|'temperature'|'coughDays';
// Slice r24 (BR-DATA-05): further alternative units — blood pressure (systolic/diastolic) in kPa and gestational age
// in weeks + days — converted on the server with the entered value kept. Together with ConvertibleField these cover
// every ValueField, so `entered` is keyed by the same six names as the values themselves.
export type ExtraConvertibleField='systolic'|'diastolic'|'weeks';
export type AllConvertibleField=ConvertibleField|ExtraConvertibleField;
export type EnteredValue={value:string;unit:string};
// Slice r24 (BR-DATA-05): the optional context that keys the placeholder value ranges by age, sex and pregnancy.
// When it is absent, or no population group matches, the slice 2i ranges apply unchanged.
export type RangeContext={age?:number;sex?:'Female'|'Male'|'Other'|'Unknown';pregnant?:boolean};
export type RangeCapture={id:string;protocolId:string;manifestHash:string;publicationVersion:number;mode:'default'|'population-demo';compiledVersion:string;version:string;status:string;clinicalApproval:'pending';context?:RangeContext;contextKey:string;group:string;fields:Record<ValueField,{label:string;unit:string;expected:[number,number];confirm:[number,number]}>};
export type ValueOverride={rangeCaptureId?:string;id:string;field:ValueField;value:string;unit:string;entered?:EnteredValue;reason:string;tier:'reason'|'clinician';expected:[number,number];confirm:[number,number];rangesVersion:string;by:FactAuthor;at:string;visitId:string};
export type OverrideConfirmation={id:string;overrideId:string;field:ValueField;by:string;byName:string;accountCode:string;at:string;visitId:string;note?:string};
export type Facts = {date:string; systolic:string; diastolic:string; weight:string; temperature:string; weeks:string; coughDays:string; notes:string; source:'measured'|'reported'; provenance?:Partial<Record<Measure,FactProvenance>>; entered?:Partial<Record<AllConvertibleField,EnteredValue>>; unusual?:Partial<Record<ValueField,string>>;};
// Slice 2j: one downstream output of a confirmed visit version that was later amended or voided, as an owned task.
// External outputs are never corrected automatically; closing needs a verified correction receipt or a reason.
// Slice R26 (BR-DATA-06): a source that links an internal output to the corrected visit (a referral's own or linked
// visit, or the episode that scheduled a follow-up), and a released indicator figure marked affected. The recompute
// summary records how a shadow comparison was re-derived (recomputed or invalidated) without rewriting the
// governance record from a patient-scoped commit.
export type CorrectionSource={kind:'visit'|'protocol-evaluation'|'programme-episode'|'enrolment';refId:string;visitId?:string;label?:string};
export type ReconciliationAssignment={by:string;at:string;from:string|null;to:string;reason:string};
export type ReconciliationNotice={to:string;at:string;seenAt?:string};
export type CorrectionTask={assignmentHistory?:ReconciliationAssignment[];assignmentNotice?:ReconciliationNotice;id:string;visitId:string;correctionVisitId:string|null;cause:'amend'|'void';createdAt:string;createdBy:string;ownerId:string|null;state:'open'|'closed'|'done';
 output:{kind:'programme-submission'|'ehr-publication'|'plan'|'referral'|'follow-up'|'protocol-evaluation'|'assistant-result'|'shadow-comparison'|'worker-activity'|'indicator-releases';refId:string|null;label:string;stateAtCorrection:string;destination?:{id:string;name:string};receipt?:string|null;count?:number;sources?:CorrectionSource[];releases?:{at:string;k:string|null}[];recomputed?:{outcome:'recomputed'|'invalidated';visitId:string|null}};
 external:boolean;action:'send-correction'|'manual-correction'|'look-up-first'|'cancel-unsent'|'review'|'invalidated'|'recomputed';instruction:string;
 closed?:{by:string;byName:string;at:string;verified:boolean;receiptId?:string;reference?:string;reason?:string}};
// Slice 10i: lineage of a visit created by the historical visit import (kind 'visits' of the record import). The visit is a confirmed
// historical record marked IMPORTED; the importer recorded it, and no clinician review or sign-off is implied.
export type VisitImport={batchId:string;row:number;at:string;by:string;byName:string;role:Role;planHash:string;fileDigest:string;sourceSystem:string};
export type Visit = {inboundSourceDecisions?:{conflictId:string;decisionId:string;sourceHash:string;by:string;at:string}[];importedSourceReference?:{evidenceId:string;sourceVisitId:string;reviewId:string;sourceHash:string;by:string;at:string};valueRangeCapture?:RangeCapture;valueRangeHistory?:{capture:RangeCapture|null;at:string;by:string;reason:string}[];reconciliationBackfill?:{planHash:string;by:string;at:string};frontlineRuns?:FrontlineRun[];anaemiaRuns?:AnaemiaRun[];imported?:VisitImport;fieldSync?:{leaseId:string;at:string};correctionTasks?:CorrectionTask[];valueOverrides?:ValueOverride[];overrideConfirmations?:OverrideConfirmation[];factAuthors?:Partial<Record<Measure,FactAuthor>>;factReviews?:FactReview[];noteAuthor?:FactAuthor;answerAuthors?:Record<string,FactAuthor>;entryReviews?:EntryReview[];signOffs?:SignOff[];disputes?:Dispute[];disputeResolutions?:DisputeResolution[];signOffWithdrawals?:SignOffWithdrawal[];fieldRegistrationId?:string;referralRequest?:ReferralRequest;media?:MediaRef[];clinicalConcern?:{value:'yes'|'no'|'unknown';reference:string;by:string;at:string};protocolChecks?:ProtocolCheck[];patientCheck?:{personId:string;personVersion:number;by:string;at:string};agentRuns?:AgentRun[]; programmeCapture?:ProgrammeCapture; id:string; personId:string; version:number; state:'draft'|'confirmed'; facts:Facts; createdAt:string; confirmedAt?:string; plan?:Plan; aiResults:AIResult[]; recordVersion:number; amendsVisitId?:string; supersededBy?:string; voidedAt?:string; voidReason?:string};
export type Plan = {mappingRevisions?:Record<string,{id:string;hash:string}>;payloads?:Record<string,Record<string,unknown>>;id:string; personVersion?:number; approvedById?:string; visitVersion:number; consentVersion:number; connectorVersions:Record<string,number>; recipients:string[]; payloadHash:string; state:'proposed'|'approved'|'completed'|'blocked'; purpose:string; createdAt:string; approvedAt?:string; approvedBy?:string; expiresAt?:string};
export type AIResult = {id:string; providerId:string; providerName:string; mode:'demo'|'http'; status:'succeeded'|'unable_to_assess'|'failed'; text:string; createdAt:string; inputHash:string; reviewed:boolean;};
export type Integration = {operations?:AdapterOperations;abdm?:AbdmConfig;ehr?:EhrConfig;mis?:MisConfig;agentContract?:{version:1;model:string};id:string;name:string;kind:'ai'|'mis'|'ehr'|'abdm';mode:'demo'|'http'|'unconfigured';status:'active'|'suspended'|'unconfigured';version:number;description:string;programmes:Programme[];endpoint?:string;credentialBinding?:string;deploymentLocation?:string;capability?:'summary'|'completeness'|'generic';behavior?:'accept'|'uncertain'|'reject';};
export type Submission = {block?:SendBlockRecord;refusal?:Refusal;trace?:TraceStep[];signOff?:{id:string;by:string;byName:string;at:string};delivery?:Delivery;id:string;visitId:string;personId:string;connectorId:string;connectorName:string;state:'accepted'|'uncertain'|'rejected'|'cancelled'|'queued'|'sending'|'retryable';mode:'demo'|'http';payloadHash:string;receipt?:string;attempts:number;message:string;createdAt:string;updatedAt:string;};
export type Referral = {need?:ReferralNeed;packRequests?:PackRequest[];sources?:ReferralSource[];urgency?:Urgency;appointmentAt?:string;delays?:{id:string;at:string;by:string;from:string;to:string;constraint:string;reason:string}[];directory?:{entryId:string;manifestHash:string;revision:number;contactRoute:string;location:string;verifiedOn:string;reviewBy:string};version?:number;ownerId?:string;due?:string;events?:{id:string;state:string;note:string;source:string;evidenceReference:string;occurredAt:string;recordedAt:string;actorId:string}[];id:string;personId:string;visitId:string;facility:string;reason:string;state:ReferralState;createdAt:string;};
// Slice 6t: audit actions that record a material read or an external request (see lib/saha/access-audit.ts).
export const ACCESS_ACTION_NAMES:readonly string[] = ['viewPatientRecord','viewActionPlan','viewRecordHistory','viewMedia','viewExternalRecords','downloadFhir','externalRequest','indicatorExport','abhaLinkReview','importRejectionsExport','viewWorkspace','openRecord','searchPatients','listPatients','viewAggregate','identifierSearch','identifierSearchMiss','identifierConflictReview','incentiveExport','viewHousehold'];
// Slice 6y: the correlation reference stamped on each external-execution step from now on: the command that
// caused it (type, receipt key, actor) and the audit event written with it. Older steps have none ("not linked").
export type TraceRef = {command:string;key:string;actorId:string;auditId:string|null};
export type TraceStep = {at:string;state:string;attempt?:number;ref:TraceRef};
export type Audit = {id:string;at:string;actor:string;role:Role;action:string;subject:string;detail:string;actorId?:string;personId?:string|null;};
export type Workspace = {schemaVersion:1;revision:number;role:Role;people:Person[];visits:Visit[];integrations:Integration[];submissions:Submission[];referrals:Referral[];audit:Audit[];receipts:Record<string,{hash:string;result:any}>};
// Slice 9b: displayName is the name the organisation shows (the member's own chosen name, else the invitation label when the
// sign-in identity carries only an email address, else the sign-in name). accountName is the sign-in name, kept to identify the account.
export type Member = {userId:string;displayName:string;accountCode:string;role:Role;isOwner:boolean;status:'active'|'suspended'|'removed';version:number;teamIds:string[];createdAt:string;accountName?:string;nameSource?:'self'|'invitation'|'account';nameVersion?:number;language?:'en'|'hi';languageVersion?:number};
export type Team = {id:string;name:string;createdAt:string};
export type Invitation = {id:string;accountCode:string;label:string;role:Role;teamIds:string[];status:'pending'|'accepted'|'revoked';expiresAt:string;createdBy:string;createdAt:string;tokenHash?:string;acceptedBy?:string};
export type Organisation = {id:string;name:string;revision:number;createdAt:string;patientRevision?:number};
export type OrgState = {governance?:Governance;outreach?:Outreach;expansions?:Expansion[];pilot?:Pilot;operations?:Operations;organisation:Organisation;members:Member[];teams:Team[];invitations:Invitation[];workspace:Workspace;
 // Slice 0a: per-patient concurrency counters as loaded, and the patient ids loaded when the
 // state is a patient partition rather than the whole organisation.
 patientRevs?:Record<string,number>;partition?:string[];
 // Slice 0b-2: set when the state was read for one viewer's workspace; such a state is never persisted.
 readOnlyFor?:string;
 // Slice 1: households, loaded in full for organisation-wide reads and for the partition's households otherwise.
 households?:Household[];
 // Slice 1b: caseload transfers, loaded for organisation-wide reads only.
 caseloads?:CaseloadTransfer[];
 // Slice 1c: identity merge cases; organisation-wide reads load all, patient partitions load those naming a loaded patient.
 identityCases?:MergeCase[];
 // Slice 6b: rights and grievance requests.
 rightsRequests?:RightsRequest[];
 // Slice 6c: retention schedules and legal holds (organisation-level).
 retention?:Retention;
 // Slice 1e: delegations relied on while applying one command; never persisted, turned into audit lines.
 delegationUsed?:DelegationUse[];
 // Slice 0b-3: set when a large team scope was read as a window of opened patients; total is the viewer's permitted count.
 paging?:{total:number;threshold:number}};
export type Snapshot = Omit<Workspace,'receipts'> & {burdenMeasurement?:{enabled:boolean;version:number};programmePacks?:{id:string;version:number;name:string;enrollable:boolean;installed:boolean;completionRules?:{id:string;label:string}[]}[];user:{userId:string;displayName:string;accountCode:string};maintenance?:{active:boolean;reason:string};environment:'synthetic'|'training'|'staging'|'production'|'misconfigured';environmentLabel:string;externalApisEnabled:boolean;agentProviders:AgentProvider[];ehrReadiness:{id:string;ready:boolean;message:string}[];misReadiness:{id:string;ready:boolean;message:string}[];organisation:Organisation;organisations:{id:string;name:string;role:Role;isOwner:boolean}[];membership:Member;members:Member[];teams:Team[];invitations:Invitation[];canManage:boolean;canAssign:boolean;speechPolicy?:{cloudAllowed:boolean;version:number};signOffPolicy?:{required:boolean;version:number;rules?:{programmes:Record<string,'required'|'not-required'>;destinations:Record<string,'required'|'not-required'>}};delegatedAuthority?:{id:string;kind:'team-supervision'|'reporting';teamIds:string[];until:string;grantorId:string}[];signOutPath?:string;auditCursor:string|null;migration:{migratedAt:string;counts:Record<string,number>}|null;
 // Slice 0b-3: present when the viewer's scope is paged; people, visits, submissions and referrals then hold only the opened window.
 patientPaging?:{total:number;threshold:number;window:string[]}};
export type RecordRevision = {id:string;personId:string;entityType:'person'|'visit';entityId:string;version:number;actorId:string;actorName:string;action:string;reason:string;data:Person|Visit;changes:{field:string;before:string;after:string}[];createdAt:string};
export const PROGRAMMES:Programme[]=['Maternal care','Chronic care','TB screening','Child health','General care'];
export const ROLE_LABEL:Record<Role,string>={asha:'ASHA worker',clinician:'Clinician',supervisor:'Supervisor',admin:'Administrator',provider:'Provider (sandbox)'};
export const emptyFacts=():Facts=>({date:new Date().toISOString().slice(0,16),systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',notes:'',source:'measured'});

// Slice 10i: imported visits are read-only history (lib/saha/imported-visits.ts). A record opens on its latest visit recorded in Saha, never an imported one.
export const isImported=(v:{imported?:unknown}|undefined|null)=>!!v?.imported;
export const latestOwnVisitId=(visits:Pick<Visit,'id'|'personId'|'imported'>[],personId:string)=>visits.filter(v=>v.personId===personId&&!v.imported).at(-1)?.id??null;
