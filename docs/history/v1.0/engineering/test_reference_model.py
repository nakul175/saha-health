import unittest
from copy import deepcopy
from reference_model import *

class Invariants(unittest.TestCase):
    def setUp(self):
        self.context={'tenant':'A','actor':'W','active':True,'environment':'synthetic','people':['P1'],'actions':['capture','disclose'],'purpose':'care'}
        self.resource={'tenant':'A','person':'P1','environment':'synthetic'}
        self.authority={'tenant':'A','person':'P1','state':'active','valid_from':1,'expires_at':100,'actions':['capture','disclose'],'purpose':'care'}
        self.snapshot={'person':'P1','version':1,'recipient':'MIS-A','model':'1.0','purpose':'care'}
        self.approval={'tenant':'A','actor':'W','state':'active','expires_at':100,'snapshot_hash':digest(self.snapshot)}
        self.need={'tenant':'A','person':'P1','concept':'history','episode':'E1','unit':'code','source':'reported','max_age':10,'purpose':'care'}
        self.fact={**self.need,'confirmed':True,'effective_at':5,'allowed_purposes':['care']}
    def allow(self):return authorise(self.context,self.resource,'disclose',self.authority,50)
    def test_authorised_action(self):self.assertTrue(self.allow())
    def test_cross_tenant_denied(self):
        self.resource['tenant']='B'
        with self.assertRaises(Denied):self.allow()
    def test_unassigned_person_denied(self):
        self.resource['person']='P2'
        with self.assertRaises(Denied):self.allow()
    def test_wrong_authority_person_denied(self):
        self.authority['person']='P2'
        with self.assertRaises(Denied):self.allow()
    def test_wrong_environment_denied(self):
        self.resource['environment']='production'
        with self.assertRaises(Denied):self.allow()
    def test_inactive_membership_denied(self):
        self.context['active']=False
        with self.assertRaises(Denied):self.allow()
    def test_role_cannot_issue_order(self):
        with self.assertRaises(Denied):authorise(self.context,self.resource,'clinical_order',self.authority,50)
    def test_revocation_denies_dispatch(self):
        self.authority['state']='revoked'
        with self.assertRaises(Denied):self.allow()
    def test_expiry_boundary_denied(self):
        with self.assertRaises(Denied):authorise(self.context,self.resource,'disclose',self.authority,100)
    def test_purpose_change_denied(self):
        self.context['purpose']='training'
        with self.assertRaises(Denied):self.allow()
    def test_exact_approval(self):self.assertTrue(check_approval(self.approval,self.snapshot,self.context,50))
    def test_changed_fact_invalidates_approval(self):
        self.snapshot['version']=2
        with self.assertRaises(Conflict):check_approval(self.approval,self.snapshot,self.context,50)
    def test_changed_recipient_invalidates_approval(self):
        self.snapshot['recipient']='MIS-B'
        with self.assertRaises(Conflict):check_approval(self.approval,self.snapshot,self.context,50)
    def test_expired_approval(self):
        with self.assertRaises(Denied):check_approval(self.approval,self.snapshot,self.context,100)
    def test_reuse_matching_fact(self):self.assertTrue(reusable(self.fact,self.need,10))
    def test_reuse_stale_fact(self):self.assertFalse(reusable(self.fact,self.need,16))
    def test_reuse_future_fact(self):self.assertFalse(reusable(self.fact,self.need,4))
    def test_reuse_wrong_episode(self):
        self.fact['episode']='E2';self.assertFalse(reusable(self.fact,self.need,10))
    def test_reuse_unconfirmed_fact(self):
        self.fact['confirmed']=False;self.assertFalse(reusable(self.fact,self.need,10))
    def test_reuse_incompatible_unit(self):
        self.fact['unit']='other';self.assertFalse(reusable(self.fact,self.need,10))
    def test_minimum_payload(self):self.assertEqual(minimal_payload({'signal':'x','name':'Person','phone':'secret'},['signal'],['signal']),{'signal':'x'})
    def test_missing_required_input(self):
        with self.assertRaises(Conflict):minimal_payload({'name':'Person'},['signal'],['signal'])
    def test_same_command_replayed_once(self):
        c=CommandStore();a=c.execute('A','W','capture','key',{'x':1});b=c.execute('A','W','capture','key',{'x':1});self.assertEqual(a['resource_id'],b['resource_id']);self.assertTrue(b['replayed']);self.assertEqual(len(c.effects),1)
    def test_same_key_changed_payload_rejected(self):
        c=CommandStore();c.execute('A','W','capture','key',{'x':1})
        with self.assertRaises(Conflict):c.execute('A','W','capture','key',{'x':2})
    def test_receipt_scope_separates_tenants(self):
        c=CommandStore();c.execute('A','W','capture','key',{'x':1});c.execute('B','W','capture','key',{'x':1});self.assertEqual(len(c.effects),2)
    def test_timeout_does_not_allow_blind_retry(self):
        a=DestinationAction('action1');a.send('timeout')
        with self.assertRaises(Conflict):a.send('accept')
    def test_reconciliation_accepts_without_resend(self):
        a=DestinationAction('action1');a.send('timeout');a.reconcile('accepted');self.assertEqual((a.state,a.sends),('accepted',1))
    def test_unknown_receipt_stays_uncertain(self):
        a=DestinationAction('action1');a.send('timeout');a.reconcile('unknown');self.assertEqual(a.state,'uncertain')
    def test_revoked_authority_blocks_proven_absent_retry(self):
        a=DestinationAction('action1');a.send('timeout');a.reconcile('proven_absent',False);self.assertEqual(a.state,'blocked')
    def test_independent_destination_states(self):
        a=DestinationAction('a');b=DestinationAction('b');a.send('accept');b.send('timeout');self.assertEqual((a.state,b.state),('accepted','uncertain'))
    def test_duplicate_event_does_not_double_count(self):
        c=Consumer();self.assertTrue(c.process('A','report','1'));self.assertFalse(c.process('A','report','1'));self.assertEqual(c.count,1)
    def test_sync_missing_parent_stays_pending(self):self.assertEqual(sync_item('rejected',True,True),'dependency_pending')
    def test_sync_concurrent_revision_conflicts(self):self.assertEqual(sync_item('accepted',False,True),'conflict')
    def test_sync_expired_authority_rejected(self):self.assertEqual(sync_item('accepted',True,False),'rejected')
    def test_suspended_capability_rejected(self):self.assertFalse(capability_eligible({'state':'suspended','populations':['adult'],'environments':['synthetic']},'adult','synthetic'))
    def test_unsupported_population_rejected(self):self.assertFalse(capability_eligible({'state':'active','populations':['adult'],'environments':['synthetic']},'child','synthetic'))

if __name__=='__main__':unittest.main(verbosity=2)
