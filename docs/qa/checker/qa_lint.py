#!/usr/bin/env python3
"""Offline QA register validation and deterministic scoped coverage; no evidence certification."""
import argparse, csv, json, re, hashlib
from pathlib import Path, PureWindowsPath
from datetime import datetime
from collections import Counter

PACKAGE = Path(__file__).resolve().parents[1]
ID = re.compile(r'^[A-Za-z][A-Za-z0-9_.-]*$')

def ratio(n, d):
    return {'numerator': n, 'denominator': d, 'ratio': n / d if d else None}

def assess(folder, root=None, release=False, evidence_root=None, allow_absolute_evidence_root=False):
    folder, root = Path(folder), Path(root) if root else None
    statuses = json.loads((PACKAGE/'standards/statuses.json').read_text())
    schema = json.loads((PACKAGE/'standards/register-schema.json').read_text())
    errors, warnings, data = [], [], {}
    def error(message): errors.append(message)
    def enum(row, field, dimension, label):
        if row.get(field) not in statuses[dimension]: error(f'{label}: invalid {field}')
    def require(row, fields, label):
        for key in fields:
            if not row.get(key, '').strip(): error(f'{label}: missing {key}')
    def index(rows, fields, label):
        result = {}
        for row in rows:
            key = tuple(row.get(f, '') for f in fields)
            if any(not ID.fullmatch(x) for x in key): error(f'{label}: invalid identifier {key}')
            if key in result: error(f'{label}: duplicate {key}')
            result[key] = row
        return result
    def dt(value, label):
        try:
            result = datetime.fromisoformat(value.replace('Z', '+00:00'))
            if result.tzinfo is None: raise ValueError('timezone required')
            return result
        except (ValueError, TypeError): error(f'{label}: invalid timezone-aware timestamp'); return None
    for name, fields in schema.items():
        try:
            with (folder/(name+'.csv')).open(encoding='utf-8-sig', newline='') as inp:
                reader = csv.DictReader(inp)
                if reader.fieldnames != fields: error(f'{name}: header must match schema exactly')
                rows = list(reader)
                for row in rows:
                    if None in row or any(v is None for v in row.values()): error(f'{name}: malformed row')
                data[name] = [{k: (v.strip() if isinstance(v,str) else '') for k,v in row.items() if k is not None} for row in rows]
        except (OSError, csv.Error) as exc: error(f'{name}: {exc}'); data[name] = []
    try: scope = json.loads((folder/'scope.json').read_text())
    except (OSError, ValueError) as exc: error(f'scope: {exc}'); scope = {}
    # References have an explicit stable base independent of register relocation.
    setting = str(evidence_root) if evidence_root is not None else scope.get('evidence_root', '')
    if setting.startswith('package:') or setting.startswith('repo:'):
        package_setting = setting.startswith('package:')
        anchor = PACKAGE.resolve() if package_setting else (root.resolve() if root else None)
        tail = setting.split(':',1)[1]
        if anchor is None:
            error('evidence_root repo: requires --root'); base = folder.resolve()
        else:
            base = (anchor / tail).resolve()
            if Path(tail).is_absolute() or PureWindowsPath(tail).drive or '\\' in tail or not base.is_relative_to(anchor):
                error(f'evidence_root escapes its anchor: tried {base}'); base = anchor
    elif setting:
        requested = Path(setting).expanduser()
        if (requested.is_absolute() or PureWindowsPath(setting).drive) and not allow_absolute_evidence_root:
            error('absolute evidence_root rejected; use package:/repo:/relative base, or explicitly opt in for a machine-local store')
            base = folder.resolve()
        elif '\\' in setting:
            error('evidence_root must use portable forward-slash paths'); base = folder.resolve()
        else:
            base = (requested if requested.is_absolute() else folder / requested).resolve()
            if requested.is_absolute(): warnings.append('absolute evidence_root explicitly allowed; not portable between machines')
    else:
        base = folder.resolve()
        if release: error('release: evidence_root must be configured or overridden')
    def reference(value, label):
        if value.startswith('https://') or value.startswith('record:'):
            warnings.append(f'{label}: external/symbolic reference not authenticated')
            return None
        local = value.split('#')[0]
        target = (base / local).resolve()
        if Path(local).is_absolute() or PureWindowsPath(local).drive or '\\' in local or not target.is_relative_to(base):
            error(f'{label}: reference outside evidence_root or nonportable absolute path; tried {target}')
            return None
        if '://' in value or not target.is_file():
            error(f'{label}: unresolved local reference; tried {target}')
            return None
        return target
    def criteria_hash(pairs):
        return hashlib.sha256(json.dumps(sorted(pairs),ensure_ascii=False,separators=(',',':')).encode('utf-8')).hexdigest()
    source_fields = ['criteria_source_ref','criteria_source_sha256','expected_ac_ids_sha256','criteria_source_review_ref']
    if release: require(scope, source_fields, 'release criteria pin')
    for name in ['criteria_source_sha256','expected_ac_ids_sha256']:
        if scope.get(name) and not re.fullmatch(r'[0-9a-f]{64}',scope[name]): error(f'scope: invalid {name}')
    if scope.get('criteria_source_review_ref'):
        reference(scope['criteria_source_review_ref'],'criteria source review')
    if scope.get('criteria_source_ref'):
        source_path = reference(scope['criteria_source_ref'],'criteria source')
        if source_path is None: error('criteria source must be a local exported snapshot for offline verification')
        elif source_path.is_file():
            try:
                raw_source = source_path.read_bytes()
                if hashlib.sha256(raw_source).hexdigest() != scope.get('criteria_source_sha256'):
                    error('criteria source: snapshot hash mismatch')
                source = json.loads(raw_source)
                require(source,['source_id','source_version','scope_id','review_ref'],'criteria source')
                if source.get('review_ref'): reference(source['review_ref'],'criteria snapshot review')
                if source.get('scope_id') != scope.get('scope_id'): error('criteria source: wrong scope')
                source_rows = source.get('criteria')
                if not isinstance(source_rows,list): raise ValueError('criteria must be a list')
                source_index = {}
                for item in source_rows:
                    pair = (item['ac_id'],item['ac_version'])
                    if pair in source_index: error('criteria source: duplicate AC/version')
                    if any(not isinstance(x,str) or not ID.fullmatch(x) for x in pair): error('criteria source: invalid AC identity')
                    if item.get('applicability') not in statuses['applicability']: error('criteria source: invalid applicability')
                    source_index[pair] = item
                register_pairs = [[r.get('ac_id',''),r.get('ac_version','')] for r in data['ac-register']]
                expected_count = scope.get('expected_ac_count')
                if type(expected_count) is not int or expected_count < 0: error('scope: expected_ac_count must be a nonnegative integer')
                elif expected_count != len(source_rows) or expected_count != len(register_pairs): error('AC population: expected count mismatch')
                source_pairs = [[r['ac_id'],r['ac_version']] for r in source_rows]
                if criteria_hash(source_pairs) != scope.get('expected_ac_ids_sha256'): error('AC population: source IDs hash mismatch')
                if criteria_hash(register_pairs) != scope.get('expected_ac_ids_sha256'): error('AC population: register IDs hash mismatch')
                for row in data['ac-register']:
                    item = source_index.get((row.get('ac_id'),row.get('ac_version')))
                    if item and row.get('applicability') != item.get('applicability'): error('AC population: applicability disagrees with canonical snapshot')
            except (ValueError,TypeError,KeyError,OSError) as exc: error(f'criteria source: invalid snapshot: {exc}')
    elif release: error('release: missing canonical criteria source snapshot')
    pins = ['scope_id','build_sha','artifact_digest','environment','config_version','data_version']
    if release: require(scope, pins+['assessment_time'], 'release scope')
    now = dt(scope['assessment_time'], 'assessment_time') if scope.get('assessment_time') else None
    acs = index(data['ac-register'], ['ac_id','ac_version'], 'AC')
    cases = index(data['case-register'], ['case_id','case_version'], 'case')
    mappings = index(data['traceability'], ['mapping_id'], 'mapping')
    runs = index(data['run-register'], ['run_id'], 'run')
    risks = index(data['risk-register'], ['risk_id'], 'risk')
    events = index(data['defect-register'], ['event_id'], 'defect event')
    exceptions = index(data['exception-register'], ['exception_id'], 'exception')
    selections = index(data['coverage-selection'], ['mapping_id'], 'selection')
    defect_ids = {r.get('defect_id') for r in events.values()}
    for key, ac in acs.items():
        label = f'AC {key}'
        require(ac, ['scope_id','source_ref','risk_tier'], label)
        enum(ac,'applicability','applicability',label)
        if ac.get('scope_id') != scope.get('scope_id'): error(f'{label}: wrong scope')
        if ac.get('risk_tier') not in ['Low','Medium','High','Critical']: error(f'{label}: invalid risk tier')
        if ac.get('applicability') == 'NO': require(ac,['applicability_rationale','review_ref'],label)
    for key, case in cases.items():
        label = f'case {key}'
        if case.get('scope_id') != scope.get('scope_id'): error(f'{label}: wrong scope')
        if case.get('mode') not in ['AUTO','MANUAL']: error(f'{label}: invalid mode')
        require(case,['procedure_ref'],label)
        if case.get('mode') == 'AUTO':
            require(case,['automation_locator','marker'],label)
            if root:
                relative = case.get('automation_locator','').split('#')[0]
                path = (root/relative).resolve()
                if not path.is_relative_to(root.resolve()) or not path.is_file(): error(f'{label}: invalid automation file')
                elif case.get('marker') not in path.read_text(errors='replace'): error(f'{label}: marker absent')
            else: warnings.append(f'{label}: code locator not verified; use --root')
    for key, risk in risks.items():
        try:
            impact, likelihood = int(risk['impact']), int(risk['likelihood'])
            if not (1 <= impact <= 4 and 1 <= likelihood <= 4): raise ValueError()
            tier = 'Critical' if impact == 4 else 'High' if impact*likelihood >= 9 else 'Medium' if impact*likelihood >= 4 else 'Low'
            if risk.get('inherent_tier') not in ['Low','Medium','High','Critical'] or ['Low','Medium','High','Critical'].index(risk.get('inherent_tier','Low')) < ['Low','Medium','High','Critical'].index(tier): error(f'risk {key}: tier below scoring-policy minimum')
        except (KeyError,ValueError): error(f'risk {key}: invalid score')
        require(risk,['scope_id','failure_mode','rationale_source'],f'risk {key}')
    for key, mapping in mappings.items():
        label = f'mapping {key}'
        if (mapping.get('ac_id'),mapping.get('ac_version')) not in acs: error(f'{label}: unknown AC/version')
        if (mapping.get('case_id'),mapping.get('case_version')) not in cases: error(f'{label}: unknown case/version')
        if (mapping.get('risk_id'),) not in risks: error(f'{label}: unknown risk')
        if mapping.get('required') not in ['YES','NO']: error(f'{label}: invalid required flag')
    pairs = Counter((m.get('ac_id'),m.get('ac_version'),m.get('case_id'),m.get('case_version')) for m in mappings.values())
    if any(n > 1 for n in pairs.values()): error('duplicate AC-to-case/version mapping')
    for key, run in runs.items():
        label = f'run {key}'
        enum(run,'result','execution',label); enum(run,'freshness','freshness',label); enum(run,'purpose','run_purpose',label)
        if (run.get('case_id'),run.get('case_version')) not in cases: error(f'{label}: unknown case/version')
        if (run.get('ac_id'),run.get('ac_version')) not in acs: error(f'{label}: unknown AC/version')
        if run.get('result') in ['PASS','FAIL']:
            require(run,pins+['tool_versions','start_time','end_time','executor','protocol_ref','expected','observed','evidence_ref'],label)
            start,end = dt(run.get('start_time'),label),dt(run.get('end_time'),label)
            if start and end and end < start: error(f'{label}: reversed timestamps')
            if now and end and end > now: error(f'{label}: future execution')
        else: require(run,['rationale'],label)
        if run.get('result') == 'NOT_APPLICABLE': require(run,['review_ref','evidence_ref'],label)
        parent = run.get('parent_attempt')
        if parent:
            if (parent,) not in runs or parent == run.get('run_id'): error(f'{label}: invalid parent attempt')
        if run.get('defect_id') and run['defect_id'] not in defect_ids: error(f'{label}: unknown defect')
    reference_fields = ['source_ref','procedure_ref','protocol_ref','evidence_ref','review_ref','rationale_source','details_ref','close_evidence','controls_evidence','approval_ref','severity_review_ref']
    for register, rows in data.items():
        for number, record in enumerate(rows, 2):
            for field in reference_fields:
                value = record.get(field, '')
                if not value: continue
                reference(value, f'{register}:{number} {field}')
    # Predecessor/run graphs cannot contain cycles.
    def cycles(records, id_field, parent_field, label):
        for row in records.values():
            seen, current = set(), row
            while current and current.get(parent_field):
                ident = current.get(id_field)
                if ident in seen: error(f'{label}: predecessor cycle'); break
                seen.add(ident); current = records.get((current.get(parent_field),))
    cycles(runs,'run_id','parent_attempt','run')
    for key,event in events.items():
        label=f'defect event {key}'
        require(event,['defect_id','case_id','severity','priority','owner','details_ref'],label)
        enum(event,'status','defect',label)
        if not ID.fullmatch(event.get('defect_id','')): error(f'{label}: invalid defect ID')
        if event.get('severity') not in ['D1','D2','D3','D4']: error(f'{label}: invalid severity')
        if event.get('run_id') and (event.get('run_id'),) in runs and runs[(event['run_id'],)].get('defect_id') not in ['', event.get('defect_id')]: error(f'{label}: run linked to a different defect')
        previous=event.get('previous_event_id')
        if previous and ((previous,) not in events or events[(previous,)].get('defect_id') != event.get('defect_id')): error(f'{label}: invalid predecessor')
        for field in ['run_id','retest_run']:
            if event.get(field) and (event[field],) not in runs: error(f'{label}: unknown {field}')
        if event.get('case_id') and not any(k[0] == event['case_id'] for k in cases): error(f'{label}: unknown case')
        if previous and (previous,) in events:
            predecessor = events[(previous,)]
            if event.get('case_id') != predecessor.get('case_id'):
                error(f'{label}: defect case identity changed across events')
            levels = {'D1':1,'D2':2,'D3':3,'D4':4}
            if levels.get(event.get('severity'),0) < levels.get(predecessor.get('severity'),0):
                require(event,['severity_change_rationale','severity_review_ref'],f'{label}: severity downgrade requires reviewed rationale')
        if event.get('status') == 'CLOSED':
            require(event,['retest_run','close_evidence'],label)
            retest=runs.get((event.get('retest_run'),),{})
            if retest.get('result')!='PASS' or retest.get('freshness')!='CURRENT' or retest.get('purpose')!='QUALIFICATION': error(f'{label}: closure without current passing qualification retest')
            if retest.get('case_id') != event.get('case_id'): error(f'{label}: retest case differs from defect case')
            if retest.get('build_sha') != event.get('build_sha'): error(f'{label}: retest build differs from closed event build')
            if release and any(retest.get(field) != scope.get(field) for field in pins): error(f'{label}: retest not on release snapshot')
    cycles(events,'event_id','previous_event_id','defect')
    parents = Counter(e.get('previous_event_id') for e in events.values() if e.get('previous_event_id'))
    if any(n > 1 for n in parents.values()): error('defect events fork; serialize transitions')
    roots = Counter(e.get('defect_id') for e in events.values() if not e.get('previous_event_id'))
    if any(n != 1 for n in roots.values()): error('defect must have one initial event')
    for key,exc in exceptions.items():
        enum(exc,'status','exception',f'exception {key}')
        if exc.get('status')=='APPROVED':
            require(exc,['scope_id','gate_id','eligibility','controls_evidence','authority','approval_ref','expiry'],f'exception {key}')
            expiry=dt(exc.get('expiry'),f'exception {key}')
            if now and expiry and expiry <= now: error(f'exception {key}: approved record expired')
    for key,selection in selections.items():
        if key not in mappings: error(f'selection {key}: unknown mapping')
        if (selection.get('run_id'),) not in runs: error(f'selection {key}: unknown run')
    counts = Counter({s:0 for s in statuses['execution']})
    freshness = Counter({s:0 for s in statuses['freshness']})
    per_ac, selected_ids = {}, set()
    current_executed = 0
    for key,mapping in mappings.items():
        if mapping.get('required')!='YES': continue
        ac_key=(mapping.get('ac_id'),mapping.get('ac_version'))
        if acs.get(ac_key,{}).get('applicability')=='NO': continue
        selection=selections.get(key,{})
        run=runs.get((selection.get('run_id'),))
        valid=False
        if run:
            selected_ids.add(run['run_id'])
            counts[run.get('result','NOT_RUN')]+=1; freshness[run.get('freshness','UNASSESSED')]+=1
            if run.get('purpose')!='QUALIFICATION': error(f'{key}: diagnostic run selected')
            for field in pins:
                if not scope.get(field) or run.get(field)!=scope.get(field): error(f'{key}: selected run mismatches {field}')
            for field in ['case_id','case_version','ac_id','ac_version']:
                if run.get(field)!=mapping.get(field): error(f'{key}: selected run mismatches {field}')
            if run.get('result') in ['PASS','FAIL'] and run.get('freshness')=='CURRENT': current_executed+=1
            valid=run.get('result')=='PASS' and run.get('freshness')=='CURRENT' and run.get('purpose')=='QUALIFICATION' and all(run.get(f)==scope.get(f) and bool(scope.get(f)) for f in pins)
        else: counts['NOT_RUN']+=1; freshness['UNASSESSED']+=1
        per_ac.setdefault(ac_key,[]).append(valid)
    applicable=[k for k,a in acs.items() if a.get('applicability')!='NO']
    planned=sum(bool(per_ac.get(k)) for k in applicable)
    validated=sum(bool(per_ac.get(k)) and all(per_ac[k]) and acs[k].get('applicability')=='YES' for k in applicable)
    unknown=sum(a.get('applicability')=='UNKNOWN' for a in acs.values())
    required=sum(counts.values())
    if release:
        if not applicable: error('release: no applicable AC population')
        if unknown: error('release: unknown applicability')
        if validated!=len(applicable): error('release: incomplete validated AC coverage')
        if counts['PASS']!=required or freshness['CURRENT']!=required: error('release: required mapping not PASS/CURRENT')
        leaves=[e for e in events.values() if e['event_id'] not in parents]
        if any(e.get('status')!='CLOSED' and e.get('severity') in ['D3','D4'] for e in leaves): error('release: unresolved D3/D4 defect')
        if not root and any(c.get('mode')=='AUTO' for c in cases.values()): error('release: automatic code locators unverified; supply --root')
    return {'mode':'RELEASE_RECORD_GATE' if release else 'STRUCTURE_AND_REPORT','errors':errors,'warnings':warnings,
        'counts_unit':'selected required AC-to-case mappings (not unique tests)', 'result_counts':dict(counts),'freshness_counts':dict(freshness),
        'historical_qualification_counts':dict(Counter(r['result'] for r in runs.values() if r.get('purpose')=='QUALIFICATION')),
        'selected_unique_runs':len(selected_ids),'unknown_applicability':unknown,'planned_coverage':ratio(planned,len(applicable)),
        'validated_coverage':ratio(validated,len(applicable)), 'required_completion':ratio(current_executed,required),
        'selected_pass_rate':ratio(counts['PASS'],counts['PASS']+counts['FAIL']),
        'resolved_evidence_root':str(base),'disclaimer':'Offline structural/coverage check only. Does not authenticate evidence, verify omitted ACs, approvals, numeric thresholds or complete release readiness.'}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--registers',type=Path,required=True); parser.add_argument('--root',type=Path)
    parser.add_argument('--release',action='store_true')
    parser.add_argument('--evidence-root',help='Override reference base using package:, repo: or relative directory')
    parser.add_argument('--allow-absolute-evidence-root',action='store_true',help='Explicitly allow machine-local absolute base; references remain confined')
    args=parser.parse_args()
    try: report=assess(args.registers,args.root,args.release,args.evidence_root,args.allow_absolute_evidence_root)
    except (ValueError,TypeError,KeyError,OSError) as exc:
        report={'errors':[f'Invalid input: {exc}'],'disclaimer':'No successful assessment'}
    print(json.dumps(report,indent=2)); return 1 if report['errors'] else 0
if __name__=='__main__': raise SystemExit(main())
