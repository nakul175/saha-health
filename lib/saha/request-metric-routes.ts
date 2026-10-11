// General operational telemetry accepts fixed route labels, never request paths
// or caller-provided identifiers/content. Keep unexpected calls observable with
// one fixed label without retaining or coercing their input.
const routes = [
  'clinical-sources', 'device-work', 'reconciliation', 'frontline-providers',
  'frontline-assessments', 'frontline-connection-test', 'anaemia-provider',
  'anaemia-screenings', 'workforce-import', 'incentive-claims', 'identifier-search',
  'trace', 'record-opened', 'aggregate-reports', 'alerts', 'notification-channel',
  'record-import', 'import-rejections', 'household', 'value-range-protocols',
  'pack-installations', 'referral-requests', 'patients', 'patient-detail', 'worklists',
  'delegations', 'worker-activity', 'action-plan', 'exceptions', 'reassignment',
  'caseload', 'identity-cases', 'exceptional', 'rights', 'retention', 'indicators',
  'referral-escalations', 'roster', 'abdm', 'media', 'governance', 'provider-sandbox',
  'patient-matches', 'continuity', 'workspace', 'commands', 'operations', 'pilot',
  'outreach', 'expansion', 'history', 'audit', 'audit-chain', 'data-exit', 'environment',
  'fixture-migration', 'programme-migration', 'patient-import', 'facility-scope',
  'purpose-scope', 'fhir',
] as const;

export type RequestMetricRoute = typeof routes[number] | 'unclassified';
const allowedRoutes: ReadonlySet<string> = new Set(routes);

export function requestMetricRoute(value: unknown): RequestMetricRoute {
  return typeof value === 'string' && allowedRoutes.has(value)
    ? value as RequestMetricRoute
    : 'unclassified';
}
