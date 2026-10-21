'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ADAPTER_OPERATIONS, CONNECTOR_PERMISSIONS, CONNECTOR_PERMISSION_LABEL, CONNECTOR_PERMISSION_PATH, LABEL, NO_PATH, OPERATION_PATHS, connectorPermissionsOf, governed, operationsOf, type AdapterOperation, type ConnectorPermission, type GovernedKind } from '@/lib/saha/adapter-operations';
import type { Integration, Snapshot } from '@/lib/saha/types';
type Dynamic = ReturnType<JSON['parse']>;
type Command=(c:Dynamic,s?:string)=>Promise<Dynamic>;
// Slice 7e: the operations a programme, EHR or ABDM connection may perform. Owners change them; everyone sees them.
export function AdapterOperationsControls({i,data,busy,command}:{i:Integration;data:Snapshot;busy:boolean;command:Command}){
 const current=operationsOf(i),[allowed,setAllowed]=useState<AdapterOperation[]>(current.allowed),[aggregateOnly,setAggregateOnly]=useState(current.aggregateOnly),[reason,setReason]=useState('');
 const permissionSetting=connectorPermissionsOf(i),[permissions,setPermissions]=useState<ConnectorPermission[]>(permissionSetting.allowed),[permissionReason,setPermissionReason]=useState('');
 // A newer setting (saved here or by another owner) resets the form; the disclosure stays open.
 useEffect(()=>{const timer=setTimeout(()=>{setAllowed(operationsOf(i).allowed);setAggregateOnly(operationsOf(i).aggregateOnly);},0);return()=>clearTimeout(timer);},[i.operations?.version]);
 useEffect(()=>{const timer=setTimeout(()=>setPermissions(connectorPermissionsOf(i).allowed),0);return()=>clearTimeout(timer);},[i.connectorPermissions?.version]);
 if(!governed(i))return null;
 const kind=i.kind as GovernedKind,owner=data.canManage,changed=allowed.join()!==current.allowed.join()||aggregateOnly!==current.aggregateOnly;
 const permissionsChanged=permissions.join()!==permissionSetting.allowed.join();
 const toggle=(op:AdapterOperation,on:boolean)=>setAllowed(ADAPTER_OPERATIONS.filter(x=>x===op?on:allowed.includes(x)));
 const summary=current.allowed.length?current.allowed.map(x=>LABEL[x].toLowerCase()).join(', '):'none';
 return <details className="adapter-ops">
  <summary>Connector permissions: {permissionSetting.explicit?(permissionSetting.allowed.map(x=>CONNECTOR_PERMISSION_LABEL[x].toLowerCase()).join(', ')||'none'):'release defaults'}</summary>
  <p className="text-sm muted">Search, read, create, amend, delete, export and status lookup are independent. Read access never enables a write or patient registration. A permission with no active path names the separate approved process.</p>
  <ul className="adapter-ops-list" aria-label={`${i.name} connector permissions`}>{CONNECTOR_PERMISSIONS.map(permission=><li key={permission}>
   {owner?<label className="check-label"><Checkbox aria-label={CONNECTOR_PERMISSION_LABEL[permission]} checked={permissions.includes(permission)} disabled={busy} onCheckedChange={on=>setPermissions(CONNECTOR_PERMISSIONS.filter(x=>x===permission?on===true:permissions.includes(x)))}/>{CONNECTOR_PERMISSION_LABEL[permission]}</label>:<strong>{CONNECTOR_PERMISSION_LABEL[permission]}: {permissionSetting.allowed.includes(permission)?'permitted':'not permitted'}</strong>}
   <span className="text-sm muted">{CONNECTOR_PERMISSION_PATH[permission]}</span>
  </li>)}</ul>
  {owner&&<form className="form-stack" onSubmit={async e=>{e.preventDefault();const r=await command({type:'setConnectorPermissions',integrationId:i.id,version:permissionSetting.version,allowed:permissions,reason:permissionReason},'Connector permissions saved');if(r)setPermissionReason('');}}>
   <label className="field"><span>Reason for the permission change</span><Input value={permissionReason} onChange={e=>setPermissionReason(e.target.value)} minLength={5} maxLength={500} required/></label>
   <Button type="submit" variant="outline" disabled={busy||!permissionsChanged||permissionReason.trim().length<5}>Save connector permissions</Button>
  </form>}
  {!!i.connectorPermissions?.history.length&&<p className="text-sm muted">Earlier permission sets: {i.connectorPermissions.history.slice(-3).map(h=>`v${h.version} ${h.allowed.join('/')||'none'}`).join(' · ')}</p>}
  <hr/>
  <p className="text-sm"><strong>Delivery operations:</strong> {current.aggregateOnly?'aggregate reports only':summary}</p>
  <p className="text-sm muted">Setting version {current.version}{current.explicit?` · changed ${new Date(i.operations!.setAt).toLocaleString()}`:' · release default'}. Every send and lookup rechecks this on the server; an item already prepared is closed as not sent if its operation is withdrawn.</p>
  <ul className="adapter-ops-list" aria-label={`${i.name} permitted operations`}>{ADAPTER_OPERATIONS.map(op=>{const path=OPERATION_PATHS[kind][op];return <li key={op}>
   {owner?<label className="check-label"><Checkbox aria-label={LABEL[op]} checked={allowed.includes(op)} disabled={busy||(aggregateOnly&&['create','update','delete'].includes(op))} onCheckedChange={on=>toggle(op,on===true)}/>{LABEL[op]}</label>:<strong>{LABEL[op]}: {current.allowed.includes(op)?'permitted':'not permitted'}</strong>}
   <span className="text-sm muted">{path||NO_PATH}</span></li>})}</ul>
  {kind==='mis'&&(owner?<label className="check-label"><Checkbox aria-label="Aggregate reports only" checked={aggregateOnly} disabled={busy} onCheckedChange={on=>{const v=on===true;setAggregateOnly(v);if(v)setAllowed(ADAPTER_OPERATIONS.filter(x=>x==='aggregate'||(x==='lookup'&&allowed.includes('lookup'))));}}/>Aggregate reports only: never send patient-level records</label>:<p className="text-sm">{current.aggregateOnly?'Aggregate-only: this destination never receives patient-level records.':'Receives patient-level records under the permitted operations.'}</p>)}
  {kind==='mis'&&<p className="text-sm muted">An aggregate-only destination receives only approved aggregate reports with small cells suppressed, prepared below its operations. Demonstration destinations only in this release.</p>}
  {owner&&<form className="form-stack" onSubmit={async e=>{e.preventDefault();const r=await command({type:'setAdapterOperations',integrationId:i.id,version:current.version,allowed,aggregateOnly,reason},'Operation setting saved');if(r)setReason('');}}>
   <label className="field"><span>Reason for the change</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={5} maxLength={500} required/></label>
   <Button type="submit" variant="outline" disabled={busy||!changed||reason.trim().length<5}>Save operation setting</Button>
  </form>}
  {!!i.operations?.history.length&&<p className="text-sm muted">Earlier settings: {i.operations.history.slice(-3).map(h=>`v${h.version} ${h.aggregateOnly?'aggregate only':h.allowed.join('/')||'none'}`).join(' · ')}</p>}
 </details>;
}
