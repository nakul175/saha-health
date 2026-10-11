// Availability/shape contract for the declared pnpm audit JSON map format.
// This validates data used by the existing classifier; it does not decide severity,
// shipped-package applicability or whether a dependency is approved.
const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function parseSecurityAuditResponse(raw) {
  const audit = JSON.parse(raw);
  const unavailable = () => { throw new Error('Dependency audit unavailable or unsupported'); };
  if (!object(audit) || Object.hasOwn(audit, 'error') || !object(audit.advisories) || !object(audit.metadata) || !object(audit.metadata.vulnerabilities)) unavailable();
  const counts = audit.metadata.vulnerabilities;
  for (const severity of severities) if (!Object.hasOwn(counts, severity) || !Number.isSafeInteger(counts[severity]) || counts[severity] < 0) unavailable();
  const observed = Object.fromEntries(severities.map(severity => [severity, 0]));
  for (const advisory of Object.values(audit.advisories)) {
    if (!object(advisory) || !severities.includes(advisory.severity)
      || typeof advisory.module_name !== 'string' || !advisory.module_name.trim()
      || typeof advisory.vulnerable_versions !== 'string'
      || typeof advisory.title !== 'string'
      || !(typeof advisory.id === 'string' && advisory.id.trim() || Number.isSafeInteger(advisory.id) && advisory.id >= 0)
      || !Array.isArray(advisory.findings) || advisory.findings.length === 0
      || !advisory.findings.every(finding => object(finding) && typeof finding.dev === 'boolean')) unavailable();
    observed[advisory.severity]++;
  }
  // The supported envelope counts advisory objects, not finding/path occurrences.
  for (const severity of severities) if (counts[severity] !== observed[severity]) unavailable();
  return audit;
}

// Validate only the production dependency data consumed by the existing SBOM walk.
// Absent dependencies mean an empty inventory; present malformed maps do not.
export function parseProductionDependencyTree(raw) {
  const listed = JSON.parse(raw);
  const unavailable = () => { throw new Error('Production dependency inventory unavailable or unsupported'); };
  if (!Array.isArray(listed) || !object(listed[0]) || Object.hasOwn(listed[0], 'error')) unavailable();
  const visit = node => {
    if (!Object.hasOwn(node, 'dependencies')) return;
    if (!object(node.dependencies)) unavailable();
    for (const info of Object.values(node.dependencies)) {
      if (!object(info) || typeof info.version !== 'string' || !info.version.trim()) unavailable();
      visit(info);
    }
  };
  visit(listed[0]);
  return listed[0];
}
