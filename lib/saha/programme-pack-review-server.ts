import {identity,db,json,runtime} from './server';
import {readState,scope} from './store';
import {fail} from './core';
import {environmentOf} from './environment';
import {mayReadInstallations} from './pack-installation';
import {recordAccess} from './access-audit';
import {programmePackProjection,packReviewResponse,type PackSelection} from './programme-pack-review';

function response(value:unknown,actor:string,org?:string){const r=json(value);r.headers.set('x-saha-operation-actor',actor);if(org)r.headers.set('x-saha-organisation',org);return r;}
export async function programmePackReviewRead(request:Request){
 const actor=await identity(),database=db();
 if(!['synthetic','training'].includes(environmentOf(runtime()).name))fail(409,'Programme configuration review requires a synthetic or training workspace.');
 const expectedActor=request.headers.get('x-saha-operation-actor');if(expectedActor&&expectedActor!==actor.userId)fail(403,'The original signed-in account is required.');
 const q=new URL(request.url).searchParams,org=request.headers.get('x-saha-organisation');
 if([...q.keys()].some(k=>!['installationId','version','manifestHash'].includes(k))||[...q.keys()].some(k=>q.getAll(k).length!==1)||![0,3].includes([...q.keys()].length))fail(400,'Choose one exact stored installation/version/manifest.');
 if(!org){
  if(q.size)fail(400,'Choose an explicit organisation before a configuration.');
  const rows=await database.prepare("SELECT o.id,o.name FROM memberships m JOIN accounts a ON a.user_id=m.user_id JOIN organisations o ON o.id=m.org_id WHERE m.user_id=? AND m.status='active' AND (m.is_owner=1 OR m.role='clinician') ORDER BY o.name,o.id").bind(actor.userId).all<{id:string;name:string}>();
  if(!rows.results.length)fail(403,'Current owner or clinician configuration access is required.');
  return response(packReviewResponse.parse({kind:'setup',actorId:actor.userId,organisations:rows.results}),actor.userId);
 }
 if(!org.trim()||expectedActor!==actor.userId)fail(403,'Use the original organisation and account from configuration setup.');
 const rawVersion=q.get('version'),selected:PackSelection|undefined=q.size?{id:q.get('installationId')!,version:Number(rawVersion),manifestHash:q.get('manifestHash')!}:undefined;
 if(selected&&(!selected.id||selected.id.length>100||!rawVersion||!/^[1-9]\d*$/.test(rawVersion)||!Number.isSafeInteger(selected.version)||selected.version>999||!/^[0-9a-f]{64}$/.test(selected.manifestHash)))fail(400,'Choose an exact stored configuration reference.');
 const now=new Date().toISOString();
 const current=async()=>{
  // Explicit empty WINDOW: no patient rows and no due-schedule/legacy bootstrap writes.
  const s=await readState(database,org,[],actor.userId,true),m=scope(s,actor.userId);
  if(!mayReadInstallations(m))fail(403,'Current owner or clinician configuration access is required.');
  let value;try{value=await programmePackProjection(s,actor.userId,selected,now);}catch{fail(409,'Stored configuration changed or is unavailable. Refresh before choosing again.');}
  return {s,m,value:value!,installed:JSON.stringify(s.operations?.installedPacks??[])};
 };
 const before=await current();
 await recordAccess(database,before.s,actor,before.m,{action:'viewWorkspace',subject:org,personId:null,detail:'Read-only stored programme configuration review; no patient records, clinical approval or activation.'});
 const after=await current();
 if(JSON.stringify(before.value)!==JSON.stringify(after.value)||before.m.version!==after.m.version)fail(409,'Configuration or membership changed while opening. Refresh and choose again.');
 const proof=await database.batch([
  database.prepare('SELECT role,status,version,is_owner FROM memberships WHERE org_id=? AND user_id=?').bind(org,actor.userId),
  database.prepare("SELECT json_type(data) AS root_type,json_extract(data,'$.installedPacks') AS installed,json_extract(data,'$.version') AS version FROM operations WHERE org_id=?").bind(org),
 ]);
 const members=proof[0].results as {role:string;status:string;version:number;is_owner:number}[],rows=proof[1].results as {root_type:string;installed:string|null;version:number|null}[];
 const member=members[0],record=rows[0];
 if(members.length!==1||!member||member.status!=='active'||member.role!==after.m.role||member.version!==after.m.version||Boolean(member.is_owner)!==Boolean(after.m.isOwner)||!(member.is_owner===1||member.role==='clinician'))fail(403,'Current configuration membership changed. Nothing was shown.');
 if(rows.length>1||record&&record.root_type!=='object'||(record?.installed??'[]')!==after.installed||(record?.version??0)!==after.value.configVersion)fail(409,'Stored configuration changed before disclosure. Refresh and choose again.');
 return response(after.value,actor.userId,org);
}
