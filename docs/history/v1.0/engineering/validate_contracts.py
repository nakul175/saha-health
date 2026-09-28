"""Bounded structural linter and example validator using Python's standard library.

This supports only the schema keywords exercised in this pack; it is not a full
OpenAPI 3.1 or JSON Schema conformance implementation. Run an independent official
profile/toolchain validator during engineering onboarding.
"""
import json,re,uuid,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parent
SPEC=json.loads((ROOT/'openapi.json').read_text())

def resolve(pointer):
    value=SPEC
    assert pointer.startswith('#/'),pointer
    for part in pointer[2:].split('/'):value=value[part.replace('~1','/').replace('~0','~')]
    return value

def valid(value,schema):
    if '$ref'in schema:return valid(value,resolve(schema['$ref']))
    if 'const'in schema and value!=schema['const']:return False
    if 'enum'in schema and value not in schema['enum']:return False
    if 'not'in schema and valid(value,schema['not']):return False
    if 'oneOf'in schema and sum(valid(value,s)for s in schema['oneOf'])!=1:return False
    if 'if'in schema and valid(value,schema['if']) and not valid(value,schema.get('then',{})):return False
    typ=schema.get('type')
    if typ=='object' and not isinstance(value,dict):return False
    if typ=='array' and not isinstance(value,list):return False
    if typ=='string' and not isinstance(value,str):return False
    if typ=='boolean' and not isinstance(value,bool):return False
    if typ=='integer' and (not isinstance(value,int) or isinstance(value,bool)):return False
    if typ=='number' and (not isinstance(value,(int,float)) or isinstance(value,bool)):return False
    if isinstance(value,dict):
        if any(k not in value for k in schema.get('required',[])):return False
        props=schema.get('properties',{})
        if schema.get('additionalProperties') is False and set(value)-set(props):return False
        if any(not valid(v,props[k])for k,v in value.items()if k in props):return False
    if isinstance(value,list):
        if len(value)<schema.get('minItems',0) or len(value)>schema.get('maxItems',float('inf')):return False
        if schema.get('uniqueItems') and len({json.dumps(v,sort_keys=True)for v in value})!=len(value):return False
        if 'items'in schema and not all(valid(v,schema['items'])for v in value):return False
    if isinstance(value,str):
        if len(value)<schema.get('minLength',0) or len(value)>schema.get('maxLength',float('inf')):return False
        if 'pattern'in schema and re.search(schema['pattern'],value) is None:return False
        try:
            fmt=schema.get('format')
            if fmt=='uuid':uuid.UUID(value)
            if fmt=='date':datetime.date.fromisoformat(value)
            if fmt=='date-time':
                dt=datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
                if dt.tzinfo is None:return False
            if fmt=='uri' and not re.match(r'^[A-Za-z][A-Za-z0-9+.-]*:',value):return False
        except ValueError:return False
    if isinstance(value,(int,float)) and not isinstance(value,bool):
        if value<schema.get('minimum',float('-inf')) or value>schema.get('maximum',float('inf')):return False
    return True

def run():
    checks=[]
    def check(name,condition):
        if not condition:raise AssertionError(name)
        checks.append(name)
    refs=[]
    def walk(value):
        if isinstance(value,dict):
            if '$ref'in value:refs.append(value['$ref']);resolve(value['$ref'])
            for v in value.values():walk(v)
        elif isinstance(value,list):
            for v in value:walk(v)
    walk(SPEC);check('Every internal reference resolves',bool(refs))
    ops=[]
    for path,item in SPEC['paths'].items():
        for method,op in item.items():
            ops.append(op['operationId'])
            check(op['operationId']+' has verified bearer requirement',op.get('security')==[{'bearerAuth':[]}])
            if method=='post':check(op['operationId']+' has required idempotency key',any(p['name']=='Idempotency-Key' and p.get('required')for p in op['parameters']))
            for name in re.findall(r'{(.*?)}',path):check(op['operationId']+' declares path '+name,any(p['name']==name and p['in']=='path' and p.get('required')for p in op.get('parameters',[])))
    check('Operation IDs unique',len(ops)==len(set(ops)));check('74 internal operations',len(ops)==74)
    examples=json.loads((ROOT/'fixtures'/'schema_examples.json').read_text())
    for name,value in examples.items():check('Example validates '+name,valid(value,SPEC['components']['schemas'][name]))
    for name,schema in SPEC['components']['schemas'].items():
        if name.endswith('Input'):
            check(name+' rejects unexpected actor',not valid({**examples[name],'actor_id':'forged'},schema))
    observed=examples['recordObservationInput']
    check('Observation rejects value with absence',not valid({**observed,'absent_reason':'unknown'},SPEC['components']['schemas']['recordObservationInput']))
    check('Observation rejects neither value nor absence',not valid({k:v for k,v in observed.items()if k!='value'},SPEC['components']['schemas']['recordObservationInput']))
    check('Conflict candidate requires selected reference',not valid({'resolution':'accept_candidate','reason':'synthetic'},SPEC['components']['schemas']['resolveConflictInput']))
    for fn in (ROOT/'events').glob('*.json'):
        schema=json.loads(fn.read_text());event=json.loads((ROOT/'fixtures'/'events'/fn.name).read_text());check('Event validates '+fn.stem,valid(event,schema));check('Event rejects clinical payload '+fn.stem,not valid({**event,'clinical_payload':'forbidden'},schema))
    reqs=json.loads((ROOT/'requirements_traceability.json').read_text());tests=json.loads((ROOT/'test_catalogue.json').read_text());rid={r['id']for r in reqs};tids={t['id']for t in tests}
    check('176 unique BRD requirements',len(reqs)==len(rid)==176);check('364 unique test definitions',len(tests)==len(tids)==364)
    check('Every requirement has two valid test references',all(len(r['tests'])==2 and set(r['tests'])<=tids for r in reqs))
    check('Every test references known requirements',all(set(t['source'].split())<=rid for t in tests));check('All application tests explicitly not run',all(t['status']=='Not run'for t in tests))
    sql=(ROOT/'001_foundation.sql').read_text();check('31 foundation tables declared',sql.count('CREATE TABLE health.')==31);check('30 non-catalogue tables force RLS',sql.count('FORCE ROW LEVEL SECURITY')==30)
    report={'status':'Passed','checks':len(checks),'scope':'Bounded structural and example checks; not complete OpenAPI, JSON Schema, PostgreSQL or ABDM validation','check_names':checks}
    (ROOT/'contract_check_results.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items()if k!='check_names'}));return report
if __name__=='__main__':run()
