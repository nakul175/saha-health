import { createHash } from 'node:crypto';
import { dirname, resolve, relative, sep } from 'node:path';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';

const hash = value => createHash('sha256').update(value).digest('hex');
const packageFor = id => {
  const file = id.split('?')[0];
  if (!file.includes('/node_modules/') || file.startsWith('\0')) return null;
  const suffix = file.slice(file.lastIndexOf('/node_modules/') + '/node_modules/'.length);
  const parts = suffix.split('/');
  const packageFolder = file.slice(0, file.length - suffix.length) + parts.slice(0, parts[0].startsWith('@') ? 2 : 1).join('/');
  let folder = dirname(file);
  while (folder === packageFolder || folder.startsWith(packageFolder + '/')) {
    const manifest = resolve(folder, 'package.json');
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      if (typeof pkg.name !== 'string' || typeof pkg.version !== 'string') throw new Error('Bundled dependency identity unavailable.');
      return { name: pkg.name, version: pkg.version };
    }
    folder = dirname(folder);
  }
  throw new Error('Bundled dependency identity unavailable.');
};

// Record the compiler's actual module membership before names disappear in minification.
/** @returns {import('vite').Plugin} */
export function bundleProvenance() {
  let root;
  return {
    name: 'saha-bundle-provenance',
    apply: 'build',
    enforce: 'post',
    configResolved(config) { root = config.root; },
    generateBundle: {
      order: 'post',
      handler(options, bundle) {
        const chunks = Object.values(bundle).filter(item => item.type === 'chunk').map(chunk => {
          const packages = new Map(), modulePackages = [];
          for (const id of Object.keys(chunk.modules)) {
            const pkg = packageFor(id);
            if (pkg) { packages.set(`${pkg.name}@${pkg.version}`, pkg); modulePackages.push(pkg); }
          }
          return {
            file: chunk.fileName, sha256: hash(chunk.code),
            moduleCount: Object.keys(chunk.modules).length,
            packages: [...packages.values()].sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`)),
            dependencyModuleCount: modulePackages.length,
          };
        }).sort((a, b) => a.file.localeCompare(b.file));
        if (!chunks.length) throw new Error('Compiler emitted no bundle provenance.');
        const inputs = ['package.json', 'pnpm-lock.yaml', 'vite.config.ts', 'build/bundle-provenance.mjs'].map(file => ({ file, sha256: hash(readFileSync(resolve(root, file))) }));
        const source = JSON.stringify({ schema: 1, inputs, chunks }, null, 2) + '\n';
        const outDir = resolve(root, options.dir ?? 'dist/server');
        if (!outDir.startsWith(resolve(root, 'dist') + sep)) throw new Error('Bundle output outside expected build.');
        const file = relative(root, resolve(outDir, 'saha-bundle-provenance.json'));
        // This compiler receipt lives outside dist. The separate reviewed CI build
        // produces it; modifying an artifact cannot grant itself a new membership hash.
        const receiptDir = resolve(root, '.sites-runtime/bundle-provenance');
        mkdirSync(receiptDir, { recursive: true });
        writeFileSync(resolve(receiptDir, hash(file) + '.json'), JSON.stringify({ schema: 1, file, sha256: hash(source), inputs }) + '\n');
        this.emitFile({ type: 'asset', fileName: 'saha-bundle-provenance.json', source });
      },
    },
  };
}
