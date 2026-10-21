#!/usr/bin/env node
// BR-SEC-05 reviewer tool. It accepts SHA-256 fingerprints and metadata, never
// usable secret values, then inspects bounded text artefacts for exact tokens.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TARGET_KINDS = ['client-bundle', 'configuration-export', 'log', 'model-context'];
const sha256 = value => createHash('sha256').update(value).digest('hex');
const canonicalIso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value;
const fail = message => { throw new Error(message); };

export function loadAuditPlan(planPath, root = process.cwd(), now = new Date().toISOString()) {
  const absolute = resolve(root, planPath), rootReal = realpathSync(root);
  if (lstatSync(absolute).isSymbolicLink()) fail('The audit plan may not be a symbolic link.');
  const descriptorReal = realpathSync(absolute);
  if (relative(rootReal, descriptorReal).startsWith(`..${sep}`) || relative(rootReal, descriptorReal) === '..') fail('The audit plan must stay inside the review root.');
  const raw = readFileSync(descriptorReal, 'utf8');
  if (raw.length > 100_000) fail('The audit plan is too large.');
  let plan; try { plan = JSON.parse(raw); } catch { fail('The audit plan is not valid JSON.'); }
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) || plan.version !== 1 || !Array.isArray(plan.records) || !Array.isArray(plan.targets)) fail('The audit plan must be a version 1 object with records and targets.');
  const allowedPlanKeys = new Set(['version', 'records', 'targets']);
  if (Object.keys(plan).some(key => !allowedPlanKeys.has(key))) fail('The audit plan contains an unsupported top-level field; secret values are not accepted.');
  const records = [], fingerprints = new Set(), bindings = new Set();
  for (const [index, record] of plan.records.entries()) {
    if (!record || typeof record !== 'object' || Array.isArray(record) || Object.keys(record).sort().join(',') !== 'binding,owner,rotateBy,rotatedAt,sha256') fail(`Record ${index + 1} must contain metadata and sha256 only.`);
    if (typeof record.binding !== 'string' || !/^[A-Z][A-Z0-9_]{2,80}$/.test(record.binding) || bindings.has(record.binding)) fail(`Record ${index + 1} has an invalid or repeated binding.`);
    if (typeof record.owner !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 .@_:/+-]{1,119}$/.test(record.owner)) fail(`Record ${index + 1} has an invalid owner reference.`);
    if (!canonicalIso(record.rotatedAt) || !canonicalIso(record.rotateBy) || Date.parse(record.rotatedAt) >= Date.parse(record.rotateBy)) fail(`Record ${index + 1} has invalid rotation dates.`);
    if (Date.parse(record.rotatedAt) > Date.parse(now) || Date.parse(record.rotateBy) <= Date.parse(now)) fail(`Record ${index + 1} is future-dated or expired.`);
    if (typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256) || fingerprints.has(record.sha256)) fail(`Record ${index + 1} has an invalid or repeated SHA-256 fingerprint.`);
    bindings.add(record.binding); fingerprints.add(record.sha256); records.push(record);
  }
  if (!records.length) fail('At least one fingerprint record is required.');
  const kinds = new Set(), paths = new Set(), targets = [];
  for (const [index, target] of plan.targets.entries()) {
    if (!target || typeof target !== 'object' || Array.isArray(target) || Object.keys(target).sort().join(',') !== 'kind,path') fail(`Target ${index + 1} must contain kind and path only.`);
    if (!TARGET_KINDS.includes(target.kind)) fail(`Target ${index + 1} has an unsupported kind.`);
    if (kinds.has(target.kind)) fail(`Target kind ${target.kind} is repeated.`);
    if (typeof target.path !== 'string' || !target.path || isAbsolute(target.path)) fail(`Target ${index + 1} must use a relative path.`);
    const candidate = resolve(rootReal, target.path);
    if (lstatSync(candidate).isSymbolicLink()) fail(`Target ${index + 1} may not be a symbolic link.`);
    const targetReal = realpathSync(candidate), rel = relative(rootReal, targetReal);
    if (rel === '..' || rel.startsWith(`..${sep}`) || targetReal === descriptorReal) fail(`Target ${index + 1} is outside the review root or is the audit plan.`);
    const stat = lstatSync(targetReal);
    if (!stat.isFile() || stat.size > 10_000_000) fail(`Target ${index + 1} must be a regular text file no larger than 10 MB.`);
    if (paths.has(targetReal)) fail(`Target ${index + 1} repeats a reviewed file.`);
    kinds.add(target.kind); paths.add(targetReal); targets.push({ kind: target.kind, path: rel, absolute: targetReal });
  }
  for (const kind of TARGET_KINDS) if (!kinds.has(kind)) fail(`A ${kind} target is required.`);
  return { records, targets, root: rootReal, now };
}

export function auditSecurityMaterials(plan) {
  const byDigest = new Map(plan.records.map(record => [record.sha256, record.binding])), findings = [];
  for (const target of plan.targets) {
    const text = readFileSync(target.absolute, 'utf8');
    if (text.includes('\0')) fail(`${target.path} is not a supported text artefact.`);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      const tokens = line.match(/[A-Za-z0-9_./+=:@-]{8,}/g) ?? [];
      for (const [tokenIndex, token] of tokens.entries()) {
        const binding = byDigest.get(sha256(token));
        if (binding) findings.push({ binding, kind: target.kind, path: target.path, line: lineIndex + 1, token: tokenIndex + 1 });
      }
    }
  }
  return { ok: findings.length === 0, reviewedAt: plan.now, bindings: plan.records.map(record => ({ binding: record.binding, owner: record.owner, rotatedAt: record.rotatedAt, rotateBy: record.rotateBy })), targets: plan.targets.map(({ kind, path }) => ({ kind, path })), findings, notice: 'Fingerprint comparison only. No secret value was loaded from the audit plan or written to this result.' };
}

export function runSecurityMaterialAudit(planPath, root = process.cwd(), now = new Date().toISOString()) {
  return auditSecurityMaterials(loadAuditPlan(planPath, root, now));
}

const self = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (self) {
  try {
    const planPath = process.argv[2];
    if (!planPath) fail('Usage: node scripts/security-material-audit.mjs <relative-plan.json>');
    const result = runSecurityMaterialAudit(planPath);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 2;
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Security material audit failed.' }));
    process.exitCode = 2;
  }
}
