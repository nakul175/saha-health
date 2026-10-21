'use client';
import catalog from '@/lib/saha/frontline/catalog.json';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
const TOOLS=['send','lookup','probe'] as const;
export function ServiceIdentityPanel({value,busy,save}:{value:any;busy:boolean;save:(c:any)=>Promise<void>}){
 const [name,setName]=useState(''),[target,setTarget]=useState(''),[owner,setOwner]=useState(''),[expiry,setExpiry]=useState(''),[tools,setTools]=useState<string[]>(['send','lookup']);
 if(!value)return null;
 const connectionName=(id:string)=>id==='openai'?'Built-in AI provider':id==='independent:anaemia'?'Anaemia Screen':id.startsWith('frontline:')?catalog.find(x=>x.id===id.slice(9))?.name??'Community-health provider':value.targets.find((x:any)=>x.id===id)?.name??'Previous connection';
 const selectClass='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
 const toggle=(tool:string)=>setTools(v=>v.includes(tool)?v.filter(x=>x!==tool):[...v,tool]);
 const later=()=>{const d=new Date();d.setDate(d.getDate()+30);return d.toISOString()};
 return <section className="panel ops-panel"><h2>Service identities</h2><p>An owner can bind a machine identity to one connection and specific tools. Requests still require the initiating person’s authority. Revoking, rotating or expiring an identity blocks further use of the previous identity; stored receipts remain available.</p>
  <form className="ops-form" onSubmit={async e=>{e.preventDefault();const t=value.targets.find((x:any)=>x.id===target);await save({type:'serviceIdentityCreate',name,targetId:target,kind:t.kind,ownerId:owner,expiresAt:new Date(expiry).toISOString(),intents:tools});}}>
   <label>Identity name<Input required minLength={3} maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
   <label>Connection<select className={selectClass} aria-label="Connection" required value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose connection</option>{value.targets.map((x:any)=><option key={x.id} value={x.id}>{connectionName(x.id)}</option>)}</select></label>
   <label>Accountable owner<select className={selectClass} aria-label="Accountable owner" required value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Choose owner</option>{value.owners.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   <label>Expires at<Input required type="datetime-local" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
   <fieldset><legend>Allowed tools</legend>{TOOLS.map(tool=><label key={tool}><input type="checkbox" checked={tools.includes(tool)} onChange={()=>toggle(tool)}/> {tool}</label>)}</fieldset>
   <Button disabled={busy||tools.length===0}>Create identity</Button>
  </form>
  <ul>{value.identities.map((x:any)=><li key={x.id}><strong>{x.name}</strong> · {connectionName(x.targetId)} · owner {x.ownerName} · {x.status} · tools {(x.intents??['legacy scope']).join(', ')} · expires {new Date(x.expiresAt).toLocaleString()}{value.bindings[x.targetId]===x.id&&<span> · Bound to connection</span>}{x.status==='active'&&<><Button variant="outline" disabled={busy||value.bindings[x.targetId]===x.id} onClick={()=>save({type:'serviceIdentityBind',targetId:x.targetId,serviceIdentityId:x.id})}>Bind to connection</Button><Button variant="outline" disabled={busy} onClick={()=>save({type:'serviceIdentityRotate',id:x.id,expiresAt:later(),intents:x.intents??['send','lookup']})}>Rotate for 30 days</Button><Button variant="outline" disabled={busy} onClick={()=>save({type:'serviceIdentityRevoke',id:x.id})}>Revoke</Button></>}</li>)}</ul>
  <p>Connections without a binding keep their existing configuration. Binding does not enable a provider or supply credentials.</p>
 </section>;
}
