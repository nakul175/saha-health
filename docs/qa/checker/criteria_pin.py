#!/usr/bin/env python3
"""Print candidate pins from an independently reviewed PM export; never writes or approves."""
import argparse,hashlib,json,re
from pathlib import Path

def pins(raw):
    source=json.loads(raw)
    for field in ['source_id','source_version','scope_id','review_ref']:
        if not isinstance(source.get(field),str) or not source[field].strip():raise ValueError('missing source '+field)
    pairs=[]
    for criterion in source['criteria']:
        pair=[criterion['ac_id'],criterion['ac_version']]
        if any(not isinstance(x,str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_.-]*',x) for x in pair):raise ValueError('invalid AC identity')
        if criterion.get('applicability') not in ['YES','NO','UNKNOWN']:raise ValueError('invalid applicability')
        if pair in pairs:raise ValueError('duplicate AC/version')
        pairs.append(pair)
    return {'expected_ac_count':len(pairs),'expected_ac_ids_sha256':hashlib.sha256(json.dumps(sorted(pairs),ensure_ascii=False,separators=(',',':')).encode()).hexdigest(),'criteria_source_sha256':hashlib.sha256(raw).hexdigest(),'criteria_source_review_ref':source['review_ref'],'scope_id':source['scope_id'],'notice':'Candidate values only; source completeness/authority must be independently reviewed. This helper does not modify scope.'}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',type=Path,required=True);args=parser.parse_args()
    try: print(json.dumps(pins(args.source.read_bytes()),indent=2));return 0
    except (OSError,ValueError,TypeError,KeyError) as exc:print(json.dumps({'errors':[str(exc)]}));return 1
if __name__=='__main__':raise SystemExit(main())
