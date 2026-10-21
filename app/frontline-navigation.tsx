'use client';
import { Home, CalendarDays, Users, Stethoscope, RefreshCw, Menu, ChevronRight, LockKeyhole, WifiOff, FileCheck2, Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { shownViews, type View } from '@/lib/saha/navigation';
import type { Snapshot } from '@/lib/saha/types';
import type { Language } from '@/lib/saha/messages';
import { useI18n } from './i18n';

export type AppTab='home'|'workspace'|'referrals'|'sync'|'more';
const views=(data:Snapshot,pilotTask:boolean)=>shownViews({role:data.role,isOwner:data.membership.isOwner,reporting:!!data.delegatedAuthority?.some(d=>d.kind==='reporting')},pilotTask);
export function FrontlineNavigation({data,view,tab,patientOpen,busy,pilotTask,go,choose}:{data:Snapshot|null;view:View;tab:AppTab;patientOpen:boolean;busy:boolean;pilotTask:boolean;go:(v:View)=>void;choose:(tab:AppTab)=>void}){
 const {lang}=useI18n(),hi=lang==='hi',allowed=data?views(data,pilotTask):[],care=data&&['asha','clinician'].includes(data.role);
 const selected=(id:AppTab,target?:View)=>!patientOpen&&tab===id&&(!target||view===target);
 return <nav className="frontline-bottom" aria-label="App navigation" lang="en">
  {data?.role==='asha'?<button disabled={busy} aria-current={selected('home')?'page':undefined} onClick={()=>choose('home')}><Home size={21}/><span lang={hi?'hi':'en'}>{hi?'होम':'Home'}</span></button>:allowed.includes('work')&&<button disabled={busy} aria-current={selected('workspace','work')?'page':undefined} onClick={()=>go('work')}><CalendarDays size={21}/><span>Today</span></button>}
  {allowed.includes('people')&&<button disabled={busy} aria-current={selected('workspace','people')?'page':undefined} onClick={()=>go('people')}><Users size={21}/><span>People</span></button>}
  {allowed.includes('work')&&<button disabled={busy} aria-current={selected('referrals')?'page':undefined} onClick={()=>choose('referrals')}><Stethoscope size={21}/><span>Referrals</span></button>}
  {care&&<button disabled={busy} aria-current={selected('sync')?'page':undefined} onClick={()=>choose('sync')}><RefreshCw size={21}/><span>Sync</span></button>}
  <button disabled={busy||!data} aria-current={selected('more')?'page':undefined} onClick={()=>choose('more')}><Menu size={21}/><span>More</span></button>
 </nav>;
}
export function FrontlineSync({online,busy,openSubmissions,openNotebook}:{online:boolean;busy:boolean;openSubmissions:()=>void;openNotebook:()=>void}){
 return <section lang="en" className="frontline-sync"><div className="eyebrow">DEVICE & SERVER</div><h1>Your sync centre</h1><p>Device drafts and programme submissions have separate status.</p>
  <div className="frontline-state"><span className={online?'connection-dot':'connection-dot offline'}/>{online?'Browser reports a connection':'Browser reports offline'}<small>Server availability is checked when you load or sync.</small></div>
  <article className="panel"><LockKeyhole size={25}/><h2>Encrypted field notebook</h2><p>Unlock the notebook to see this device’s actual drafts, registrations and media. Its encrypted queue is not read by this screen.</p><Button disabled={busy} onClick={openNotebook}>Open device drafts <ChevronRight size={17}/></Button><p className="muted text-sm">Prepare assigned visits while connected. Review each draft before sync. Sync saves an unconfirmed server draft; it does not send it to a programme.</p></article>
  <article className="panel"><FileCheck2 size={25}/><h2>Programme submissions</h2><p>Check server receipts and items needing attention. A programme receipt does not describe whether this device’s notebook has synced.</p><Button variant="outline" disabled={busy} onClick={openSubmissions}>View submissions <ChevronRight size={17}/></Button></article>
  {!online&&<p className="notice"><WifiOff size={18}/> Keep unsynced work in the encrypted notebook until a server connection is available.</p>}
 </section>;
}
export function FrontlineMore({data,pilotTask,busy,go,switchOrg,setLanguage}:{data:Snapshot;pilotTask:boolean;busy:boolean;go:(v:View)=>void;switchOrg:(id:string)=>void;setLanguage:(lang:Language)=>void}){
 const {t,lang}=useI18n(),allowed=views(data,pilotTask);
 return <section className="frontline-more"><div className="eyebrow">YOUR WORKSPACE</div><h1>More</h1><div className="panel"><h2>{data.membership.displayName}</h2><p>{t(`role.${data.role}`)} · {data.organisation.name}</p><label className="field"><span>{t('nav.chooseOrganisation')}</span><select value={data.organisation.id} disabled={busy} onChange={e=>switchOrg(e.target.value)}>{data.organisations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><div className="language-buttons"><Button disabled={busy} variant={lang==='en'?'default':'outline'} onClick={()=>setLanguage('en')}>English</Button><Button disabled={busy} variant={lang==='hi'?'default':'outline'} lang="hi" onClick={()=>setLanguage('hi')}>हिन्दी</Button></div><p className="muted text-sm" lang="en">App navigation is in English. Hindi clinical workspace translations remain draft.</p></div>
 <div className="panel frontline-more-list">{allowed.map(v=><button key={v} disabled={busy} onClick={()=>go(v)}><span>{t(`nav.${v}`)}</span><ChevronRight size={18}/></button>)}</div>
 <a className="frontline-workspace-link" href="/"><Layers3 size={19}/> Open full web workspace</a><a className="frontline-workspace-link" href="/account-recovery"><LockKeyhole size={19}/> Account and device recovery</a><a className="frontline-workspace-link" href={data.signOutPath??'/signout-with-chatgpt?return_to=%2F'} target="_top"><LockKeyhole size={19}/>{t('nav.signOut')}</a>
 </section>;
}
