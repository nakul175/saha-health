#!/usr/bin/env python3
"""Validate PM mapping against real field membership, aliases and stage gates."""
import argparse,hashlib,json
from pathlib import Path
PACKAGE=Path(__file__).resolve().parents[1]

def validate(mapping,catalogue,raw_digest=None):
    errors=[]
    fields={r['id'] for r in catalogue['fields']}
    aliases=catalogue.get('fieldAliases',{})
    gates=catalogue.get('stage_gate_ids')
    if gates is None:
        gates=[g for stage in catalogue['review_profiles']['stages'].values() for group in stage['types'].values() for g in group]
    digest=raw_digest or catalogue.get('source_catalogue_sha256')
    if mapping.get('catalogue_sha256')!=digest:errors.append('catalogue source hash mismatch')
    if mapping.get('reference_edition')!=catalogue.get('catalogueVersion'):errors.append('catalogue edition mismatch')
    for field in mapping.get('verified_catalogue_field_ids',[]):
        if field not in fields:errors.append(f'not an actual catalogue field: {field}')
    for old,new in mapping.get('legacy_field_aliases',{}).items():
        if aliases.get(old)!=new or new not in fields:errors.append(f'invalid field alias: {old} -> {new}')
    for prefix in mapping.get('stage_gate_prefixes',[]):
        if not any(g.startswith(prefix) for g in gates):errors.append(f'unknown stage-gate prefix: {prefix}')
    return errors

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalogue',type=Path,help='Installed full PM catalogue; defaults to bundled extracted index')
    parser.add_argument('--mapping',type=Path,default=PACKAGE/'workflow/PM-MAPPING.json')
    args=parser.parse_args()
    path=args.catalogue or PACKAGE/'workflow/pm-catalogue-index.json'
    try:
        raw=path.read_bytes();errors=validate(json.loads(args.mapping.read_text()),json.loads(raw),hashlib.sha256(raw).hexdigest() if args.catalogue else None)
    except (OSError,ValueError,KeyError,TypeError) as exc:errors=[str(exc)]
    print(json.dumps({'errors':errors,'catalogue':str(path.resolve()),'mode':'FULL_CATALOGUE' if args.catalogue else 'EXTRACTED_INDEX','disclaimer':'Field membership validation; no product scope or approval authentication'},indent=2))
    return 1 if errors else 0
if __name__=='__main__':raise SystemExit(main())
