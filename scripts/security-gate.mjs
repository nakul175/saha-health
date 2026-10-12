// Slice 0c supply-chain gate (BR-SEC-12). Run after `npm run build`:
//   node scripts/security-gate.mjs [--sbom path] [--report path]
// 1. Writes a CycloneDX 1.5 SBOM of production dependencies (pnpm list --prod).
// 2. Runs `pnpm audit` and fails on any critical advisory, and on any high advisory whose
//    package is present in the built Worker or client bundle (dist/). High advisories confined
//    to development or build-time tooling are reported, not failed; the report lists them so a
//    reviewer can see what was accepted and why.
// The gate needs registry access for the audit. Without it the gate fails closed.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readBundleProvenance } from './lib/bundle-provenance.mjs';
import { assertAuditedBundlePackages } from './lib/bundle-audit-coverage.mjs';
import { parseSecurityAuditResponse, parseProductionDependencyTree } from './lib/security-audit-response.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const sbomPath = arg('--sbom', 'dist/sbom.cdx.json'), reportPath = arg('--report', 'dist/security-gate.json');
const pnpm = args => execFileSync('corepack', ['pnpm', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
// Invalidate the selected report before any build or external-tool validation.
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify({ gate: 'supply-chain (slice 0c)', sbom: sbomPath, productionComponents: null, counts: null, blocking: [], accepted: [], passed: false, auditAvailable: false, checkedAt: new Date().toISOString() }, null, 2) + '\n');
const unavailable = () => { console.error('Dependency audit unavailable; failing closed.'); process.exit(3); };
if (!existsSync('dist')) { console.error('Build first: dist/ is missing.'); process.exit(2); }

// Compiler membership includes runtime modules declared as development dependencies.
let provenance;
try { provenance = readBundleProvenance(); } catch {
  console.error('Built bundle provenance unavailable; failing closed.'); process.exit(3);
}
// SBOM of production dependencies plus actual bundled dependencies.
let tree;
try { tree = parseProductionDependencyTree(pnpm(['list', '--prod', '--json', '--depth', 'Infinity'])); } catch { unavailable(); }
const components = new Map();
const walk = deps => { for (const [name, info] of Object.entries(deps ?? {})) { const key = `${name}@${info.version}`; components.set(key, { type: 'library', name, version: info.version, purl: `pkg:npm/${name.startsWith('@') ? '%40' + name.slice(1) : name}@${info.version}`, scope: 'required' }); walk(info.dependencies); } };
walk(tree.dependencies);
for (const { name, version } of provenance.packages) {
  const key = `${name}@${version}`;
  components.set(key, { type: 'library', name, version, purl: `pkg:npm/${name.startsWith('@') ? '%40' + name.slice(1) : name}@${version}`, scope: 'required' });
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const sbom = { bomFormat: 'CycloneDX', specVersion: '1.5', version: 1, metadata: { timestamp: new Date().toISOString(), component: { type: 'application', name: 'saha-health', version: pkg.version } }, components: [...components.values()].sort((a, b) => a.purl.localeCompare(b.purl)) };
mkdirSync(dirname(sbomPath), { recursive: true });
writeFileSync(sbomPath, JSON.stringify(sbom, null, 2) + '\n');

const shipped = provenance.shipped;
let auditedLockComponents;
try {
  const tree = JSON.parse(pnpm(['list', '--json', '--depth', 'Infinity', '--lockfile-only']))[0];
  auditedLockComponents = assertAuditedBundlePackages(tree, provenance.packages);
} catch { console.error('Built dependency audit coverage unavailable; failing closed.'); process.exit(3); }

let audit, auditOutput;
try { auditOutput = pnpm(['audit', '--json']); } catch (e) {
  // Only pnpm's expected findings exit is usable, after validating the full envelope.
  if (e.status === 1 && !e.signal && e.stdout) auditOutput = e.stdout; else unavailable();
}
try { audit = parseSecurityAuditResponse(auditOutput); } catch { unavailable(); }
const findings = Object.values(audit.advisories ?? {}).map(a => ({ id: a.id, module: a.module_name, severity: a.severity, vulnerable: a.vulnerable_versions, devOnly: a.findings.every(f => f.dev), shipped: shipped(a.module_name), title: a.title }));
const blocking = findings.filter(f => f.severity === 'critical' || (f.severity === 'high' && f.shipped));
// Reject an input/artifact change during the external tools; no old audit is reusable.
try { if (readBundleProvenance().fingerprint !== provenance.fingerprint) throw new Error('Build changed'); } catch { console.error('Build changed during dependency audit; failing closed.'); process.exit(3); }
// Retain only non-secret compiler custody data, rather than all local tool state.
const provenanceEvidencePath = 'dist/bundle-provenance-evidence.json';
const provenanceEvidenceBytes = JSON.stringify({ schema: 1, fingerprint: provenance.fingerprint, manifests: provenance.manifests.map(record => ({
  ...record, manifest: JSON.parse(readFileSync('dist/' + record.file, 'utf8')),
  receipt: JSON.parse(readFileSync(record.compilerReceipt.file, 'utf8')),
})) }, null, 2) + '\n';
writeFileSync(provenanceEvidencePath, provenanceEvidenceBytes);
const report = { gate: 'supply-chain (slice 0c)', sbom: sbomPath, productionComponents: components.size, auditedLockComponents, auditAvailable: true, provenanceEvidence: { file: provenanceEvidencePath, sha256: createHash('sha256').update(provenanceEvidenceBytes).digest('hex') }, bundleProvenance: { fingerprint: provenance.fingerprint, chunks: provenance.chunks, copiedScripts: provenance.copiedScripts, generatedDataScripts: provenance.generatedDataScripts, manifests: provenance.manifests, runtimePackages: provenance.packages }, counts: audit.metadata?.vulnerabilities ?? {}, blocking, accepted: findings.filter(f => !blocking.includes(f) && ['high', 'moderate'].includes(f.severity)).map(f => ({ ...f, reason: f.shipped ? 'moderate runtime finding retained for review' : 'dependency absent from compiler module membership' })), passed: blocking.length === 0, checkedAt: new Date().toISOString() };
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, productionComponents: report.productionComponents, counts: report.counts, blocking: blocking.length, accepted: report.accepted.length }));
process.exit(report.passed ? 0 : 1);
