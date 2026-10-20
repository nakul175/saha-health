// Slice 0c: swappable identity layer.
//
// Authorization code consumes a Principal and never reads provider headers directly. Exactly one
// provider is trusted per deployment, chosen by SAHA_IDENTITY_PROVIDER:
//   sites-chatgpt      (default) the Sites dispatcher's authenticated-user headers, as in R11
//   cloudflare-access  a Cloudflare Access application in front of the Worker; the signed
//                      Cf-Access-Jwt-Assertion is verified against the team's published keys,
//                      so any identity provider Access supports (institutional SAML/OIDC) works
// Headers of a provider that is not selected are ignored, so a deployment behind Access cannot be
// impersonated with Sites headers and vice versa. Account IDs are namespaced per provider except
// for sites-chatgpt, which keeps the R11 IDs; moving providers therefore needs members re-invited.
export function identityConfig(e) {
    const provider = String(e.SAHA_IDENTITY_PROVIDER ?? '').trim() || 'sites-chatgpt';
    if (provider === 'sites-chatgpt')
        return { provider };
    if (provider !== 'cloudflare-access')
        return { provider: 'cloudflare-access', error: 'Unknown SAHA_IDENTITY_PROVIDER.' };
    const teamDomain = String(e.SAHA_ACCESS_TEAM_DOMAIN ?? '').trim().toLowerCase(), audience = String(e.SAHA_ACCESS_AUD ?? '').trim();
    if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(teamDomain))
        return { provider, error: 'SAHA_ACCESS_TEAM_DOMAIN must be <team>.cloudflareaccess.com.' };
    if (!/^[a-f0-9]{32,128}$/.test(audience))
        return { provider, error: 'SAHA_ACCESS_AUD must be the Access application audience tag.' };
    return { provider, teamDomain, audience };
}
export function signOutPath(config) {
    return config.provider === 'cloudflare-access' && config.teamDomain ? `https://${config.teamDomain}/cdn-cgi/access/logout` : '/signout-with-chatgpt?return_to=%2F';
}
export const RESERVED_IDENTITY = (userId) => userId.startsWith('fixture:') || userId === 'system' || userId.startsWith('system:');
export function sitesPrincipal(h) {
    const userId = h.get('oai-authenticated-user-id'), email = h.get('oai-authenticated-user-email');
    // Slice 9a: ids beginning `fixture:` are reserved for synthetic demonstration fixture members (lib/saha/demonstration.ts);
    // no one can sign in as one. Cloudflare Access ids always begin `access:`. Slice 13d (round-10 review L3): `system` and ids
    // beginning `system:` are reserved too: automated audit rows use them (the scheduled job, caseload scheduler and
    // notification simulator), so no one can sign in under, or be mistaken for, an automated actor.
    if (!userId || !email || RESERVED_IDENTITY(userId))
        return null;
    const encoded = h.get('oai-authenticated-user-full-name');
    let fullName = null;
    if (encoded && h.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
        try {
            fullName = decodeURIComponent(encoded);
        }
        catch {
            fullName = null;
        }
    }
    return { userId, displayName: fullName ?? email, email, fullName, provider: 'sites-chatgpt' };
}
const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
const json = (s) => JSON.parse(new TextDecoder().decode(b64url(s)));
const jwksCache = new Map();
const JWKS_TTL_MS = 10 * 60 * 1000, SKEW_S = 60;
async function jwks(teamDomain, deps, force = false) {
    const cached = jwksCache.get(teamDomain), now = (deps.now ?? Date.now)();
    if (!force && cached && now - cached.fetchedAt < JWKS_TTL_MS)
        return cached.keys;
    // Slice 11d: workerd (and so Cloudflare Workers) throws a TypeError for the redirect mode 'error', which made every key fetch fail and every Access sign-in 401.
    // The 'manual' mode returns a redirect as an unfollowed 3xx, which `response.ok` below refuses, so a redirect is still never followed or trusted.
    const response = await (deps.fetch ?? fetch)(`https://${teamDomain}/cdn-cgi/access/certs`, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    if (!response.ok)
        throw new Error('Access keys unavailable');
    const body = await response.json();
    if (!Array.isArray(body.keys))
        throw new Error('Access keys malformed');
    jwksCache.set(teamDomain, { keys: body.keys, fetchedAt: now });
    return body.keys;
}
// Returns the verified principal, or null for any missing, malformed, unsigned, expired,
// wrong-audience or wrong-issuer token. Key-fetch failure also yields null (fail closed).
export async function accessPrincipal(h, config, deps = {}) {
    if (config.provider !== 'cloudflare-access' || config.error || !config.teamDomain || !config.audience)
        return null;
    const token = h.get('cf-access-jwt-assertion');
    if (!token || token.length > 8192)
        return null;
    const parts = token.split('.');
    if (parts.length !== 3)
        return null;
    try {
        const header = json(parts[0]), claims = json(parts[1]);
        if (header.alg !== 'RS256' || typeof header.kid !== 'string')
            return null;
        let keys = await jwks(config.teamDomain, deps), jwk = keys.find(k => k.kid === header.kid);
        if (!jwk) {
            keys = await jwks(config.teamDomain, deps, true);
            jwk = keys.find(k => k.kid === header.kid);
        }
        if (!jwk)
            return null;
        const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
        const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
        if (!valid)
            return null;
        const now = Math.floor((deps.now ?? Date.now)() / 1000), aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
        if (claims.iss !== `https://${config.teamDomain}` || !aud.includes(config.audience))
            return null;
        // JSON exponent overflow is a number (Infinity) in JavaScript. A signed but malformed
        // validity claim must not bypass expiry or activation by failing its comparison.
        if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp + SKEW_S < now)
            return null;
        if (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || !Number.isFinite(claims.nbf) || claims.nbf - SKEW_S > now))
            return null;
        if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string' || !claims.email.includes('@'))
            return null;
        const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 200) : null;
        const amr = Array.isArray(claims.amr) ? claims.amr.filter((x) => typeof x === 'string') : [];
        const issuedAt = typeof claims.iat === 'number' && Number.isFinite(claims.iat) ? Math.floor(claims.iat) : 0;
        const credentialId = typeof claims.jti === 'string' && claims.jti.trim() ? claims.jti.trim().slice(0, 200) : `${claims.sub}:${issuedAt}`;
        return {
            userId: `access:${claims.sub}`,
            displayName: name ?? claims.email,
            email: claims.email,
            fullName: name,
            provider: 'cloudflare-access',
            authentication: { mfa: amr.includes('mfa'), issuedAt, credentialId },
        };
    }
    catch {
        return null;
    }
}
export async function principalFromHeaders(h, config, deps = {}) {
    if (config.error)
        return null;
    return config.provider === 'sites-chatgpt' ? sitesPrincipal(h) : accessPrincipal(h, config, deps);
}
export function clearAccessKeyCache() { jwksCache.clear(); }
// A service identity is usable only while active and before its expiry.
export function serviceIdentityIsValid(si, now = Date.now()) {
    const nowMs = typeof now === 'number' ? now : Date.parse(now);
    const expiresMs = Date.parse(si.expiresAt);
    return si.status === 'active' && Number.isFinite(expiresMs) && expiresMs > nowMs;
}
