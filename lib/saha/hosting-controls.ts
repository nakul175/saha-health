import {z} from 'zod';
import {fail,uuid} from './core';
import type {Actor} from './store';
import type {Member,OrgState} from './types';

export const HOSTING_AREAS=['primary-storage','provider','backup','analytics','support'] as const;
export type HostingArea=typeof HOSTING_AREAS[number];
export const TRANSFER_DIRECTIONS=['at-rest','outbound','inbound','interactive-access'] as const;
export type TransferDirection=typeof TRANSFER_DIRECTIONS[number];
export type HostingRoute={id:string;area:HostingArea;targetId:string;purpose:string;direction:TransferDirection;location:string;authorityReference:string;enabled:boolean};
export type HostingControls={version:number;state:'draft'|'active';approvedLocations:string[];routes:HostingRoute[];reason:string;setBy:string;setAt:string;history:{version:number;state:'draft'|'active';approvedLocations:string[];routes:HostingRoute[];reason:string;setBy:string;setAt:string}[]};

const token=z.string().trim().min(2).max(120),reference=z.string().trim().min(5).max(200);
const route=z.object({id:z.string().regex(/^[a-z][a-z0-9-]{2,60}$/),area:z.enum(HOSTING_AREAS),targetId:token,purpose:token,direction:z.enum(TRANSFER_DIRECTIONS),location:token,authorityReference:reference,enabled:z.boolean()}).strict();
export const hostingControlsSchema=z.discriminatedUnion('type',[z.object({type:z.literal('setHostingControls'),version:z.number().int().min(0),state:z.enum(['draft','active']),approvedLocations:z.array(token).min(1).max(20),routes:z.array(route).min(1).max(80),reason:z.string().trim().min(10).max(500)}).strict()]);
export type HostingControlsCommand=z.infer<typeof hostingControlsSchema>;

export const controlsOf=(s:Pick<OrgState,'operations'>):HostingControls|undefined=>(s.operations as (typeof s.operations&{hostingControls?:HostingControls})|undefined)?.hostingControls;
const canonical=(values:string[])=>[...new Set(values.map(x=>x.trim()))].sort();
const canonicalRoutes=(routes:HostingRoute[])=>[...routes].map(x=>({...x,id:x.id.trim(),targetId:x.targetId.trim(),purpose:x.purpose.trim(),location:x.location.trim(),authorityReference:x.authorityReference.trim()})).sort((a,b)=>a.id.localeCompare(b.id));

export function validateActiveControls(c:Pick<HostingControls,'approvedLocations'|'routes'>){
 const approved=new Set(c.approvedLocations),enabled=c.routes.filter(x=>x.enabled);
 for(const area of HOSTING_AREAS)if(!enabled.some(x=>x.area===area))fail(422,`Active hosting controls require an enabled ${area} route.`);
 for(const r of enabled)if(!approved.has(r.location))fail(422,`Route ${r.id} uses a location outside the approved deployment locations.`);
}

export function authorizeHostingControls(m:Member,c:{type:string}){if(c.type==='setHostingControls'&&!m.isOwner)fail(403,'Only an organisation owner can change hosting and cross-border controls.');}
export function applyHostingControls(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()){
 if((input as {type?:unknown})?.type!=='setHostingControls')return null;authorizeHostingControls(m,input as {type:string});
 const parsed=hostingControlsSchema.safeParse(input);if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid hosting controls.');const c=parsed.data;
 const ops=s.operations??={version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null};const current=controlsOf(s);if((current?.version??0)!==c.version)fail(409,'Hosting controls changed. Refresh and review the current policy.');
 const locations=canonical(c.approvedLocations);if(locations.length!==c.approvedLocations.length)fail(422,'List each approved location once.');const routes=canonicalRoutes(c.routes);if(new Set(routes.map(x=>x.id)).size!==routes.length)fail(422,'List each route id once.');const identities=new Set<string>();for(const r of routes){const identity=`${r.area}|${r.targetId}|${r.purpose}|${r.direction}`;if(identities.has(identity))fail(422,'List each area, target, purpose and direction route once.');identities.add(identity);}if(c.state==='active')validateActiveControls({approvedLocations:locations,routes});
 const nextVersion=(current?.version??0)+1,history=current?[...current.history,{version:current.version,state:current.state,approvedLocations:current.approvedLocations,routes:current.routes,reason:current.reason,setBy:current.setBy,setAt:current.setAt}]:[];
 (ops as typeof ops&{hostingControls:HostingControls}).hostingControls={version:nextVersion,state:c.state,approvedLocations:locations,routes,reason:c.reason,setBy:u.userId,setAt:now,history:history.slice(-20)};ops.version++;ops.updatedAt=now;
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'setHostingControls',subject:s.organisation.id,detail:`Hosting and cross-border controls version ${nextVersion} saved as ${c.state}: ${locations.length} approved location(s), ${routes.filter(x=>x.enabled).length} enabled processing route(s). No provider or jurisdiction was inferred. Reason: ${c.reason}`});
 return {version:nextVersion,state:c.state,approvedLocations:locations.length,routes:routes.length};
}

export function assertHostingRoute(prepared:OrgState,current:OrgState,input:{area:HostingArea;targetId:string;purpose:string;direction:TransferDirection}){
 const expected=controlsOf(prepared),policy=controlsOf(current);
 // Existing deployments remain explicitly unconfigured until their security owner supplies a policy. Once a policy is
 // started, even as a draft, it is fail closed and can never be bypassed by omitting a route at dispatch time.
 if(!expected&&!policy)return;
 if(!expected||!policy||expected.version!==policy.version)fail(403,'Hosting controls changed before transfer. Nothing was sent.');
 if(policy.state!=='active')fail(403,'Hosting controls are not active. Nothing was sent.');
 const r=policy.routes.find(x=>x.enabled&&x.area===input.area&&x.targetId===input.targetId&&x.purpose===input.purpose&&x.direction===input.direction);
 if(!r)fail(403,'This processing route, purpose and direction are not approved. Nothing was sent.');
 if(!policy.approvedLocations.includes(r.location))fail(403,'This processing route is outside the approved deployment locations. Nothing was sent.');
 return {policyVersion:policy.version,routeId:r.id,location:r.location,authorityReference:r.authorityReference};
}

export function hostingControlsView(s:OrgState){const policy=controlsOf(s);return {configured:!!policy,enforced:policy?.state==='active',policy:policy??null,requiredAreas:HOSTING_AREAS,notice:policy?'Only exact enabled routes in approved locations are permitted once this policy exists. Draft and changed policies refuse transfer.':'No deployment-specific policy is configured. The security owner must record approved locations and routes before claiming location compliance.'};}
