import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';

const hash = value => createHash('sha256').update(value).digest('hex');
const script = file => /\.(m?js|cjs)$/.test(file);
const files = dir => readdirSync(dir).flatMap(name => {
  const file = resolve(dir, name);
  return statSync(file).isDirectory() ? files(file) : [file];
});
const assert = condition => { if (!condition) throw new Error('Built bundle provenance unavailable or inconsistent.'); };
export function readBundleProvenance(root = process.cwd()) {
  const dist = resolve(root, 'dist');
  const all = files(dist);
  const manifests = all.filter(file => file.endsWith('/saha-bundle-provenance.json'));
  assert(manifests.length > 0);
  const packages = new Map(), covered = new Set(), records = [];
  for (const file of manifests) {
    const bytes = readFileSync(file), path = relative(root, file);
    const receiptFile = resolve(root, '.sites-runtime/bundle-provenance', hash(path) + '.json');
    const receiptBytes = readFileSync(receiptFile), receipt = JSON.parse(receiptBytes.toString('utf8'));
    assert(receipt.schema === 1 && receipt.file === path && receipt.sha256 === hash(bytes));
    const data = JSON.parse(bytes.toString('utf8'));
    assert(data.schema === 1 && Array.isArray(data.inputs) && data.inputs.length === 4 && Array.isArray(data.chunks) && data.chunks.length > 0);
    const expectedInputs = new Set(['package.json', 'pnpm-lock.yaml', 'vite.config.ts', 'build/bundle-provenance.mjs']);
    for (const input of data.inputs) {
      assert(expectedInputs.delete(input.file) && input.sha256 === hash(readFileSync(resolve(root, input.file))));
    }
    assert(expectedInputs.size === 0);
    for (const chunk of data.chunks) {
      assert(typeof chunk.file === 'string' && script(chunk.file) && Number.isInteger(chunk.moduleCount) && chunk.moduleCount > 0 && Array.isArray(chunk.packages));
      assert(Number.isInteger(chunk.dependencyModuleCount) && chunk.dependencyModuleCount >= chunk.packages.length && chunk.dependencyModuleCount <= chunk.moduleCount);
      const target = resolve(dirname(file), chunk.file);
      assert(target.startsWith(dist + sep) && !covered.has(target));
      assert(chunk.sha256 === hash(readFileSync(target)));
      covered.add(target);
      for (const pkg of chunk.packages) {
        assert(typeof pkg.name === 'string' && pkg.name.length > 0 && typeof pkg.version === 'string' && pkg.version.length > 0);
        packages.set(`${pkg.name}@${pkg.version}`, { name: pkg.name, version: pkg.version });
      }
    }
    records.push({ file: relative(dist, file), sha256: hash(bytes), compilerReceipt: { file: relative(root, receiptFile), sha256: hash(receiptBytes) } });
  }
  // Public scripts are copied verbatim, rather than compiled from installed modules.
  const publicHashes = new Set(existsSync(resolve(root, 'public')) ? files(resolve(root, 'public')).filter(script).map(file => hash(readFileSync(file))) : []);
  const copied = [], generatedDataScripts = [];
  for (const file of all.filter(script)) {
    if (covered.has(file)) continue;
    const bytes = readFileSync(file), text = bytes.toString('utf8'), path = relative(dist, file);
    if (publicHashes.has(hash(bytes))) { copied.push({ file: path, sha256: hash(bytes) }); continue; }
    // vinext emits these data-only sidecars after Rollup has finished. Validate their
    // entire grammar; a filename never exempts arbitrary executable script.
    let data;
    if (/^(server|server\/ssr)\/(vinext-client-assets|__vite_rsc_assets_manifest)\.js$/.test(path)) {
      const match = /^export default ([\s\S]*?);?\s*$/.exec(text);
      assert(match);
      data = JSON.parse(match[1]);
      assert(data && typeof data === 'object' && !Array.isArray(data));
      if ('bootstrapScriptContent' in data) {
        const bootstrap = /^import\(("[^"\\]+")\)$/.exec(data.bootstrapScriptContent);
        assert(bootstrap);
        const target = resolve(dist, 'client', '.' + JSON.parse(bootstrap[1]));
        assert(covered.has(target));
      }
    } else if (/^client\/_next\/static\/[^/]+\/_ssgManifest\.js$/.test(path)) {
      assert(text === 'self.__SSG_MANIFEST=new Set;self.__SSG_MANIFEST_CB&&self.__SSG_MANIFEST_CB()');
    } else if (/^client\/_next\/static\/[^/]+\/_buildManifest\.js$/.test(path)) {
      const match = /^self\.__BUILD_MANIFEST = (\{[\s\S]*\});self\.__BUILD_MANIFEST_CB && self\.__BUILD_MANIFEST_CB\(\)$/.exec(text);
      assert(match); data = JSON.parse(match[1]);
      assert(data && typeof data === 'object' && !Array.isArray(data));
    } else assert(false);
    const validateData = value => {
      if (Array.isArray(value)) { value.forEach(validateData); return; }
      if (value && typeof value === 'object') {
        assert(!Object.hasOwn(value, '__proto__'));
        for (const [key, child] of Object.entries(value)) if (key !== 'bootstrapScriptContent') validateData(child);
      } else if (typeof value === 'string') {
        assert(!/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value));
        const asset = resolve(dist, 'client', value.startsWith('/') ? '.' + value : value);
        assert(asset.startsWith(resolve(dist, 'client') + sep) && existsSync(asset));
        if (script(asset)) assert(covered.has(asset) || publicHashes.has(hash(readFileSync(asset))));
      }
    };
    if (data) validateData(data);
    generatedDataScripts.push({ file: path, sha256: hash(bytes) });
  }
  const packageRecords = [...packages.values()];
  const fingerprint = hash(JSON.stringify({ packages: packageRecords, manifests: records, copiedScripts: copied, generatedDataScripts }));
  return { packages: packageRecords, chunks: covered.size, copiedScripts: copied, generatedDataScripts, manifests: records, fingerprint, shipped: name => packageRecords.some(pkg => pkg.name === name) };
}
