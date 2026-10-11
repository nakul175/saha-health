"""Read-only source/inventory verification; does not grant product acceptance."""
import csv
import hashlib
import json
from pathlib import Path

QA = Path(__file__).resolve().parents[1]
ROOT = QA.parents[1]

def rows(name):
    with (QA/'saha-registers'/f'{name}.csv').open(newline='') as f:
        return list(csv.DictReader(f))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

checks = {}
manifest = json.loads((QA/'MANIFEST.json').read_text())
checks['85_upstream_files_byte_exact'] = all(digest(QA/f['path']) == f['sha256'] for f in manifest['files'])
source = json.loads((QA/'sources/criteria-source.json').read_text())
criteria = {c['ac_id']: c for c in source['criteria']}
checks['271_source_ids_exact_register_population'] = len(criteria) == 271 and set(criteria) == {c['ac_id'] for c in rows('ac-register')}
checks['no_applicability_or_review_invented'] = all(c['applicability'] == 'UNKNOWN' for c in rows('ac-register')) and not rows('coverage-selection') and not rows('run-register')
formal = json.loads((QA/'sources/formal-case-source.json').read_text())
original = json.loads((ROOT/'docs/history/v1.0/engineering/test_catalogue.json').read_text())
checks['364_original_formal_case_ids_preserved'] = len(formal) == 364 and set(formal) == {c['id'] for c in original}
cwo = json.loads((QA/'sources/additional-scenario-drafts.json').read_text())['contracts']
checks['95_draft_oracles_exact'] = len(cwo) == 95 and all(criteria[k]['literal_acceptance'] == c['sourceLiteral'] and hashlib.sha256(c['sourceLiteral'].encode()).hexdigest() == c['sourceLiteralSha256'] for k,c in cwo.items())
cases = rows('case-register')
checks['case_inventory_is_364_formal_plus95_draft'] = len(cases) == 459 and {c['case_id'] for c in cases} == set(formal) | {'PROP-'+k for k in cwo}
mappings = rows('traceability')
checks['447_mappings_retain_owner_and_criterion'] = len(mappings) == 447 and all(c['story_id'] == criteria[c['ac_id']]['owner_story_id'] and c['epic_id'] == criteria[c['ac_id']]['owner_epic_id'] for c in mappings)
shared = json.loads((QA/'sources/shared-case-mapping-gaps.json').read_text())
checks['12_shared_cases_remain_explicit_gaps'] = len(shared) == 12 and set(shared) <= set(formal) and not set(shared) & {m['case_id'] for m in mappings}
checks['frozen_current_routine_spec_unchanged'] = digest(QA/'sources/current-routine-frozen-specification.md') == 'f390d7c13d7794556115b04caed8982179d1fcfd18a81dda59d70f6f573758df'
pointer = json.loads((ROOT/'docs/verification/current-baseline.json').read_text())['manifest']
current_baseline = json.loads((ROOT/'docs/verification'/pointer).read_text())
checks['current_baseline_has_real_distinct_predecessor'] = current_baseline.get('previous') != pointer and (ROOT/'docs/verification'/current_baseline['previous']).is_file()
print(json.dumps({'checks':checks, 'passed':sum(checks.values()), 'total':len(checks), 'productAcceptanceGranted':False}, indent=2))
raise SystemExit(0 if all(checks.values()) else 1)
