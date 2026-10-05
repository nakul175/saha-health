"""Bounded Perfetto wire decoder; retains collector event names/times, no payloads.
Uses Trace.packet=1, TracePacket.track_event=11/interned_data=12/sequence=10,
TrackEvent name=23/name_iid=10/type=9, InternedData.event_names=2.
Not a replacement for trace_processor; no liveness/isolate attribution claim.
"""
import sys,json,re,hashlib
from pathlib import Path

def fields(data):
 i=0
 def varint():
  nonlocal i
  n=0;shift=0
  while True:
   assert i<len(data),'truncated varint'
   b=data[i];i+=1;n|=(b&127)<<shift
   if b<128:return n
   shift+=7;assert shift<70
 while i<len(data):
  key=varint();field=key>>3;wire=key&7
  if wire==0:value=varint()
  elif wire==2:
   size=varint();assert i+size<=len(data),'truncated bytes'
   value=data[i:i+size];i+=size
  elif wire in (1,5):
   size=8 if wire==1 else 4;assert i+size<=len(data)
   value=data[i:i+size];i+=size
  else:raise ValueError('unsupported wire '+str(wire))
  yield field,wire,value

def one(f,k,default=None):return next((v for n,w,v in f if n==k),default)
raw=Path(sys.argv[1]).read_bytes();names={};events=[];total=0;packet_count=0;allnames=set();missing=0
for n,w,packet in fields(raw):
 if n!=1 or w!=2:continue
 packet_count+=1;f=list(fields(packet));seq=one(f,10,0)
 if one(f,13,0)&1:names[seq]={}
 ns=names.setdefault(seq,{})
 for num,wire,intern in f:
  if num==12 and wire==2:
   for kind,iw,entry in fields(intern):
    if kind==2:
     ef=list(fields(entry));ns[one(ef,1)]=one(ef,2,b'').decode('utf8',errors='replace')
 for num,wire,te in f:
  if num!=11 or wire!=2:continue
  total+=1;e=list(fields(te));name=one(e,23)
  if name is not None:name=name.decode('utf8',errors='replace')
  else:name=ns.get(one(e,10),'')
  if not name:
   legacy=one(e,6)
   if legacy:name=ns.get(one(list(fields(legacy)),1),'')
  if name:allnames.add(name)
  elif one(e,9)!=2:missing+=1
  if re.search(r'\bGC\b|garbage|scavenge|MarkCompact|cppgc|V8\.GC|major.gc|minor.gc',name,re.I):
   events.append({'name':name,'timestamp':one(f,8),'timestampClock':one(f,58),'sequence':seq,'type':one(e,9),'track':one(e,11),'legacyPhase':one(list(fields(one(e,6))),2) if one(e,6) else None})
counts={}
for e in events:counts[e['name']]=counts.get(e['name'],0)+1
result={'traceSha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'packets':packet_count,'trackEvents':total,'unresolvedNames':missing,'collectorEvents':len(events),'collectorCounts':counts,'collectorTimeline':events,'nonCollectorEventNamesCount':len(allnames-set(counts)),'observedStaticEventNames':sorted(allnames),'classification':'Wire-level passive trace observation; absence of events is an observability limitation, not evidence of no collection. No heap bytes or isolate liveness proven.'}
Path(sys.argv[2]).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='collectorTimeline'}))
