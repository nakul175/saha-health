import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'saha-auth-recovery-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  let source = readFileSync('lib/saha/authentication-recovery.ts', 'utf8')
    .replace("import { z } from 'zod';", "const z = { discriminatedUnion:()=>({}), object:()=>({}), literal:()=>({}), string:()=>({trim(){return this},min(){return this},max(){return this},uuid(){return this}}) };" )
    .replace("import { fail, uuid } from './core';", "const fail=(status,message)=>{const e=new Error(message);e.status=status;throw e}; const uuid=()=> '00000000-0000-4000-8000-000000000001';")
    .replace("import type { Principal } from './identity';", '');
  writeFileSync(join(dir, 'subject.mjs'), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const subject = await import(pathToFileURL(join(dir, 'subject.mjs')));
  const access = (issuedAt, mfa = true, userId = 'access:worker') => ({ userId, provider: 'cloudflare-access', authentication: { issuedAt, mfa, credentialId: `credential-${issuedAt}` } });
  const sites = { userId: 'sites-worker', provider: 'sites-chatgpt' };

  check(() => assert.throws(() => subject.beginRecovery(sites, 'Identity verified device replacement', 1_000_000), /approved institutional sign-in/));
  check(() => assert.throws(() => subject.beginRecovery(access(900, false), 'Identity verified device replacement', 1_000_000), /second factor/));
  const pending = subject.beginRecovery(access(900), 'Identity steward verified device replacement', 1_000_000);
  check(() => assert.equal(pending.state, 'revoked-pending-activation'));
  check(() => assert.equal(pending.revokedBefore, 1000));
  check(() => assert.equal(subject.credentialIsCurrent(access(900), pending.revokedBefore), false));
  check(() => assert.equal(subject.credentialIsCurrent(access(1001), pending.revokedBefore), true));
  check(() => assert.throws(() => subject.completeRecovery(access(900), pending, 1_100_000), /Sign in again/));
  check(() => assert.throws(() => subject.completeRecovery(access(1001, true, 'access:other'), pending, 1_100_000), /another institutional identity/));
  const active = subject.completeRecovery(access(1001), pending, 1_100_000);
  check(() => assert.equal(active.state, 'active'));
  check(() => assert.equal(active.replacementCredentialId, 'credential-1001'));
  check(() => assert.equal(pending.state, 'revoked-pending-activation'));
  check(() => assert.throws(() => subject.completeRecovery(access(1002), active, 1_200_000), /no longer awaiting activation/));
  console.log(JSON.stringify({ suite: 'SAHA-012 authentication recovery contract', passed }));
} finally { rmSync(dir, { recursive: true, force: true }); }
