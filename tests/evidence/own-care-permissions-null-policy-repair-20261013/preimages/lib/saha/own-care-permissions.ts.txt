import {z} from 'zod';
import {fail} from './core';
import {assignedFacilities,assignedLocalities,defaultAccessScope,type AccessScope} from './facility-scope';
import {ACCESS_PURPOSES,PROGRAMME_NAMES} from './purpose-scope';
import type {Member,OrgState} from './types';
const text=z.string().min(1),version=z.number().int().positive().safe(),location=z.object({facilityId:text.optional(),localityId:text.optional()}).strict();
const scopeSchema=z.object({version:z.number().int().nonnegative().safe(),enforceFacility:z.boolean(),enforceLocality:z.boolean(),facilities:z.array(z.object({id:text,name:text,localityId:text.nullable()}).passthrough()),localities:z.array(z.object({id:text,name:text}).passthrough()),teamAssignments:z.record(location),memberAssignments:z.record(location)}).passthrough();
const grantSchema=z.object({memberId:text,programme:z.enum(PROGRAMME_NAMES).nullable(),purposes:z.array(z.enum(ACCESS_PURPOSES)).refine(x=>new Set(x).size===x.length),version,revokedAt:z.string().datetime().optional()}).passthrough();
const reference=z.object({id:text,name:text.nullable()}).strict();
export const ownCarePermissionsSchema=z.object({organisationId:text,actorId:text,membershipVersion:version,role:z.literal('asha'),teams:z.array(z.object({id:text,name:text}).strict()),assignmentMode:z.literal('direct-assignment-and-team'),programmeRestriction:z.enum(PROGRAMME_NAMES).nullable(),purposeRestriction:z.array(z.enum(ACCESS_PURPOSES)).nullable(),facility:z.object({enforced:z.boolean(),references:z.array(reference)}).strict(),locality:z.object({enforced:z.boolean(),references:z.array(reference)}).strict(),scopeVersion:z.number().int().nonnegative().safe(),asOf:z.string().datetime(),refreshAt:z.string().datetime().nullable()}).strict();
export type OwnCarePermissions=z.infer<typeof ownCarePermissionsSchema>;
export function ownCarePermissionsProjection(s:OrgState,m:Member,actor:string,refreshAt:string|null,now=new Date().toISOString()):OwnCarePermissions{
 if(m.userId!==actor||m.role!=='asha'||m.status!=='active')fail(403,'An active ASHA can review only their own recorded care restrictions.');
 if(!version.safeParse(m.version).success||!Array.isArray(m.teamIds)||m.teamIds.some(x=>!text.safeParse(x).success)||new Set(m.teamIds).size!==m.teamIds.length)fail(503,'Current membership context is unavailable.');
 if(s.operations!==undefined&&(!s.operations||typeof s.operations!=='object'||Array.isArray(s.operations)))fail(503,'Current recorded care policy is unavailable.');
 const parsed=scopeSchema.safeParse(s.operations?.accessScope??defaultAccessScope()),grants=z.array(grantSchema).safeParse(s.operations?.purposeGrants??[]);if(!parsed.success||!grants.success)fail(503,'Current recorded care policy is unavailable.');
 const sc=parsed.data as AccessScope;if(new Set(sc.facilities.map(x=>x.id)).size!==sc.facilities.length||new Set(sc.localities.map(x=>x.id)).size!==sc.localities.length)fail(503,'Current location references are ambiguous.');
 const active=grants.data.filter(g=>g.memberId===actor&&!g.revokedAt);if(active.length>1)fail(503,'Current purpose restriction is ambiguous.');const g=active[0];
 const teams=m.teamIds.map(id=>{const found=s.teams.filter(t=>t.id===id);if(found.length!==1||!text.safeParse(found[0].name).success)fail(503,'Current team reference is unavailable.');return{id,name:found[0].name};});
 return ownCarePermissionsSchema.parse({organisationId:s.organisation.id,actorId:actor,membershipVersion:m.version,role:'asha',teams,assignmentMode:'direct-assignment-and-team',programmeRestriction:g?.programme??null,purposeRestriction:g?.purposes.length?g.purposes:null,facility:{enforced:sc.enforceFacility,references:[...assignedFacilities(m,sc)].sort().map(id=>({id,name:sc.facilities.find(f=>f.id===id)?.name??null}))},locality:{enforced:sc.enforceLocality,references:[...assignedLocalities(m,sc)].sort().map(id=>({id,name:sc.localities.find(l=>l.id===id)?.name??null}))},scopeVersion:sc.version,asOf:now,refreshAt});
}
