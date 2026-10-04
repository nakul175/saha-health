// Slice 13a: refuse API requests that another website started, reads included.
//
// Saha's API is used only by its own pages and by a few server-to-server callers that authenticate themselves.
// A browser marks a request another site started with `Sec-Fetch-Site: cross-site` (or `same-site` for another
// subdomain of the same registrable domain) and, on cross-origin requests, an `Origin` that is not ours. Such a
// request is refused here, before identity or any data is read, so that even if a proxy in front of the Worker
// (Cloudflare Access was seen reflecting a foreign Origin with credentials allowed, 3 October 2026) adds CORS
// headers, another site can read only this refusal. Changes were already refused cross-site (server.ts
// parseRequest); this extends the rule to every method under /api/.
//
// Server-to-server endpoints that authenticate with their own signature or credential, not with the sign-in
// cookie, are exempt: a browser never needs to call them, and their own checks stand.
export const CROSS_SITE_EXEMPT = new Set(['/api/mis/callback', '/api/anaemia-connection-test', '/api/frontline-connection-test']);

export function crossSiteReason(request: Request): string | null {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/') || CROSS_SITE_EXEMPT.has(url.pathname)) return null;
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site' || site === 'same-site') return `Sec-Fetch-Site ${site}`;
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== url.origin) return 'foreign Origin';
  return null;
}

// The refused request's body is drained (bounded) and cancelled first, as lib/saha/monitoring.ts measured() does: an unread
// body on a reused local connection surfaces as a 'worker restarted mid-request' 503 on the next request.
export async function crossSiteRefusal(request: Request): Promise<Response | null> {
  if (!crossSiteReason(request)) return null;
  if (request.body && !request.bodyUsed) { try { const reader = request.body.getReader(); let read = 0; while (read < 262144) { const { done, value } = await reader.read(); if (done) break; read += value?.length ?? 0; } await reader.cancel(); } catch { /* already closed */ } }
  return new Response(JSON.stringify({ error: 'Requests started by another website are not allowed.' }), {
    status: 403,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', vary: 'Origin, Sec-Fetch-Site' },
  });
}
