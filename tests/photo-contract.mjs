// Slice 3f contract: workspace photo reduction (lib/saha/photo.ts) with an injected decoder and canvas.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.photo-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  writeFileSync(join(dir, 'photo.js'), ts.transpileModule(readFileSync('lib/saha/photo.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const P = await import(pathToFileURL(join(dir, 'photo.js')));
  const steps = [];
  let closed = 0;
  const env = (sizeOf, decode = true) => ({ createImageBitmap: async () => { if (!decode) throw Error('decode'); return { width: 4000, height: 3000, close: () => closed++ }; },
    OffscreenCanvas: class { constructor(w, h) { this.w = w; this.h = h; } getContext() { return { drawImage() {} }; } async convertToBlob({ type, quality }) { steps.push([this.w, this.h, quality]); return new Blob([new Uint8Array(sizeOf(this.w, this.h, quality))], { type }); } } });
  const out = await P.reducePhoto(new Blob([new Uint8Array(10)], { type: 'image/heic' }), env((w, h, q) => Math.round(w * h * q / 3)));
  check(() => assert.equal(out.type, 'image/jpeg'));
  check(() => assert.ok(out.size <= P.PHOTO_TARGET));
  check(() => assert.deepEqual(steps[0], [1280, 960, 0.8], 'first attempt: 1280 px long edge at quality 0.8'));
  check(() => assert.ok(steps.length > 1, 'stepped down until it fitted'));
  check(() => assert.equal(closed, 1, 'decoded image released'));
  const small = await P.reducePhoto(new Blob([new Uint8Array(10)]), { ...env(() => 1000), createImageBitmap: async () => ({ width: 300, height: 200 }) });
  check(() => assert.equal(small.size, 1000, 'small photos are still re-encoded (metadata dropped) without upscaling'));
  await assert.rejects(() => P.reducePhoto(new Blob([new Uint8Array(10)]), env(() => 300 * 1024)), /could not be reduced below 256 KB/); passed++;
  await assert.rejects(() => P.reducePhoto(new Blob([new Uint8Array(10)]), env(() => 1, false)), /could not be read/); passed++;
  await assert.rejects(() => P.reducePhoto(new Blob([new Uint8Array(10)]), { createImageBitmap: async () => ({ width: 1, height: 1 }), OffscreenCanvas: undefined }), /cannot reduce photos/); passed++;
  check(() => assert.deepEqual(P.PHOTO_STEPS.at(-1), [480, 0.5]));
  const result = { suite: 'Workspace photo reduction contract (slice 3f)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/photo-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
