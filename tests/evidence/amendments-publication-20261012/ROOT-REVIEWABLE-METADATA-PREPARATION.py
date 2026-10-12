#!/usr/bin/env python3
"""Root review only: amendments-specific metadata preparation. Does not run itself.
The child did NOT execute these mutations after automatic approval rejected twice.
Root must assess current authorization and approval review before execution.
Pattern source: individually inspected receiving-handover metadata2affc8ea.
No push/merge/hosting/runtime/minimum relaxation.
"""
from pathlib import Path
import json,hashlib,subprocess
R=Path(__file__).resolve().parents[3]/'work/saha-next50-amendments-20261012'
P=R.parent/'saha-next50-handover-20261012'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip()=='ebca2572153af2a208f6517adcc8a3abd11cc2ed', 'Review immutable source first; child review-only successor may require explicit adjusted expected head'
m=json.loads((R/'tests/evidence/traceable-amendments-20261012/manifest.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert all(sha(R/k)==v for k,v in m['sourcePins'].items())
base=json.loads(subprocess.check_output(['git','show','22a271033eaa57e124a235fc615744928f1ac106:tests/regression-baseline.json'],cwd=R))
assert json.loads((R/'tests/regression-baseline.json').read_text())['suites']==base['suites']
assert hashlib.sha256(json.dumps(base['suites'],sort_keys=True,separators=(',',':')).encode()).hexdigest()=='b404c185dfb475b4e4a0e2df28df4fa00e28a4ec50c762e40135eaff377ebc96'
def pattern(path):
 return subprocess.check_output(['git','show','2affc8ea:'+path],cwd=P,text=True)
# Original sevenjobs/selections plus solely additive native lane and strong391 guard.
s=pattern('.github/workflows/ci.yml').replace('Receiving ASHA handover acknowledgement','Assigned ASHA traceable correction draft').replace('21769','21783').replace('SAHA_HANDOVER_OUTPUT','SAHA_AMENDMENTS_OUTPUT').replace('handover','amendments').replace('"minPassed":22','"minPassed":35').replace('"minPassed":40','"minPassed":45').replace('observed22 intent and40 native','observed35 intent and45 native')
(R/'.github/workflows/ci.yml').write_text(s)
# Existing authority/light smoke checks all preserved, one explicit new-route row.
p=R/'tests/nfr/authorisation-matrix-current.mjs';old=p.read_bytes();oldsha=hashlib.sha256(old).hexdigest()
s=pattern('tests/nfr/authorisation-matrix-current.mjs').replace('/api/handover','/api/amendments').replace('Receiving handover','Traceable amendments').replace('receiving handover','traceable amendments').replace('Today/Routine/Handover','Today/Routine/Amendments')
p.write_text(s)
a=R/'docs/verification/evidence-source-snapshots'/('amendments-matrix-'+oldsha[:12]+'.mjs');a.write_bytes(old)
binding={'originalManifest':'tests/evidence/routine-current-source-integration-20261011/manifest.json','sourcePath':str(p.relative_to(R)),'originalSourceSha256':oldsha,'originalSourceBytes':len(old),'currentSourceSha256':sha(p),'archivedSource':str(a.relative_to(R)),'scope':'Historical exact-source preimage only; no reports/goldens/minima substituted'}
orig=R/binding['originalManifest'];binding.update(originalManifestSha256=sha(orig),originalManifestBytes=orig.stat().st_size)
(R/'docs/verification/evidence-source-snapshot-amendments-matrix-20261012.json').write_text(json.dumps(binding,indent=2))
s=pattern('scripts/check-documentation.py').replace('evidence-source-snapshot-handover-matrix-20261012.json','evidence-source-snapshot-amendments-matrix-20261012.json').replace('before the additive receiving-handover route','before the additive amendment-review route')
(R/'scripts/check-documentation.py').write_text(s)
s=pattern('tests/smoke/local-routine-current-smoke.mjs').replace('/api/handover','/api/amendments').replace('Receiving handover','Traceable amendments').replace('receiving handover','amendment source review').replace('result.json.work','result.json.visits')
(R/'tests/smoke/local-routine-current-smoke.mjs').write_text(s)
s=pattern('tests/lib/uat-selection.mjs').replace('HANDOVER_SCREEN','AMENDMENTS_SCREEN').replace('Candidate receiving ASHA handover (/handover; acknowledgement only; deployment pending)','Candidate ASHA traceable correction (/amendments; draft creation only; deployment pending)').replace('app/handover/page.tsx','app/amendments/page.tsx').replace('app/handover/handover.tsx','app/amendments/amendments.tsx')
(R/'tests/lib/uat-selection.mjs').write_text(s)
assert all(sha(R/k)==v for k,v in m['sourcePins'].items()), 'Runtime/owned tests must remain reviewed bytes'
print('Only delegated metadata/additive original-route checks patched; reviewed runtime unchanged. Root must run actual qualifying tests before any baseline registration.')
