import { z } from 'zod';
import { digest, fail } from './core';

const text=z.string().trim().min(3).max(300),reference=z.string().trim().min(3).max(200);
const safeSettingKey=z.string().regex(/^[a-z][a-z0-9_.-]{1,79}$/).refine(v=>!/(^|[_.-])(secret|password|token|credential|api[_-]?key|patient|person|phone|email|address|abha)([_.-]|$)/i.test(v),'Sensitive and patient fields are not deployment settings.');
const safeString=z.string().trim().min(1).max(200).refine(v=>!/(-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]+=*|\bsk-[A-Za-z0-9_-]{12,})/i.test(v),'Store only a secret binding name, never a secret value.');
const role=z.enum(['deployment-lead','operations','organisation-owner','supervisor','trainer','support','security','qa']);
export const deploymentManifestSchema=z.object({
 release:z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/),
 dataPolicy:z.literal('synthetic-only-no-record-copy'),
 settings:z.array(z.object({key:safeSettingKey,value:z.union([safeString,z.boolean(),z.number().finite()]),scope:z.enum(['shared','local']),approvalRef:reference}).strict()).min(1).max(80).refine(rows=>new Set(rows.map(x=>x.key)).size===rows.length,'Setting keys must be unique.'),
 secretBindings:z.array(z.object({purpose:text,binding:z.string().regex(/^SAHA_[A-Z0-9_]{1,60}$/)}).strict()).max(30).refine(rows=>new Set(rows.map(x=>x.binding)).size===rows.length,'Secret bindings must be unique.'),
 dependencies:z.array(z.object({name:text,version:reference,reference}).strict()).min(1).max(60),
 training:z.array(z.object({module:text,version:reference,reference,roles:z.array(role).min(1).max(8)}).strict()).min(1).max(60),
 tests:z.array(z.object({id:reference,version:reference,reference}).strict()).min(1).max(100),
 responsibilities:z.array(z.object({area:text,accountable:role,response:text}).strict()).min(1).max(60),
 localDifferences:z.array(z.object({area:text,difference:text,approvalRef:reference}).strict()).min(1).max(60),
}).strict();
export type DeploymentManifest=z.infer<typeof deploymentManifestSchema>;
export const deploymentPackSchema=z.object({format:z.literal('saha-deployment-pack'),schema:z.literal(1),spec:z.unknown(),deployment:deploymentManifestSchema,source:z.object({proposalVersion:z.number().int().positive(),reviewHash:z.string().length(64),reviewedAt:z.string().datetime()}).strict()}).strict();

export function deploymentManifest(input:unknown):DeploymentManifest{
 const parsed=deploymentManifestSchema.safeParse(input);if(!parsed.success)fail(422,'Deployment package is invalid. Use reviewed settings, named secret bindings, dependencies, training, tests, responsibilities and explicit local differences.');return parsed.data;
}
export async function buildDeploymentPack(spec:unknown,deployment:DeploymentManifest,proposalVersion:number,review:{hash:string;at:string}){
 const pack={format:'saha-deployment-pack' as const,schema:1 as const,spec,deployment,source:{proposalVersion,reviewHash:review.hash,reviewedAt:review.at}};
 return {...pack,contentSha256:await digest(pack)};
}
export function parseDeploymentPack(input:unknown){
 const parsed=z.object({...deploymentPackSchema.shape,contentSha256:z.string().length(64)}).strict().safeParse(input);if(!parsed.success)fail(422,'Deployment pack is not a supported configuration-only package.');const {contentSha256,...body}=parsed.data;return digest(body).then(hash=>{if(hash!==contentSha256)fail(409,'Deployment pack content differs from its recorded digest.');return parsed.data;});
}
