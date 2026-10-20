import { z } from 'zod';
import { digest, fail, uuid } from './core';

const identifier = z.string().trim().min(1).max(200);
const explanation = z.string().trim().min(10).max(1000);
const unique = (values: string[]) => new Set(values).size === values.length;

export const compositionDraftSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]{2,60}$/),
  title: identifier,
  teamIds: z.array(identifier).min(1).max(20).refine(unique),
  intendedUse: explanation,
  permittedData: z.array(identifier).min(1).max(30).refine(unique),
  tools: z.array(z.object({
    capabilityId: identifier,
    capabilityVersion: z.number().int().positive(),
    manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict()).min(2).max(10).refine(rows => unique(rows.map(row => row.capabilityId))),
  interactionReview: explanation,
  missingInputRules: z.array(z.object({ input: identifier, response: explanation }).strict()).min(1).max(30),
  disagreementRule: explanation,
  conflictScenarios: z.array(z.object({ id: identifier, description: explanation, expected: explanation, passed: z.boolean() }).strict()).min(1).max(30).refine(rows => unique(rows.map(row => row.id))),
}).strict();

export type CompositionDraft = z.infer<typeof compositionDraftSchema>;
export type CompositionReview = {
  id: string;
  version: number;
  manifestHash: string;
  draft: CompositionDraft;
  createdBy: string;
  createdAt: string;
  state: 'draft' | 'reviewed' | 'suspended';
  review?: { by: string; at: string; reference: string; findings: string; authorVersion: number; reviewerVersion: number };
};
export type CompositionActor = { userId: string; role: string; status: string; version: number; teamIds: string[] };
export type CurrentCapability = { id: string; version: number; manifestHash: string; state: 'active' | 'suspended' | 'retired' };
export type CompositionDecision = {
  compositionId: string;
  compositionVersion: number;
  manifestHash: string;
  available: true;
  inputHash: string;
};

function clinicalLead(actor: CompositionActor, teams: string[]) {
  if (actor.status !== 'active' || actor.role !== 'clinician' || !teams.every(team => actor.teamIds.includes(team))) {
    fail(403, 'An active clinical safety reviewer covering every composition team is required.');
  }
}

export async function createCompositionReview(input: unknown, author: CompositionActor, now = new Date().toISOString()): Promise<CompositionReview> {
  const parsed = compositionDraftSchema.safeParse(input);
  if (!parsed.success) fail(422, 'Record the exact tools, interaction review, missing-input rules and conflict scenarios.');
  const draft = parsed.data;
  clinicalLead(author, draft.teamIds);
  return { id: uuid(), version: 1, manifestHash: await digest(draft), draft, createdBy: author.userId, createdAt: now, state: 'draft' };
}

export function reviewComposition(review: CompositionReview, expectedVersion: number, reviewer: CompositionActor, reference: string, findings: string, now = new Date().toISOString()) {
  if (review.version !== expectedVersion) fail(409, 'The composition changed. Review the current version.');
  if (review.state !== 'draft') fail(409, 'Only a current draft composition can be reviewed.');
  clinicalLead(reviewer, review.draft.teamIds);
  if (review.createdBy === reviewer.userId) fail(403, 'A different clinical safety reviewer must review the composition.');
  if (reference.trim().length < 3 || findings.trim().length < 10) fail(422, 'Record the review reference and findings.');
  if (review.draft.conflictScenarios.some(scenario => !scenario.passed)) fail(409, 'Every declared conflict scenario must pass before this composition is available.');
  review.review = { by: reviewer.userId, at: now, reference: reference.trim(), findings: findings.trim(), authorVersion: expectedVersion, reviewerVersion: reviewer.version };
  review.state = 'reviewed';
  review.version++;
}

export function suspendComposition(review: CompositionReview, expectedVersion: number) {
  if (review.version !== expectedVersion) fail(409, 'The composition changed. Refresh before suspending it.');
  review.state = 'suspended';
  review.version++;
}

export async function compositionDecision(
  review: CompositionReview | undefined,
  capabilities: CurrentCapability[],
  inputs: Record<string, unknown>,
  actor: CompositionActor,
): Promise<CompositionDecision> {
  if (!review || review.state !== 'reviewed' || !review.review) fail(409, 'This exact combined workflow has no current independent composition review.');
  clinicalLead(actor, review.draft.teamIds);
  if (review.review.reviewerVersion !== actor.version || review.review.by !== actor.userId) fail(409, 'The accountable composition reviewer changed. Re-review this composition.');
  for (const bound of review.draft.tools) {
    const current = capabilities.find(capability => capability.id === bound.capabilityId);
    if (!current || current.state !== 'active' || current.version !== bound.capabilityVersion || current.manifestHash !== bound.manifestHash) {
      fail(409, 'A tool approval changed or is unavailable. Review the joint composition again.');
    }
  }
  const declared = new Set(review.draft.missingInputRules.map(rule => rule.input));
  for (const input of review.draft.permittedData) {
    if (!(input in inputs) || inputs[input] === null || inputs[input] === undefined || inputs[input] === '') {
      if (!declared.has(input)) fail(409, 'A required input is missing without a reviewed handling rule.');
    }
  }
  return { compositionId: review.id, compositionVersion: review.version, manifestHash: review.manifestHash, available: true, inputHash: await digest(inputs) };
}
