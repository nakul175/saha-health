"""Coordination helper tests only, not Saha application/hosting acceptance."""
import copy
import unittest
from gate import merge_blockers, delivery_blockers

def valid():
    p = {k: True for k in ("enabled","standing_merge_authority","synthetic_only","lease_owned","scope_matches","native_checks_pass","no_blocking_findings","history_preserved","release_target_confirmed","rollback_compatible")}
    p.update(head_sha="a"*40, live_head_sha="a"*40, base_sha="b"*40, live_base_sha="b"*40, spec_sha="c"*40,
             active_issue=175, pr_story_issue=175, pr_number=999, required_criteria=["A1","A2"])
    for role in ("author", "qa", "review"):
        p[role] = dict(role=role,status="pass",run_id="test-"+role,head_sha=p["head_sha"],base_sha=p["base_sha"],spec_sha=p["spec_sha"],evidence=["synthetic-helper-fixture"])
    p["qa"]["criteria"] = {"A1":"pass","A2":"pass"}
    p["required_checks"]=[dict(status="completed",outcome="success",head_sha=p["head_sha"],evidence="synthetic-helper-fixture")]
    return p

class GateTests(unittest.TestCase):
    def test_valid_fixture(self): self.assertEqual(merge_blockers(valid()), [])
    def test_missing_packet(self): self.assertTrue(merge_blockers(None))
    def test_default_denies(self): self.assertTrue(merge_blockers({}))
    def test_every_boolean_gate(self):
        for key,val in valid().items():
            if val is True:
                p=valid();p[key]=False
                with self.subTest(key=key): self.assertTrue(merge_blockers(p))
    def test_truthy_is_not_approval(self):
        p=valid();p["standing_merge_authority"]="yes";self.assertTrue(merge_blockers(p))
    def test_changed_head(self):
        p=valid();p["live_head_sha"]="d"*40;self.assertTrue(merge_blockers(p))
    def test_changed_base(self):
        p=valid();p["live_base_sha"]="d"*40;self.assertTrue(merge_blockers(p))
    def test_short_hash(self):
        p=valid();p["head_sha"]="abcdef1";self.assertTrue(merge_blockers(p))
    def test_other_story(self):
        p=valid();p["pr_story_issue"]=176;self.assertTrue(merge_blockers(p))
    def test_old_pr_not_bulk_merged(self):
        for n in (173,184,187):
            p=valid();p["pr_number"]=n
            with self.subTest(pr=n): self.assertTrue(merge_blockers(p))
    def test_missing_criteria(self):
        p=valid();p["required_criteria"]=[];self.assertTrue(merge_blockers(p))
    def test_duplicate_criteria(self):
        p=valid();p["required_criteria"]=["A1","A1"];self.assertTrue(merge_blockers(p))
    def test_missing_qa(self):
        p=valid();del p["qa"];self.assertTrue(merge_blockers(p))
    def test_stale_review(self):
        p=valid();p["review"]["head_sha"]="d"*40;self.assertTrue(merge_blockers(p))
    def test_stale_spec(self):
        p=valid();p["qa"]["spec_sha"]="d"*40;self.assertTrue(merge_blockers(p))
    def test_self_approval(self):
        p=valid();p["review"]["run_id"]=p["author"]["run_id"];self.assertTrue(merge_blockers(p))
    def test_missing_evidence(self):
        p=valid();p["qa"]["evidence"]=[];self.assertTrue(merge_blockers(p))
    def test_incomplete_criteria(self):
        p=valid();p["qa"]["criteria"]={"A1":"pass"};self.assertTrue(merge_blockers(p))
    def test_blocked_criterion(self):
        p=valid();p["qa"]["criteria"]["A2"]="blocked";self.assertTrue(merge_blockers(p))
    def test_check_outcomes(self):
        for outcome in ("failure","cancelled","skipped","action_required",None):
            p=valid();p["required_checks"][0]["outcome"]=outcome
            with self.subTest(outcome=outcome): self.assertTrue(merge_blockers(p))
    def test_running_check(self):
        p=valid();p["required_checks"][0]["status"]="in_progress";self.assertTrue(merge_blockers(p))
    def test_commit_not_deployment(self):
        self.assertTrue(delivery_blockers({"merge_sha":"a"*40}))
    def test_different_deployed_build(self):
        self.assertTrue(delivery_blockers(dict(merge_sha="a"*40,deployed_sha="b"*40,deployment_observed=True,story_smoke_passed=True,synthetic_only=True,evidence="test")))
    def test_verified_delivery(self):
        self.assertEqual(delivery_blockers(dict(merge_sha="a"*40,deployed_sha="a"*40,deployment_observed=True,story_smoke_passed=True,synthetic_only=True,evidence="test")),[])

if __name__ == '__main__': unittest.main()
