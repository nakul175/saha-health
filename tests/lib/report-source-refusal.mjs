// Current NFR fixture classification only; production reporting remains unchanged.
// A refused GET can be refreshed, but an arbitrary conflict is never accepted.
export const REPORT_SOURCE_CHANGED = 'Reporting authority or source changed while the report was released. Refresh before viewing it.';
export const REPORT_SOURCE_RETRIES = 4; // Additional attempts; exhaustion still fails the workload.

export function reportSourceRefusal(response, path, method = 'GET') {
  if (method !== 'GET' || path !== '/api/operations' || response?.status !== 409 ||
      typeof response.headers?.get !== 'function' ||
      response.headers?.get('cache-control') !== 'no-store') return false;
  const body = response.json;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !Object.hasOwn(body, 'error') ||
      body.error !== REPORT_SOURCE_CHANGED) return false;
  // Match the captured native body bytes too. JSON.parse alone would conceal
  // a duplicated key whose earlier value contained protected response data.
  return response.text === JSON.stringify({ error: REPORT_SOURCE_CHANGED });
}
