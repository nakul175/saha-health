import { z } from 'zod';
import { matchInput } from './continuity';

const id = z.string().regex(/^[A-Za-z0-9_:.-]{1,120}$/);
const version = z.number().int().positive();
export const matchingOperation = z.discriminatedUnion('type', [
  z.object({ type: z.literal('search'), query: matchInput }).strict(),
  z.object({ type: z.literal('select'), query: matchInput, hash: z.string().regex(/^[a-f0-9]{64}$/), personId: id, version }).strict(),
]);
export const matchingSetup = z.object({ organisationId: id, actorId: id, teams: z.array(z.object({ id, name: z.string().min(1) }).strict()) }).strict();
const identityState=z.enum(['local','provisional','resolved','not-recorded']);
const candidate = z.object({ id, name: z.string().min(1), age: z.number().int().min(0).max(120), sex: z.enum(['Female','Male','Other','Unknown']), village: z.string().min(1), version, identityState, match: z.enum(['Same normalised name','Similar name, locality and age']) }).strict();
export const matchingResponse = z.object({
  organisationId: id, actorId: id, hash: z.string().regex(/^[a-f0-9]{64}$/), candidates: z.array(candidate).max(20), overflow: z.boolean(), scope: z.string().min(1),
  selected: z.object({ id, name: z.string().min(1), age: z.number().int().min(0).max(120), sex: z.enum(['Female','Male','Other','Unknown']), village: z.string().min(1), version, identityState }).strict().nullable(),
}).strict().superRefine((r,c)=>{
  if(new Set(r.candidates.map(p=>p.id)).size!==r.candidates.length)c.addIssue({code:'custom',message:'Duplicate candidate identifiers.'});
  if(r.selected && (r.overflow || !r.candidates.some(p=>p.id===r.selected!.id&&p.version===r.selected!.version&&p.name===r.selected!.name&&p.age===r.selected!.age&&p.sex===r.selected!.sex&&p.village===r.selected!.village&&p.identityState===r.selected!.identityState)))c.addIssue({code:'custom',message:'Selected record no longer matches its candidate.'});
});
export type MatchingResult = z.infer<typeof matchingResponse>;
export type MatchingQuery = z.infer<typeof matchInput>;
export function selectionIntent(r: MatchingResult, query: MatchingQuery, personId: string, affirmed: boolean) {
  const c=r.candidates.find(p=>p.id===personId);
  return !r.overflow&&affirmed&&c ? matchingOperation.parse({type:'select',query,hash:r.hash,personId:c.id,version:c.version}) : null;
}
