import csv,json,shutil,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from qa_lint import assess, PACKAGE

class CheckerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.base=Path(self.tmp.name)/'lifecycle'
        shutil.copytree(PACKAGE/'examples/lifecycle',self.base); self.folder=self.base/'registers'
        scope=json.loads((self.folder/'scope.json').read_text()); scope['evidence_root']='..'
        (self.folder/'scope.json').write_text(json.dumps(scope))
    def tearDown(self): self.tmp.cleanup()
    def rows(self,name):
        with (self.folder/(name+'.csv')).open(newline='') as f:return list(csv.DictReader(f))
    def save(self,name,rows):
        fields=json.loads((PACKAGE/'standards/register-schema.json').read_text())[name]
        with (self.folder/(name+'.csv')).open('w',newline='') as f:
            w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
    def edit(self,name,field,value,index=0):
        rows=self.rows(name);rows[index][field]=value;self.save(name,rows)
    def errors(self,**kw):return assess(self.folder,**kw)['errors']
    def test_demo_metrics(self):
        r=assess(self.folder);self.assertEqual(r['errors'],[])
        self.assertEqual(r['planned_coverage']['ratio'],1)
        self.assertEqual(r['validated_coverage']['ratio'],.5)
        self.assertEqual(r['result_counts']['FAIL'],1)
        self.assertEqual(r['historical_qualification_counts']['FAIL'],2)
    def test_release_rejects_failed_required_even_with_exception(self):self.assertTrue(self.errors(release=True))
    def test_empty_plan_has_null_ratios_and_release_block(self):
        r=assess(PACKAGE/'registers');self.assertFalse(r['errors']);self.assertIsNone(r['planned_coverage']['ratio'])
        self.assertTrue(assess(PACKAGE/'registers',release=True)['errors'])
    def test_release_current_all_pass_records(self):
        self.edit('run-register','result','PASS',2)
        self.edit('run-register','observed','Fictional issue corrected',2)
        self.assertFalse(self.errors(release=True))
    def test_missing_artifact(self):
        self.edit('run-register','artifact_digest','',1);self.assertTrue(self.errors())
    def test_invalid_status(self):
        self.edit('run-register','result','PENDING');self.assertTrue(self.errors())
    def test_lowercase_freshness(self):
        self.edit('run-register','freshness','unassessed');self.assertTrue(self.errors())
    def test_duplicate_run(self):
        r=self.rows('run-register');r.append(r[0]);self.save('run-register',r);self.assertTrue(self.errors())
    def test_unknown_ac(self):
        self.edit('traceability','ac_id','AC-MISSING');self.assertTrue(self.errors())
    def test_unmapped_ac_stays_denominator(self):
        r=self.rows('ac-register');extra=dict(r[0],ac_id='AC-UNMAPPED');r.append(extra);self.save('ac-register',r)
        output=assess(self.folder);self.assertEqual(output['planned_coverage']['denominator'],3)
        self.assertEqual(output['planned_coverage']['numerator'],2)
    def test_stale_pass_does_not_validate(self):
        self.edit('run-register','freshness','STALE',1)
        self.assertEqual(assess(self.folder)['validated_coverage']['numerator'],0)
    def test_wrong_selected_build(self):
        self.edit('coverage-selection','run_id','RUN-DEMO-FAIL');self.assertTrue(self.errors())
    def test_diagnostic_selected(self):
        self.edit('run-register','purpose','DIAGNOSTIC',1);self.assertTrue(self.errors())
    def test_na_required_not_pass(self):
        self.edit('run-register','result','NOT_APPLICABLE',2)
        self.edit('run-register','rationale','Example exclusion',2)
        self.edit('run-register','review_ref','RECORDS.md',2)
        self.assertEqual(assess(self.folder)['validated_coverage']['numerator'],1)
        self.assertTrue(self.errors(release=True))
    def test_unknown_applicability(self):
        self.edit('ac-register','applicability','UNKNOWN')
        r=assess(self.folder);self.assertEqual(r['unknown_applicability'],1);self.assertEqual(r['validated_coverage']['numerator'],0)
    def test_no_without_review(self):
        self.edit('ac-register','applicability','NO');self.assertTrue(self.errors())
    def test_risk_override(self):
        self.edit('risk-register','inherent_tier','Medium');self.assertTrue(self.errors())
    def test_defect_cycle(self):
        self.edit('defect-register','previous_event_id','EV-DEMO-03');self.assertTrue(self.errors())
    def test_failed_closure(self):
        self.edit('defect-register','retest_run','RUN-DEMO-FAIL',2);self.assertTrue(self.errors())
    def test_expired_exception(self):
        self.edit('exception-register','expiry','2026-10-10T00:00:00Z');self.assertTrue(self.errors())
    def test_broken_evidence(self):
        self.edit('run-register','evidence_ref','missing.txt',1);self.assertTrue(self.errors())
    def test_timestamp_timezone(self):
        self.edit('run-register','start_time','2026-10-11T10:00:00',1);self.assertTrue(self.errors())
    def test_auto_locator_marker(self):
        root=self.base/'repo';root.mkdir();(root/'test.py').write_text('# qa:TC-DEMO-02@v1\n')
        self.edit('case-register','mode','AUTO');self.edit('case-register','automation_locator','test.py#test');self.edit('case-register','marker','qa:TC-DEMO-02@v1')
        self.assertFalse(self.errors(root=root));(root/'test.py').write_text('');self.assertTrue(self.errors(root=root))
    def test_duplicate_mapping(self):
        r=self.rows('traceability');r.append(dict(r[0],mapping_id='MAP-DUPLICATE'));self.save('traceability',r);self.assertTrue(self.errors())
    def test_malformed_csv(self):
        with (self.folder/'run-register.csv').open('a') as f:f.write('bad,row\n')
        self.assertTrue(self.errors())

    def scope_edit(self,field,value):
        path=self.folder/'scope.json';scope=json.loads(path.read_text());scope[field]=value;path.write_text(json.dumps(scope))
    def make_all_pass(self):
        self.edit('run-register','result','PASS',2)
        self.edit('run-register','observed','Fictional issue corrected',2)
    def test_omitted_ac_fails_release_source_pin(self):
        self.make_all_pass()
        for name in ['ac-register','case-register','traceability','coverage-selection','risk-register']:
            self.save(name,self.rows(name)[:1])
        self.save('run-register',self.rows('run-register')[:2])
        self.save('defect-register',self.rows('defect-register')[:3])
        errors=self.errors(release=True)
        self.assertTrue(any('expected count mismatch' in e for e in errors))
        self.assertTrue(any('register IDs hash mismatch' in e for e in errors))
    def test_replace_ac_same_count_fails_hash(self):
        self.edit('ac-register','ac_id','AC-REPLACED')
        self.assertTrue(any('register IDs hash mismatch' in e for e in self.errors(release=True)))
    def test_changed_source_snapshot_rejected(self):
        path=self.base/'criteria-source.json';source=json.loads(path.read_text());source['criteria'].pop();path.write_text(json.dumps(source))
        self.assertTrue(any('snapshot hash mismatch' in e for e in self.errors(release=True)))
    def test_unknown_expected_population_blocks_release(self):
        self.scope_edit('criteria_source_ref','');self.make_all_pass();self.assertTrue(self.errors(release=True))
    def test_applicability_cannot_be_removed_silently(self):
        self.edit('ac-register','applicability','NO');self.edit('ac-register','applicability_rationale','claim');self.edit('ac-register','review_ref','RECORDS.md')
        self.assertTrue(any('applicability disagrees' in e for e in self.errors()))
    def test_severity_downgrade_unreviewed_blocks(self):
        self.make_all_pass()
        events=self.rows('defect-register')[:1]
        events.append(dict(events[0],event_id='EV-DOWNGRADE',previous_event_id=events[0]['event_id'],severity='D2'))
        self.save('defect-register',events)
        self.assertTrue(any('severity downgrade' in e for e in self.errors(release=True)))
    def test_severity_review_without_rationale_blocks(self):
        self.edit('defect-register','severity','D2',1);self.edit('defect-register','severity_review_ref','RECORDS.md',1)
        self.assertTrue(any('severity_change_rationale' in e for e in self.errors()))
    def test_reviewed_severity_downgrade_record_allowed(self):
        self.edit('defect-register','severity','D2',1)
        self.edit('defect-register','severity_review_ref','RECORDS.md',1)
        self.edit('defect-register','severity_change_rationale','Fictional triage review corrected affected scope',1)
        self.assertFalse(self.errors())
    def test_unrelated_passing_retest_rejected(self):
        self.make_all_pass();self.edit('defect-register','retest_run','RUN-DEMO-MEDIUM',2)
        self.assertTrue(any('retest case differs' in e for e in self.errors(release=True)))
    def test_defect_case_change_cannot_redirect_retest(self):
        self.make_all_pass();self.edit('defect-register','case_id','TC-DEMO-06',2)
        self.edit('defect-register','retest_run','RUN-DEMO-MEDIUM',2)
        self.assertTrue(any('case identity changed' in e for e in self.errors(release=True)))
    def test_retest_wrong_closed_build_rejected(self):
        self.edit('defect-register','build_sha','different-sha',2)
        self.assertTrue(any('retest build differs' in e for e in self.errors()))
    def test_csv_utf8_bom_accepted(self):
        path=self.folder/'ac-register.csv';path.write_bytes(b'\xef\xbb\xbf'+path.read_bytes());self.assertFalse(self.errors())
    def test_registers_relocate_with_evidence_root(self):
        other=Path(self.tmp.name)/'moved';shutil.copytree(self.folder,other)
        self.scope_edit('evidence_root','repo:lifecycle')
        shutil.rmtree(other);shutil.copytree(self.folder,other)
        self.assertFalse(assess(other,root=self.base.parent)['errors'])
    def test_package_anchored_evidence_root(self):
        self.scope_edit('evidence_root','package:examples/lifecycle')
        other=Path(self.tmp.name)/'moved';shutil.copytree(self.folder,other)
        self.assertFalse(assess(other)['errors'])
    def test_cli_style_evidence_override(self):
        self.scope_edit('evidence_root','missing-root')
        self.assertFalse(assess(self.folder,evidence_root=self.base,allow_absolute_evidence_root=True)['errors'])
    def test_missing_ref_error_prints_absolute_path(self):
        self.edit('run-register','evidence_ref','absent.log',1)
        self.assertTrue(any(str((self.base/'absent.log').resolve()) in e for e in self.errors()))

    def test_absolute_evidence_root_rejected_by_default(self):
        self.scope_edit('evidence_root',str(self.base))
        self.assertTrue(any('absolute evidence_root rejected' in e for e in self.errors()))
    def test_absolute_cli_override_rejected_by_default(self):
        self.assertTrue(assess(self.folder,evidence_root=self.base)['errors'])
    def test_absolute_reference_rejected_even_inside_store(self):
        self.edit('run-register','evidence_ref',str(self.base/'RECORDS.md'),1)
        self.assertTrue(any('outside evidence_root' in e for e in self.errors()))
    def test_traversal_reference_rejected(self):
        (self.base.parent/'outside.txt').write_text('not approved evidence')
        self.edit('run-register','evidence_ref','../outside.txt',1)
        self.assertTrue(any('outside evidence_root' in e for e in self.errors()))
    def test_symlink_escape_rejected(self):
        (self.base.parent/'outside.txt').write_text('outside store')
        (self.base/'escape.txt').symlink_to(self.base.parent/'outside.txt')
        self.edit('run-register','evidence_ref','escape.txt',1)
        self.assertTrue(any('outside evidence_root' in e for e in self.errors()))
    def test_source_snapshot_escape_rejected(self):
        self.scope_edit('criteria_source_ref',str(self.base/'criteria-source.json'))
        self.assertTrue(any('outside evidence_root' in e for e in self.errors(release=True)))
    def test_package_anchor_escape_rejected(self):
        self.scope_edit('evidence_root','package:../outside')
        self.assertTrue(any('escapes its anchor' in e for e in self.errors()))
    def test_repo_anchor_escape_rejected(self):
        self.scope_edit('evidence_root','repo:../outside')
        self.assertTrue(any('escapes its anchor' in e for e in self.errors(root=self.base)))
    def test_windows_absolute_reference_rejected(self):
        self.edit('run-register','evidence_ref','C:/outside/evidence.txt',1)
        self.assertTrue(any('outside evidence_root' in e for e in self.errors()))
    def test_in_store_relative_reference_still_passes(self):
        self.edit('run-register','evidence_ref','./RECORDS.md#observations',1)
        self.assertFalse(self.errors())

if __name__=='__main__':unittest.main()
