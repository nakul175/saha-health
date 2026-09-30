import { z } from 'zod';
import { digest, fail, uuid } from './core';
import { applyGovernance, governanceSpec, governanceState } from './governance';
import type { OrgState, Member } from './types';
import type { Actor } from './store';
import type { AgentProvider } from './agent';
// Slice 5b (BR-AI-11): provider self-service in a controlled environment. A provider sandbox is an
// organisation declared, while it holds no patient records, to serve exactly one AI provider. Provider
// accounts exist only there. They may keep the provider's documentation and a test-credential reference,
// propose capability versions and run the fixed synthetic evaluation corpus. Nothing in a sandbox is
// activated; an owner of both organisations imports a proposal into a production organisation as a draft,
// which then follows the standard evaluation, independent review and owner activation path.
export type ProviderDocumentation={version:number;summary:string;intendedUse:string;limitations:string;knownFailureModes:string;supportContact:string;testEndpoint?:string;credentialReference?:string;updatedAt:string;updatedBy:string;hash:string};
export type ProviderSandbox={providerId:string;providerName:string;declaredAt:string;declaredBy:string;reason:string;documentation?:ProviderDocumentation};
export type ProposalOrigin={sandboxOrganisationId:string;sandboxName:string;sandboxEntryId:string;sandboxRevision:number;sandboxManifestHash:string;evaluation:{id:string;corpusVersion:string;cases:number;precision:number|null;recall:number|null};documentation:{version:number;hash:string;summary:string;intendedUse:string;limitations:string;knownFailureModes:string;supportContact:string};importedBy:string;importedAt:string};
// Commands a provider account may use, and the only commands a sandbox accepts from anyone.
export const PROVIDER_COMMANDS=['createGovernance','prepareEvaluation','runEvaluationCase','cancelEvaluation','saveProviderDocs','switchOrganisation'];
export const SANDBOX_COMMANDS=[...PROVIDER_COMMANDS,'inviteProvider','createInvite','revokeInvite','updateMember','createTeam','renameOrganisation','transitionGovernance'];
const id=z.string().trim().min(1).max(200),text=z.string().trim().min(10).max(1000),version=z.number().int().min(0);
const teamIds=z.array(id).min(1).max(20).refine(x=>new Set(x).size===x.length,'Choose each team once.');
// A reference names a server-side binding (for example an environment variable). It is never a secret value.
export const credentialReference=z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,63}$/,'Enter the name of a server-side credential binding, not the credential itself.').refine(x=>!/^(SK|PK|API|KEY|TOKEN|SECRET|BEARER)_?[A-Z0-9]{16,}$/.test(x),'Enter the name of a server-side credential binding, not the credential itself.');
const endpoint=z.string().url().max(500).refine(s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash}catch{return false}},'Use an https address without credentials, query or fragment.');
export const sandboxSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('declareProviderSandbox'),providerId:id,reason:text}).strict(),
 z.object({type:z.literal('inviteProvider'),accountCode:z.string().trim().regex(/^[A-F0-9]{24}$/,'Use the 24-character account code.'),label:id,teamIds}).strict(),
 z.object({type:z.literal('saveProviderDocs'),version,summary:text,intendedUse:text,limitations:text,knownFailureModes:text,supportContact:id,testEndpoint:endpoint.optional(),credentialReference:credentialReference.optional()}).strict(),
 z.object({type:z.literal('importCapabilityProposal'),sandboxOrganisationId:id,entryId:id,entryVersion:z.number().int().positive(),ownerId:id,teamIds,changeSummary:text,replacesId:id.optional()}).strict()
]);
export type SandboxCommand=z.infer<typeof sandboxSchema>;
export const sandboxOf=(s:OrgState)=>governanceState(s).sandbox;
export const isProvider=(m:Member)=>m.role==='provider';
// Server-side gate run before any command handler, and again for replayed commands.
export function authorizeSandbox(s:OrgState,m:Member,c:any){
 const sb=sandboxOf(s);
 if(isProvider(m)){if(!sb)fail(403,'Provider accounts work only in a provider sandbox.');if(!PROVIDER_COMMANDS.includes(c.type))fail(403,'Provider accounts can only maintain their own documentation, proposed capability versions and synthetic evaluations.');}
 // A second declaration reaches its handler (409 there), so a replayed declaration still returns its receipt.
 if(sb&&!SANDBOX_COMMANDS.includes(c.type)&&c.type!=='declareProviderSandbox')fail(409,'This is a provider sandbox. It holds no patient records and cannot run care workflows, deliveries or activations; import a proposal into a production organisation instead.');
 if(c.type==='createGovernance'&&sb&&(c.spec?.kind!=='capability'||c.spec?.providerId!==sb.providerId))fail(403,`This sandbox accepts capability proposals for ${sb.providerName} only.`);
 if(c.type==='transitionGovernance'&&sb&&c.state!=='retired')fail(409,'A provider sandbox cannot activate or suspend a capability. Withdraw the proposal, or import it into a production organisation for review.');
 if(c.type==='updateMember'){const target=s.members.find(x=>x.userId===c.userId);if(target&&(target.role==='provider')!==(c.role==='provider'))fail(409,'Provider accounts keep the provider role. Suspend the membership instead of changing its role.');if(c.role==='provider'&&!sb)fail(409,'Provider accounts exist only in a provider sandbox.');}
 if(c.type==='declareProviderSandbox'&&!m.isOwner)fail(403,'An organisation owner must declare a provider sandbox.');
 if(c.type==='inviteProvider'){if(!m.isOwner)fail(403,'An organisation owner must invite provider accounts.');if(!sb)fail(409,'Provider accounts can only be invited to a provider sandbox.');}
 if(c.type==='saveProviderDocs'){if(!sb)fail(409,'Provider documentation is kept in a provider sandbox.');if(!isProvider(m)&&!m.isOwner)fail(403,'The provider or a sandbox owner must maintain this documentation.');}
 if(c.type==='importCapabilityProposal'){if(sb)fail(409,'Import proposals into a production organisation, not into a provider sandbox.');if(!m.isOwner)fail(403,'An organisation owner must import a provider proposal.');}
}
const audit=(s:OrgState,u:Actor,m:Member,action:string,subject:string,detail:string,now:string)=>s.workspace.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action,subject,detail});
// The latest completed evaluation of this exact manifest, in the sandbox.
export function sandboxEvaluation(source:OrgState,entryId:string,manifestHash:string){return governanceState(source).evaluations.filter(e=>e.entryId===entryId&&e.manifestHash===manifestHash&&e.state==='completed').sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];}
export async function applySandbox(s:OrgState,input:unknown,u:Actor,m:Member,providers:AgentProvider[],source?:OrgState|null,now=new Date().toISOString()):Promise<any|null>{
 const parsed=sandboxSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeSandbox(s,m,c);s.governance??={entries:[],evaluations:[],safety:[]};const g=s.governance;
 if(c.type==='declareProviderSandbox'){
  if(g.sandbox)fail(409,'This organisation is already a provider sandbox.');
  if(s.workspace.people.length||(s.households??[]).length||s.workspace.visits.length)fail(409,'Only an organisation with no patient records can become a provider sandbox.');
  if(g.entries.some(e=>e.state==='active'||e.state==='reviewed'))fail(409,'Retire reviewed or active packages before declaring a provider sandbox.');
  if(s.members.some(x=>x.status==='active'&&x.userId!==u.userId&&!x.isOwner))fail(409,'Declare the sandbox before inviting other members.');
  const p=providers.find(p=>p.id===c.providerId);if(!p)fail(404,'Choose a registered AI provider.');
  g.sandbox={providerId:p.id,providerName:p.name,declaredAt:now,declaredBy:u.userId,reason:c.reason};audit(s,u,m,c.type,s.organisation.id,`Organisation declared a provider sandbox for ${p.name}. Patient records, care workflows, deliveries and activation are unavailable here. Reason: ${c.reason}`,now);return {providerId:p.id};
 }
 if(c.type==='inviteProvider'){
  const sb=g.sandbox!;if(c.teamIds.some(t=>!s.teams.some(x=>x.id===t)))fail(422,'Choose a team in this organisation.');
  if(s.members.some(x=>x.accountCode===c.accountCode&&x.status==='active'))fail(409,'This account is already an active member.');if(s.invitations.some(i=>i.accountCode===c.accountCode&&i.status==='pending'&&i.expiresAt>now))fail(409,'A current invitation already exists. Revoke it before issuing another.');
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  const i={id:uuid(),accountCode:c.accountCode,label:c.label,role:'provider' as const,teamIds:c.teamIds,status:'pending' as const,expiresAt:new Date(Date.parse(now)+72*3600000).toISOString(),createdBy:u.userId,createdAt:now,tokenHash:await digest(token)};s.invitations.push(i);
  audit(s,u,m,c.type,i.id,`Provider account invited for ${sb.providerName}: ${c.label}; sandbox access only; expires in 72 hours.`,now);return {invitationId:i.id,token,expiresAt:i.expiresAt};
 }
 if(c.type==='saveProviderDocs'){
  const sb=g.sandbox!,prior=sb.documentation;if((prior?.version??0)!==c.version)fail(409,'Provider documentation changed. Refresh before saving.');
  const {type,version,...fields}=c;const hash=await digest(fields);if(prior&&prior.hash===hash)fail(422,'No documentation change to save.');
  sb.documentation={...fields,version:(prior?.version??0)+1,updatedAt:now,updatedBy:u.userId,hash};
  audit(s,u,m,c.type,s.organisation.id,`Provider documentation version ${sb.documentation.version} saved for ${sb.providerName}.${c.credentialReference?' A test credential reference is recorded; no credential value is stored.':''}`,now);return {version:sb.documentation.version};
 }
 // importCapabilityProposal: the sandbox state is read by the server before this handler runs.
 if(!source)fail(404,'Provider sandbox not found or unavailable.');
 const sb=sandboxOf(source);if(!sb)fail(409,'Choose a provider sandbox.');
 const owner=source.members.find(x=>x.userId===u.userId&&x.status==='active');if(!owner?.isOwner)fail(403,'You must be an owner of the provider sandbox to import its proposals.');
 const sg=governanceState(source),e=sg.entries.find(x=>x.id===c.entryId);if(!e)fail(404,'Proposal not found in that sandbox.');if(e.version!==c.entryVersion)fail(409,'The proposal changed. Refresh before importing.');
 if(e.spec.kind!=='capability'||e.spec.providerId!==sb.providerId||e.state!=='draft')fail(409,'Only a current draft capability proposal can be imported.');if(sg.entries.some(x=>x.replacesId===e.id))fail(409,'A later proposal revision exists in the sandbox.');
 if(!sb.documentation)fail(409,'The provider must record its documentation in the sandbox before a proposal is imported.');
 const ev=sandboxEvaluation(source,e.id,e.manifestHash);if(!ev?.metrics?.passed)fail(409,'Run a passing synthetic evaluation of this exact proposal in the sandbox before importing it.');
 if(g.entries.some(x=>x.origin?.sandboxEntryId===e.id&&x.origin.sandboxManifestHash===e.manifestHash))fail(409,'This proposal version was already imported.');
 const spec=governanceSpec.parse({...e.spec,ownerId:c.ownerId,teamIds:c.teamIds,changeSummary:c.changeSummary});
 const created=await applyGovernance(s,{type:'createGovernance',spec,...(c.replacesId?{replacesId:c.replacesId}:{})},u,m,now);const entry=g.entries.find(x=>x.id===created.entryId)!;
 const d=sb.documentation;entry.origin={sandboxOrganisationId:source.organisation.id,sandboxName:source.organisation.name,sandboxEntryId:e.id,sandboxRevision:e.revision,sandboxManifestHash:e.manifestHash,evaluation:{id:ev.id,corpusVersion:ev.corpusVersion,cases:ev.caseIds.length,precision:ev.metrics.precision,recall:ev.metrics.recall},documentation:{version:d.version,hash:d.hash,summary:d.summary,intendedUse:d.intendedUse,limitations:d.limitations,knownFailureModes:d.knownFailureModes,supportContact:d.supportContact},importedBy:u.userId,importedAt:now};
 audit(s,u,m,c.type,entry.id,`Provider proposal imported as a draft from sandbox ${source.organisation.name} (revision ${e.revision}). It needs this organisation's own synthetic evaluation, independent clinical review and owner activation; the sandbox evaluation does not count.`,now);
 return {entryId:entry.id};
}
