'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GuidedCapture, CaptureStage, captureProblems, factStep } from '../guided-capture';
import { ProgrammeQuestions, type ProgrammeDraft } from '../programmes';
import { MEASURES, FACT_SOURCES, SOURCE_LABEL, VALUE_FIELDS, VALUE_RANGES, measureOf,
  factProvenance, authorText, alternativeUnit } from '@/lib/saha/fact-provenance';
import type { Facts, FactSource, Measure, ValueField } from '@/lib/saha/types';
import type { RoutineContext, RoutineStaleRefusal } from '@/lib/saha/routine-visit';
import { routineSelection, currentServerDraft } from '@/lib/saha/resume-work';
import { RoutineSaveStatus } from './save-status';
import { observationConflict, reviewedFacts, unchangedReviewCheckpoint, sameReviewContext, type ConflictChoice } from '@/lib/saha/routine-conflict';
import './routine-visit.css';
import InterfaceLanguage from './interface-language';
import { I18nProvider, TranslationNotice } from '../i18n';
import type { Language } from '@/lib/saha/messages';
import ContextualAcademyPanel from './contextual-academy';
import type { ContextualAcademy } from '@/lib/saha/contextual-academy';

const conflictGroupText=(id:string,value:Facts)=>{
  if(id==='context')return 'Visit observation time (UTC): '+value.date+'\nDefault source: '+SOURCE_LABEL[value.source];
  if(id==='notes')return value.notes||'No visit notes recorded.';
  const measure=id as Measure,fields=VALUE_FIELDS.filter(field=>measureOf(field)===measure),lines:string[]=[];
  for(const field of fields){lines.push(VALUE_RANGES.fields[field].label+': '+(value[field]?value[field]+' '+VALUE_RANGES.fields[field].unit:'Missing; not assumed normal.'));if(value.entered?.[field])lines.push('Original entered value: '+value.entered[field]!.value+' '+value.entered[field]!.unit);if(value.unusual?.[field])lines.push('Recorded unusual-value reason: '+value.unusual[field]);}
  const recorded=fields.some(field=>Boolean(value[field]));
  if(recorded||value.provenance?.[measure]){const provenance=factProvenance(value,measure);lines.push('Source or missing reason: '+SOURCE_LABEL[provenance.source]);if(recorded)lines.push('Observation time (UTC): '+provenance.at);else lines.push('No recorded value; explicit missing reason retained.');}
  else lines.push('No observation source or time is assumed for missing values.');
  return lines.join('\n');
};

type Attempt = { key: string; command: Record<string, unknown>; personId: string; organisationId: string; actorId: string;
  input: { facts: Facts | null; programme: ProgrammeDraft | null } };
