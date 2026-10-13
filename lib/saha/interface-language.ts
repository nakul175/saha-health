import { z } from 'zod';
import { languageOf, type LanguageRecord } from './messages';
const ref = z.string().min(1).max(200);
export const interfaceLanguageContext = z.object({ actorId: ref, organisationId: ref, personId: ref,
  language: z.enum(['en', 'hi']), version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  refreshAt: z.string().datetime().nullable() }).strict();
export type InterfaceLanguageContext = z.infer<typeof interfaceLanguageContext>;
export const interfaceLanguageChange = z.object({ language: z.enum(['en','hi']), version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict();
export const interfaceLanguageReceipt = z.object({ context: interfaceLanguageContext, operation: z.object({
  key: z.string().uuid(), language: z.enum(['en','hi']), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), replayed: z.boolean()
}).strict() }).strict().refine(value=>value.context.version>=value.operation.version&&(value.context.version>value.operation.version||value.context.language===value.operation.language),'Current preference does not agree with this receipt.');
export const interfaceLanguageRefusal = z.object({ outcome: z.literal('request-not-dispatched'), key: z.string().uuid(),
  actorId: ref, organisationId: ref, personId: ref, language: z.enum(['en','hi']), version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict();
// The original English default is preserved for an absent own record. Malformed
// stored choices are unavailable, not an invented preference or approved language.
export function currentInterfaceLanguage(source: unknown, actorId: string) {
  if (source !== undefined && (typeof source !== 'object' || source === null || Array.isArray(source)))
    throw Error('Current language choice is unavailable.');
  const records = (source ?? {}) as Record<string, LanguageRecord>;
  if (Object.prototype.hasOwnProperty.call(records, actorId)) {
    const record = z.object({language: z.enum(['en','hi']), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), at: z.string().datetime()}).strict().safeParse(records[actorId]);
    if (!record.success || new Date(record.data.at).toISOString() !== record.data.at) throw Error('Current language choice is unavailable.');
  }
  return languageOf(records, actorId);
}
export const sameLanguageBinding = (context: Pick<InterfaceLanguageContext,'actorId'|'organisationId'|'personId'>, binding: Pick<InterfaceLanguageContext,'actorId'|'organisationId'|'personId'>) =>
  context.actorId === binding.actorId && context.organisationId === binding.organisationId && context.personId === binding.personId;
