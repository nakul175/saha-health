import http from 'k6/http';
import { check } from 'k6';
const base = __ENV.SAHA_BRIDGE_BASE;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base ?? '')) throw new Error('This reporting smoke permits synthetic loopback only');
export const options = { vus: 2, iterations: 20, maxDuration: '15s', thresholds: { checks: ['rate==1'], http_req_failed: ['rate==0'] } };
export default function () {
  const response = http.get(base + '/bridge-fixture', { tags: { scenario_id: 'SCN-TC-NFR-01-A', run_scope: 'bridge_smoke' }, redirects: 0 });
  check(response, { 'synthetic bridge returns 204': r => r.status === 204 });
}
export function handleSummary(data) { return { [__ENV.SAHA_K6_RAW_OUTPUT]: JSON.stringify(data, null, 2) }; }
