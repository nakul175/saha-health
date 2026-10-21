// BR-SEC-05 local control: server-side secret references may be accompanied by an
// operator-owned rotation record. This module deliberately accepts metadata only.
// Key material, provider values and key-encryption keys have no representation here.
type Env = Record<string, string | undefined>;

export type SecretRotationRecord = {
  binding: string;
  owner: string;
  rotatedAt: string;
  rotateBy: string;
};

export type RotationResult =
  | { ok: true; records: SecretRotationRecord[] }
  | { ok: false; records: []; error: string };

const BINDING = /^[A-Z][A-Z0-9_]{2,80}$/;
const OWNER = /^[A-Za-z0-9][A-Za-z0-9 .@_:/+-]{1,119}$/;
const EXACT_KEYS = ['binding', 'owner', 'rotateBy', 'rotatedAt'];

const iso = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString() === value ? value : null;
};

export function secretRotationRecords(env: Env): RotationResult {
  const raw = env.SAHA_SECRET_ROTATION_RECORDS;
  if (raw === undefined || raw.trim() === '') return { ok: true, records: [] };
  if (raw.length > 50_000) return { ok: false, records: [], error: 'SAHA_SECRET_ROTATION_RECORDS is too large.' };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, records: [], error: 'SAHA_SECRET_ROTATION_RECORDS is not valid JSON.' }; }
  if (!Array.isArray(parsed) || parsed.length > 100) return { ok: false, records: [], error: 'SAHA_SECRET_ROTATION_RECORDS must be a list of at most 100 metadata records.' };
  const records: SecretRotationRecord[] = [];
  const seen = new Set<string>();
  for (const [index, value] of parsed.entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, records: [], error: `Rotation record ${index + 1} must be an object.` };
    const item = value as Record<string, unknown>, keys = Object.keys(item).sort();
    if (keys.join(',') !== EXACT_KEYS.join(',')) return { ok: false, records: [], error: `Rotation record ${index + 1} may contain binding, owner, rotatedAt and rotateBy only.` };
    if (typeof item.binding !== 'string' || !BINDING.test(item.binding)) return { ok: false, records: [], error: `Rotation record ${index + 1} has an invalid secret binding name.` };
    if (seen.has(item.binding)) return { ok: false, records: [], error: `Rotation record ${index + 1} repeats binding ${item.binding}.` };
    if (typeof item.owner !== 'string' || !OWNER.test(item.owner)) return { ok: false, records: [], error: `Rotation record ${index + 1} has an invalid owner reference.` };
    const rotatedAt = iso(item.rotatedAt), rotateBy = iso(item.rotateBy);
    if (!rotatedAt || !rotateBy || Date.parse(rotatedAt) >= Date.parse(rotateBy)) return { ok: false, records: [], error: `Rotation record ${index + 1} needs canonical ISO dates with rotatedAt before rotateBy.` };
    seen.add(item.binding);
    records.push({ binding: item.binding, owner: item.owner, rotatedAt, rotateBy });
  }
  return { ok: true, records };
}

export function requiredServerSecretBindings(env: Env): string[] {
  const names = new Set<string>();
  for (const [name, value] of Object.entries(env)) if (typeof value === 'string' && value.length > 0 && /(?:KEY|TOKEN|SECRET|PASSWORD|PASSPHRASE)$/.test(name) && BINDING.test(name)) names.add(name);
  for (const key of ['SAHA_MIS_CONNECTIONS', 'SAHA_EHR_CONNECTIONS']) {
    try {
      const grants = JSON.parse(env[key] ?? '[]');
      if (!Array.isArray(grants)) continue;
      for (const grant of grants) if (grant && typeof grant === 'object') {
        for (const field of ['credentialBinding', 'callbackBinding']) {
          const name = (grant as Record<string, unknown>)[field];
          if (typeof name === 'string' && BINDING.test(name)) names.add(name);
        }
      }
    } catch { /* The environment checker reports malformed grant JSON separately. */ }
  }
  return [...names].sort();
}

export function secretRotationChecks(env: Env, checkedAt = new Date().toISOString()) {
  const parsed = secretRotationRecords(env);
  if (!parsed.ok) return [{ binding: null, status: 'error' as const, message: parsed.error }];
  const now = Date.parse(checkedAt), byName = new Map(parsed.records.map(record => [record.binding, record]));
  if (!Number.isFinite(now)) return [{ binding: null, status: 'error' as const, message: 'The secret rotation check time is invalid.' }];
  return requiredServerSecretBindings(env).map(binding => {
    const record = byName.get(binding);
    if (!record) return { binding, status: 'error' as const, message: `Secret binding ${binding} has no owner and rotation record.` };
    if (Date.parse(record.rotatedAt) > now) return { binding, status: 'error' as const, message: `Secret binding ${binding} has a future rotatedAt value.` };
    if (Date.parse(record.rotateBy) <= now) return { binding, status: 'error' as const, message: `Secret binding ${binding} is past its rotateBy date.` };
    return { binding, status: 'ok' as const, message: `Secret binding ${binding} has owner ${record.owner} and a current rotation record through ${record.rotateBy}.`, owner: record.owner, rotatedAt: record.rotatedAt, rotateBy: record.rotateBy };
  });
}
