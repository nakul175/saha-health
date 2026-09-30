"""Small in-memory reference model, not production application or clinical code.

This model makes selected invariants executable. It deliberately omits network,
database atomicity, keys, authenticated sessions and clinical decision logic.
"""
import hashlib,json

class Denied(ValueError): pass
class Conflict(ValueError): pass

def digest(value):
    # Reference fixtures contain no floats. A production canonicalisation standard
    # and cross-language conformance vectors must be selected before deployment.
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()

def reusable(fact,need,now):
    keys=('tenant','person','concept','episode','unit','source')
    return all(fact.get(k)==need.get(k) for k in keys) and fact.get('confirmed') is True and not fact.get('disputed',False) and 0<=now-fact['effective_at']<=need['max_age'] and need['purpose'] in fact['allowed_purposes']

def authorise(context,resource,action,authority,now):
    if not context['active']:raise Denied('inactive actor')
    if context['tenant']!=resource['tenant']:raise Denied('tenant')
    if context['environment']!=resource['environment']:raise Denied('environment')
    if resource['person'] not in context['people']:raise Denied('relationship')
    if action not in context['actions']:raise Denied('role action')
    if authority['tenant']!=resource['tenant'] or authority['person']!=resource['person']:raise Denied('authority subject')
    if authority['state']!='active' or not authority['valid_from']<=now<authority['expires_at']:raise Denied('authority time')
    if action not in authority['actions'] or context['purpose']!=authority['purpose']:raise Denied('authority scope')
    return True

def check_approval(approval,snapshot,context,now):
    if approval['state']!='active' or now>=approval['expires_at']:raise Denied('approval expired or withdrawn')
    if approval['tenant']!=context['tenant'] or approval['actor']!=context['actor']:raise Denied('approval identity')
    if approval['snapshot_hash']!=digest(snapshot):raise Conflict('snapshot changed')
    return True

def minimal_payload(source,allowed,required):
    result={k:source[k] for k in allowed if k in source}
    if not set(required)<=set(result):raise Conflict('required input missing')
    return result

class CommandStore:
    def __init__(self):self.receipts={};self.effects=[]
    def execute(self,tenant,actor,command,key,payload):
        k=(tenant,actor,command,key);h=digest(payload)
        if k in self.receipts:
            previous=self.receipts[k]
            if previous['request_hash']!=h:raise Conflict('same key different payload')
            return {**previous,'replayed':True}
        result={'request_hash':h,'resource_id':len(self.effects)+1,'replayed':False}
        self.effects.append((k,payload));self.receipts[k]=result
        return result

class DestinationAction:
    def __init__(self,logical_id):self.logical_id=logical_id;self.state='queued';self.sends=0;self.receipt=None
    def send(self,outcome):
        if self.state!='queued':raise Conflict('write must be queued; reconcile uncertainty first')
        self.sends+=1
        self.state={'timeout':'uncertain','accept':'accepted','reject':'rejected'}[outcome]
    def reconcile(self,evidence,current_authority=True):
        if self.state!='uncertain':raise Conflict('not uncertain')
        if evidence=='accepted':self.state='accepted';self.receipt='synthetic-receipt'
        elif evidence=='proven_absent' and current_authority:self.state='queued'
        elif evidence=='proven_absent':self.state='blocked'
        else:self.state='uncertain'

class Consumer:
    def __init__(self):self.receipts=set();self.count=0
    def process(self,tenant,consumer,event):
        key=(tenant,consumer,event)
        if key in self.receipts:return False
        self.receipts.add(key);self.count+=1;return True

def sync_item(parent_state,version_matches,authority_active):
    if parent_state not in ('accepted','duplicate'):return 'dependency_pending'
    if not version_matches:return 'conflict'
    if not authority_active:return 'rejected'
    return 'accepted'

def capability_eligible(manifest,population,environment):
    return manifest['state']=='active' and population in manifest['populations'] and environment in manifest['environments']
