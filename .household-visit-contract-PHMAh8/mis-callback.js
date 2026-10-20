import { z } from 'zod';
import { fail } from './core.js';
import { misCredential, receiptSchema } from './mis.js';
export const callbackSchema = z.object({ organisationId: z.string().min(1).max(200), integrationId: z.string().min(1).max(200), submissionId: z.string().min(1).max(200), receipt: receiptSchema }).strict();
export async function verifyMisSignature(raw, timestamp, signature, secret, now = Date.now()) {
    if (!/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300000 || !/^[a-f0-9]{64}$/.test(signature))
        fail(401, 'Invalid or expired callback signature.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = Uint8Array.from(signature.match(/../g), x => parseInt(x, 16));
    if (!await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(timestamp + '.' + raw)))
        fail(401, 'Invalid callback signature.');
}
// Slice 6u (fourth review): the callback is authenticated before any organisation data is read. The server grant
// (configuration, not the database) names the callback secret; the signature is verified with it; only then is the
// one integration row loaded and checked against the grant. Every failure here (external services disabled, no
// grant, missing secret, bad or expired signature, unknown organisation or connection, changed route) gives the same
// 401 answer, so an unsigned caller learns nothing about which organisations or connections exist.
export const CALLBACK_REFUSED = 'Callback not accepted.';
export async function authenticateCallback(raw, body, timestamp, signature, env, loadIntegration, now = Date.now()) {
    try {
        if (env.SAHA_EXTERNAL_APIS_ENABLED !== 'true')
            throw new Error('disabled');
        const grants = JSON.parse(env.SAHA_MIS_CONNECTIONS ?? '[]');
        if (!Array.isArray(grants))
            throw new Error('grants');
        const grant = grants.find((g) => g && g.organisationId === body.organisationId && g.integrationId === body.integrationId), binding = grant?.callbackBinding;
        if (typeof binding !== 'string' || !/^SAHA_MIS_[A-Z0-9_]+$/.test(binding) || !env[binding])
            throw new Error('grant');
        await verifyMisSignature(raw, timestamp, signature, env[binding], now);
        const i = await loadIntegration(body.organisationId, body.integrationId);
        if (!i || i.id !== body.integrationId || i.kind !== 'mis' || i.mode !== 'http')
            throw new Error('connection');
        if (misCredential(i, body.organisationId, env, true) !== env[binding])
            throw new Error('binding');
        return i;
    }
    catch {
        return fail(401, CALLBACK_REFUSED);
    }
}
