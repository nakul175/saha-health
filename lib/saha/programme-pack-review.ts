import {z} from 'zod';
import {digest} from './core';
import {packManifestSchema, manifestIssues, installationsOf, MAX_INSTALLATIONS, MAX_MANIFEST_CHARS, NOT_CLINICALLY_APPROVED} from './pack-installation';
import type {OrgState} from './types';

const opaque=z.string().min(1);
const reference=z.string().min(1).max(100);
const version=z.number().int().min(1).max(999);
const hash=z.string().regex(/^[0-9a-f]{64}$/);
const state=z.enum(['staged','approved','rejected','active','retired']);
const summary=z.object({id:reference,packId:z.string(),version,name:z.string(),state,manifestHash:hash}).strict();
const history=z.object({state,at:z.string().datetime(),by:opaque,reason:z.string()}).strict();
const review=z.object({by:opaque,memberVersion:z.number().int().positive(),at:z.string().datetime(),decision:z.enum(['approve','reject']),reason:z.string(),approval:z.literal('clinical').optional()}).strict();
const businessApproval=z.object({by:opaque,memberVersion:z.number().int().positive(),at:z.string().datetime(),reason:z.string()}).strict();
export const packReviewResponse=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('setup'),actorId:opaque,organisations:z.array(z.object({id:reference,name:z.string().min(1)}).strict())}).strict(),
 z.object({kind:z.literal('configuration'),actorId:opaque,organisation:z.object({id:reference,name:z.string().min(1)}).strict(),configVersion:z.number().int().nonnegative(),notice:z.literal(NOT_CLINICALLY_APPROVED),asOf:z.string().datetime(),installations:z.array(summary).max(MAX_INSTALLATIONS),selected:z.object({id:reference,packId:z.string(),version,state,manifestHash:hash,manifest:packManifestSchema,manifestJson:z.string().max(MAX_MANIFEST_CHARS),stagedBy:opaque,stagedAt:z.string().datetime(),reason:z.string(),review:review.nullable(),businessApproval:businessApproval.nullable(),activatedAt:z.string().datetime().nullable(),retiredAt:z.string().datetime().nullable(),history:z.array(history)}).strict().nullable()}).strict(),
] ).superRefine((v,c)=>{
 if(v.kind==='setup'){if(new Set(v.organisations.map(x=>x.id)).size!==v.organisations.length)c.addIssue({code:'custom',message:'Ambiguous organisation references.'});return;}
 if(new Set(v.installations.map(x=>x.id)).size!==v.installations.length)c.addIssue({code:'custom',message:'Ambiguous installation references.'});
 if(v.selected&&!v.installations.some(x=>x.id===v.selected!.id&&x.version===v.selected!.version&&x.manifestHash===v.selected!.manifestHash&&x.packId===v.selected!.packId&&x.state===v.selected!.state))c.addIssue({code:'custom',message:'Selected source binding unavailable.'});
});
export type PackReviewResponse=z.infer<typeof packReviewResponse>;
export type PackSelection={id:string;version:number;manifestHash:string};
export type PackConfiguration=Extract<PackReviewResponse,{kind:'configuration'}>;

export function installationLabel(value:Pick<PackConfiguration['installations'][number],'state'>){
 return {staged:'Staged; structural review pending',approved:'Structural approval recorded; activation separate',rejected:'Rejected configuration',active:'Active synthetic configuration; clinical approval not established',retired:'Retired configuration; history retained'}[value.state];
}

export async function programmePackProjection(s:OrgState,actorId:string,selection?:PackSelection,now=new Date().toISOString()):Promise<PackConfiguration>{
 const raw=s.operations?.installedPacks;
 if(raw!==undefined&&!Array.isArray(raw))throw Error('Stored installation context unavailable.');
 const records=installationsOf(s);
 if(records.length>MAX_INSTALLATIONS||new Set(records.map(x=>x.id)).size!==records.length)throw Error('Stored installation references unavailable.');
 for(const x of records){
  if(!packManifestSchema.safeParse(x.manifest).success||manifestIssues(x.manifest).length||JSON.stringify(x.manifest).length>MAX_MANIFEST_CHARS||x.packId!==x.manifest.id||x.version!==x.manifest.version||x.pack.id!==x.packId||x.pack.version!==x.version||await digest({format:x.manifest.format,manifest:x.manifest})!==x.manifestHash)throw Error('Stored manifest binding unavailable.');
  if(!x.history.length||x.history.at(-1)?.state!==x.state||(['approved','active'].includes(x.state)&&x.review?.decision!=='approve'))throw Error('Stored structural history unavailable.');
 }
 const chosen=selection?records.find(x=>x.id===selection.id&&x.version===selection.version&&x.manifestHash===selection.manifestHash):null;
 if(selection&&!chosen)throw Error('The selected configuration changed. Refresh and choose again.');
 const packet={kind:'configuration' as const,actorId,organisation:{id:s.organisation.id,name:s.organisation.name},configVersion:s.operations?.version??0,notice:NOT_CLINICALLY_APPROVED,asOf:now,installations:[...records].reverse().map(x=>({id:x.id,packId:x.packId,version:x.version,name:x.manifest.name,state:x.state,manifestHash:x.manifestHash})),selected:chosen?{id:chosen.id,packId:chosen.packId,version:chosen.version,state:chosen.state,manifestHash:chosen.manifestHash,manifest:chosen.manifest,manifestJson:JSON.stringify(chosen.manifest),stagedBy:chosen.stagedBy,stagedAt:chosen.stagedAt,reason:chosen.reason,review:chosen.review??null,businessApproval:chosen.businessApproval??null,activatedAt:chosen.activatedAt??null,retiredAt:chosen.retiredAt??null,history:chosen.history}:null};
 const parsed=packReviewResponse.parse(packet);
 if(parsed.kind!=='configuration'||(parsed.selected&&!parsed.installations.some(x=>x.id===parsed.selected!.id&&x.version===parsed.selected!.version&&x.manifestHash===parsed.selected!.manifestHash)))throw Error('Configuration reference unavailable.');
 return parsed;
}
