import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from check_pm_mapping import validate,PACKAGE

class MappingTests(unittest.TestCase):
    def setUp(self):
        self.mapping=json.loads((PACKAGE/'workflow/PM-MAPPING.json').read_text())
        self.catalogue=json.loads((PACKAGE/'workflow/pm-catalogue-index.json').read_text())
    def test_every_mapping_is_a_real_field(self):self.assertEqual(validate(self.mapping,self.catalogue),[])
    def test_stage_prefix_is_not_a_field(self):
        self.mapping['verified_catalogue_field_ids'].append('acceptance_criterion.ready')
        self.assertTrue(any('not an actual catalogue field' in e for e in validate(self.mapping,self.catalogue)))
    def test_alias_is_not_canonical_field(self):
        self.mapping['verified_catalogue_field_ids'].append('acceptance_criterion.fixture_method')
        self.assertTrue(validate(self.mapping,self.catalogue))
    def test_alias_target_must_exist(self):
        self.mapping['legacy_field_aliases']['acceptance_criterion.fixture_method']='missing.field'
        self.assertTrue(validate(self.mapping,self.catalogue))
    def test_unknown_gate_prefix_rejected(self):
        self.mapping['stage_gate_prefixes'].append('gate.acceptance_criterion.unknown.')
        self.assertTrue(validate(self.mapping,self.catalogue))
    def test_hash_mismatch_rejected(self):
        self.mapping['catalogue_sha256']='0'*64;self.assertTrue(validate(self.mapping,self.catalogue))

if __name__=='__main__':unittest.main()
