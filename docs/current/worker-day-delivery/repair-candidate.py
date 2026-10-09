#!/usr/bin/env python3
"""One-time exact-source repair of new candidate code, not a production/deploy action."""
from pathlib import Path
import hashlib
import json

root = Path.cwd()
p = root / 'app/workspace.tsx'
prior = '797cd08d6e6f0477a78be95218fbcdea6def2fb007da029586037179a90dafb1'
assert hashlib.sha256(p.read_bytes()).hexdigest() == prior, 'Unexpected workspace; review concurrent change.'
old = p.read_text()
fragment = " const [workerDayRequested,setWorkerDayRequested]=useState(false);\n useEffect(()=>{setWorkerDayRequested(appFirst&&new URLSearchParams(window.location.search).get('experience')==='worker-day');},[appFirst]);"
assert old.count(fragment) == 1
new = old.replace(fragment, ' const workerDayRequested=useWorkerDayRequest();', 1)
new = new.replace("'use client';\n", "'use client';\nimport { useWorkerDayRequest } from './worker-day-request';\n", 1)
archive = root / 'docs/verification/evidence-source-snapshots' / (prior + '.txt')
if archive.exists(): assert archive.read_bytes() == p.read_bytes()
else: archive.write_bytes(p.read_bytes())
index_path = root / 'docs/verification/evidence-source-snapshots-guided-media-impact.json'
index = json.loads(index_path.read_text())
index.setdefault('snapshots', {}).setdefault('app/workspace.tsx', {})[prior] = {'path': str(archive.relative_to(root)), 'bytes': p.stat().st_size}
index_path.write_text(json.dumps(index, indent=2) + '\n')
p.write_text(new)
test = root / 'tests/smoke/worker-day-browser.mjs'
s = test.read_text()
old_check = "  check(!await page.locator('#worker-today-title').count(), 'Person context replaces Today');"
new_check = "  await page.locator('#worker-today-title').waitFor({ state: 'hidden' });\n  check(!await page.locator('#worker-today-title').isVisible(), 'Person context replaces Today');"
assert s.count(old_check) == 1
# Existing workspace intentionally keeps hidden panels mounted; visibility is the actual outcome.
test.write_text(s.replace(old_check, new_check, 1))
with (root / 'VALIDATION.md').open('a') as f:
    f.write('\n\n## 9 October 2026 — Worker-day initial failures and candidate repair\n\nRun 37922392180 on 4e012f8 failed the lint ratchet (1393 vs 1392 errors) and the new browser assertion after six positives; the later HTTP run was cancelled by a newer revision. No full pass is claimed. The added effect is replaced with an external-store query hook, without suppressing a rule or raising the baseline. The browser assertion now waits for actual hidden state, because the unchanged workspace deliberately keeps inactive panels mounted. It still requires the person context to replace Today visually. All assertions remain; original failure artifacts and Git history are retained. Fresh exact-source qualification is required.\n')
print(json.dumps({'workspace': hashlib.sha256(p.read_bytes()).hexdigest(), 'prior': prior, 'status': 'Repair applied; not yet qualified'}))
