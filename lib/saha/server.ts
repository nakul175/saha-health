import {transitionSuperseded} from './programmes';
import {writeFailureEvent} from './observability';
import {materialiseInstalledWork,installedWorkRows} from './installed-pack-work';
import {collectSensitive,minimiseLegacyAiPayload} from './agent-minimisation';
import {deviceGrantRows} from './device-work';
import { rangeCaptureFor } from './fact-provenance';
import {serviceDispatch} from './service-dispatch';
import { applyReconciliation, authorizeReconciliation } from './reconciliation';
import {checkSourceCommand} from './clinical-source';
import { applyGovernance, authorizeGovernance } from './governance';
import { applyDeploymentAuthorisation, authorizeDeploymentAuthorisation } from './deployment-authorisation';
import { applyShadow, authorizeShadow } from './shadow';
import { applyEvaluation, authorizeEvaluation } from './evaluation';
import { executeEvaluation } from './evaluation-execution';
import { applyHousehold, authorizeHousehold } from './household';
import { applyHouseholdWork, authorizeHouseholdWork } from './household-visit-work';
import { applyHouseholdVisit, authorizeHouseholdVisit } from './household-visit';
import { applyProgrammeReferrals, authorizeProgrammeReferrals } from './referral-consolidation';
import { applyCaseload, authorizeCaseload } from './caseload';
import { applyDueCaseloads } from './caseload-schedule';
import { applyMerge, authorizeMerge, ensureNotMerged } from './merge';
import { applyExceptional, authorizeExceptional, ensureExceptionalScope } from './exceptional';
import { applyRights, authorizeRights, ensureNotRestricted } from './rights';
import { applyRetention, authorizeRetention } from './retention';
import { applyFixtureMark, authorizeFixtureMark } from './fixture-migration';
import { applyProgrammeMigration, authorizeProgrammeMigration } from './programme-migration';
import { applyRangeProtocol, authorizeRangeProtocol, applyPackInstallation, authorizePackInstallation } from './pack-installation';
import { catalogueOf, enrollableAt, installedPacks } from './programmes';
import { applyConsent, authorizeConsent, consentNoticesFor } from './consent';
import { applyFactReview, authorizeFactReview, recordFactAuthors } from './fact-verification';
import { applySignOff, authorizeSignOff, carryDisputes, ensureSignOff, signOffPolicy, stampSubmissions } from './visit-signoff';
import { applyPatientImport, authorizePatientImport } from './patient-import';
import { applyRecordImport, authorizeRecordImport } from './record-import';
import { authorizeCrosswalk } from './crosswalk';
import { crosswalkWithReview } from './crosswalk-server';
import { applyCrosswalkCorrection, authorizeCrosswalkCorrection } from './crosswalk-correction';
import { ensureNotImported } from './imported-visits';
import { applyDelegation, authorizeDelegation, delegationAudit, heldBy } from './delegation';
import { applyIndicatorRegistry, authorizeIndicatorRegistry } from './indicator-registry';
import { applyReferral, authorizeReferralSource } from './referrals';
import {applyDueWork, applyDueWorkPolicy, authorizeDueWork} from './due-work';
import { applyActionPlan, authorizeActionPlan } from './action-plan';
import { applyReassignment, authorizeReassignment } from './reassignment';
import { applyCorrectionTask, authorizeCorrectionTask } from './correction-tasks';
import { applyExceptionAssignment, authorizeExceptionAssignment } from './exceptions';
import { authorizeDeviceDiagnosticReplay, readDeviceDiagnosticRows } from './exception-diagnostics';
import { applyRoster } from './roster';
import { applyWorkforceImport, authorizeWorkforceImport } from './workforce-import';
import { reserveAbhaReview, releaseAbhaReview, recordAbhaReviewReservation } from './abha-review-reservation';
import { AbhaHeldElsewhere, LINK_REFUSED, validateAbhaLink, applyAbdm, authorizeAbdm, redactAbha, redactRevision } from './abdm';
import { applyTransfer, authorizeTransfer } from './abdm-transfer';
import { applyContinuity, authorizeContinuity, ensurePatientIdentity, reviewRegistration } from './continuity';
import { applyPilot, authorizePilotCommand } from './pilot';
import { applyOutreach, authorizeOutreach } from './outreach';
import { applyPrioritisation, authorizePrioritisation } from './prioritisation';
import { applyExpansion, authorizeExpansion } from './expansion';
import { boundedJsonBody } from './request-body';
import { accessRoute, recordAccess, recordAccesses } from './access-audit';
import { applyOperations, ensureOperating, operator } from './operations';
import { applyFacilityScope, authorizeFacilityScope } from './facility-scope';
import { applyInvoiceReconciliation } from './ai-invoice';
import { ALERT_OWNERS, applyAlertAck, canAcknowledge } from './alerts';
import { authorizeInboxReplay, evaluateAfterCommand, markRead } from './alert-delivery-server';
import { applyField } from './field';
import { applyFieldRegistration, authorizeFieldRegistration } from './field-registration';
import {registrationGrantRows,recordRegistrationWireReplay} from './registration-device-work';
import { applyReferralRequest, authorizeReferralRequest } from './referral-request';
import { applyEhr, ehrReadiness } from './ehr';
import { executeEhr } from './ehr-execution';
import { configureMis, mappedPayload, misReadiness, MAPPING_COMMANDS, pinMisMappingApprovals } from './mis';
import { executeMis } from './mis-execution';
import { authorizeDestinationEnrolment } from './destination-enrolment';
import { executeDestinationEnrolment } from './destination-enrolment-execution';
import { providers, agentApply } from './agent';
import { executeAgent } from './agent-execution';
import { linkTrace } from './trace';
import { applyAdapterOperations } from './adapter-operations';
import { applyIntegrationReadiness } from './integration-readiness';
import { applyPurposeScope, authorizePurposeScope, COMMAND_PURPOSE, ensurePurpose } from './purpose-scope';
import { applyDeploymentConfiguration, authorizeDeploymentConfiguration, enforceDeploymentConfiguration } from './deployment-configuration';
import {applySupportCase,authorizeSupportCase} from './support-case';
import { applyDataFlowAuthority, authorizeDataFlowAuthority, requireApprovedDataFlow } from './data-flow-authority';
import { applyNotificationChannel } from './notification-channel';
import { applySpeechPolicy, speechPolicyView } from './speech';
import { authorizeAggregate } from './aggregate-delivery';
import { applyIncentives, authorizeIncentives } from './incentives';
import { executeAggregate } from './aggregate-execution';
import { applySandbox, authorizeSandbox, SANDBOX_UNAVAILABLE } from './provider-sandbox';
import { applyDemonstration, authorizeDemonstration, automaticInstall, prepareHome, writeFixtureAccounts } from './demonstration';
import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { identityConfig, principalFromHeaders, signOutPath } from './identity';
import { credentialIsCurrent } from './authentication-recovery';
import { seedWorkspace } from './seed';
import { effectiveRuntime, ensureEnvironment, ensureEnvironmentDataBoundary, environmentOf, ENVIRONMENT_LABEL, fixturesFor, markEnvironmentRecord, outboundEnvironment } from './environment';
import { AppError, apply, digest, fail, person, visit, uuid, type Command } from './core';
import { platformApply, platformSchema, validTeams } from './platform';
import { languageOf } from './messages';
import { patientTargets } from './partition';
import { PAGED_THRESHOLD, pagedWindow, pagingRequest, type PagingRequest } from './patient-directory';
import { auditWindow } from './access-audit';
import { recordWorkspaceLoad, recordPartitionResponse, type SnapshotVia } from './read-audit';
import { accountCode, auditPage, snapshotDecorations, parseCursor, createState, ensureAccount, history, persist, persistBurdenCounter, readState, scope, type Actor } from './store';
import type { OrgState, Integration, Member, Snapshot } from './types';
export async function identity(){const cfg=identityConfig(runtime());if(cfg.error)fail(503,'Sign-in is not configured for this deployment.');const u=await principalFromHeaders(await headers(),cfg);if(u){const security=await db().prepare('SELECT revoked_before FROM credential_recoveries WHERE user_id=?').bind(u.userId).first<{revoked_before:number}>();if(security&&!credentialIsCurrent(u,security.revoked_before))fail(401,'This credential was superseded. Sign in again with the approved institutional method.');return u;}if(import.meta.env.DEV&&cfg.provider==='sites-chatgpt')return {userId:'preview-synthetic-owner',displayName:'Preview owner',email:'preview@example.invalid',fullName:null,provider:'sites-chatgpt' as const};return fail(401,'Sign in to use your workspace.');}
export function db(){if(!env.DB)fail(503,'Workspace storage is temporarily unavailable. Your unsaved input has been kept on screen.');return env.DB!;}
export async function loadFor(u:Actor,orgId?:string|null,targets?:(orgId:string)=>Promise<string[]|null>,viewerScoped=false,paging?:PagingRequest|null,material:boolean|SnapshotVia=false){const id=await activeOrg(u,orgId);
 // Slice 1f: due scheduled caseload transfers are applied (or held) before the organisation is read for this request.
 await applyDueCaseloads(db(),id,u.userId);
 const ids=targets?await targets(id):null;
 // Slice 0b-3: a paging client with a large non-ASHA scope reads only its opened window of patients.
 const paged=viewerScoped&&!ids&&paging?await pagedWindow(db(),id,u.userId,paging.window):null;
 // Slice 6aa (seventh review, finding 3): the window audit is not opt-in. A workspace read without the paging request by a
 // non-ASHA viewer above the threshold returns every in-scope record, so each one is audited first (fail closed).
 const unpaged=material&&viewerScoped&&!ids&&!paging?await pagedWindow(db(),id,u.userId,[]):null;
 let state=paged?await readState(db(),id,paged.ids,u.userId,true):await readState(db(),id,ids??undefined,viewerScoped&&!ids?u.userId:undefined);
 if(unpaged){const vm=scope(state,u.userId),all=state.workspace.people.filter(p=>p.assigned).map(p=>p.id),kept=await auditWindow(db(),state,u,vm,all,undefined,'full');if(kept.length!==all.length)state=await readState(db(),id,kept,u.userId,true);}
 // Slice 6w (fifth review, finding 7): window records not opened through the detail route are audited first.
 if(paged&&paged.ids.length){const kept=await auditWindow(db(),state,u,scope(state,u.userId),paged.ids);if(kept.length!==paged.ids.length){paged.ids=kept;state=await readState(db(),id,kept,u.userId,true);}}
 if(paged)state.paging={total:paged.total,threshold:PAGED_THRESHOLD};ensureEnvironmentDataBoundary(state,rawRuntime());const viewer=scope(state,u.userId);
 // Slice 10h (BR-SEC-08): a whole-caseload snapshot is recorded as one summarised event (scope size, records returned, paging
 // window), after the window audit and before the snapshot is returned; if it cannot be written nothing is returned.
 if(material)await recordWorkspaceLoad(db(),state,u,viewer,typeof material==='string'?material:'workspace load',paged?{total:paged.total,threshold:PAGED_THRESHOLD,window:paged.ids.length}:null);
 return state;}
