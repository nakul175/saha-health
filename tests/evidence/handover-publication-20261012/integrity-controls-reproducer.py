from pathlib import Path
import json,subprocess,hashlib,datetime,os,shutil
root=Path.cwd();source=root/'work/saha-next50-handover-20261012';out=root/'outputs/saha-next50-20261012/handover/integrity002';out.mkdir(exist_ok=True);scratch=root/'work/saha-handover-integrity-control-002-20261012';python='/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3'
assert not scratch.exists();scratch.mkdir()
files=subprocess.check_output(['git','ls-files','-z'],cwd=source).decode().split('\0')
for name in filter(None,files):
 p=source/name;q=scratch/name
 if not p.is_file():continue
 q.parent.mkdir(parents=True,exist_ok=True)
 if p.is_symlink():q.symlink_to(os.readlink(p))
 else:os.link(p,q)
binding=scratch/'docs/verification/evidence-source-snapshot-handover-matrix-20261012.json';data=json.loads(binding.read_text());archive=scratch/data['archivedSource'];matrix=scratch/data['sourcePath'];manifest=scratch/data['originalManifest'];report=scratch/'tests/evidence/handover-publication-20261012/root-minima-001.json'
# Hardlinks provide an exact read-only mirror; make every mutated control anchor a separate private inode first.
for p in [binding,archive,matrix,manifest,report]:
 b=p.read_bytes();p.unlink();p.write_bytes(b)
anchors={str(p.relative_to(source)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [source/data['archivedSource'],source/data['sourcePath'],source/data['originalManifest'],source/'tests/evidence/handover-publication-20261012/root-minima-001.json',source/'docs/verification/evidence-source-snapshot-handover-matrix-20261012.json']}
check=lambda:subprocess.run([python,'scripts/check-documentation.py'],cwd=scratch,capture_output=True,text=True)
initial=check();(out/'integrity-positive-before.log').write_text(initial.stdout+initial.stderr);assert initial.returncode==0,initial.stdout+initial.stderr
cases=[('historical-source-tamper',archive,lambda b:b+b'\n// changed\n'),('original-manifest-tamper',manifest,lambda b:b+b' '),('current-source-tamper',matrix,lambda b:b+b'\n// changed\n'),('current-evidence-tamper',report,lambda b:b+b' '),('wrong-current-pin',binding,lambda b:json.dumps({**json.loads(b),'currentSourceSha256':'0'*64}).encode()),('wrong-source-path',binding,lambda b:json.dumps({**json.loads(b),'sourcePath':'tests/smoke/local-routine-current-smoke.mjs'}).encode()),('outside-archive',binding,lambda b:json.dumps({**json.loads(b),'archivedSource':'tests/nfr/authorisation-matrix-current.mjs'}).encode())]
results=[]
for name,p,mutate in cases:
 old=p.read_bytes()
 try:
  p.write_bytes(mutate(old));r=check();(out/('integrity-'+name+'.log')).write_text(r.stdout+r.stderr);assert r.returncode!=0,name;results.append({'case':name,'rejected':True,'exitCode':r.returncode,'diagnostic':(r.stdout+r.stderr).strip()[:600]})
 finally:p.write_bytes(old)
# Same matching source bytes through a symlink outside the archived-source boundary must still refuse.
b=archive.read_bytes();archive.unlink();archive.symlink_to(source/data['archivedSource'])
try:
 r=check();(out/'integrity-archive-symlink-escape.log').write_text(r.stdout+r.stderr);assert r.returncode!=0;results.append({'case':'archive-symlink-escape','rejected':True,'exitCode':r.returncode,'diagnostic':(r.stdout+r.stderr).strip()[:600]})
finally:archive.unlink();archive.write_bytes(b)
final=check();(out/'integrity-positive-after.log').write_text(final.stdout+final.stderr);assert final.returncode==0,final.stdout+final.stderr
for p,h in anchors.items():assert hashlib.sha256((source/p).read_bytes()).hexdigest()==h
record={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checkerSourceSha256':hashlib.sha256((source/'scripts/check-documentation.py').read_bytes()).hexdigest(),'tests':results,'untamperedBeforePass':True,'untamperedAfterPass':True,'originalCandidateAnchorsUnmodified':True,'anchors':anchors,'limits':'Author synthetic full-checker controls in an isolated hardlinked mirror. Mutated anchors copied to separate private inodes first; original source/evidence/criteria untouched. Tests do not run the app or prove formal acceptance. Trust anchors remain versioned review inputs, not a guarantee against coordinated authorized checker/config rewrites.'};(out/'METADATA-INTEGRITY-CONTROLS.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'negativeControls':len(results),'rejected':len(results),'untamperedBeforeAndAfterPass':True}))
