import {db, identity, json, loadFor} from './server';
import {dueWorkQueue} from './due-work';
import {recordPatientWorkView} from './read-audit';
import {scope} from './store';
import {fail} from './core';

export async function dueWorkRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'),undefined,true),m=scope(s,u.userId),managementOnly=new URL(request.url).searchParams.get('management')==='1';
 const ops=s.operations as (typeof s.operations&{dueWorkPolicy?:unknown})|undefined;
 if(managementOnly){if(!m.isOwner)fail(403,'Only an organisation owner can read due-work policy settings.');return json({configurationRequired:true,policy:null,items:[],scope:'Policy settings only; no patient queue was read.',management:{operationsVersion:ops?.version??0,policy:ops?.dueWorkPolicy??null}});}
 const result=dueWorkQueue(s,m);
 await recordPatientWorkView(db(),s,u,m,'care continuity',result.items.length);
 return json({...result,...(m.isOwner?{management:{operationsVersion:ops?.version??0,policy:ops?.dueWorkPolicy??null}}:{})});
}
