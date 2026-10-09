#!/usr/bin/env python3
"""Apply the reviewed, exact-source workspace wiring and preserve source evidence.

Used once on the named feature branch; no database, external provider, host or
acceptance status is touched. Run from a complete checkout. Any source drift fails.
"""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path.cwd()
p = root / 'app/workspace.tsx'
old = p.read_text()
expected = 'c7d6971820b8d13c77859413d2278dbd6a45dcbfef13d0b164c7a2083cde8e8f'
marker = "import { WorkerToday, WorkerNavigation, WorkerSpace } from './worker-day';"
if marker in old:
    raise SystemExit('Wiring already applied; do not regenerate evidence blindly.')
if hashlib.sha256(p.read_bytes()).hexdigest() != expected:
    raise SystemExit('Workspace differs from reviewed original. Rebase and review before applying.')
new = marker + "\nimport { workerDayEnabled } from '@/lib/saha/worker-day';\n" + old
# Keep the client directive first.
new = new.replace("'use client';\n", '', 1)
new = "'use client';\n" + new
needle = " const orgRef=useRef<string|null>(null);"
replacement = " const [workerDayRequested,setWorkerDayRequested]=useState(false);\n useEffect(()=>{setWorkerDayRequested(appFirst&&new URLSearchParams(window.location.search).get('experience')==='worker-day');},[appFirst]);\n const workerDay=workerDayEnabled(appFirst,workerDayRequested,data);\n" + needle
assert new.count(needle) == 1
new = new.replace(needle, replacement, 1)
needle = "{appTab==='home'&&data.role==='asha'&&<FrontlineGuidance"
assert new.count(needle) == 1
new = new.replace(needle,"{appTab==='home'&&data.role==='asha'&&workerDay&&<WorkerToday data={data} busy={busy} open={p=>navigate(()=>{void openPerson(p,'work list')})} work={()=>go('work')} sync={()=>navigate(()=>{setAppTab('sync');setSelected(null);setVisitId(null)})}/>}\n {appTab==='home'&&data.role==='asha'&&!workerDay&&<FrontlineGuidance",1)
needle = "{appTab==='more'&&<FrontlineMore"
assert new.count(needle) == 1
new = new.replace(needle,"{appTab==='more'&&workerDay&&<WorkerSpace data={data} busy={busy} go={go} sync={()=>navigate(()=>{setAppTab('sync');setSelected(null);setVisitId(null)})}/>}\n {appTab==='more'&&!workerDay&&<FrontlineMore",1)
needle = "{appFirst&&<FrontlineNavigation"
assert new.count(needle) == 1
new = new.replace(needle,"{appFirst&&workerDay&&<WorkerNavigation view={view} tab={appTab} patientOpen={!!person} busy={busy} go={go} choose={tab=>navigate(()=>{setSelected(null);setVisitId(null);setAppTab(tab)})}/>}\n {appFirst&&!workerDay&&<FrontlineNavigation",1)
# Retain the exact previous workspace for historical evidence references.
index_path = root / 'docs/verification/evidence-source-snapshots-guided-media-impact.json'
index = json.loads(index_path.read_text())
archive = root / 'docs/verification/evidence-source-snapshots' / (expected + '.txt')
if archive.exists() and archive.read_bytes() != p.read_bytes():
    raise SystemExit('Conflicting historical source archive.')
archive.write_bytes(p.read_bytes())
entry = {'path': str(archive.relative_to(root)), 'bytes': p.stat().st_size}
versions = index.setdefault('snapshots', {}).setdefault('app/workspace.tsx', {})
if expected in versions and versions[expected] != entry:
    raise SystemExit('Conflicting historical source index.')
versions[expected] = entry
index_path.write_text(json.dumps(index, indent=2) + '\n')
p.write_text(new)
# Record limits, not a pass. Status will be supplemented by actual runner evidence.
note = '\n\n## 9 October 2026 — Worker-day entry candidate\n\nSee [worker-day delivery](docs/current/worker-day-delivery/README.md). Opt-in synthetic ASHA Today presentation reuses current scoped records, audited open and existing guided capture/save. No schema, domain command, role, clinical rule or acceptance status changed. Tests and production/device boundaries are recorded in that document and the associated draft PR; source presence is not a passed acceptance case.\n'
with (root/'VALIDATION.md').open('a') as f: f.write(note)
for path in ['docs/IMPLEMENTATION.md','docs/NEXT-DELIVERY.md','docs/QUALIFICATION.md']:
    with (root/path).open('a') as f:f.write('\n\n### Worker-day entry candidate — 9 October 2026\n\n[Bounded delivery and remaining qualification](current/worker-day-delivery/README.md). Opt-in synthetic presentation; no formal requirement or clinical acceptance promoted.\n')
with (root/'HANDOVER.md').open('a') as f:f.write(note)
with (root/'docs/DOCUMENTATION-INDEX.md').open('a') as f:f.write('\n\n[Worker-day entry candidate](current/worker-day-delivery/README.md): opt-in synthetic entry, source reuse, tests and limits.\n')
subprocess.run(['git','add','app','lib/saha/worker-day.ts','tests/worker-day-contract.mjs','tests/smoke/worker-day-browser.mjs','docs','VALIDATION.md','HANDOVER.md'],check=True)
subprocess.run(['python3','scripts/update-baseline.py','worker-day-2026-10-09','Worker-day entry candidate; source integrity only, acceptance pending'],check=True)
subprocess.run(['python3','scripts/build-documentation.py'],check=True)
print(json.dumps({'workspace_sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'source_preserved': expected, 'acceptance': 'not assessed'}))
