'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {DueWorkPanel} from '../due-work-panel';
import {DueWorkPolicyPanel} from '../due-work-policy-panel';
import type {Snapshot} from '@/lib/saha/types';

type JsonData = ReturnType<typeof JSON.parse>;
export default function DueWork(){
 const [data,setData]=useState<Snapshot|null>(null),[queue,setQueue]=useState<JsonData>(null),[ops,setOps]=useState<JsonData>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),keys=useRef<Record<string,string>>({});
 const load=useCallback(async()=>{try{const w=await fetch('/api/workspace',{cache:'no-store'}),j:JsonData=await w.json();if(!w.ok)throw Error(j.error);if(j.role!=='admin'||j.membership.isOwner){const r=await fetch('/api/due-work'+(j.role==='admin'?'?management=1':''),{cache:'no-store',headers:{'x-saha-organisation':j.organisation.id}}),q:JsonData=await r.json();if(!r.ok)throw Error(q.error);setQueue(q);setOps(q.management??null)}else{setQueue(null);setOps(null)}setData(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Due work could not load.');}},[]);
 useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[load]);
 const command=async(body:JsonData)=>{if(!data||busy)return null;setBusy(true);const wire=JSON.stringify(body),key=keys.current[wire]??crypto.randomUUID();keys.current[wire]=key;try{const r=await fetch('/api/commands',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key,'x-saha-organisation':data.organisation.id},body:wire}),j:JsonData=await r.json();if(!r.ok)throw Error(j.error);delete keys.current[wire];await load();return j.result;}catch(e){setError(e instanceof Error?e.message:'The change was not saved.');return null;}finally{setBusy(false)}};
 if(error&&!data)return <main className="outreach-page"><h1>Due work and escalation</h1><p role="alert">{error}</p></main>;if(!data)return <main className="outreach-page"><p role="status">Loading due work…</p></main>;
 return <main className="outreach-page"><a href="/app">Back to workspace</a><div className="page-heading"><div><div className="eyebrow">CARE CONTINUITY</div><h1>Due work and escalation</h1><p>Prioritised local work under the organisation’s reviewed policy.</p></div></div>{error&&<p role="alert" className="error-panel">{error}</p>}{data.membership.isOwner&&ops&&<DueWorkPolicyPanel data={data} operationsVersion={ops.operationsVersion} policy={ops.policy} busy={busy} save={async c=>{await command(c)}}/>}<DueWorkPanel data={data} busy={busy} command={command} initialValue={queue}/></main>;
}
