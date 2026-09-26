import { z } from 'zod';
import { fail } from './core';
import { receiptSchema } from './mis';
export const callbackSchema=z.object({organisationId:z.string().min(1).max(200),integrationId:z.string().min(1).max(200),submissionId:z.string().min(1).max(200),receipt:receiptSchema}).strict();
export async function verifyMisSignature(raw:string,timestamp:string,signature:string,secret:string,now=Date.now()){
 if(!/^\d{13}$/.test(timestamp)||Math.abs(now-Number(timestamp))>300000||!/^[a-f0-9]{64}$/.test(signature))fail(401,'Invalid or expired callback signature.');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const sig=Uint8Array.from(signature.match(/../g)!,x=>parseInt(x,16));if(!await crypto.subtle.verify('HMAC',key,sig,new TextEncoder().encode(timestamp+'.'+raw)))fail(401,'Invalid callback signature.');
}
