// pnpm audit reads the lockfile. A bundle from stale node_modules must not borrow
// the clean audit of a different version in that lockfile.
export function assertAuditedBundlePackages(tree, bundled) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const refuse = () => { throw new Error('Built dependency versions are not covered by the audited lock graph.'); };
  if (!object(tree)) refuse();
  const locked = new Set();
  const walk = record => {
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      if (record[field] === undefined) continue;
      if (!object(record[field])) refuse();
      for (const [name, dependency] of Object.entries(record[field])) {
        if (!name || !object(dependency) || typeof dependency.version !== 'string' || !dependency.version) refuse();
        const key = `${name}@${dependency.version}`;
        // pnpm may first show a deduped leaf and expand the same package later.
        // JSON has no object cycles; every occurrence can contribute children.
        locked.add(key); walk(dependency);
      }
    }
  };
  walk(tree);
  if (!Array.isArray(bundled)) refuse();
  for (const pkg of bundled) if (!object(pkg) || !locked.has(`${pkg.name}@${pkg.version}`)) refuse();
  return locked.size;
}
