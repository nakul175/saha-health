#!/usr/bin/env python3
"""Regenerate candidate metadata, not runtime, migrations or acceptance status."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path.cwd()
raw = (root / 'requirements/brd-v1.1.json').read_bytes()
assert hashlib.sha1(f'blob {len(raw)}\0'.encode() + raw).hexdigest() == '889fbe916fd9dca375635cc54b01dabeda75d9d2', 'Original requirements changed; review first'
source = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
slug = 'worker-today-' + source[:12]
manifest = root / 'docs/verification' / ('application-' + slug + '-sha256.json')
assert not manifest.exists(), 'This source manifest already exists; preserve it and review before regenerating'
marker = '## Worker Today entry candidate — 9 October 2026'
for name in ['VALIDATION.md', 'HANDOVER.md']:
    path = root / name
    if marker not in path.read_text():
        with path.open('a') as stream:
            stream.write('\n\n' + marker + '\n\nSee [candidate scope and evidence](docs/current/WORKER-TODAY-PREVIEW.md). This is an opt-in synthetic/training entry that reuses the existing protected visit editor and save commands. No domain rule, schema, historical assessment or formal acceptance is changed. Candidate tests and limits are in PR #182. No merge or deployment is authorised.\n')
for name in ['IMPLEMENTATION.md', 'NEXT-DELIVERY.md', 'QUALIFICATION.md', 'DOCUMENTATION-INDEX.md']:
    path = root / 'docs' / name
    if marker not in path.read_text():
        with path.open('a') as stream:
            stream.write('\n\n' + marker + '\n\n[Candidate scope, reuse and qualification](current/WORKER-TODAY-PREVIEW.md). This opt-in entry is an incremental presentation change. Original requirement assessments and acceptance statuses remain unchanged; no whole-parent completion is inferred.\n')
subprocess.run(['node', 'tests/uat/coverage-map.mjs'], check=True)
subprocess.run(['python3', 'scripts/update-baseline.py', slug, 'Worker Today entry candidate; source integrity, not product acceptance'], check=True)
subprocess.run(['python3', 'scripts/check-documentation.py'], check=True)
subprocess.run(['node', 'scripts/audit-requirements.mjs', '--check'], check=True)
subprocess.run(['node', 'scripts/test.mjs', '--check-catalogue'], check=True)
print(json.dumps({'source': source, 'manifest': str(manifest.relative_to(root)), 'acceptance_changed': False, 'runtime_changed_by_preparation': False}))