export default function RoutineVisit() {
  const [context, setContext] = useState<RoutineContext | null>(null);
  const [displayLanguage,setDisplayLanguage]=useState<Language>('en');
  const [learning,setLearning]=useState<ContextualAcademy>({status:'unavailable',optional:true,requiresAdditionalLogin:false,careGate:false,completionTracking:'none',reason:'not-configured'});
  const [languageBinding,setLanguageBinding]=useState<{actorId:string;organisationId:string;personId:string}|null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [notice, setNotice] = useState('Loading routine visit…');
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const [programmeDirty, setProgrammeDirty] = useState(false), [checked, setChecked] = useState(false);
  const [latest, setLatest] = useState<RoutineContext | null>(null);
  const [conflictChoices,setConflictChoices]=useState<Record<string,ConflictChoice>>({}),[conflictChecked,setConflictChecked]=useState(false),[conflictStale,setConflictStale]=useState(false),[heldComparison,setHeldComparison]=useState(false),[comparisonProgrammeDirty,setComparisonProgrammeDirty]=useState(false);
  const comparisonReadGeneration=useRef(0),comparisonBoundaryActive=useRef(false);
  const comparisonMemory=useRef<{base:RoutineContext;facts:Facts;actorId:string;programme:ProgrammeDraft|null;programmeDirty:boolean}|null>(null);
  const [readChoice, setReadChoice] = useState({ token: 0, kind: 'load' as 'load' | 'merge' });
  const [programmeRecovery, setProgrammeRecovery] = useState<(ProgrammeDraft & { token: number }) | undefined>();
  const attempt = useRef<Attempt | null>(null), heading = useRef<HTMLHeadingElement>(null);
  const boundActor = useRef<string | null>(null);
  const protectionGeneration=useRef(0);
  const programmeDraft = useRef<ProgrammeDraft | null>(null);
  const mounted = useRef(true), inFlight = useRef(false);
  const visit = context?.visit;
  const factsDirty = !!facts && !!visit && JSON.stringify(facts) !== JSON.stringify(visit.facts);
  const dirty = factsDirty || programmeDirty;
  const invalidateComparisonForEdit=useCallback(()=>{comparisonBoundaryActive.current=false;comparisonReadGeneration.current++;setLatest(null);setConflictChoices({});setConflictChecked(false);setConflictStale(false);comparisonMemory.current=null;setHeldComparison(false);},[]);
  const onProgrammeDirty = useCallback((value: boolean) => {if(value)invalidateComparisonForEdit();setProgrammeDirty(value);}, [invalidateComparisonForEdit]);
  const onProgrammeDraft = useCallback((value: ProgrammeDraft) => { programmeDraft.current = structuredClone(value); }, []);
  const endpoint = (personId: string, visitId?: string) => '/api/routine-visit?personId=' + encodeURIComponent(personId) +
    (visitId ? '&visitId=' + encodeURIComponent(visitId) : '');
  const receive = (value: RoutineContext, replaceFacts: boolean) => {
    comparisonBoundaryActive.current=false;
    setContext(value); if (replaceFacts) setFacts(value.visit?.facts ?? null);
    setConflictChoices({});setConflictChecked(false);setConflictStale(false);
    setChecked(false); setLatest(null);
  };
  const clearProtected = useCallback(() => {
    comparisonBoundaryActive.current=false;comparisonReadGeneration.current++;
    protectionGeneration.current++;
    setContext(null); setFacts(null); setLatest(null); setProgrammeDirty(false); setChecked(false);
    setProgrammeRecovery(undefined); programmeDraft.current = null;
  }, []);
  const clearComparisonForBoundary=useCallback(()=>{
    if(!comparisonBoundaryActive.current||!comparisonMemory.current)return;
    setHeldComparison(true);clearProtected();setNotice('Protected comparison cleared. Original edits remain private in this screen’s memory.');
  },[clearProtected]);
  const comparisonReadCurrent=(generation:number)=>{
    if(!mounted.current||generation!==comparisonReadGeneration.current)return false;
    if(document.hidden||!navigator.onLine){clearComparisonForBoundary();return false;}
    return true;
  };
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController(), selection = routineSelection(new URLSearchParams(window.location.search));
    if (!selection) {
      const frame = requestAnimationFrame(() => setNotice('Choose one existing assigned person from Today.'));
      return () => { mounted.current = false; cancelAnimationFrame(frame); controller.abort(); };
    }
    const selectedPerson = selection.personId, selectedOrganisation = selection.organisationId;
    void fetch(endpoint(selectedPerson, selection.visitId), { cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
      headers: { 'x-saha-organisation': selectedOrganisation } })
      .then(async response => {
        if (!response.ok) throw Error([401,403,404].includes(response.status) ? 'Access refused. Check your active ASHA membership and assignment.' : 'Routine visit unavailable. Try again with a connection.');
        const value: RoutineContext = await response.json();
        if (controller.signal.aborted) return;
        const actorId = response.headers.get('x-saha-operation-actor');
        if (value.person.id !== selectedPerson || value.organisationId !== selectedOrganisation)
          throw Error('Selected record could not be matched. Return to Today and choose the person again.');
        if (!actorId) throw Error('Signed-in account could not be matched. Return to Today and try again.');
        if (selection.actorId && actorId !== selection.actorId) throw Error('The signed-in account changed. Return to Resume work with the original account.');
        if (selection.visitId) currentServerDraft(value, selectedPerson, selectedOrganisation, actorId, selection.visitId);
        boundActor.current = actorId;
        setLanguageBinding({actorId,organisationId:selectedOrganisation,personId:selectedPerson});
        receive(value, true); setNotice(value.visit ? 'Current server draft loaded. Review before saving.' : 'No current draft. Opening this screen creates nothing.');
        heading.current?.focus();
      }).catch(cause => { if (!controller.signal.aborted) setNotice(cause.message); });
    return () => { mounted.current = false; controller.abort(); };
  }, []);
  useEffect(()=>{
    if(!context||!boundActor.current)return;
    setLearning({status:'unavailable',optional:true,requiresAdditionalLogin:false,careGate:false,completionTracking:'none',reason:'not-configured'});
    const controller=new AbortController(),personId=context.person.id,organisationId=context.organisationId,actorId=boundActor.current;
    void fetch('/api/contextual-academy?personId='+encodeURIComponent(personId),{cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:{'x-saha-organisation':organisationId}})
      .then(async response=>{
        if([401,403,404].includes(response.status)){clearProtected();setNotice('Access refused. Protected content cleared.');return null;}
        if(!response.ok)return null;
        if(response.headers.get('x-saha-operation-actor')!==actorId){clearProtected();setNotice('The signed-in account changed. Protected content cleared.');return null;}
        const value=await response.json() as ContextualAcademy;
        if(!value||!['available','unavailable'].includes(value.status)||value.optional!==true||value.requiresAdditionalLogin!==false||value.careGate!==false||value.completionTracking!=='none'||(value.status==='available'&&!Array.isArray(value.items)))return null;
        return value;
      }).then(value=>{if(!controller.signal.aborted&&value)setLearning(value);})
      .catch(()=>{if(!controller.signal.aborted)setLearning({status:'unavailable',optional:true,requiresAdditionalLogin:false,careGate:false,completionTracking:'none',reason:'invalid-configuration'});});
    return()=>controller.abort();
  },[context?.person.id,context?.organisationId,clearProtected]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty || uncertain) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, uncertain]);

  const send = async (c: Record<string, unknown>, message = 'Server draft saved and read back.', retry = false) => {
    if (inFlight.current || (!retry && (!context || !boundActor.current || uncertain || attempt.current))) return null;
    if (!retry && c.type === 'saveProgrammeAnswers' && factsDirty) { setNotice('Save corrected observations before programme evidence. Your answers remain on screen.'); return null; }
    if (!navigator.onLine) { setNotice('Offline: your entries remain on this screen, unsaved. Reconnect before saving.'); return null; }
    const current = retry ? attempt.current : context && boundActor.current ? {
      key: crypto.randomUUID(), command: structuredClone(c), personId: context.person.id,
      organisationId: context.organisationId, actorId: boundActor.current,
      input: { facts: facts ? structuredClone(facts) : null,
        programme: programmeDraft.current ? structuredClone(programmeDraft.current) : null } } : null;
    if (!current) return null;
    const generation=protectionGeneration.current;
    const revoked=()=>{if(generation===protectionGeneration.current)return false;setUncertain(true);setNotice('Access refused. Protected content cleared.');return true;};
    attempt.current = current; inFlight.current = true; setBusy(true);
    try {
      if (retry) {
        // A scope refusal may follow a committed save. Re-authorise the original
        // selection/account without changing its key, body or expected version.
        const selectedVisit = typeof current.command.visitId === 'string' ? current.command.visitId : undefined;
        const authorised = await fetch(endpoint(current.personId, selectedVisit), {
          cache: 'no-store', credentials: 'same-origin',
          headers: { 'x-saha-organisation': current.organisationId } });
        if (!mounted.current || revoked()) { void authorised.body?.cancel().catch(()=>{}); return null; }
        if ([401,403,404].includes(authorised.status)) {
          clearProtected(); setUncertain(true); setNotice('Access refused. Protected content cleared.'); return null;
        }
        if (!authorised.ok) throw Error('Original attempt remains unresolved.');
        if (authorised.headers.get('x-saha-operation-actor') !== current.actorId) {
          clearProtected(); setUncertain(true);
          setNotice('Sign in with the original account to check this attempt. Protected content cleared.'); return null;
        }
        const value: RoutineContext = await authorised.json();
        if (!mounted.current || revoked()) return null;
        if (value.person.id !== current.personId || value.organisationId !== current.organisationId ||
            (selectedVisit && value.visit?.id !== selectedVisit)) throw Error('Original selection could not be matched.');
        // Retain still-authorised unsaved edits. After a refusal only freshly
        // authorised projections may return to the screen; editing stays paused.
        if (!context) {
          receive(value, true);
          if (selectedVisit && value.visit?.id === selectedVisit) {
            if (current.input.facts) setFacts(structuredClone(current.input.facts));
            if (current.input.programme?.visitId === selectedVisit)
              setProgrammeRecovery({ ...structuredClone(current.input.programme), token: 1 });
          }
        }
      }
      const response = await fetch('/api/routine-visit', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': current.key,
          'x-saha-organisation': current.organisationId, 'x-saha-operation-actor': current.actorId },
        body: JSON.stringify({ personId: current.personId, command: current.command }) });
      if (!mounted.current || revoked()) { void response.body?.cancel().catch(()=>{}); return null; }
      if (!response.ok) {
        if ([401,403,404].includes(response.status)) {
          clearProtected(); setUncertain(true); setNotice('Access refused. Protected content cleared.'); return null;
        }
        if (response.status >= 500) throw Error('Write outcome is uncertain. Keep this screen and check the exact attempt.');
        const problem = await response.json() as { error?: string; operation?: Partial<RoutineStaleRefusal> };
        if (!mounted.current || revoked()) return null;
        const refusal = problem.operation;
        const staleAttempt = response.status === 409 && refusal &&
          response.headers.get('x-saha-operation-actor') === current.actorId &&
          refusal.outcome === 'not-applied-stale-version' && refusal.key === current.key &&
          refusal.organisationId === current.organisationId && refusal.personId === current.personId &&
          refusal.visitId === current.command.visitId && refusal.expectedVersion === current.command.version &&
          Number.isSafeInteger(refusal.currentVersion) && typeof refusal.currentVersion === 'number' &&
          typeof refusal.expectedVersion === 'number' && refusal.currentVersion > refusal.expectedVersion;
        setNotice((typeof problem.error === 'string' ? problem.error : 'Save refused.') + ' Your entries remain unsaved on this screen.');
        if (!retry || staleAttempt) { attempt.current = null; setUncertain(false); }
        if (staleAttempt) { setLatest(null); setChecked(false); }
        return null;
      }
      if (response.headers.get('x-saha-operation-actor') !== current.actorId) {
        clearProtected(); throw Error('Original account could not be matched.');
      }
      const value = await response.json() as { context: RoutineContext; result: unknown };
      if (!mounted.current || revoked()) return null;
      if (!value.context || value.context.person.id !== current.personId ||
          value.context.organisationId !== current.organisationId ||
          (current.command.type !== 'startVisit' && value.context.visit?.id !== current.command.visitId))
        throw Error('Saved result could not be matched. Check the exact attempt.');
      receive(value.context, ['startVisit','saveVisit'].includes(String(current.command.type)));comparisonMemory.current=null;setHeldComparison(false);
      setProgrammeRecovery(undefined);
      setReadChoice(previous => ({ token: previous.token + 1, kind: current.command.type === 'saveVisit' ? 'merge' : 'load' }));
      attempt.current = null; setUncertain(false); setNotice(message);
      return value;
    } catch {
      if (mounted.current) { setUncertain(true); setNotice('Write outcome uncertain. Entries kept; editing is paused. Check the exact attempt with its original key.'); }
      return null;
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  const compare = async () => {
    if (!context || busy) return;
    const generation=++comparisonReadGeneration.current, protection=protectionGeneration.current;setBusy(true);setConflictChoices({});setConflictChecked(false);setConflictStale(false);
    if(facts&&boundActor.current){comparisonMemory.current={base:structuredClone(context),facts:structuredClone(facts),actorId:boundActor.current,programme:programmeDraft.current?structuredClone(programmeDraft.current):null,programmeDirty};setComparisonProgrammeDirty(programmeDirty);comparisonBoundaryActive.current=true;}
    try {
      if(!comparisonReadCurrent(generation))return;
      const response = await fetch(endpoint(context.person.id, visit?.id), { cache: 'no-store', credentials: 'same-origin', signal:AbortSignal.timeout(20000), headers: { 'x-saha-organisation': context.organisationId } });
      if(!comparisonReadCurrent(generation) || protection!==protectionGeneration.current){void response.body?.cancel().catch(()=>{});return;}
      if ([401,403,404].includes(response.status)) {
        setHeldComparison(Boolean(comparisonMemory.current));clearProtected(); setUncertain(Boolean(attempt.current)); setNotice('Access refused. Protected content cleared.'); return;
      }
      if (!response.ok) throw Error();
      if (response.headers.get('x-saha-operation-actor') !== boundActor.current) {
        setHeldComparison(Boolean(comparisonMemory.current));clearProtected(); setUncertain(Boolean(attempt.current));
        setNotice('Sign in with the original account to check this attempt. Protected content cleared.'); return;
      }
      const value: RoutineContext = await response.json();
      if (!mounted.current || protection!==protectionGeneration.current) return;
      if (value.person.id !== context.person.id || value.organisationId !== context.organisationId ||
          value.visit?.id !== visit?.id) throw Error();
      if(!comparisonReadCurrent(generation))return;setLatest(value); setNotice('Latest saved record loaded for comparison. Your entries have not been replaced.');
    } catch { if(mounted.current&&generation===comparisonReadGeneration.current&&protection===protectionGeneration.current){setLatest(null);setConflictStale(true);setNotice('Saved record unavailable. Your entries remain on screen.');} }
    finally { if(mounted.current)setBusy(false); }
  };
  const recoverComparison=async()=>{
    const held=comparisonMemory.current;if(!held||busy||uncertain)return;const generation=++comparisonReadGeneration.current;comparisonBoundaryActive.current=true;setBusy(true);
    try{
      if(!comparisonReadCurrent(generation))return;
      const r=await fetch(endpoint(held.base.person.id,held.base.visit?.id),{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(20000),headers:{'x-saha-organisation':held.base.organisationId}});
      if(!comparisonReadCurrent(generation))return;
      if(!r.ok||r.headers.get('x-saha-operation-actor')!==held.actorId)throw Error();
      const current=await r.json()as RoutineContext;sameReviewContext(held.base,current);if(!comparisonReadCurrent(generation))return;
      receive(held.base,false);setFacts(structuredClone(held.facts));setLatest(current);comparisonBoundaryActive.current=true;setComparisonProgrammeDirty(held.programmeDirty);setHeldComparison(false);
      if(held.programme)setProgrammeRecovery({...structuredClone(held.programme),token:1});
      setNotice('Original local edits restored after a fresh authorised read. Review both versions before any save.');
    }catch{if(mounted.current&&generation===comparisonReadGeneration.current){clearProtected();setHeldComparison(true);setNotice('Original comparison unavailable. Local edits remain private in this screen’s memory; no operation was sent.');}}
    finally{if(mounted.current)setBusy(false);}
  };
  let review:ReturnType<typeof observationConflict>|null=null,reviewProblem='',chosen:Facts|null=null;
  if(context&&facts&&latest)try{review=observationConflict(context,facts,latest);try{chosen=reviewedFacts(review,conflictChoices);}catch(cause){reviewProblem=cause instanceof Error?cause.message:'Review choices unavailable.';}}catch(cause){reviewProblem=cause instanceof Error?cause.message:'Review context unavailable.';}
  const adoptReviewed=async()=>{
    if(!context||!facts||!latest||!review||!chosen||!conflictChecked||conflictStale||busy||uncertain||programmeDirty||comparisonProgrammeDirty||inFlight.current)return;
    const reviewed=latest,merged=structuredClone(chosen),generation=++comparisonReadGeneration.current;setBusy(true);inFlight.current=true;
    try{
      if(!comparisonReadCurrent(generation))return;
      const r=await fetch(endpoint(context.person.id,visit?.id),{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(20000),headers:{'x-saha-organisation':context.organisationId}});
      if(!comparisonReadCurrent(generation))return;
      if([401,403,404].includes(r.status)||r.headers.get('x-saha-operation-actor')!==boundActor.current){setHeldComparison(Boolean(comparisonMemory.current));clearProtected();setNotice('Access refused or account changed. Protected comparison cleared; local edits retained privately.');return;}
      if(!r.ok)throw Error();const current=await r.json()as RoutineContext;
      if(!comparisonReadCurrent(generation))return;
      if(!unchangedReviewCheckpoint(reviewed,current)){setConflictStale(true);setConflictChecked(false);setNotice('The saved record changed again. Compare a fresh version; your unsaved entries have not been replaced.');return;}
      receive(current,false);setFacts(merged);setReadChoice(previous=>({token:previous.token+1,kind:'load'}));setProgrammeRecovery(undefined);comparisonMemory.current=null;setHeldComparison(false);
      setNotice('Reviewed choices are still unsaved. Use Save observations explicitly to commit the current draft version.');heading.current?.focus();
    }catch{if(mounted.current&&generation===comparisonReadGeneration.current){setConflictStale(true);setConflictChecked(false);setNotice('Current comparison unavailable or context changed. Your entries remain unsaved; compare again before deciding.');}}
    finally{inFlight.current=false;if(mounted.current)setBusy(false);}
  };
  useEffect(()=>{
    const visibility=()=>{if(document.hidden)clearComparisonForBoundary();};
    window.addEventListener('offline',clearComparisonForBoundary);window.addEventListener('pagehide',clearComparisonForBoundary);document.addEventListener('visibilitychange',visibility);
    return()=>{window.removeEventListener('offline',clearComparisonForBoundary);window.removeEventListener('pagehide',clearComparisonForBoundary);document.removeEventListener('visibilitychange',visibility);};
  },[clearComparisonForBoundary]);
  const edit = !!visit && visit.state === 'draft' && !visit.voidedAt && !visit.supersededBy && !busy && !uncertain && (!latest || (!!review && !review.rows.some(row=>row.changed)));
  const setValue = (field: ValueField, value: string) => {invalidateComparisonForEdit();setFacts(previous => {
    if (!previous) return previous;
    const next = structuredClone(previous); next[field] = value;
    // An explicit edit in the labelled canonical unit replaces this field's old alternative entry.
    if (next.entered) delete next.entered[field];
    return next;
  });};
  const setProvenance = (measure: Measure, source: FactSource, at?: string) => {invalidateComparisonForEdit();setFacts(previous => !previous ? previous :
    { ...previous, provenance: { ...previous.provenance, [measure]: { source, ...(at ? { at } : {}) } } });};
  const problems = facts && visit ? captureProblems(facts, visit) : [];
  return <I18nProvider lang={displayLanguage}><main className="routine-visit" lang="en" aria-busy={busy}>
    <p>Saha · Synthetic / training</p><h1 ref={heading} tabIndex={-1}>Routine visit</h1>
    <p role="status">{notice}</p>
    {languageBinding && <InterfaceLanguage binding={languageBinding} onLanguage={setDisplayLanguage} onRefused={()=>{clearProtected();setNotice('Access refused. Protected content cleared.');}}/>}
    <TranslationNotice partial={true} untranslated={false}/>
    {context && <>
      <section aria-label="Selected person"><h2>{context.person.name}</h2><p>{context.person.village} · {context.person.id}</p>
        <p>{context.person.age} years · {context.person.sex} · Person version {context.person.version}</p>
        {visit && <p>Visit {visit.id} · version {visit.version} · {visit.voidedAt ? 'Voided encounter on server' : visit.supersededBy ? 'Superseded encounter on server' : visit.state === 'confirmed' ? 'Confirmed encounter on server' : 'Server draft; not confirmed'}. Destination: not submitted by this screen.</p>}
      </section>
      <RoutineSaveStatus visit={visit ?? null} dirty={dirty} busy={busy} uncertain={uncertain} lifecycle={context?.lifecycle}/>
      {visit && !visit.voidedAt && !visit.supersededBy && <a aria-disabled={busy || uncertain || dirty} href={'/disagreement-review?'+new URLSearchParams({organisationId:context.organisationId,personId:context.person.id,visitId:visit.id})} onClick={event => { if (busy || uncertain || dirty || inFlight.current || attempt.current) event.preventDefault(); }}>Review separate extraction results</a>}
      <ContextualAcademyPanel key={learning.status==='available'?learning.items.map(item=>item.id+':'+item.source.contentHash).join('|'):learning.reason} learning={learning}/>
      {!visit ? <button disabled={busy || uncertain} onClick={() => void send({ type: 'startVisit', personId: context.person.id }, 'Server draft started or resumed and read back.')}>Start or resume routine draft</button> : facts &&
      <div lang={displayLanguage}><GuidedCapture enabled={true} identity={context.person.name + ' · ' + context.person.id} problems={problems} help={{task:'routine-visit',actorRole:'asha'}}
        steps={[{id:'time',label:'Observation time'},...MEASURES.map(measure => ({id:factStep(measure),label:measure})),{id:'notes',label:'Visit notes'},{id:'review',label:'Review and save'}]}>
        <I18nProvider lang="en"><div lang="en"><CaptureStage id="time"><label>Visit observation time (UTC)<input type="datetime-local" disabled={!edit} value={facts.date} onChange={event => {invalidateComparisonForEdit();setFacts({...facts,date:event.target.value});}}/></label></CaptureStage>
        {MEASURES.map(measure => <CaptureStage key={measure} id={factStep(measure)}>
          {VALUE_FIELDS.filter(field => measureOf(field) === measure).map(field => <label key={field}>{VALUE_RANGES.fields[field].label} ({VALUE_RANGES.fields[field].unit})
            <input aria-label={VALUE_RANGES.fields[field].label + ' (' + VALUE_RANGES.fields[field].unit + ')'} inputMode="decimal" maxLength={12} disabled={!edit} value={facts[field]} onChange={event => setValue(field,event.target.value)}/>
            {facts.entered?.[field] && <small>Converted from {facts.entered[field]!.value} {alternativeUnit(field).label}; original entry retained until you explicitly edit this field.</small>}
            {!facts[field] && <small>Missing; never assumed normal.</small>}
          </label>)}
          <label>Source or missing reason: {measure}<select disabled={!edit} value={factProvenance(facts,measure).source} onChange={event => setProvenance(measure,event.target.value as FactSource,facts.provenance?.[measure]?.at)}>
            {FACT_SOURCES.map(source => <option key={source} value={source}>{SOURCE_LABEL[source]}</option>)}
          </select></label>
          <label>Observation time (UTC): {measure}<input type="datetime-local" disabled={!edit} value={facts.provenance?.[measure]?.at ?? facts.date} onChange={event => setProvenance(measure,factProvenance(facts,measure).source,event.target.value)}/></label>
          <p>Saved author: {authorText(visit.factAuthors?.[measure])}. Current entry is {JSON.stringify(facts) === JSON.stringify(visit.facts) ? 'saved same-visit evidence' : 'under review; corrections are unsaved'}.</p>
        </CaptureStage>)}
        <CaptureStage id="notes"><label>Visit notes<textarea maxLength={3000} disabled={!edit} value={facts.notes} onChange={event => {invalidateComparisonForEdit();setFacts({...facts,notes:event.target.value});}}/></label></CaptureStage>
        <ProgrammeQuestions visit={visit} busy={!edit} command={send} onDirty={onProgrammeDirty} savedReadChoice={readChoice}
          onDraftChange={onProgrammeDraft} unsavedRecovery={programmeRecovery}/>
        <CaptureStage id="review"><h2>Review current observations</h2><dl>{VALUE_FIELDS.map(field => <div key={field}><dt>{VALUE_RANGES.fields[field].label}</dt><dd>{facts[field] || 'Missing'} {facts[field] && VALUE_RANGES.fields[field].unit} · {facts[field] || facts.provenance?.[measureOf(field)!] ? factProvenance(facts,measureOf(field)!).source : 'Not recorded'} · {facts[field] ? factProvenance(facts,measureOf(field)!).at + ' UTC' : 'No recorded value'}</dd></div>)}</dl>
          <p>{facts.notes || 'No visit notes.'}</p><p>Pack versions: {visit.programmeCapture?.packs.map(p => p.pack.name+' v'+p.pack.version).join(' · ') || 'No captured programme pack'}</p>
          <button disabled={!edit || problems.length > 0} onClick={() => void send({type:'saveVisit',visitId:visit.id,version:visit.version,facts})}>Save observations as server draft</button>
          {visit.state === 'draft' && <><label><input type="checkbox" disabled={!edit || dirty} checked={checked} onChange={event => setChecked(event.target.checked)}/>I checked {context.person.name} · {context.person.id} for this visit.</label>
            <button disabled={!edit || dirty || !checked} onClick={() => void send({type:'confirmVisit',visitId:visit.id,version:visit.version,patientCheck:{personId:context.person.id,personVersion:context.person.version,confirmed:true}},'Confirmed encounter saved and read back. Destination remains not submitted.')}>Confirm checked visit</button></>}
        </CaptureStage>
        </div></I18nProvider>
      </GuidedCapture></div>}
      {visit && <button disabled={busy} onClick={() => void compare()}>Compare latest saved record</button>}
      {latest && <section aria-label="Saved record comparison"><h2>Saved version {latest.visit?.version}</h2><p>Your version {visit?.version}; unsaved entries remain in the editor.</p><pre>{JSON.stringify(latest.visit?.facts,null,2)}</pre>
        {review&&<section aria-label="Observation conflict review"><h3>Review each changed observation group</h3><p>Original version {review.base.visit?.version}; current saved version {review.current.visit?.version}. Choices stay unsaved. Values, paired blood pressure, source/time, units and unusual-value reasons remain together.</p>
          {review.rows.filter(row=>row.changed).map(row=><fieldset key={row.id}><legend>{row.label}{row.collision?' · conflicting edits':''}</legend><dl><dt>Originally loaded</dt><dd><pre>{conflictGroupText(row.id,review.base.visit!.facts)}</pre></dd><dt>My unsaved edit</dt><dd><pre>{conflictGroupText(row.id,review.local)}</pre></dd><dt>Current saved observation</dt><dd><pre>{conflictGroupText(row.id,review.current.visit!.facts)}</pre></dd></dl><label>Review {row.label}<select disabled={busy||uncertain||conflictStale} value={conflictChoices[row.id]??''} onChange={e=>{setConflictChoices({...conflictChoices,[row.id]:e.target.value as ConflictChoice});setConflictChecked(false);}}><option value="">Choose explicitly</option><option value="local">Keep my unsaved observation group</option><option value="saved">Use the current saved observation group</option></select></label></fieldset>)}
          {(programmeDirty||comparisonProgrammeDirty)&&<p role="alert">Programme answers remain staged. This observation-only comparison cannot adopt while programme edits are unsaved; cancel the comparison to keep working or use the existing explicit whole-record replacement.</p>}
          {reviewProblem&&<p>{reviewProblem}</p>}<label><input type="checkbox" disabled={!chosen||busy||uncertain||conflictStale||programmeDirty||comparisonProgrammeDirty} checked={conflictChecked} onChange={e=>setConflictChecked(e.target.checked)}/>I reviewed the original, unsaved and current saved observation groups.</label>
          <button disabled={!chosen||!conflictChecked||busy||uncertain||conflictStale||programmeDirty||comparisonProgrammeDirty} onClick={()=>void adoptReviewed()}>Adopt reviewed choices without saving</button>
        </section>}{!review&&reviewProblem&&<p role="alert">{reviewProblem}</p>}
        <button disabled={busy} onClick={()=>{invalidateComparisonForEdit();setNotice('Comparison cancelled. Your entries are unchanged and remain unsaved.');}}>Cancel comparison and keep my edits</button>
        <button disabled={busy || uncertain} onClick={() => { if (inFlight.current || attempt.current) return;
          receive(latest,true);comparisonMemory.current=null;setHeldComparison(false); setReadChoice(previous => ({token:previous.token+1,kind:'load'}));
          setProgrammeRecovery(undefined);
          setNotice('Explicitly replaced entries with the saved record.'); }}>Replace unsaved entries with saved record</button></section>}
    </>}
    {heldComparison&&!context&&<section aria-label="Private comparison recovery"><p>Original edits are retained only in this screen’s memory. Fresh access from the original account is required; nothing is resent or saved.</p><button disabled={busy||uncertain} onClick={()=>void recoverComparison()}>Recover original comparison</button></section>}
    {uncertain && <section aria-label="Unresolved write attempt">
      <p>The original attempt remains unresolved. Use the original account and restored access to check it before starting another write. This recovery is kept only while this screen stays open.</p>
      <button disabled={busy} onClick={() => attempt.current && void send(attempt.current.command,'Exact operation reconciled and read back.',true)}>Check exact write attempt</button>
    </section>}
    <a href="/today">Back to Today</a><p>Entries on this screen are not a durable local save. This connected flow needs the server; prepared encrypted offline work is a separate journey.</p>
  </main></I18nProvider>;
}
