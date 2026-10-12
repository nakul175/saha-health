import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundleProvenance } from '../build/bundle-provenance.mjs';
import { readBundleProvenance } from '../scripts/lib/bundle-provenance.mjs';

const root = mkdtempSync(join(tmpdir(), 'saha-bundle-contract-'));
const inputNames = ['package.json', 'pnpm-lock.yaml', 'vite.config.ts', 'build/bundle-provenance.mjs'];
let passed = 0, failed = 0;
const cases = [];
const check = (name, fn) => { try { fn(); passed++; cases.push({ name, passed: true }); } catch (error) { failed++; cases.push({ name, passed: false, message: error.message }); } };
const put = (file, bytes) => { mkdirSync(join(root, file, '..'), { recursive: true }); writeFileSync(join(root, file), bytes); };
const seed = () => {
  rmSync(join(root, 'dist'), { recursive: true, force: true });
  for (const file of inputNames) put(file, file === 'package.json' ? '{"name":"application-root","version":"1.0.0"}' : 'original-' + file);
  put('node_modules/react-server-dom-webpack/package.json', JSON.stringify({ name: 'react-server-dom-webpack', version: '19.2.6' }));
  const plugin = bundleProvenance(); plugin.configResolved({ root });
  const chunk = { type: 'chunk', fileName: 'runtime.js', code: 'export const x=42;', modules: { [join(root, 'node_modules/react-server-dom-webpack/cjs/server.js')]: {} } };
  let emitted;
  plugin.generateBundle.handler.call({ emitFile(asset) { emitted = asset; } }, {}, { 'runtime.js': chunk });
  put('dist/server/runtime.js', chunk.code); put('dist/server/' + emitted.fileName, emitted.source);
  return { chunk, plugin, manifest: JSON.parse(emitted.source) };
};
const mutate = fn => { const { manifest } = seed(); fn(manifest); put('dist/server/saha-bundle-provenance.json', JSON.stringify(manifest)); };
const refuses = fn => { seed(); fn(); assert.throws(() => readBundleProvenance(root)); };
try {
  check('minified chunk has no literal dependency name', () => { const { chunk } = seed(); assert.equal(chunk.code.includes('react-server-dom-webpack'), false); });
  check('compiler identifies real package and version despite minification', () => { seed(); assert.deepEqual(readBundleProvenance(root).packages, [{ name: 'react-server-dom-webpack', version: '19.2.6' }]); });
  check('bundled development dependency is shipped', () => { seed(); assert.equal(readBundleProvenance(root).shipped('react-server-dom-webpack'), true); });
  check('absent tooling dependency is not shipped', () => { seed(); assert.equal(readBundleProvenance(root).shipped('wrangler'), false); });
  check('nested package owner wins over containing package', () => { seed(); put('node_modules/outer/package.json', '{"name":"outer","version":"1.0.0"}'); put('node_modules/outer/node_modules/inner/package.json', '{"name":"inner","version":"2.0.0"}'); const p=bundleProvenance();p.configResolved({root});let e;p.generateBundle.handler.call({emitFile(a){e=a;}},{},{x:{type:'chunk',fileName:'inner.js',code:'export{};',modules:{[join(root,'node_modules/outer/node_modules/inner/index.js')]:{}}}}); assert.equal(JSON.parse(e.source).chunks[0].packages[0].name,'inner'); });
  check('missing provenance refuses', () => refuses(() => rmSync(join(root, 'dist/server/saha-bundle-provenance.json'))));
  check('missing compiler receipt refuses', () => refuses(() => rmSync(join(root, '.sites-runtime/bundle-provenance'), {recursive:true,force:true})));
  check('removing dependency while keeping chunk/input hashes refuses', () => {mutate(m=>m.chunks[0].packages=[]);assert.throws(()=>readBundleProvenance(root));});
  check('replacing dependency while keeping chunk/input hashes refuses', () => {mutate(m=>m.chunks[0].packages=[{name:'benign',version:'1.0.0'}]);assert.throws(()=>readBundleProvenance(root));});
  check('malformed provenance refuses', () => refuses(() => put('dist/server/saha-bundle-provenance.json', 'bad json')));
  for (const [name, edit] of [
    ['unsupported schema', m => m.schema = 2], ['absent inputs', m => delete m.inputs],
    ['missing input', m => m.inputs.pop()], ['duplicate input', m => m.inputs[1] = m.inputs[0]],
    ['unknown input', m => m.inputs[0].file = 'other.json'], ['input hash mismatch', m => m.inputs[0].sha256 = '0'.repeat(64)],
    ['absent chunks', m => delete m.chunks], ['empty chunks', m => m.chunks = []],
    ['missing compiled package list', m => delete m.chunks[0].packages], ['empty package identity', m => m.chunks[0].packages[0].name = ''],
    ['empty package version', m => m.chunks[0].packages[0].version = ''], ['invalid module count', m => m.chunks[0].moduleCount = 0],
    ['duplicate chunk', m => m.chunks.push(m.chunks[0])], ['path escapes build', m => m.chunks[0].file = '../../../package.json'],
    ['compiled hash mismatch', m => m.chunks[0].sha256 = '0'.repeat(64)],
  ]) check(name + ' refuses', () => { mutate(edit); assert.throws(() => readBundleProvenance(root)); });
  check('changed compiled body refuses', () => refuses(() => put('dist/server/runtime.js', 'export const x=43;')));
  check('missing compiled body refuses', () => refuses(() => rmSync(join(root, 'dist/server/runtime.js'))));
  check('changed lockfile refuses', () => refuses(() => put('pnpm-lock.yaml', 'different')));
  check('unknown executable file refuses', () => refuses(() => put('dist/server/not-recorded.js', 'export const malicious=1;')));
  check('exact public script copy is covered', () => { seed();put('public/sw.js','self.foo=1;');put('dist/client/sw.js','self.foo=1;');assert.equal(readBundleProvenance(root).copiedScripts.length,1); });
  check('modified public script refuses', () => refuses(() => {put('public/sw.js','self.foo=1;');put('dist/client/sw.js','self.foo=2;');}));
  check('snapshot fingerprint is stable on unchanged artifacts',()=>{seed();assert.equal(readBundleProvenance(root).fingerprint,readBundleProvenance(root).fingerprint);});
  check('legitimate later public rebuild changes snapshot fingerprint',()=>{seed();put('public/sw.js','self.foo=1;');put('dist/client/sw.js','self.foo=1;');const before=readBundleProvenance(root).fingerprint;put('public/sw.js','self.foo=2;');put('dist/client/sw.js','self.foo=2;');assert.notEqual(readBundleProvenance(root).fingerprint,before);});
  check('JSON-only generated sidecar is accepted', () => { seed();put('dist/server/vinext-client-assets.js','export default {"lazyChunks":[]};\n');assert.equal(readBundleProvenance(root).generatedDataScripts.length,1); });
  check('generated filename cannot hide executable payload', () => refuses(() => put('dist/server/vinext-client-assets.js','export default {};evil();')));
  check('generated filename cannot hide non-JSON expression', () => refuses(() => put('dist/server/vinext-client-assets.js','export default {"a":evil()};')));
  check('bootstrap script must reference known compiled client chunk', () => refuses(() => put('dist/server/__vite_rsc_assets_manifest.js','export default {"bootstrapScriptContent":"import(\\"/unknown.js\\")"}')));
  check('bootstrap arbitrary executable script refuses', () => refuses(() => put('dist/server/__vite_rsc_assets_manifest.js','export default {"bootstrapScriptContent":"evil()"}')));
  check('prototype-derived bootstrap cannot bypass JSON validation', () => refuses(() => put('dist/server/__vite_rsc_assets_manifest.js','export default {"__proto__":{"bootstrapScriptContent":"import(\\"https://invalid.test/a.js\\")"}}')));
  check('nested prototype key refuses', () => refuses(() => put('dist/server/vinext-client-assets.js','export default {"a":{"__proto__":{}}}')));
  check('remote sidecar asset reference refuses', () => refuses(() => put('dist/server/__vite_rsc_assets_manifest.js','export default {"clientReferenceDeps":{"x":{"js":["https://invalid.test/a.js"]}}}')));
  check('protocol-relative sidecar asset reference refuses', () => refuses(() => put('dist/server/vinext-client-assets.js','export default {"lazyChunks":["//invalid.test/a.js"]}')));
  check('unknown local sidecar asset reference refuses', () => refuses(() => put('dist/server/vinext-client-assets.js','export default {"lazyChunks":["/unknown.js"]}')));
  check('sidecar parent traversal reference refuses', () => refuses(() => put('dist/server/vinext-client-assets.js','export default {"lazyChunks":["../../package.json"]}')));
  check('fixed SSG data callback is accepted', () => {seed();put('dist/client/_next/static/id/_ssgManifest.js','self.__SSG_MANIFEST=new Set;self.__SSG_MANIFEST_CB&&self.__SSG_MANIFEST_CB()');assert.equal(readBundleProvenance(root).generatedDataScripts.length,1);});
  check('extra SSG execution refuses', () => refuses(() => put('dist/client/_next/static/id/_ssgManifest.js','self.__SSG_MANIFEST=new Set;self.__SSG_MANIFEST_CB&&self.__SSG_MANIFEST_CB();evil()')));
  check('build manifest JSON/callback is accepted', () => {seed();put('dist/client/_next/static/id/_buildManifest.js','self.__BUILD_MANIFEST = {"sortedPages":[]};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()');assert.equal(readBundleProvenance(root).generatedDataScripts.length,1);});
  check('build manifest extra executable refuses', () => refuses(() => put('dist/client/_next/static/id/_buildManifest.js','self.__BUILD_MANIFEST = {};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB();evil()')));
  check('unresolvable compiler dependency refuses build', () => { seed();const p=bundleProvenance();p.configResolved({root});assert.throws(()=>p.generateBundle.handler.call({emitFile(){}},{},{x:{type:'chunk',fileName:'x.js',code:'export{};',modules:{[join(root,'missing/node_modules/unknown/index.js')]:{}}}}));});
  check('empty compiler result refuses build', () => {const p=bundleProvenance();p.configResolved({root});assert.throws(()=>p.generateBundle.handler.call({emitFile(){}},{},{}));});
} finally {
  rmSync(root, { recursive: true, force: true });
  const result={passed,failed,skipped:0,cases};mkdirSync('tests/reports',{recursive:true});writeFileSync('tests/reports/bundle-provenance-contract-result.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({passed,failed,skipped:0}));if(failed)process.exitCode=1;
}
