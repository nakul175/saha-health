'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { interfaceLanguageContext, interfaceLanguageReceipt, interfaceLanguageRefusal, sameLanguageBinding,
  type InterfaceLanguageContext } from '@/lib/saha/interface-language';
import type { Language } from '@/lib/saha/messages';
type Binding=Pick<InterfaceLanguageContext,'actorId'|'organisationId'|'personId'>;
type Attempt={key:string;body:{language:Language;version:number};binding:Binding};
export default function InterfaceLanguage({binding,onLanguage,onRefused}:{binding:Binding;onLanguage:(language:Language)=>void;onRefused:()=>void}) {
  const [context,setContext]=useState<InterfaceLanguageContext|null>(null),[notice,setNotice]=useState('Loading your display-language preference…');
  const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[expiry,setExpiry]=useState<string|null>(null);
  const attempt=useRef<Attempt|null>(null),epoch=useRef(0),active=useRef(false),lock=useRef(false),controller=useRef<AbortController|null>(null);
  const callbacks=useRef({onLanguage,onRefused});
  useLayoutEffect(()=>{callbacks.current={onLanguage,onRefused};});
  const bindingId=JSON.stringify(binding);
  const invalidate=useCallback(()=>{epoch.current++;controller.current?.abort();},[]);
  useLayoutEffect(()=>{active.current=true;invalidate();
    return()=>{active.current=false;invalidate();};
  },[bindingId,invalidate]);
  const available=()=>active.current&&!document.hidden&&navigator.onLine;
  const clear=useCallback((refused=false)=>{invalidate();setContext(null);callbacks.current.onLanguage('en');
    setUncertain(!!attempt.current);setNotice(refused?'Access refused. Protected content cleared. Use the original account and current assignment.':'Language preference unavailable. Your unsaved observations remain; reconnect and refresh this preference.');
    if(refused)callbacks.current.onRefused();},[invalidate]);
  useEffect(()=>{const hidden=()=>{if(document.hidden)clear();},offline=()=>clear();
    document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',offline);window.addEventListener('offline',offline);
    return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',offline);window.removeEventListener('offline',offline);};
  },[bindingId,clear]);
  useEffect(()=>{if(!expiry)return;const ms=Date.parse(expiry)-Date.now();
    if(ms<=0){const frame=requestAnimationFrame(()=>clear(true));return()=>cancelAnimationFrame(frame);}
    let timer:ReturnType<typeof setTimeout>;const arm=()=>{const remaining=Date.parse(expiry)-Date.now();if(remaining<=0)clear(true);else timer=setTimeout(arm,Math.min(remaining,2147483647));};arm();return()=>clearTimeout(timer);
  },[expiry,bindingId,clear]);
  const url=(b:Binding)=>'/api/interface-language?personId='+encodeURIComponent(b.personId);
  const authorised=useCallback(async(b:Binding,signal:AbortSignal)=>{
    const response=await fetch(url(b),{cache:'no-store',credentials:'same-origin',signal,headers:{'x-saha-organisation':b.organisationId,'x-saha-operation-actor':b.actorId}});
    if([401,403,404].includes(response.status)){clear(true);throw Error('Access refused.');}
    if(!response.ok)throw Error('Preference unavailable. Refresh current access before choosing again.');
    const value=interfaceLanguageContext.safeParse(await response.json());
    if(response.headers.get('x-saha-operation-actor')!==b.actorId||response.headers.get('x-saha-organisation')!==b.organisationId||!value.success||!sameLanguageBinding(value.data,b)){
      clear(true);throw Error('Original account or selection could not be matched.');
    }
    if(value.data.refreshAt&&Date.parse(value.data.refreshAt)<=Date.now()){clear(true);throw Error('Current assignment expired.');}
    return value.data;
  },[clear]);
  const refresh=useCallback(async()=>{
    if(lock.current||!available())return;lock.current=true;setBusy(true);const generation=epoch.current,abort=new AbortController();controller.current=abort;
    const timer=setTimeout(()=>abort.abort(),15000);
    try{const value=await authorised(binding,abort.signal);if(!available()||generation!==epoch.current)return;
      setContext(value);setExpiry(value.refreshAt);callbacks.current.onLanguage(value.language);setNotice(attempt.current?'Original language attempt remains unresolved. Check its exact key before a new choice.':'Current own display-language preference loaded. Clinical text stays as recorded.');
    }catch{if(available()&&generation===epoch.current){setContext(null);setNotice('Preference unavailable. Your unsaved observations remain. Refresh when connected.');}}
    finally{clearTimeout(timer);lock.current=false;if(active.current)setBusy(false);}
  },[binding,authorised]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>void refresh());return()=>cancelAnimationFrame(frame);},[bindingId,refresh]);
  const change=async(language:Language,retry=false)=>{
    if(lock.current||!available()||!retry&&(!context||attempt.current||context.language===language))return;
    const current=retry?attempt.current:context?{key:crypto.randomUUID(),body:{language,version:context.version},binding:{...binding}}:null;
    if(!current)return;if(!sameLanguageBinding(current.binding,binding)){setNotice('Return to the original account, organisation and record to check this attempt.');return;}attempt.current=current;lock.current=true;setBusy(true);
    const generation=epoch.current,abort=new AbortController();controller.current=abort;const timer=setTimeout(()=>abort.abort(),20000);
    try{
      if(retry){await authorised(current.binding,abort.signal);if(!available()||generation!==epoch.current)return;}
      const response=await fetch(url(current.binding),{method:'POST',credentials:'same-origin',cache:'no-store',signal:abort.signal,
        headers:{'content-type':'application/json','idempotency-key':current.key,'x-saha-organisation':current.binding.organisationId,'x-saha-operation-actor':current.binding.actorId},body:JSON.stringify(current.body)});
      if(!available()||generation!==epoch.current)return;
      if([401,403,404].includes(response.status)){clear(true);return;}
      const raw=await response.json();if(!available()||generation!==epoch.current)return;
      if(!response.ok){const witness=interfaceLanguageRefusal.safeParse(raw && typeof raw==='object' && 'operation' in raw ? raw.operation : null);
        if(!retry&&witness.success&&witness.data.key===current.key&&witness.data.language===current.body.language&&witness.data.version===current.body.version&&sameLanguageBinding(witness.data,current.binding)&&response.headers.get('x-saha-operation-actor')===current.binding.actorId){
          attempt.current=null;setUncertain(false);setContext(null);setNotice('This request was not dispatched. Refresh your current preference before choosing again.');return;
        }
        throw Error('Exact outcome remains unresolved.');
      }
      const value=interfaceLanguageReceipt.safeParse(raw);
      if(!value.success||!sameLanguageBinding(value.data.context,current.binding)||response.headers.get('x-saha-operation-actor')!==current.binding.actorId||response.headers.get('x-saha-organisation')!==current.binding.organisationId||value.data.operation.key!==current.key||value.data.operation.language!==current.body.language||value.data.operation.version!==current.body.version+1)throw Error('Exact receipt could not be matched.');
      if(value.data.context.refreshAt&&Date.parse(value.data.context.refreshAt)<=Date.now()){clear(true);return;}
      attempt.current=null;setUncertain(false);setContext(value.data.context);setExpiry(value.data.context.refreshAt);callbacks.current.onLanguage(value.data.context.language);
      setNotice(value.data.operation.replayed?'Original preference receipt reconciled. The current own preference is shown.':'Display-language preference saved and read back. Observations and clinical wording stay as recorded.');
    }catch{if(active.current){setUncertain(true);setNotice('Language outcome uncertain. Keep this screen and check the exact original preference attempt; no new key is sent automatically.');}}
    finally{clearTimeout(timer);lock.current=false;if(active.current)setBusy(false);if(attempt.current&&active.current)setUncertain(true);}
  };
  return <section aria-label="Display-language preference" lang="en" style={{border:'1px solid #bac9cc',padding:12,marginBlock:16}}>
    <h2>Display language</h2><p>Saved for your membership in this organisation. Names, clinical text, values and units stay as recorded. Hindi interface text is a draft, not reviewed by a qualified translator.</p>
    <p role="status">{notice}</p><p>{context?'Current preference: '+(context.language==='hi'?'Hindi (draft)':'English'):'Current preference unavailable.'}</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <button style={{minWidth:44,minHeight:44}} disabled={busy||uncertain||!context||context.language==='en'} onClick={()=>void change('en')}>Save English preference</button>
      <button lang="hi" style={{minWidth:44,minHeight:44}} disabled={busy||uncertain||!context||context.language==='hi'} onClick={()=>void change('hi')}>Save हिन्दी preference</button>
      <button style={{minWidth:44,minHeight:44}} disabled={busy} onClick={()=>void refresh()}>Refresh language preference</button>
      {uncertain&&<button style={{minWidth:44,minHeight:44}} disabled={busy} onClick={()=>attempt.current&&void change(attempt.current.body.language,true)}>Check exact language attempt</button>}
    </div>
  </section>;
}
