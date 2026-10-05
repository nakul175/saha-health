import {z} from 'zod';
import {digest,fail,uuid} from './core';
import {allowed} from './access';
import {contactWithdrawalItems,recordConsent} from './consent';
import {environmentOf} from './environment';
import {verifyMisSignature} from './mis-callback';
import type {Actor} from './store';
import type {Member,OrgState} from './types';
import type {ContactPreferences} from './outreach';

// R77: mock provider callbacks can only withdraw automated contact. They cannot grant consent or send messages.
export const optoutSchema=z.object({provider:z.literal('mock-reminder'),organisationId:z.string().min(1).max(200),eventId:z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),destination:z.string().regex(/^TEST-[A-Z0-9-]{3,30}$/),preferenceVersion:z.number().int().positive(),occurredAt:z.string().datetime(),action:z.literal('STOP')}).strict();
export type ReminderOptout=z.infer<typeof optoutSchema>;
export type ReminderOptoutEvidence={eventId:string;receipt:string;receivedAt:string;occurredAt:string;source:'signed-mock-callback'|'staff-mock-simulation';before:ContactPreferences;after:ContactPreferences;cancelled:string[];consentEventId:string};
export const OPTOUT_REFUSED='Mock opt-out callback not accepted.';
export function requireMockEnvironment(env:Record<string,string|undefined>){if(!['synthetic','training'].includes(environmentOf(env).name))fail(409,'Mock reminder opt-out is available only in synthetic or training environments.');}
export async function authenticateOptout(raw:string,body:ReminderOptout,timestamp:string,signature:string,env:Record<string,string|undefined>,now=Date.now()){
 try{
  requireMockEnvironment(env);
  if(env.SAHA_REMINDER_MOCK_CALLBACK_ENABLED!=='true')throw Error('disabled');
  const grants=JSON.parse(env.SAHA_REMINDER_MOCK_CALLBACK_GRANTS??'[]');
  if(!Array.isArray(grants))throw Error('grants');
  const grant=grants.find((g:any)=>g?.organisationId===body.organisationId&&g?.provider==='mock-reminder');
  if(!grant||typeof grant.secretBinding!=='string'||!/^SAHA_REMINDER_MOCK_[A-Z0-9_]+$/.test(grant.secretBinding))throw Error('grant');
  const secret=env[grant.secretBinding];if(!secret||secret.length<32)throw Error('secret');
  await verifyMisSignature(raw,timestamp,signature,secret,now);
 }catch{fail(401,OPTOUT_REFUSED);}
}
export function resolveOptout(s:OrgState,e:ReminderOptout,m?:Member){
 if(e.organisationId!==s.organisation.id)fail(409,'The opt-out belongs to another organisation.');
 const matches=s.workspace.people.filter(p=>p.contactPreferences?.destination===e.destination);
 // Never choose one of two people sharing a contact, or redirect a former contact after a reassignment.
 if(matches.length!==1)fail(409,'Synthetic contact cannot be resolved uniquely. Reconcile the contact before retrying.');
 const p=matches[0];
 if(m&&(!['asha','clinician','supervisor'].includes(m.role)||m.status!=='active'||!allowed(m,p)))fail(403,'Care-team access to this patient is required.');
 if(p.mergedInto)fail(409,'Merged records require contact reconciliation.');
 return p;
}
export async function eventIdentity(e:ReminderOptout){return {key:'reminder_optout_'+await digest({organisationId:e.organisationId,provider:e.provider,eventId:e.eventId}),hash:await digest(e)};}
export function applyReminderOptout(s:OrgState,e:ReminderOptout,u:Actor,source:ReminderOptoutEvidence['source'],m?:Member,now=new Date().toISOString()){
 const p=resolveOptout(s,e,m),c=p.contactPreferences!;
 const at=Date.parse(e.occurredAt),received=Date.parse(now);
 if(!Number.isFinite(at)||at>received+300000||at<received-86400000)fail(409,'Opt-out event is stale or future-dated. Reconcile the provider event.');
 if(c.version!==e.preferenceVersion||at<Date.parse(c.updatedAt))fail(409,'Contact preferences changed since this event. Reconcile before retrying.');
 if(c.method!=='sms')fail(409,'The event does not match an SMS reminder contact.');
 if((p.reminderOptouts??[]).length>=100)fail(409,'Mock opt-out evidence limit reached; retain evidence and reconcile.');
 const before=structuredClone(c),reason='Authenticated synthetic reminder STOP event.';
 c.permission=false;c.version++;c.updatedAt=now;c.by=u.userId;p.version++;
 const items=contactWithdrawalItems(s,p,now,reason),receipt='SIM-OPTOUT-'+uuid();
 const consent=recordConsent(p,{purpose:'contact',action:'withdrawn',at:now,by:u.userId,byName:u.displayName,role:m?.role??'provider',channel:'contact-preferences',reference:receipt,reason,fromVersion:before.version,toVersion:c.version,items});
 const cancelled=items.filter(i=>i.disposition==='stopped').map(i=>i.ref);
 (p.reminderOptouts??=[]).push({eventId:e.eventId,receipt,receivedAt:now,occurredAt:e.occurredAt,source,before,after:structuredClone(c),cancelled,consentEventId:consent.id});
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m?.role??'provider',action:'reminderOptout',subject:p.id,personId:p.id,detail:`Authenticated mock STOP recorded; ${cancelled.length} unsent reminders cancelled. Terminal receipts retained. No real message sent. Event ${e.eventId}; receipt ${receipt}.`});
 return {ok:true,receipt,eventId:e.eventId,cancelled:cancelled.length,realMessageSent:false,preferenceVersion:c.version};
}