// The organisation a request acts in: the named one, else the account's active membership.
// Slice 9a: a new home organisation in the synthetic environment receives the demonstration clinical package.
const ensureHome=(u:Actor)=>ensureAccount(db(),u,w=>fixturesFor(rawRuntime(),w),automaticInstall(rawRuntime())?state=>prepareHome(db(),state,u,environmentOf(rawRuntime()).name,accountCode):undefined);
export async function activeOrg(u:Actor,orgId?:string|null){
 await ensureHome(u);let id=orgId;
 if(id){
  // BR-SEC-06: an explicitly named tenant is authority input, not a routing hint. Resolve the current
  // membership before any patient target, search, report, export or traffic-triggered background work can
  // query that tenant. The same refusal covers a missing tenant, a foreign tenant and a revoked membership,
  // so the header cannot be used as a tenant-existence oracle. Every material route still applies its
  // role/patient/purpose checks and rechecks current authority before disclosure or commit.
  const active=await db().prepare('SELECT 1 AS active FROM memberships WHERE org_id=? AND user_id=? AND status=?').bind(id,u.userId,'active').first();
  if(!active)fail(403,'Your organisation membership is inactive or unavailable.');
 }else{
  const a=await db().prepare('SELECT active_org_id FROM accounts WHERE user_id=?').bind(u.userId).first<{active_org_id:string}>();id=a?.active_org_id;
  const active=id?await db().prepare('SELECT user_id FROM memberships WHERE org_id=? AND user_id=? AND status=?').bind(id,u.userId,'active').first():null;
  if(!active){const fallback=await db().prepare('SELECT org_id FROM memberships WHERE user_id=? AND status=? ORDER BY created_at LIMIT 1').bind(u.userId,'active').first<{org_id:string}>();id=fallback?.org_id;if(id)await db().prepare('UPDATE accounts SET active_org_id=? WHERE user_id=?').bind(id,u.userId).run();}
 }
 if(!id)fail(403,'Select an active organisation.');return id;
}
export async function snapshotFor(state:OrgState,u:Actor):Promise<Snapshot>{
 const m=scope(state,u.userId),w=state.workspace;const permitted=new Set(w.people.filter(p=>p.assigned).map(p=>p.id));
 const {orgs,migration,activity}=await snapshotDecorations(db(),state.organisation.id,u.userId);
 const {receipts,...base}=w;
 return {...base,consentNotices:consentNoticesFor(state,m),...(m.isOwner?{dataFlowAuthorities:state.operations?.dataFlows??[]}:{ }),burdenMeasurement:{enabled:!!state.operations?.workBurden?.enabled,version:state.operations?.workBurden?.version??0},programmePacks:catalogueOf(state).map(p=>({id:p.id,version:p.version,name:p.name,enrollable:!!enrollableAt(p.id,p.version,state),installed:!!p.installed,...(p.completionRules?{completionRules:p.completionRules.map(r=>({id:r.id,label:r.label}))}:{})})),role:m.role,people:w.people.filter(p=>permitted.has(p.id)).map(p=>redactAbha({...p,followUps:p.followUps?.map(t=>{const {transitionStatus:_,...original}=t as any;return {...original,...(transitionSuperseded(state,t)?{transitionStatus:'superseded'}:{})};})})),visits:w.visits.filter(v=>permitted.has(v.personId)),submissions:w.submissions.filter(s=>permitted.has(s.personId)),referrals:w.referrals.filter(r=>permitted.has(r.personId)),audit:activity.events,auditCursor:activity.nextCursor,user:{userId:u.userId,displayName:u.displayName,accountCode:await accountCode(u.userId)},maintenance:{active:!!state.operations?.maintenance,reason:state.operations?.reason??''},environment:environmentOf(rawRuntime()).name,environmentLabel:ENVIRONMENT_LABEL[environmentOf(rawRuntime()).name],externalApisEnabled:externalEnabled(),agentProviders:providers(w.integrations,runtime()),ehrReadiness:w.integrations.filter(i=>i.kind==='ehr'&&i.mode==='http').map(i=>ehrReadiness(i,state.organisation.id,runtime())),misReadiness:w.integrations.filter(i=>i.kind==='mis'&&i.mode==='http').map(i=>misReadiness(i,state.organisation.id,runtime())),organisation:state.organisation,organisations:orgs.map(o=>({id:o.id,name:o.name,role:o.role,isOwner:!!o.is_owner})),membership:{...m,...(({language,version})=>({language,languageVersion:version}))(languageOf(state.operations?.memberLanguages,u.userId))},members:state.members.filter(x=>m.isOwner||m.role==='admin'||x.userId===m.userId||x.teamIds.some(t=>m.teamIds.includes(t))),teams:state.teams.filter(t=>m.isOwner||m.role==='admin'||m.teamIds.includes(t.id)),invitations:m.isOwner?state.invitations.map(({tokenHash,...i})=>i):[],canManage:m.isOwner,speechPolicy:speechPolicyView(state,environmentOf(rawRuntime()).name),signOffPolicy:{required:signOffPolicy(state).required,version:signOffPolicy(state).version,...(signOffPolicy(state).rules?{rules:signOffPolicy(state).rules}:{})},canAssign:(m.isOwner||m.role==='supervisor'||heldBy(state,m,'team-supervision').length>0)&&m.role!=='admin',delegatedAuthority:heldBy(state,m,'team-supervision').concat(heldBy(state,m,'reporting')).map(d=>({id:d.id,kind:d.kind,teamIds:d.teamIds,until:d.until,grantorId:d.grantorId})),signOutPath:signOutPath(identityConfig(runtime())),migration:migration?{migratedAt:migration.migrated_at,counts:JSON.parse(migration.counts)}:null,...(state.paging?{patientPaging:{...state.paging,window:w.people.filter(p=>permitted.has(p.id)).map(p=>p.id)}}:{})};
}
export async function snapshot(request?:Request){const u=await identity();return snapshotFor(await loadFor(u,request?.headers.get('x-saha-organisation'),undefined,true,pagingRequest(request),'workspace load'),u);}
// Slice 0b-3: the snapshot returned after a command follows the same paging request as the workspace read.
const viewerSnapshot=async(request:Request,u:Actor,orgId:string,via:SnapshotVia='response to a command')=>snapshotFor(await loadFor(u,orgId,undefined,true,pagingRequest(request),via),u);
async function parseRequest(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)fail(403,'Cross-origin changes are not allowed.');if(request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Cross-site changes are not allowed.');if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this operation.');const key=request.headers.get('idempotency-key');if(!key||!/^[a-zA-Z0-9_-]{8,100}$/.test(key))fail(400,'A valid idempotency key is required.');const input=await boundedJsonBody(request,20000),wireHash=await digest(input);const parsed=platformSchema.safeParse(input);if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid command.');return {key,c:parsed.data,wireHash};}
// Atomic reservation before an ABHA lookup. Refused/pending attempts consume the daily
// bound even if the steward audit cannot be written; successes and unrelated validation
// failures release their slot. Repeated probes never obtain a second uncertain lookup.
async function abdmWithStewardReview(state:OrgState,c:any,u:Actor,m:Member,key:string){
 if(c?.type!=='abhaLink')return applyAbdm(state,c,u,m);
 // Preserve role, patient/version, module and already-linked refusals without looking up
 // another person's number. Wrong-code validation is not used: duplicates precede OTP.
 validateAbhaLink(state,c,m);
 const reservation=await reserveAbhaReview(db(),state.organisation.id,u.userId,key,c,c.abhaNumber);
 if(!reservation.acquired)fail(422,LINK_REFUSED);
 try{
  const result=applyAbdm(state,c,u,m);
  await releaseAbhaReview(db(),state.organisation.id,u.userId,reservation.attemptHash);
  return result;
 }catch(e){
  if(!(e instanceof AbhaHeldElsewhere)){
   await releaseAbhaReview(db(),state.organisation.id,u.userId,reservation.attemptHash);
   throw e;
  }
  try{
   const since=new Date(Date.now()-86400000).toISOString();
   const prior=await db().prepare("SELECT MIN(id) AS id FROM audit_events WHERE org_id=? AND actor_id=? AND action='abhaLinkReview' AND at>=? AND person_id=?").bind(state.organisation.id,u.userId,since,e.heldBy).first<{id:string|null}>();
   const eventId=prior?.id??(await recordAccesses(db(),state,u,m,[{action:'abhaLinkReview',subject:e.heldBy,personId:e.heldBy,detail:`An ABHA link on record ${e.personId} was refused because this record holds the same ABHA number. An identity steward should review whether the two records are the same person. The requester was shown the ordinary link refusal. Recorded on this record only; repeats by the same requester within a day are not recorded again.`}]))[0].id;
   await recordAbhaReviewReservation(db(),state.organisation.id,u.userId,reservation.attemptHash,eventId);
  }catch{/* Audit reports its own fixed failure; keep the reservation and reveal nothing. */}
  fail(422,LINK_REFUSED);
 }
}
async function dispatchCommand(request:Request,parsed:Awaited<ReturnType<typeof parseRequest>>){
 const u=await identity(),{key,c}=parsed,hash=await digest(c);await ensureHome(u);
 const old=await db().prepare('SELECT org_id,hash,result,person_id FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId,key).first<{org_id:string;hash:string;result:string;person_id:string|null}>();
 if(old){if(old.hash!==hash)fail(409,'This operation key was already used for different input.');if(!['switchOrganisation','joinOrganisation','createOrganisation'].includes(c.type)&&request.headers.get('x-saha-organisation')&&old.org_id!==request.headers.get('x-saha-organisation'))fail(409,'This operation key belongs to a different organisation.');const state=await loadFor(u,old.org_id);const m=scope(state,u.userId);if(c.type.startsWith('serviceIdentity')&&!m.isOwner)fail(403,'Only an organisation owner can manage service identities.');if(c.type.startsWith('clinicalAuthority')&&(!m.isOwner||m.role!=='clinician'))fail(403,'A current clinician owner manages professional authority.');authorizeDeploymentConfiguration(state,m,c);enforceDeploymentConfiguration(state,c,true);if(old.person_id&&!c.type.startsWith('support'))person(state.workspace,old.person_id);authorizeExceptionAssignment(state,m,c,old.person_id);await authorizeDeviceDiagnosticReplay(db(),state,m,c.type==='assignException'?c.itemId:'');authorizePilotCommand(state,m,c);authorizeOutreach(state,m,c);authorizePrioritisation(state,m,c);authorizeExpansion(state,m,c);authorizeContinuity(state,m,c);authorizeFieldRegistration(state,m,c);authorizeReferralRequest(state,m,c);authorizeDueWork(state,m,c);authorizeActionPlan(state,m,c);authorizeCorrectionTask(state,m,c);authorizeReconciliation(state,m,c);authorizeReferralSource(state,m,c);authorizeProgrammeReferrals(state,m,c);authorizeHousehold(state,m,c);authorizeHouseholdVisit(state,m,c);authorizeHouseholdWork(state,m,c);authorizeCaseload(state,m,c);authorizeMerge(state,m,c);authorizeCrosswalk(state,m,c);authorizeCrosswalkCorrection(state,m,c);authorizeFacilityScope(state,m,c);authorizePurposeScope(state,m,c);authorizeDataFlowAuthority(state,m,c);authorizeSupportCase(state,m,c);authorizeExceptional(state,m,c);authorizeRights(state,m,c);authorizeConsent(state,m,c);authorizeDelegation(state,m,c);authorizeReassignment(state,m,c);authorizeIndicatorRegistry(state,m,c);authorizeAggregate(state,m,c);authorizeIncentives(state,m,c);authorizeRetention(state,m,c);authorizeFixtureMark(state,m,c);authorizeProgrammeMigration(state,m,c);authorizePackInstallation(state,m,c);authorizeRangeProtocol(state,m,c);if(c.type==='refreshVisitRanges'){if(!['asha','clinician'].includes(m.role))fail(403,'A current care role is required.');visit(state.workspace,c.visitId);}authorizeFactReview(state,m,c);authorizeSignOff(state,m,c);authorizePatientImport(state,m,c);authorizeRecordImport(state,m,c);authorizeWorkforceImport(state,m,c);authorizeAbdm(state,m,c);authorizeTransfer(state,m,c);authorizeSandbox(state,m,c);authorizeShadow(state,m,c);authorizeGovernance(state,m,c);authorizeDeploymentAuthorisation(state,m,c);await checkSourceCommand(db(),state,c,m);authorizeEvaluation(state,m,c);authorizeDemonstration(m,c,environmentOf(rawRuntime()).name);authorizeDestinationEnrolment(m,c);await authorizeInboxReplay(state,m,c);if(c.type==='opsAcknowledgeAlert'){if(!canAcknowledge(m,ALERT_OWNERS[c.alertId]))fail(403,'Your current membership cannot acknowledge this alert.');}else if(c.type.startsWith('ops')&&!operator(m))fail(403,'Operations access required.');if(['opsWorkBurden','opsAvailability','opsMaintenance','opsRates','opsBudget','opsInvoiceReconcile','opsDueWorkPolicy'].includes(c.type)&&!m.isOwner)fail(403,'Owner access required.');if(['createInvite','revokeInvite','updateMember','rosterApply','createTeam','renameOrganisation','enableAgentContract','configureMis',...MAPPING_COMMANDS,'activateMis','testMis','configureEhr','activateEhr','probeEhr','setAdapterOperations','setEhrLookupPolicy'].includes(c.type)&&!m.isOwner)fail(403,'Your current membership cannot access this action.');const result=JSON.parse(old.result);await recordRegistrationWireReplay(db(),state,u,c,key,hash,parsed.wireHash,result);if(request.headers.get('x-saha-response')==='result'&&c.type==='executeAgent')return {result,replayed:true};return {result:JSON.parse(old.result),snapshot:await viewerSnapshot(request,u,state.organisation.id,'replay of a saved command'),replayed:true};}
 if(c.type==='createOrganisation'){
  const count=await db().prepare('SELECT count(*) AS n FROM memberships WHERE user_id=? AND is_owner=1 AND status=?').bind(u.userId,'active').first<{n:number}>();if((count?.n??0)>=10)fail(422,'This release supports up to 10 organisations owned by one account.');
  const now=new Date().toISOString(),orgId=`org_${(await digest(`${u.userId}:${key}`)).slice(0,32)}`,w=fixturesFor(rawRuntime(),seedWorkspace(now));w.people=[];
  const state:OrgState={organisation:{id:orgId,name:c.name,revision:1,createdAt:now},teams:[{id:'default',name:'Care team',createdAt:now}],members:[{userId:u.userId,displayName:u.displayName,accountCode:await accountCode(u.userId),role:'clinician',isOwner:true,status:'active',version:1,teamIds:['default'],createdAt:now}],invitations:[],workspace:w};
  await createState(db(),state,u,'createOrganisation',0,'',{}, {key,hash});return {result:{organisationId:orgId},snapshot:await viewerSnapshot(request,u,orgId)};
 }
 if(c.type==='joinOrganisation'){
  const invite=await db().prepare('SELECT org_id FROM invitations WHERE token_hash=?').bind(await digest(c.token)).first<{org_id:string}>();if(!invite)fail(404,'Invitation not found or unavailable.');
  const state=await readState(db(),invite.org_id),before=structuredClone(state),now=new Date().toISOString();enforceDeploymentConfiguration(state,c);
  const tokenHash=await digest(c.token),inv=state.invitations.find(x=>x.tokenHash===tokenHash);
  if(!inv||inv.status!=='pending'||inv.expiresAt<=now||inv.accountCode!==await accountCode(u.userId))fail(403,'This invitation is expired, used, revoked or belongs to another account.');
  validTeams(state,inv.teamIds,inv.role);const member=state.members.find(m=>m.userId===u.userId);if(member?.status==='active')fail(409,'You are already a member of this organisation.');
  const next={userId:u.userId,displayName:u.displayName,accountCode:await accountCode(u.userId),role:inv.role,isOwner:false,status:'active' as const,version:(member?.version??0)+1,teamIds:inv.teamIds,createdAt:member?.createdAt??now};if(member)Object.assign(member,next);else state.members.push(next);inv.status='accepted';inv.acceptedBy=u.userId;
  state.workspace.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:inv.role,action:'acceptInvite',subject:inv.id,detail:'Account-bound invitation accepted. Membership activated.'});
  await persist(db(),before,state,u,c,key,hash,{organisationId:invite.org_id},[],true);return {result:{organisationId:invite.org_id},snapshot:await viewerSnapshot(request,u,invite.org_id)};
 }
 const requested=c.type==='switchOrganisation'?c.organisationId:request.headers.get('x-saha-organisation');
 // Slice 0a: certified patient commands load only the named patient(s).
 const state=await loadFor(u,requested,orgId=>patientTargets(db(),orgId,c as any)),before=structuredClone(state),m=scope(state,u.userId);authorizeDeploymentConfiguration(state,m,c);enforceDeploymentConfiguration(state,c);ensurePurpose(m,COMMAND_PURPOSE[c.type]);authorizeSandbox(state,m,c);ensureOperating(state,c);ensureEnvironment(state,c,rawRuntime());ensurePatientIdentity(state,c);ensureNotMerged(state,c);ensureNotImported(state,c);ensureExceptionalScope(state,m,c);ensureNotRestricted(state,c);const registration=c.type==='createPerson'?await reviewRegistration(state,m,c):null;let result:any;
 // Slice 2g: supervisor sign-off is checked on the server before executePlan sends or queues programme submissions.
 // Slice 10g: the same call stops open disputes before a plan or EHR publication is prepared or approved, and applies the
 // withdrawal hold and the per-programme and per-destination sign-off rules before a plan runs.
 const signedOff=await ensureSignOff(state,c,m);
 if(c.type==='probeEhr'||c.type==='retrieveEhrDocument'||c.type==='executeEhrPublish'||c.type==='lookupEhrPublish'){const result=await executeEhr(db(),state,c,u,m,key,hash,runtime());return {result,snapshot:await viewerSnapshot(request,u,state.organisation.id)};}
 if(c.type==='testMis'||c.type==='sendSubmission'||c.type==='lookupSubmission'){const result=await executeMis(db(),state,c,u,m,key,hash,runtime());return {result,snapshot:await viewerSnapshot(request,u,state.organisation.id)};}
 // Slice r37: destination enrolment request/lookup/activation against a mock programme destination.
 if(c.type==='requestDestinationEnrolment'||c.type==='lookupDestinationEnrolment'||c.type==='activateDestinationEnrolment'){const result=await executeDestinationEnrolment(db(),state,c,u,m,key,hash,environmentOf(rawRuntime()).name);return {result,snapshot:await viewerSnapshot(request,u,state.organisation.id)};}
 // Slice 7g: aggregate report delivery (prepare, approve, send, lookup) has its own checkpointed execution.
 if(c.type==='prepareAggregateReport'||c.type==='approveAggregateReport'||c.type==='sendAggregateReport'||c.type==='lookupAggregateReport'){authorizeAggregate(state,m,c);const [{reportCompleteness,assertCompletenessCurrent},{configuredLiveFreshness,completenessDisclosure},{periodWindow}]=await Promise.all([import('./reporting-completeness-server'),import('./reporting-completeness'),import('./aggregate-delivery')]),reportingProvider={evaluate:async(current:typeof state,member:typeof m,report:Pick<import('./aggregate-delivery').AggregateReport,'definitions'|'teamIds'|'period'|'computedAt'>)=>{const period=periodWindow(report.period,new Date(report.computedAt)),window={since:new Date(report.period.start+'T00:00:00Z').toISOString(),until:period.until.toISOString()},completeness=await reportCompleteness(current,member,window,report.definitions,report.computedAt,report.teamIds);return completenessDisclosure(completeness,configuredLiveFreshness(current,member,{teamIds:report.teamIds},window,report.computedAt,completeness.body));},assertCurrent:async(current:typeof state,member:typeof m,reporting:import('./aggregate-delivery').AggregateReporting,definitions:string[],teamIds:string[])=>assertCompletenessCurrent(current,member,{body:{window:reporting.window,evaluatedAt:reporting.evaluatedAt},basis:reporting.evidenceBasis,digest:reporting.evidenceDigest},definitions,teamIds)};const result=await executeAggregate(db(),state,c,u,m,key,hash,undefined,reportingProvider);return {result,snapshot:await viewerSnapshot(request,u,state.organisation.id)};}
 if(c.type==='runEvaluationCase'){const result=await executeEvaluation(db(),state,c,u,m,key,hash,runtime());return {result,snapshot:await viewerSnapshot(request,u,state.organisation.id)};}
 if(c.type==='runAI'&&state.workspace.integrations.find(i=>i.id===c.providerId)?.mode==='http')fail(409,'Use the governed evidence assistant for external AI. Legacy free-text AI execution is unavailable.');
 if(c.type==='executeAgent'){const result=await executeAgent(db(),state,c,u,m,key,hash,runtime());if(request.headers.get('x-saha-response')==='result')return {result};return {result,snapshot:await viewerSnapshot(request,u,state.organisation.id)};}
 // Slice 6v: marking in-app alert notifications read writes only the viewer's own notification rows and a receipt.
 if(c.type==='alertInboxMarkRead'){const result=await markRead(state,u,m,c,key,hash);return {result,snapshot:await viewerSnapshot(request,u,state.organisation.id)};}
 if(c.type==='switchOrganisation'){result={organisationId:state.organisation.id};}
 else {
  if(c.type==='createPerson'&&(!m.teamIds.includes(c.teamId)||m.role==='admin'))fail(403,'Choose a care team you belong to.');
  const agent=await agentApply(state,c,u,m,providers(state.workspace.integrations,runtime()));
  const mis=['configureMis','activateMis','cancelSubmission',...MAPPING_COMMANDS].includes(c.type)?await configureMis(state,c as any,u,m,runtime()):null;
  const ehr=c.type.includes('Ehr')?await applyEhr(state,c as any,u,m,runtime()):null;
  const field=await applyField(state,c,u,m,undefined,environmentOf(rawRuntime()).name)??await applyFieldRegistration(state,c,u,m,undefined,environmentOf(rawRuntime()).name)??await applyReferralRequest(state,c,u,m);
  const pilot=await applyPilot(state,c,u,m);
  const outreach=await applyOutreach(state,c,u,m,undefined,environmentOf(rawRuntime()).name);
  const prioritisation=await applyPrioritisation(state,c,u,m);
  const expansion=await applyExpansion(state,c,u,m);
  // Slice 5b: an import reads the named provider sandbox; the importer's ownership of it is checked in applySandbox.
  const sandbox=await applySandbox(state,c,u,m,providers(state.workspace.integrations,runtime()),c.type==='importCapabilityProposal'?await sandboxSource(c.sandboxOrganisationId,state.organisation.id,u.userId):null);
  authorizeGovernance(state,m,c);authorizeDeploymentAuthorisation(state,m,c);await checkSourceCommand(db(),state,c,m);const governance=await applyGovernance(state,c,u,m);const deploymentAuthorisation=await applyDeploymentAuthorisation(state,c,u,m);
  // Slice 9a: owner-only demonstration clinical package (synthetic environment only). Fixture account rows are written
  // first because the fixture memberships reference them.
  const demonstration=await applyDemonstration(state,c,u,m,environmentOf(rawRuntime()).name,accountCode);if(demonstration)await writeFixtureAccounts(db(),state.members,new Date().toISOString());
  // Slice 5f: shadow operation of a reviewed capability revision (outputs stored for governance only).
  const shadow=applyShadow(state,c,u,m);
  const evaluation=await applyEvaluation(state,c,u,m,providers(state.workspace.integrations,runtime()));
  const continuity=applyContinuity(state,c,u,m);
  const household=applyHousehold(state,c,u,m)??applyHouseholdVisit(state,c,u,m)??await applyHouseholdWork(state,c,u,m);
  const caseload=applyCaseload(state,c,u,m);
  const merge=applyMerge(state,c,u,m);
  const exceptional=applyExceptional(state,c,u,m);
  const rights=applyRights(state,c,u,m);
  const consent=applyConsent(state,c,u,m);
  const delegation=applyDelegation(state,c,u,m);
  // Slice 6s: owner-maintained indicator definitions (append-only versions).
  const registry=applyIndicatorRegistry(state,c,u,m);
  const retention=applyRetention(state,c,u,m);
  const fixture=await applyFixtureMark(state,c,u,m);
  // Slice 4e: reviewed migration of open programme episodes to a newer pack version.
  const packMigration=await applyProgrammeMigration(state,c,u,m);
  // Slice 4f: governed installation of programme pack versions (stage, independent review, activation, retirement).
  const packInstall=await applyRangeProtocol(state,c,u,m,environmentOf(rawRuntime()).name)??await applyPackInstallation(state,c,u,m);
  const factReview=await applyFactReview(state,c,u,m);
  // Slice 2g: reviews of notes and programme answers, supervisor sign-off and the owner's sign-off policy.
  const signOff=await applySignOff(state,c,u,m);
  const patientImport=await applyPatientImport(state,c,u,m,rawRuntime());
  // Slice 2h: controlled import of programme enrolments and external identifiers for existing people.
  const recordImport=await applyRecordImport(state,c,u,m,rawRuntime());
  // Slice 10e: programme identity crosswalk (link, correct and withdraw identifiers with provenance); conflicts open an identity case.
  const crosswalk=await crosswalkWithReview(db(),state,c,u,m);
  const crosswalkCorrection=await applyCrosswalkCorrection(state,c,u,m);
  // Slice 10d: owner workforce roster import from a CSV file (invitations, memberships, external staff ids).
  const workforce=await applyWorkforceImport(state,c,u,m,rawRuntime());
  // Slice 2j: closing a correction task with evidence.
  const reconciliation=await applyReconciliation(state,c,u,m);
  const exceptionDiagnostics=c.type==='assignException'&&c.itemId.startsWith('device-diagnostic:')?await readDeviceDiagnosticRows(db(),state,m):[];
  const exceptionAssignment=applyExceptionAssignment(state,c,u,m,new Date().toISOString(),exceptionDiagnostics);
  const referral=exceptionAssignment??reconciliation??applyDueWork(state,c,u,m)??applyReferral(state,c,u,m)??applyActionPlan(state,c,u,m)??applyReassignment(state,c,u,m)??applyCorrectionTask(state,c,u,m)??applyProgrammeReferrals(state,c,u,m);
  const roster=await applyRoster(state,c,u,m);
  const abdm=await abdmWithStewardReview(state,c,u,m,key);
  const transfer=await applyTransfer(state,c,u,m);
  const ops=applyDueWorkPolicy(state,c,u,m)??applyOperations(state,c,u,m)??applyAlertAck(state,c,u,m)??applyInvoiceReconciliation(state,c,u,m)??applyNotificationChannel(state,c,u,m,environmentOf(rawRuntime()).name,fail,uuid)??applySpeechPolicy(state,c,u,m,environmentOf(rawRuntime()).name,fail,uuid); // slice 10b: owner-managed notification channel (demonstration simulator); slice 12a: voice input setting
 // Slice feat/r08 (BR-ID-02/BR-OPS-01): facility and geography/locality access policy (owner-managed, versioned, audited).
 const facilityScope=applyFacilityScope(state,c,u,m);
  // Slice 7e: owner-managed, versioned operation permissions for record adapters.
  const adapterOps=applyAdapterOperations(state,c,u,m,fail,uuid);
  const integrationReadiness=applyIntegrationReadiness(state,c,u,m,environmentOf(rawRuntime()).name,fail);
  // Slice r09: owner-managed, versioned programme/purpose dimensions in the access policy.
  const purposeScope=applyPurposeScope(state,c,u,m);
  const supportCase=applySupportCase(state,c,u,m);
  const deploymentConfiguration=await applyDeploymentConfiguration(state,c,u,m);
  // Slice 10c: synthetic worker incentive claims (schedule, prepare, verify, approve, correct); stored in the operations document.
  const incentives=await applyIncentives(state,c,u,m);
  const dataFlowAuthority=applyDataFlowAuthority(state,c,u,m,new Date().toISOString(),rawRuntime());
  const platform=dataFlowAuthority?{handled:true,result:dataFlowAuthority}:supportCase?{handled:true,result:supportCase}:deploymentConfiguration?{handled:true,result:deploymentConfiguration}:prioritisation?{handled:true,result:prioritisation}:incentives?{handled:true,result:incentives}:demonstration?{handled:true,result:demonstration}:integrationReadiness?{handled:true,result:integrationReadiness}:adapterOps?{handled:true,result:adapterOps}:facilityScope?{handled:true,result:facilityScope}:purposeScope?{handled:true,result:purposeScope}:shadow?{handled:true,result:shadow}:sandbox?{handled:true,result:sandbox}:transfer?{handled:true,result:transfer}:abdm?{handled:true,result:abdm}:roster?{handled:true,result:roster}:referral?{handled:true,result:referral}:retention?{handled:true,result:retention}:fixture?{handled:true,result:fixture}:packMigration?{handled:true,result:packMigration}:packInstall?{handled:true,result:packInstall}:factReview?{handled:true,result:factReview}:signOff?{handled:true,result:signOff}:patientImport?{handled:true,result:patientImport}:crosswalk?{handled:true,result:crosswalk}:crosswalkCorrection?{handled:true,result:crosswalkCorrection}:recordImport?{handled:true,result:recordImport}:workforce?{handled:true,result:workforce}:rights?{handled:true,result:rights}:consent?{handled:true,result:consent}:registry?{handled:true,result:registry}:delegation?{handled:true,result:delegation}:exceptional?{handled:true,result:exceptional}:merge?{handled:true,result:merge}:caseload?{handled:true,result:caseload}:household?{handled:true,result:household}:evaluation?{handled:true,result:evaluation}:deploymentAuthorisation?{handled:true,result:deploymentAuthorisation}:governance?{handled:true,result:governance}:continuity?{handled:true,result:continuity}:expansion?{handled:true,result:expansion}:outreach?{handled:true,result:outreach}:pilot?{handled:true,result:pilot}:ops?{handled:true,result:ops}:field?{handled:true,result:field}:ehr?{handled:true,result:ehr}:mis?{handled:true,result:mis}:agent?{handled:true,result:agent}:await platformApply(state,c,u,m);
  if(platform.handled)result=platform.result;
  else {const oldRole=state.workspace.role;
   if(c.type==='toggleIntegration'){const target=state.workspace.integrations.find(i=>i.id===c.integrationId);if(target?.mode==='http'&&!['mis','ehr'].includes(target.kind)&&target.status!=='active')requireApprovedDataFlow(state,c.integrationId);}
   if(['toggleIntegration','registerIntegration'].includes(c.type)&&m.isOwner)state.workspace.role='admin';
   result=await apply(state.workspace,c as Command,u.userId,{call:(i,p)=>{const sensitive=collectSensitive(state);return externalCall(i,p,key,()=>externalRequestAudit(state,u,m,c,i,sensitive),sensitive);},packs:installedPacks(state),rangeCapture:p=>rangeCaptureFor(state,p),rangeEnvironment:environmentOf(rawRuntime()).name});
   state.workspace.role=oldRole;const a=state.workspace.audit.at(-1);if(a&&!before.workspace.audit.some(x=>x.id===a.id)){a.actorId=u.userId;a.actor=u.displayName;a.role=m.role;}
   if(c.type==='createPerson'){const p=state.workspace.people.find(x=>x.id===result.personId)!;p.assignedTo=u.userId;markEnvironmentRecord(p,rawRuntime());if(registration)p.identityReview=registration;}
   if(c.type==='preparePlan'){const v=visit(state.workspace,c.visitId),plan=v.plan,environment=outboundEnvironment(rawRuntime());if(!plan||plan.id!==result.planId)fail(409,'Prepared programme plan is unavailable.');plan.payloads=Object.fromEntries(plan.recipients.filter(id=>state.workspace.integrations.find(i=>i.id===id)?.mode==='http').map(id=>{const integration=state.workspace.integrations.find(i=>i.id===id)!;return[id,mappedPayload(integration,v,state,environment)];}));plan.payloadHash=await digest({visitId:v.id,version:v.version,facts:v.facts,programmeCapture:v.programmeCapture,recipients:plan.recipients,payloads:plan.payloads});}
  }
 }
 // Slice 2e: measurements whose value or entry changed are credited to the authenticated actor.
 stampSubmissions(before,state,signedOff);
 pinMisMappingApprovals(before,state);
 // Slice 6y: execution steps this command adds carry its type, receipt key and audit event.
 linkTrace(before,state,c.type,key,u.userId);
 if(c.type!=='switchOrganisation')recordFactAuthors(before,state,u,m);
 // Slice 10g: a new correction draft carries the open disputes of the visit it corrects.
 if(c.type==='amendVisit')carryDisputes(before,state,u,m);
 // Slice 1e: record any delegated authority the command relied on.
 const authorityDelegations=state.delegationUsed?.length?delegationAudit(state,u,m,c.type,typeof (c as any).personId==='string'?(c as any).personId:null):[];
 if(c.type==='confirmVisit'||c.type==='voidVisit'||c.type==='amendVisit')await materialiseInstalledWork(state,u,c.visitId,undefined,200);
 await persist(db(),before,state,u,{...c,authorityDelegations},key,hash,result,[...(c.type==='prepareFieldVisit'?deviceGrantRows(result,state,u):await registrationGrantRows(c,result,state,u,key,hash,parsed.wireHash)),...installedWorkRows(state,before)],c.type==='switchOrganisation');
 // Slice 6v: an organisation-wide command evaluates alert delivery on the state it loaded (best effort, never fails the command).
 if(c.type!=='switchOrganisation')await evaluateAfterCommand(state);
 // Slice 0b: a partitioned command may answer with the partition snapshot for the client to merge.
 if(request.headers.get('x-saha-response')==='delta'&&state.partition){const partition=state.partition,fresh=await loadFor(u,state.organisation.id,async()=>partition);await recordPartitionResponse(db(),fresh,u,scope(fresh,u.userId));return {result,delta:await snapshotFor(fresh,u),partition};}
 return {result,snapshot:await viewerSnapshot(request,u,state.organisation.id)};
}
export async function command(request:Request){await identity();
 // Slice 0b-3 follow-up: a malformed paging header is refused before the command runs, never after it commits.
 pagingRequest(request);const parsed=await parseRequest(request);const finish=async(result:Awaited<ReturnType<typeof dispatchCommand>>)=>{await syncBurdenOutcome(request,parsed,result.replayed?'server-sync-replay':'server-sync-success');return result;};try{return await finish(await dispatchCommand(request,parsed));}catch(e){
 // Concurrent identical commands may race past the receipt read. Replay only a
 // committed receipt, after the normal current-membership checks run again.
 if(!(e instanceof AppError)||e.status===409){const u=await identity(),key=request.headers.get('idempotency-key');if(key){const saved=await db().prepare('SELECT key FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId,key).first();if(saved)return finish(await dispatchCommand(request,parsed));}}
 await syncBurdenOutcome(request,parsed,e instanceof AppError&&e.status===409?'server-sync-conflict':e instanceof AppError&&[403,404].includes(e.status)?'server-sync-refused':e instanceof AppError&&e.status===422?'server-sync-invalid':null);throw e;
}}
// Metadata is independent of the clinical command: unavailable counters cannot
// turn a saved visit into a failed command or authorise another clinical retry.
async function syncBurdenOutcome(request:Request,parsed:Awaited<ReturnType<typeof parseRequest>>,code:import('./work-burden-types').BurdenCode|null){
 if(parsed.c.type!=='syncFieldVisit'||!code)return;try{const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'),async()=>[]),m=scope(s,u.userId);if(!s.operations?.workBurden?.enabled||!['asha','clinician'].includes(m.role))return;const key='sync_'+await digest({key:parsed.key,code}),hash=await digest({format:'saha-burden-v1',organisationId:s.organisation.id,code});await persistBurdenCounter(db(),s,u,m,key,hash,code);}catch(error){writeFailureEvent('work-burden-counter-unavailable',error);}
}
// Slice 5b: the provider sandbox named by an import, read whole but never persisted or returned.
// Slice 6p (independent review): the importer's active owner membership of the named organisation and
// its sandbox declaration are checked before its state is read; not found, not a sandbox and not the
// importer's own all answer the same 404, so the route is not an existence or sandbox oracle.
async function sandboxSource(id:string,current:string,userId:string){if(id===current)fail(409,'Import proposals into a production organisation, not into a provider sandbox.');const gone=()=>fail(404,SANDBOX_UNAVAILABLE);
 const owner=await db().prepare('SELECT 1 AS ok FROM memberships WHERE org_id=? AND user_id=? AND status=? AND is_owner=1').bind(id,userId,'active').first();if(!owner)gone();
 const gov=await db().prepare('SELECT data FROM governance WHERE org_id=?').bind(id).first<{data:string}>();let declared=false;try{declared=!!(gov&&JSON.parse(gov.data)?.sandbox);}catch{declared=false;}if(!declared)gone();
 try{return await readState(db(),id);}catch{gone();}}
export async function patientHistory(request:Request){const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),id=new URL(request.url).searchParams.get('personId')??'';const p=person(s.workspace,id),cursor=parseCursor(new URL(request.url).searchParams.get('cursor'));const h=await history(db(),s.organisation.id,id,cursor);
 // Slice 6t: a revision history page is a material read, recorded before it is returned.
 const m=scope(s,u.userId);await recordAccess(db(),s,u,m,{action:'viewRecordHistory',subject:id,personId:id,detail:`Revision history read: ${h.revisions.length} revision${h.revisions.length===1?'':'s'}${cursor?' (older page)':''}.${accessRoute(m,p)}`});
 return {...h,revisions:h.revisions.map(redactRevision)};}
export async function organisationAudit(request:Request){const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'));return auditPage(db(),s.organisation.id,u.userId,parseCursor(new URL(request.url).searchParams.get('cursor')),new URL(request.url).searchParams.get('summaries')==='1');}
// Slice 6n: every provider path receives the environment-policy runtime; rawRuntime is for reporting only.
export const rawRuntime=()=>env as unknown as Record<string,string|undefined>;
export const runtime=()=>effectiveRuntime(rawRuntime());
export const externalEnabled=()=>runtime().SAHA_EXTERNAL_APIS_ENABLED==='true';
// Slice 6t: an external AI request is recorded in the audit chain after its checks and before it is sent;
// if the event cannot be written the request is not sent.
async function externalRequestAudit(s:OrgState,u:Actor,m:Member,c:{type:string},i:Integration,sensitive?:Set<string>){const visitId=(c as {visitId?:string}).visitId,personId=visitId?s.workspace.visits.find(v=>v.id===visitId)?.personId??null:null;await recordAccess(db(),s,u,m,{action:'externalRequest',subject:visitId??i.id,personId,detail:`${c.type}: request to ${i.name} (${new URL(i.endpoint!).origin}) about to be sent${visitId?` for visit ${visitId}`:''}. The outcome is recorded separately.`});await serviceDispatch(db(),s,u,m,i.id,personId,{intent:'send',purpose:COMMAND_PURPOSE[c.type],authorize:(latest,member)=>{if(sensitive)for(const value of collectSensitive(latest))sensitive.add(value);ensureOperating(latest,c);ensurePatientIdentity(latest,c);ensureNotMerged(latest,c);ensureNotImported(latest,c);ensureNotRestricted(latest,c);if(visitId){const old=s.workspace.visits.find(v=>v.id===visitId),v=latest.workspace.visits.find(v=>v.id===visitId),p=latest.workspace.people.find(p=>p.id===personId),prepared=s.workspace.people.find(p=>p.id===personId);if(!old||!v||!p||!prepared||v.version!==old.version||p.version!==prepared.version||p.consentVersion!==prepared.consentVersion)fail(409,'Clinical request changed before dispatch.');}}});}
 export async function externalCall(i:Integration,payload:unknown,key:string,beforeSend?:()=>Promise<void>,sensitive:Set<string>=new Set()){payload=minimiseLegacyAiPayload(payload,sensitive);const e=runtime(),environment=outboundEnvironment(rawRuntime());if(!externalEnabled())fail(409,'External AI calls are not enabled in this sandbox. Configure approved server credentials before connecting a live provider.');if(!i.endpoint||!i.credentialBinding)fail(409,'Provider endpoint and credential binding are required.');const u=new URL(i.endpoint);const allowed=(e.SAHA_ALLOWED_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean);if(u.protocol!=='https:'||!allowed.includes(u.origin)||u.username||u.password||u.search||u.hash)fail(403,'This provider origin is not on the server-approved allowlist.');const keyValue=e[i.credentialBinding];if(!keyValue)fail(409,'The provider credential is not configured on the server.');if(!payload||typeof payload!=='object'||Array.isArray(payload))fail(409,'Provider payload must be an environment-labelled object.');payload={...(payload as Record<string,unknown>),environment};if(beforeSend)await beforeSend();payload=minimiseLegacyAiPayload(payload,sensitive);let response:Response;try{response=await fetch(i.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${keyValue}`,'Idempotency-Key':key,'X-Saha-Environment':environment,'X-Saha-Trace-Id':key},body:JSON.stringify(payload),redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{fail(502,'Provider did not return a confirmed result. Do not assume a clinical finding.');}if(!response!.ok)fail(502,`Provider returned HTTP ${response!.status}. No result was accepted.`);const reader=response!.body?.getReader();if(!reader)fail(502,'Provider returned no response.');let size=0;const chunks:Uint8Array[]=[];while(true){const {value,done}=await reader!.read();if(done)break;size+=value.length;if(size>16000){await reader!.cancel();fail(502,'Provider response exceeds the permitted size.');}chunks.push(value);}try{const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(502,'Provider returned invalid JSON.');}}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function error(e:unknown){if(e instanceof AppError)return json({error:e.message},e.status);writeFailureEvent('workspace-operation-failed',e);return json({error:'The workspace is unavailable. Your input remains on screen; please try again.'},503);}
