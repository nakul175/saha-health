#!/usr/bin/env python3
"""Validate imported scope ownership; never infer application acceptance."""
from pathlib import Path
from collections import Counter
import csv
import hashlib
import json
import sys
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
def rows(name):
    with (HERE / name).open(encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f, delimiter='\t'))
def main():
    checks = []
    def check(name, ok):
        checks.append({'check': name, 'passed': bool(ok)})
    raw = (ROOT / 'requirements/brd-v1.1.json').read_bytes()
    original = json.loads(raw)['requirements']
    scope, links, criteria = rows('scope.tsv'), rows('cwo-links.tsv'), rows('new-criteria.tsv')
    ids = {r['id'] for r in scope}
    old = [k for r in scope for k in r['original_ids'].split(',') if k]
    sources = {r['source_id'] for r in links}
    check('160 distinct canonical owners', len(scope) == len(ids) == 160)
    check('176 original requirements owned once', Counter(old) == Counter(r['id'] for r in original))
    check('Original source bytes retained', hashlib.sha1(f'blob {len(raw)}\0'.encode() + raw).hexdigest() == '889fbe916fd9dca375635cc54b01dabeda75d9d2')
    check('Original requirement and acceptance text retained', all(r.get('requirement') and r.get('acceptance') for r in original))
    check('32 CWO outcomes with one primary owner', len(links) == len(sources) == 32 and all(r['primary_id'] in ids for r in links))
    check('Related owners exist', all(k in ids for r in links for k in r['related_ids'].split(',') if k))
    check('All scope aliases resolve', all(k in sources for r in scope for k in r['cwo_ids'].split(',') if k))
    check('95 unique criteria with valid owner and source', len(criteria) == len({r['id'] for r in criteria}) == 95 and all(r['owner_id'] in ids and r['id'][:7] in sources and r['text'] for r in criteria))
    check('Preserved criterion bytes match v0.2 import', hashlib.sha256((HERE/'new-criteria.tsv').read_bytes()).hexdigest() == 'c3728e66c21d0644f5f572116b5a37ef7ca9626c2b698bbf1902b1bdba63b918')
    check('Preserved CWO mapping bytes match v0.2 import', hashlib.sha256((HERE/'cwo-links.tsv').read_bytes()).hexdigest() == 'c1564afa1d91d049c88a7a1de518f773367a3ee1b2b742b72cdcd837a05f8fa9')
    print(json.dumps({'kind': 'Planning/source integrity only', 'passed': sum(c['passed'] for c in checks), 'failed': sum(not c['passed'] for c in checks), 'checks': checks}, indent=2))
    return int(any(not c['passed'] for c in checks))
if __name__ == '__main__':
    sys.exit(main())
