#!/usr/bin/env python3
"""Apply reviewed application edits; the CI author may not create or modify workflows."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path.cwd()
folder = root / 'docs/current/worker-day-offline'
patches = json.loads((folder/'patch.json').read_text())
prepared = []
for patch in patches:
    path = root / patch['path']
    original = path.read_bytes()
    if hashlib.sha256(original).hexdigest() != patch['before_sha256']:
        raise SystemExit('Reviewed preimage changed: '+patch['path'])
    text = original.decode()
    for old, new in patch['replacements']:
        if text.count(old) != 1:
            raise SystemExit('Replacement is not unique: '+patch['path'])
        text = text.replace(old,new,1)
    if patch.get('append_file'):
        text += '\n' + (folder/patch['append_file']).read_text()
    if hashlib.sha256(text.encode()).hexdigest() != patch['after_sha256']:
        raise SystemExit('Unexpected patch output: '+patch['path'])
    prepared.append((patch,path,original,text))
index_path = root/'docs/verification/evidence-source-snapshots-guided-media-impact.json'
index = json.loads(index_path.read_text())
for patch,path,original,text in prepared:
    digest = patch['before_sha256']
    archive = root/'docs/verification/evidence-source-snapshots'/(digest+'.txt')
    if archive.exists() and archive.read_bytes() != original:
        raise SystemExit('Historical source conflict: '+patch['path'])
    archive.write_bytes(original)
    entry = {'path':str(archive.relative_to(root)),'bytes':len(original)}
    versions = index.setdefault('snapshots',{}).setdefault(patch['path'],{})
    if digest in versions and versions[digest] != entry:
        raise SystemExit('Historical index conflict: '+patch['path'])
    versions[digest] = entry
    path.write_text(text)
index_path.write_text(json.dumps(index,indent=2)+'\n')
note = '\n\n## 9 October 2026 — Worker-day offline continuation candidate\n\nSee [offline delivery](docs/current/worker-day-offline/README.md). Existing encrypted storage and sync contracts support the prepared-visit journey. No clinical, programme, production or complete D04/D05 acceptance follows from source publication. No merge or deployment is authorised.\n'
for path in ['HANDOVER.md','VALIDATION.md']:
    with (root/path).open('a') as output: output.write(note)
with (root/'VALIDATION.md').open('a') as output:
    output.write('\nPreparation run 37937029543 failed immutable historical-test preservation before publication. The original driver now remains unchanged; its current successor preserves all 12 assertions and the stable unit/field-shell minimum with an explicit thirteen-asset fixture. Run 37937764564 passed preparation integrity but its bot could not publish a new workflow. Workflow publication remains with the authorised repository connector; this script now stages application/documentation only and does not request broader bot permissions. Both failures remain recorded.\n')
for path in ['docs/IMPLEMENTATION.md','docs/NEXT-DELIVERY.md','docs/QUALIFICATION.md']:
    with (root/path).open('a') as output:
        output.write('\n\n### Worker-day offline continuation — candidate\n\n[Story, implementation and verification boundary](current/worker-day-offline/README.md). Existing encrypted vault, scoped packets and draft sync are reused; no new approval or data store. Parent requirements remain pending.\n')
with (root/'docs/DOCUMENTATION-INDEX.md').open('a') as output:
    output.write('\n\n[Worker-day offline continuation](current/worker-day-offline/README.md): prepared-visit resume and duplicate-safe-sync qualification.\n')
subprocess.run(['git','add','public','app/worker-day.tsx','scripts/test-catalogue.mjs','tests/worker-day-offline-contract.mjs','tests/worker-day-shell-current.mjs','tests/smoke/worker-day-offline-browser.mjs','docs','HANDOVER.md','VALIDATION.md'],check=True)
subprocess.run(['node','tests/uat/coverage-map.mjs'],check=True)
subprocess.run(['python3','scripts/update-baseline.py','worker-day-offline-2026-10-09','Worker-day offline continuation candidate; source integrity only'],check=True)
subprocess.run(['python3','scripts/build-documentation.py'],check=True)
subprocess.run(['git','add','docs','HANDOVER.md','VALIDATION.md'],check=True)
changed = subprocess.check_output(['git','diff','--cached','--name-only'],text=True).splitlines()
allowed_prefixes = ('public/','docs/')
allowed_paths = {'app/worker-day.tsx','scripts/test-catalogue.mjs','HANDOVER.md','VALIDATION.md'}
if not changed or any(p not in allowed_paths and not p.startswith(allowed_prefixes) for p in changed):
    raise SystemExit('Unexpected staged path; refusing publication: '+repr(changed))
print(json.dumps({'source_patched':[item['path'] for item in patches],'acceptance':'pending','workflow_changes':False}))
