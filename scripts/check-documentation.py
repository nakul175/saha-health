#!/usr/bin/env python3
"""Verify the R11 handover without modifying runtime, archives or test evidence."""
from pathlib import Path
from zipfile import ZipFile
import csv
import hashlib
import gzip
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
errors = []
checks = {}


def require(condition, message):
    if not condition:
        errors.append(message)


def read_json(path):
    return json.loads((ROOT/path).read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


# The application baseline checked is the current one (docs/verification/current-baseline.json).
# Earlier baselines such as application-r11-sha256.json are retained unchanged as history.
pointer=ROOT/'docs/verification/current-baseline.json'
current_baseline=json.loads(pointer.read_text())['manifest'] if pointer.exists() else 'application-r11-sha256.json'
require((ROOT/'docs/verification/application-r11-sha256.json').is_file(),'R11 baseline manifest missing')
for name,key in [(current_baseline,'baselineSourceFiles'),('original-documents-sha256.json','originalFiles')]:
    manifest=read_json('docs/verification/'+name)['files']
    for filename,expected in manifest.items():
        path=ROOT/filename
        require(path.is_file() and digest(path)==expected,'Changed baseline file: '+filename)
    checks[key]=len(manifest)

history=ROOT/'docs/history/v1.0'
entries=0
with ZipFile(history/'Health-AI-Documentation-Pack-v1.0.zip') as archive:
    require(archive.testzip() is None,'Original documentation ZIP CRC error')
    for name in archive.namelist():
        path=history/Path(*Path(name).parts[1:])
        require(path.is_file() and path.read_bytes()==archive.read(name),'Extracted original differs: '+name)
        entries+=1
with ZipFile(history/'Health-AI-Engineering-Assets-v1.0.zip') as archive:
    require(archive.testzip() is None,'Original engineering ZIP CRC error')
    for name in archive.namelist():
        require((history/name).read_bytes()==archive.read(name),'Engineering archive differs: '+name)
checks['originalArchiveEntries']=entries

office=list(history.glob('*.docx'))+list((history/'source').glob('*.docx'))+list(history.glob('*.xlsx'))
for path in office:
    with ZipFile(path) as archive:
        require(archive.testzip() is None,'Office ZIP CRC error: '+path.name)
        ET.fromstring(archive.read('word/document.xml' if path.suffix=='.docx' else 'xl/workbook.xml'))
checks['unchangedOfficeFiles']=len(office)

source=read_json('requirements/brd-v1.1.json'); trace=read_json('requirements/traceability.json')
require(digest(history/'source'/source['source']['filename'])==source['source']['sha256'],'BRD source digest differs')
require(len(source['requirements'])==176,'BRD requirement count changed')
require(trace['acceptance']=={'pending':176,'accepted':0},'Formal acceptance changed')
require(sum(trace['counts'].values())==176 and set(trace['counts'])<= {'implemented-local','partial','not-built','unverified'},'Assessment counts inconsistent')
require([r['id'] for r in source['requirements']]==[r['id'] for r in trace['requirements']],'Traceability ID order differs')
for old,new in zip(source['requirements'],trace['requirements']):
    for key,value in old.items():
        require(new.get(key)==value,f'Source requirement differs: {old["id"]} {key}')
    for path in new['evidenceContext']:
        require((ROOT/path).exists(),'Missing evidence: '+path)
checks['requirements']=176

cases=read_json('docs/history/v1.0/engineering/test_catalogue.json')
with (ROOT/'docs/current/TEST-CATALOGUE.csv').open(newline='') as stream:
    current=list(csv.DictReader(stream))
require(len(cases)==len(current)==364,'Catalogue count differs')
for old,new in zip(cases,current):
    for key,value in old.items():
        require(new.get(key)==str(value),f'Original test field differs: {old["id"]} {key}')
    require(new['currentFormalExecution']=='Not run as a formal catalogue case','Unsupported case execution claim')
checks['preservedTestCases']=len(current)

for filename in ['COMMAND-CATALOGUE.csv','HTTP-ROUTES.csv','DATA-DICTIONARY.csv']:
    with (ROOT/'docs/current'/filename).open(newline='') as stream:
        for row in csv.DictReader(stream):
            path=ROOT/row['source']; require(path.is_file(),'Missing inventory source: '+row['source'])
            if 'line' in row:
                require(0<int(row['line'])<=len(path.read_text().splitlines()),'Invalid inventory line')

with (ROOT/'docs/current/EXECUTION-REGISTER.csv').open(newline='') as stream:
    reports=list(csv.DictReader(stream))
total=0
for row in reports:
    report=read_json(row['report']); path=ROOT/row['report']
    require(row['sha256']==digest(path),'Changed execution digest: '+row['report'])
    require(row['storedCompletedAt']==report.get('completedAt','Not recorded in this report'),'Invented result date')
    require((ROOT/row['reproduce'].removeprefix('node ')).exists(),'Missing reproduction script')
    total+=int(row['passedAssertions'] or 0)
require(total==1284,'R11 assertion total differs')
checks['historicalProductAssertions']=total

# Development-slice evidence: each folder's manifest pins its reports' digests and dates.
snapshot_index=ROOT/'docs/verification/evidence-source-snapshots.json'
source_snapshots=read_json('docs/verification/evidence-source-snapshots.json').get('snapshots',{}) if snapshot_index.exists() else {}
for additional_name in ['evidence-source-snapshots-conformance-import.json','evidence-source-snapshots-composite-measures.json','evidence-source-snapshots-guided-media-impact.json','evidence-source-snapshots-alert-transition.json','evidence-source-snapshots-routine-retention.json','evidence-source-snapshots-refresh-contrast-20261012.json']:
    additional_index=ROOT/'docs/verification'/additional_name
    if additional_index.exists():
        for source_path,versions in json.loads(additional_index.read_text()).get('snapshots',{}).items():
            existing=source_snapshots.setdefault(source_path,{})
            for expected,entry in versions.items():
                require(expected not in existing or existing[expected]==entry,'Conflicting historical source snapshot: '+source_path)
                existing.setdefault(expected,entry)
slice_total=0
supplement={}
for supplement_name in ['tests/evidence/app-first-guidance-media-impact-integration/author-artifacts.json','tests/evidence/reporting-completeness-root-integration/author-artifacts.json','tests/evidence/verification-programme-root-integration/author-artifacts.json','tests/evidence/privacy-registration-root-integration/author-artifacts.json','tests/evidence/alert-transition-guidance-root-integration/author-artifacts.json']:
    supplement_path=ROOT/supplement_name
    if supplement_path.exists():
        for path,expected in json.loads(supplement_path.read_text()).get('files',{}).items():
            require(path not in supplement or supplement[path]==expected,'Conflicting supplemental artifact: '+path)
            supplement.setdefault(path,expected)
for evidence_path,expected in supplement.items():
    path=ROOT/evidence_path
    require(evidence_path.startswith('tests/evidence/') and re.fullmatch(r'[a-f0-9]{64}',str(expected)) and path.is_file() and digest(path)==expected,'Changed supplemental author artifact: '+evidence_path)
for manifest_path in sorted((ROOT/'tests/evidence').glob('*/manifest.json')):
    manifest=json.loads(manifest_path.read_text())
    # Preserve the authors' immutable manifests, including their existing
    # digest layouts. Only report-level numeric assertion counts are summed.
    entries=manifest.get('sha256',manifest.get('files',manifest.get('filesSha256',manifest.get('reports'))))
    # Descriptive reports without digests require the exact complete root supplement.
    if entries is None or isinstance(entries,dict) and entries and all(isinstance(v,(int,float)) or isinstance(v,dict) and 'sha256' not in v for v in entries.values()):
        key=str(manifest_path.relative_to(ROOT))
        if key in supplement:
            artifacts=[p for p in manifest_path.parent.rglob('*') if p.is_file()]
            require(all(str(p.relative_to(ROOT)) in supplement for p in artifacts),'Incomplete supplemental author artifacts: '+key)
            entries={str(p.relative_to(ROOT)):supplement[str(p.relative_to(ROOT))] for p in artifacts if str(p.relative_to(ROOT)) in supplement}
    # A cold reviewer can retain a list of explicit path/digest records.
    # Validate that schema without rewriting the immutable author/review manifest.
    if isinstance(entries,list):
        valid=all(isinstance(meta,dict) and isinstance(meta.get('path'),str) and re.fullmatch(r'[a-f0-9]{64}',str(meta.get('sha256',''))) for meta in entries)
        require(valid,'Invalid explicit evidence digest list: '+str(manifest_path.relative_to(ROOT)))
        require(valid and len({meta['path'] for meta in entries})==len(entries),'Duplicate evidence digest path: '+str(manifest_path.relative_to(ROOT)))
        entries={meta['path']:meta for meta in entries} if valid else {}
    # These named maps pin application source rather than result reports.
    # Check every source digest, preserving its original layout and source scope.
    for source_key in ['sourceSha256','sourcePins','applicationSourceUnchanged','unchangedProtectedSources','unchangedProtectedSource','originalEvidenceSha256','unchangedOriginals']:
        source_entries=manifest.get(source_key)
        if source_entries is None:
            continue
        valid=isinstance(source_entries,dict) and all((path.startswith(('app/','worker/','lib/','public/','db/','drizzle/','scripts/','tests/','docs/current/','docs/history/v1.0/source/')) or (str(manifest_path.relative_to(ROOT))=='tests/evidence/alert-disclosure-before/manifest.json' and source_key=='sourcePins' and path=='dist/server/index.js')) and re.fullmatch(r'[a-f0-9]{64}',str(expected.get('sha256') if isinstance(expected,dict) else expected)) and (not isinstance(expected,dict) or 'bytes' not in expected or isinstance(expected['bytes'],int) and expected['bytes']>=0) for path,expected in source_entries.items())
        require(valid,'Invalid source digest map: '+str(manifest_path.relative_to(ROOT)))
        if valid:
            entries=entries if isinstance(entries,dict) else {}
            for path,expected in source_entries.items():
                existing=entries.get(path)
                expected_digest=expected.get('sha256') if isinstance(expected,dict) else expected
                require(existing is None or (existing.get('sha256') if isinstance(existing,dict) else existing)==expected_digest,'Conflicting source digest: '+path)
                entries.setdefault(path,expected)
    # Independent review can name report metadata separately while pinning every
    # actual file in sha256. Preserve that original layout and verify both maps.
    if isinstance(manifest.get('sha256'),dict) and isinstance(manifest.get('reports'),dict) and all(isinstance(meta,dict) and 'path' in meta for meta in manifest['reports'].values()):
        previous_entries=entries if isinstance(entries,dict) else {}
        entries={path:{'sha256':expected} for path,expected in manifest['sha256'].items()}
        for path,meta in previous_entries.items():
            if path.startswith(('app/','lib/','public/','db/','drizzle/','scripts/','tests/')):
                entries.setdefault(path,meta)
        for label,meta in manifest['reports'].items():
            path=meta['path']
            require(path in entries,'Unpinned named evidence report: '+str(label))
            if path in entries:
                require('sha256' not in meta or meta['sha256']==entries[path]['sha256'],'Conflicting named evidence digest: '+str(label))
                entries[path].update({key:value for key,value in meta.items() if key not in ('path','sha256')})
    # Some immutable original author manifests contain only descriptive totals.
    # They qualify only when a root supplement checks every retained artifact in
    # that exact folder directly; no report bytes use historical source fallback.
    if entries is None and str(manifest_path.relative_to(ROOT)) in supplement:
        artifacts=[p for p in manifest_path.parent.rglob('*') if p.is_file()]
        require(all(str(p.relative_to(ROOT)) in supplement for p in artifacts),'Incomplete supplemental author artifacts: '+str(manifest_path.relative_to(ROOT)))
        entries={str(p.relative_to(ROOT)):supplement[str(p.relative_to(ROOT))] for p in artifacts if str(p.relative_to(ROOT)) in supplement}
    require(isinstance(entries,dict) and bool(entries),'Missing evidence digests: '+str(manifest_path.relative_to(ROOT)))
    for report,meta in (entries or {}).items():
        path=(ROOT/report) if report.startswith(('tests/','docs/','lib/','app/','worker/','public/','db/','drizzle/','scripts/')) else manifest_path.parent/report
        expected=meta.get('sha256') if isinstance(meta,dict) else meta
        # One explicitly bound generated diagnostic preimage. It never substitutes for current application source or report evidence.
        if str(manifest_path.relative_to(ROOT))=='tests/evidence/alert-disclosure-before/manifest.json' and report=='dist/server/index.js':
            binding=read_json('tests/evidence/alert-disclosure-author/manifest.json')['archivedOriginalSource'][report]
            archive=ROOT/binding['artifact']
            require(binding['originalManifest']==str(manifest_path.relative_to(ROOT)) and binding['originalManifestSha256']==digest(manifest_path) and binding['originalManifestBytes']==manifest_path.stat().st_size,'Unbound original generated diagnostic manifest')
            require(binding['originalManifestPin']=='sourcePins.dist/server/index.js' and binding['encoding']=='gzip-lossless' and binding['sha256']==expected and binding['bytes']==meta.get('bytes'),'Unbound generated diagnostic source pin')
            require(archive.is_file() and digest(archive)==binding['artifactSha256'] and archive.stat().st_size==binding['artifactBytes'],'Changed generated diagnostic gzip')
            if archive.is_file():
                preimage=gzip.decompress(archive.read_bytes())
                require(hashlib.sha256(preimage).hexdigest()==expected and len(preimage)==binding['bytes'],'Changed generated diagnostic preimage')
            continue
        # One exact historical authorization-matrix source pair; no report or oracle fallback.
        if str(manifest_path.relative_to(ROOT))=='tests/evidence/routine-current-source-integration-20261011/manifest.json' and report=='tests/nfr/authorisation-matrix-current.mjs' and path.is_file() and digest(path)!=expected:
            binding=read_json('docs/verification/evidence-source-snapshot-selective-matrix-20261013.json')
            require(binding['originalManifest']==str(manifest_path.relative_to(ROOT)) and binding['originalManifestSha256']==digest(manifest_path)=='9c700f935ec08bc8d55766f8e72a6f4190ed54c03abaf190f336abb03149f017' and binding['originalManifestBytes']==manifest_path.stat().st_size==3549,'Changed original selective matrix manifest')
            require(binding['sourcePath']==report and binding['originalManifestPin']=='sourceSha256.tests/nfr/authorisation-matrix-current.mjs' and binding['originalSourceSha256']==expected=='3779f8a562c132fac2b2ded74101a8438b5655389aacfb75e3da4990982fd5d3','Unbound historical selective matrix source')
            current_pin=read_json('docs/verification/'+current_baseline)['files'].get(report)
            require(current_pin==digest(path)==binding['currentSourceSha256'],'Current selective matrix source must match current baseline')
            archive=(ROOT/binding['archivedSource']).resolve()
            require(archive.is_relative_to(ROOT/'docs/verification/evidence-source-snapshots') and archive.is_file() and archive.stat().st_size==binding['originalSourceBytes'] and digest(archive)==expected,'Changed exact selective matrix preimage')
            path=archive
        # One bound historical test-source preimage: current test bytes remain checked by the current baseline.
        # This never substitutes for a test report, expected image, assertion count or current execution.
        if str(manifest_path.relative_to(ROOT))=='tests/evidence/guided-home/manifest.json' and report=='tests/ui/app-first-phone.spec.mjs' and path.is_file() and digest(path)!=expected:
            binding=read_json('docs/verification/evidence-source-snapshot-phone-navigation-20261012.json')
            require(binding['originalManifest']==str(manifest_path.relative_to(ROOT)) and binding['originalManifestSha256']==digest(manifest_path) and binding['originalManifestBytes']==manifest_path.stat().st_size,'Unbound historical phone-source manifest')
            require(binding['sourcePath']==report and binding['originalManifestPin']=='files.tests/ui/app-first-phone.spec.mjs' and binding['originalSourceSha256']==expected and binding['originalSourceBytes']==meta.get('bytes'),'Unbound historical phone-source pin')
            current_pin=read_json('docs/verification/'+current_baseline)['files'].get(report)
            require(current_pin==digest(path)==binding['currentSourceSha256'],'Current phone test source is not independently pinned by the current baseline')
            archive=(ROOT/binding['archivedSource']).resolve()
            require(archive.is_relative_to(ROOT/'docs/verification/evidence-source-snapshots') and archive.is_file() and archive.stat().st_size==binding['originalSourceBytes'] and digest(archive)==expected,'Changed historical phone-source preimage')
            path=archive
        # Preserve the exact historical offline-purge fixture preimage while
        # independently pinning the current fixture in the active baseline.
        if str(manifest_path.relative_to(ROOT))=='tests/evidence/app-first-offline-rawkey-broad/manifest.json' and report=='tests/integration-offline-guided-purge-failure-browser.mjs' and path.is_file() and digest(path)!=expected:
            binding=read_json('docs/verification/evidence-source-snapshot-offline-purge-connection-close-20261013.json')
            require(binding['originalManifest']==str(manifest_path.relative_to(ROOT)) and binding['originalManifestSha256']==digest(manifest_path) and binding['originalManifestBytes']==manifest_path.stat().st_size,'Unbound historical offline-purge manifest')
            require(binding['sourcePath']==report and binding['originalManifestPin']=='sourceSha256.tests/integration-offline-guided-purge-failure-browser.mjs' and binding['originalSourceSha256']==expected and isinstance(binding['originalSourceBytes'],int) and binding['originalSourceBytes']>0,'Unbound historical offline-purge source pin')
            current_pin=read_json('docs/verification/'+current_baseline)['files'].get(report)
            require(current_pin==digest(path)==binding['currentSourceSha256'],'Current offline-purge fixture is not independently pinned by the current baseline')
            archive=(ROOT/binding['archivedSource']).resolve()
            require(archive.is_relative_to(ROOT/'docs/verification/evidence-source-snapshots') and archive.is_file() and archive.stat().st_size==binding['originalSourceBytes'] and digest(archive)==expected,'Changed historical offline-purge source preimage')
            path=archive
        # An author can pin shared source before a later independently reviewed feature changes it.
        # Preserve and check the exact earlier bytes; current runtime is still checked above.
        # Report/evidence paths always remain checked in place and cannot use an archive.
        if report.startswith(('app/','worker/','lib/','public/','db/','drizzle/','scripts/')) and path.is_file() and digest(path)!=expected:
            archived=source_snapshots.get(report,{}).get(expected)
            if archived:
                candidate=(ROOT/archived['path']).resolve()
                require(candidate.is_relative_to(ROOT/'docs/verification/evidence-source-snapshots') and candidate.is_file() and candidate.stat().st_size==archived['bytes'],'Invalid historical source snapshot: '+report)
                path=candidate
        require(path.is_relative_to(ROOT) and path.is_file() and digest(path)==expected,'Changed slice evidence: '+str(path))
        if isinstance(meta,dict):
            if 'bytes' in meta:
                require(path.is_file() and path.stat().st_size==meta['bytes'],'Changed evidence size: '+str(path))
            count=meta.get('passed',0)
            require(count is None or (type(count) is int and count>=0),'Invalid evidence assertion count: '+str(path))
            if type(count) is int and count>=0:
                slice_total+=count
checks['sliceEvidenceAssertions']=slice_total

# Historical links retain original locations. Check authored current links only.
documents=[ROOT/'README.md',ROOT/'CLAUDE.md']+list((ROOT/'docs').glob('*.md'))+list((ROOT/'docs/current').glob('*.md'))+[ROOT/'docs/history/README.md',ROOT/'docs/reference/README.md']
links=0
for document in documents:
    for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)',document.read_text()):
        target=target.split('#',1)[0]
        if not target or re.match(r'^[a-z]+:',target):
            continue
        path=(document.parent/target).resolve()
        require(path.is_relative_to(ROOT) and path.exists(),f'Broken link in {document.name}: {target}')
        links+=1
checks['currentRelativeLinks']=links

generated=subprocess.run([sys.executable,str(ROOT/'scripts/build-documentation.py'),'--check'],cwd=ROOT,capture_output=True,text=True)
require(generated.returncode==0,generated.stdout+generated.stderr)
checks.update(read_json('docs/verification/generated-inventory.json'))
original=(history/'Health-AI-Wireframes-v1.0.html').read_text()
annotated=(ROOT/'docs/current/Health-AI-Wireframes-v1.1.html').read_text()
require(re.findall(r'<script>(.*?)</script>',original,re.S)==re.findall(r'<script>(.*?)</script>',annotated,re.S),'Prototype script changed')
require('R11 documentation review' in annotated and 'All 176 BRD acceptances remain pending' in annotated,'Wireframe boundary missing')
checks['prototypeScriptPreserved']=True
if errors:
    print('\n'.join(errors),file=sys.stderr)
    raise SystemExit(1)
print(json.dumps({'status':'passed','scope':'Documentation integrity against the current baseline ('+current_baseline+'); not product execution or formal acceptance',**checks},indent=2))
