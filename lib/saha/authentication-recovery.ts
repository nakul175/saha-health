import { z } from 'zod';
import { fail, uuid } from './core';
import type { Principal } from './identity';

export const recoverySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('begin'), authority: z.literal('institutional-identity'), reason: z.string().trim().min(10).max(500) }),
  z.object({ action: z.literal('complete'), recoveryId: z.string().uuid() }),
]);

export type RecoveryRecord = {
  id: string;
  userId: string;
  state: 'revoked-pending-activation' | 'active';
  revokedBefore: number;
  replacementCredentialId?: string;
  createdAt: string;
  completedAt?: string;
  reason: string;
};

export function requireVerifiedMfa(principal: Principal) {
  if (principal.provider !== 'cloudflare-access' || !principal.authentication?.mfa || principal.authentication.issuedAt < 1)
    fail(403, 'Identity-verified recovery requires the approved institutional sign-in and its second factor.');
  return principal.authentication;
}

export function beginRecovery(principal: Principal, reason: string, now = Date.now()): RecoveryRecord {
  requireVerifiedMfa(principal);
  return {
    id: uuid(), userId: principal.userId, state: 'revoked-pending-activation',
    revokedBefore: Math.floor(now / 1000), createdAt: new Date(now).toISOString(), reason,
  };
}

export function completeRecovery(principal: Principal, record: RecoveryRecord, now = Date.now()): RecoveryRecord {
  const auth = requireVerifiedMfa(principal);
  if (record.userId !== principal.userId) fail(403, 'This recovery belongs to another institutional identity.');
  if (record.state !== 'revoked-pending-activation') fail(409, 'This recovery is no longer awaiting activation.');
  if (auth.issuedAt <= record.revokedBefore) fail(403, 'Sign in again with the required factor after superseded credentials were revoked.');
  return { ...record, state: 'active', replacementCredentialId: auth.credentialId, completedAt: new Date(now).toISOString() };
}

export function credentialIsCurrent(principal: Principal, revokedBefore: number) {
  return principal.provider !== 'cloudflare-access' || !!principal.authentication && principal.authentication.issuedAt > revokedBefore;
}
