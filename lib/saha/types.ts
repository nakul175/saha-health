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
import type { AgentRun, AgentProvider } from './agent';
import type { Enrolment, FollowUp, ProgrammeCapture } from './programmes';
import type { FieldRegistration, ReferralRequest } from './field-registration';
// Slice 5b: 'provider' exists only in provider sandbox organisations (lib/saha/provider-sandbox.ts).
export type Role = 'asha' | 'clinician' | 'supervisor' | 'admin' | 'provider';
export type Programme = 'Maternal care' | 'Chronic care' | 'TB screening' | 'Child health' | 'General care';
// Slice 4d: one dependency between two plan items of the same patient; removal is appended, never deleted.
export type PlanItemRef={kind:'follow-up'|'referral'|'protocol-review';id:string};
export type PlanDependency={id:string;dependent:PlanItemRef;blocker:PlanItemRef;at:string;by:string;reason:string;removed?:{at:string;by:string;reason:string}};
// Slice 4d: an additional source of a referral (the referral's own visit remains its first source).
export type ReferralSource={id:string;kind:'visit'|'protocol-evaluation'|'programme-episode';refId:string;visitId?:string;sourceAt:string;linkedAt:string;by:string;note:string};
export type Person = {packMigration?:{batchId:string;enrolmentId:string;packId:string;from:number;to:number;at:string};planDependencies?:PlanDependency[];imported?:{batchId:string;row:number;at:string;by:string;planHash:string};synthetic?:boolean;syntheticMark?:{batchId:string;at:string;by:string};consentHistory?:ConsentEvent[];fieldRegistration?:FieldRegistration;abha?:Abha;abdmConsents?:AbdmConsent[];careContexts?:CareContext[];abdmTransfers?:Transfer[];abdmReceived?:ReceivedRecord[];restrictions?:Restriction[];exceptionalAccess?:ExceptionalGrant[];mergedInto?:MergeLink;mergedFrom?:MergeLink[];householdId?:string;proxies?:ProxyGrant[];identityReview?:IdentityReview;assignmentHistory?:AssignmentEvent[];contactPreferences?:ContactPreferences;fieldLeases?:FieldLease[];ehr?:EhrState;enrolments?:Enrolment[]; followUps?:FollowUp[]; id:string; name:string; age:number; sex:string; village:string; programmes:Programme[]; task:string; due:string; status:'due'|'in_progress'|'completed'; aiConsent:boolean; exchangeConsent:boolean; consentVersion:number; assigned:boolean; createdAt:string; version:number; teamId:string; assignedTo:string|null};
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
export type Facts = {date:string; systolic:string; diastolic:string; weight:string; temperature:string; weeks:string; coughDays:string; notes:string; source:'measured'|'reported'; provenance?:Partial<Record<Measure,FactProvenance>>;};
export type Visit = {factAuthors?:Partial<Record<Measure,FactAuthor>>;factReviews?:FactReview[];noteAuthor?:FactAuthor;answerAuthors?:Record<string,FactAuthor>;entryReviews?:EntryReview[];signOffs?:SignOff[];fieldRegistrationId?:string;referralRequest?:ReferralRequest;media?:MediaRef[];clinicalConcern?:{value:'yes'|'no'|'unknown';reference:string;by:string;at:string};protocolChecks?:ProtocolCheck[];patientCheck?:{personId:string;personVersion:number;by:string;at:string};agentRuns?:AgentRun[]; programmeCapture?:ProgrammeCapture; id:string; personId:string; version:number; state:'draft'|'confirmed'; facts:Facts; createdAt:string; confirmedAt?:string; plan?:Plan; aiResults:AIResult[]; recordVersion:number; amendsVisitId?:string; supersededBy?:string; voidedAt?:string; voidReason?:string};
export type Plan = {payloads?:Record<string,Record<string,unknown>>;id:string; personVersion?:number; approvedById?:string; visitVersion:number; consentVersion:number; connectorVersions:Record<string,number>; recipients:string[]; payloadHash:string; state:'proposed'|'approved'|'completed'|'blocked'; purpose:string; createdAt:string; approvedAt?:string; approvedBy?:string; expiresAt?:string};
export type AIResult = {id:string; providerId:string; providerName:string; mode:'demo'|'http'; status:'succeeded'|'unable_to_assess'|'failed'; text:string; createdAt:string; inputHash:string; reviewed:boolean;};
export type Integration = {abdm?:AbdmConfig;ehr?:EhrConfig;mis?:MisConfig;agentContract?:{version:1;model:string};id:string;name:string;kind:'ai'|'mis'|'ehr'|'abdm';mode:'demo'|'http'|'unconfigured';status:'active'|'suspended'|'unconfigured';version:number;description:string;programmes:Programme[];endpoint?:string;credentialBinding?:string;capability?:'summary'|'completeness'|'generic';behavior?:'accept'|'uncertain';};
export type Submission = {signOff?:{id:string;by:string;byName:string;at:string};delivery?:Delivery;id:string;visitId:string;personId:string;connectorId:string;connectorName:string;state:'accepted'|'uncertain'|'rejected'|'cancelled'|'queued'|'sending'|'retryable';mode:'demo'|'http';payloadHash:string;receipt?:string;attempts:number;message:string;createdAt:string;updatedAt:string;};
export type Referral = {sources?:ReferralSource[];urgency?:Urgency;appointmentAt?:string;delays?:{id:string;at:string;by:string;from:string;to:string;constraint:string;reason:string}[];directory?:{entryId:string;manifestHash:string;revision:number;contactRoute:string;location:string;verifiedOn:string;reviewBy:string};version?:number;ownerId?:string;due?:string;events?:{id:string;state:string;note:string;source:string;evidenceReference:string;occurredAt:string;recordedAt:string;actorId:string}[];id:string;personId:string;visitId:string;facility:string;reason:string;state:ReferralState;createdAt:string;};
// Slice 6t: audit actions that record a material read or an external request (see lib/saha/access-audit.ts).
export const ACCESS_ACTION_NAMES:readonly string[] = ['viewPatientRecord','viewRecordHistory','viewMedia','viewExternalRecords','downloadFhir','externalRequest','indicatorExport'];
export type Audit = {id:string;at:string;actor:string;role:Role;action:string;subject:string;detail:string;actorId?:string;personId?:string|null;};
export type Workspace = {schemaVersion:1;revision:number;role:Role;people:Person[];visits:Visit[];integrations:Integration[];submissions:Submission[];referrals:Referral[];audit:Audit[];receipts:Record<string,{hash:string;result:any}>};
export type Member = {userId:string;displayName:string;accountCode:string;role:Role;isOwner:boolean;status:'active'|'suspended'|'removed';version:number;teamIds:string[];createdAt:string};
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
export type Snapshot = Omit<Workspace,'receipts'> & {programmePacks?:{id:string;version:number;name:string;enrollable:boolean;installed:boolean}[];user:{userId:string;displayName:string;accountCode:string};maintenance?:{active:boolean;reason:string};environment:'synthetic'|'training'|'staging'|'production'|'misconfigured';environmentLabel:string;externalApisEnabled:boolean;agentProviders:AgentProvider[];ehrReadiness:{id:string;ready:boolean;message:string}[];misReadiness:{id:string;ready:boolean;message:string}[];organisation:Organisation;organisations:{id:string;name:string;role:Role;isOwner:boolean}[];membership:Member;members:Member[];teams:Team[];invitations:Invitation[];canManage:boolean;canAssign:boolean;signOffPolicy?:{required:boolean;version:number};delegatedAuthority?:{id:string;kind:'team-supervision'|'reporting';teamIds:string[];until:string;grantorId:string}[];signOutPath?:string;auditCursor:string|null;migration:{migratedAt:string;counts:Record<string,number>}|null;
 // Slice 0b-3: present when the viewer's scope is paged; people, visits, submissions and referrals then hold only the opened window.
 patientPaging?:{total:number;threshold:number;window:string[]}};
export type RecordRevision = {id:string;personId:string;entityType:'person'|'visit';entityId:string;version:number;actorId:string;actorName:string;action:string;reason:string;data:Person|Visit;changes:{field:string;before:string;after:string}[];createdAt:string};
export const PROGRAMMES:Programme[]=['Maternal care','Chronic care','TB screening','Child health','General care'];
export const ROLE_LABEL:Record<Role,string>={asha:'ASHA worker',clinician:'Clinician',supervisor:'Supervisor',admin:'Administrator',provider:'Provider (sandbox)'};
export const emptyFacts=():Facts=>({date:new Date().toISOString().slice(0,16),systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',notes:'',source:'measured'});
