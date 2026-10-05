'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from './i18n';
import { MEASURES, VALUE_FIELDS, factProvenance, measureValue, normaliseUnits, rangeProblem, selectionForVisit } from '@/lib/saha/fact-provenance';
import type { Facts, Visit } from '@/lib/saha/types';
import type { Measure } from '@/lib/saha/types';
import './guided-capture.css';
export type CaptureStep={id:string;label:string};
export type CaptureProblem={step:string;message:string};
// Presentation warnings use the captured protocol; the original server save remains authoritative.
export function captureProblems(f:Facts,v:Visit):CaptureProblem[]{
 const out:CaptureProblem[]=[];if(!f.date||!Number.isFinite(Date.parse(f.date+'Z'))||Date.parse(f.date+'Z')>Date.now()+300000)out.push({step:'time',message:'Select an observation time that is not in the future.'});
 if(!!f.systolic!==!!f.diastolic)out.push({step:'fact:bloodPressure',message:'Enter both blood pressure readings or leave both blank.'});
 for(const field of VALUE_FIELDS){if(f[field]&&!/^[0-9]+(\.[0-9]+)?$/.test(f[field]))out.push({step:factStep(field),message:field+': enter a positive number or leave blank.'});const only={...f,systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',[field]:f[field],unusual:f.unusual?.[field]!==undefined?{[field]:f.unusual[field]}:undefined};const issue=rangeProblem(only,undefined,selectionForVisit(v));if(issue)out.push({step:factStep(field),message:issue});}
 for(const m of MEASURES){const own=f.provenance?.[m];if(!own)continue;const value=measureValue(f,m),p=factProvenance(f,m),recorded=['measured','reported'].includes(p.source);if(!!value!==recorded)out.push({step:factStep(m),message:m+': choose measured/reported for a value, or a missing reason when blank.'});if(own.at&&(!value||Date.parse(own.at+'Z')>Date.now()+300000))out.push({step:factStep(m),message:m+': observation time must apply to a recorded value and cannot be in the future.'});}
 const unit=normaliseUnits(f);if(unit.problem){const field=Object.keys(f.entered??{}).find(k=>unit.problem?.toLowerCase().includes(k.toLowerCase()))??Object.keys(f.entered??{})[0];out.push({step:factStep(field??'weight'),message:unit.problem});}return out;
}
const Context=createContext<{enabled:boolean;active:string;eligible:(s:CaptureStep[])=>void}|null>(null);
export const factStep=(field:string)=>'fact:'+(['systolic','diastolic'].includes(field)?'bloodPressure':field);
export function GuidedCapture({enabled,steps,identity,problems=[],children}:{enabled:boolean;steps:CaptureStep[];identity?:string;problems?:CaptureProblem[];children:ReactNode}){
 const {lang}=useI18n(),hi=lang==='hi';const [wanted,setWanted]=useState('time'),[programme,setProgramme]=useState<CaptureStep[]>([]);const heading=useRef<HTMLHeadingElement>(null);
 const all=useMemo(()=>{const seen=new Set<string>();return [...steps,...programme].filter(s=>{if(seen.has(s.id))return false;seen.add(s.id);return true;});},[steps,programme]);
 const active=all.some(s=>s.id===wanted)?wanted:'time',index=all.findIndex(s=>s.id===active);
 useEffect(()=>{if(enabled)heading.current?.focus({preventScroll:true})},[active,enabled]);
 const value=useMemo(()=>({enabled,active,eligible:setProgramme}),[enabled,active]);
 return <Context.Provider value={value}>{enabled&&<section className="guided-capture" aria-label={hi?'भेंट की जानकारी':'Guided visit capture'}><p className="guided-capture-identity">{identity}</p><p className="muted text-sm">{hi?'चरण':'Step'} {index+1} / {all.length}</p><h3 ref={heading} tabIndex={-1}>{all[index]?.label}</h3><p>{hi?'पीछे और आगे से जानकारी नहीं सहेजी जाती। सहेजने के लिए नीचे का बटन दबाएँ।':'Back and Next keep your entries on screen. Use the explicit save buttons to save.'}</p><div className="guided-capture-navigation"><Button type="button" variant="outline" disabled={index===0} onClick={()=>setWanted(all[index-1].id)}>{hi?'पीछे':'Back'}</Button><Button type="button" variant="outline" disabled={index===all.length-1} onClick={()=>setWanted(all[index+1].id)}>{hi?'आगे':'Next'}</Button></div><label className="field">{hi?'जानकारी चुनें':'Go to observation or save'}<select aria-label={hi?'जानकारी चुनें':'Go to observation or save'} value={active} onChange={e=>setWanted(e.target.value)}>{all.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><p className="muted text-sm">{hi?'यह ऑनलाइन भेंट है। ऑफलाइन के लिए सुरक्षित डिवाइस ड्राफ़्ट खोलें।':'This capture needs a connection. Offline work uses prepared encrypted device drafts.'} <a href="/app/offline/">{hi?'डिवाइस ड्राफ़्ट':'Open device drafts'}</a></p>{problems.length>0&&<div className="notice amber-notice" role="alert" lang="en"><strong>Check these entries before saving</strong>{problems.map((p,i)=><p key={i}><button type="button" className="text-link" onClick={()=>setWanted(p.step)}>{p.message}</button></p>)}</div>}</section>}{children}</Context.Provider>;
}
/** Visibility alone changes: children (including local answer state) never unmount. */
export function CaptureStage({id,children}:{id:string;children:ReactNode}){const c=useContext(Context),hidden=!!c?.enabled&&c.active!==id;return <div className={c?.enabled?'capture-stage':'legacy-capture-stage'} data-capture-step={id} hidden={hidden} inert={hidden}>{children}</div>}
export function useGuidedProgramme(steps:CaptureStep[]){const c=useContext(Context),signature=JSON.stringify(steps);useEffect(()=>{c?.eligible(JSON.parse(signature))},[c?.eligible,signature]);return !!c?.enabled}
export function useGuidedObservation():{enabled:boolean;measure:Measure|null}{const c=useContext(Context);return {enabled:!!c?.enabled,measure:c?.active.startsWith('fact:')?c.active.slice(5) as Measure:null}}
export function CaptureSecondary({enabled,title,children}:{enabled:boolean;title:string;children:ReactNode}){return enabled?<details className="capture-secondary"><summary>{title}</summary>{children}</details>:<>{children}</>}
