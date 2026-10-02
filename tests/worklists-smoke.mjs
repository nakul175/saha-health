import assert from 'node:assert/strict';
// Slice 0b-4: server-side work lists for paged workspaces, through the built Worker and local D1. A separate synthetic
// organisation holds 560 people in team A and 30 in team B, with visits, follow-ups, submissions and referrals.
// For paged viewers, every view walked page by page must equal what the unpaged workspace (the same read without
// the paging header) shows for the same viewer, computed here by an independent implementation of the documented
// order. ASHAs keep the unpaged workspace; the address carries no names, ids or free text.
const ATTENTION=['uncertain','sending','queued','retryable'],TERMINAL=['completed','declined','cancelled'];
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const oracle=s=>{
 const work=s.people.slice().sort((a,b)=>Number(a.status==='completed')-Number(b.status==='completed')||Number(b.due==='Today')-Number(a.due==='Today')||a.name.localeCompare(b.name,'en')||cmp(a.id,b.id)).map(p=>p.id);
 const tasks=s.people.flatMap(p=>(p.followUps??[]).filter(t=>t.state==='open').map(t=>({p,t}))).sort((a,b)=>a.t.due.localeCompare(b.t.due)||cmp(a.p.id,b.p.id));
 const followups=[...new Set(tasks.map(x=>x.p.id))].map(id=>`${id}:${tasks.filter(x=>x.p.id===id).map(x=>x.t.id).join(',')}`);
 const subs=s.submissions.slice().sort((a,b)=>cmp(b.createdAt,a.createdAt)||cmp(b.id,a.id));
 const refs=s.referrals.slice().sort((a,b)=>Number(TERMINAL.includes(a.state))-Number(TERMINAL.includes(b.state))||(a.due??'9999').localeCompare(b.due??'9999')||cmp(a.id,b.id)).map(r=>r.id);
 const stats={toDo:s.people.filter(p=>p.status==='due'&&p.due==='Today').length,inProgress:s.people.filter(p=>p.status==='in_progress').length,confirmed:s.visits.filter(v=>v.state==='confirmed'&&!v.voidedAt&&!v.supersededBy).length,attention:s.submissions.filter(x=>ATTENTION.includes(x.state)).length};
 return {work,followups,tasks:tasks.length,subs:subs.map(x=>x.id),attention:subs.filter(x=>ATTENTION.includes(x.state)).map(x=>x.id),refs,stats};
};
export async function worklistsSmoke({get,post,check,sql,base}){
 const run=crypto.randomUUID().slice(0,8);
 const account=label=>({id:`wl-${run}-${label}`,headers:{'oai-authenticated-user-id':`wl-${run}-${label}`,'oai-authenticated-user-email':`${label}@example.invalid`},state:null});
 const o=account('owner'),sv=account('supervisor'),cl=account('clinician'),as=account('asha'),ad=account('admin'),x=account('stranger');
 await get(o);const org=(await post(o,{type:'createOrganisation',name:`Worklists ${run}`})).result.organisationId;
 await get(o,'/api/workspace',200,org);
 const teamB=(await post(o,{type:'createTeam',name:'Worklists team B'},200,crypto.randomUUID(),org)).result.teamId;
 for(const [who,role,teams] of [[sv,'supervisor',['default']],[cl,'clinician',['default']],[as,'asha',['default']],[ad,'admin',['default']]]){await get(who);const inv=(await post(o,{type:'createInvite',accountCode:who.state.user.accountCode,label:`Worklists ${role}`,role,teamIds:teams},200,crypto.randomUUID(),org)).result;await post(who,{type:'joinOrganisation',token:inv.token});}
 await get(x);
 const tpl=(await post(o,{type:'createPerson',name:'Worklists Template',age:30,sex:'Female',village:'Template village',programme:'Maternal care',teamId:'default'},200,crypto.randomUUID(),org)).result.personId;
 const {identityReview,assignmentHistory,fieldRegistration,...template}=JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org,tpl).data);
 const STATUS=[['due','Today'],['due','Tomorrow'],['in_progress','Today'],['completed','Today'],['due','Today'],['completed','Yesterday'],['in_progress','Next week']];
 // Names repeat (and differ in case) so name ties are broken by id.
 const person=(i,team)=>{const id=`wl_${run}_${team==='default'?'a':'b'}${String(i).padStart(4,'0')}`,name=`${team==='default'?['Aster','birch','Cedar'][i%3]:'Birch'} Synthetic ${String(i%41).padStart(2,'0')}`,assignedTo=team==='default'&&i<20?as.id:o.id,[status,due]=STATUS[i%7];
  const followUps=i%6===0?[{id:`f${i}a`,enrolmentId:`e${i}`,packId:'maternal',title:'Synthetic follow-up',due:`2026-10-${String(1+(i%27)).padStart(2,'0')}`,ownerId:o.id,state:'open',createdAt:'2026-09-20T08:00:00.000Z',createdBy:o.id},{id:`f${i}b`,enrolmentId:`e${i}`,packId:'ncd',title:'Closed follow-up',due:'2026-09-01',ownerId:o.id,state:'completed',createdAt:'2026-09-20T08:00:00.000Z',createdBy:o.id}]:undefined;
  return {id,name,team,assignedTo,data:{...template,id,name,age:20+(i%50),village:`Worklists village ${i%12}`,programmes:[i%3?'Maternal care':'Chronic care'],status,due,...(followUps?{followUps}:{}),version:1,teamId:team,assignedTo,createdAt:'2026-09-20T08:00:00.000Z'}};};
 const seededA=Array.from({length:559},(_,i)=>person(i,'default')),seededB=Array.from({length:30},(_,i)=>person(i,teamB));
 const insP=sql.prepare('INSERT INTO patients (org_id,id,version,name,team_id,assigned_to,data) VALUES (?,?,?,?,?,?,?)');
 const insV=sql.prepare('INSERT INTO visits (org_id,id,person_id,version,record_version,state,data) VALUES (?,?,?,?,?,?,?)');
 const insS=sql.prepare('INSERT INTO submissions (org_id,id,visit_id,person_id,state,data) VALUES (?,?,?,?,?,?)');
 const insR=sql.prepare('INSERT INTO referrals (org_id,id,person_id,data) VALUES (?,?,?,?)');
 const SUB=['accepted','uncertain','queued','rejected','retryable','sending','cancelled'],REF=['draft','sent','completed','scheduled','declined','cancelled'];
 sql.exec('BEGIN');
 for(const [i,p] of [...seededA,...seededB].entries()){
  insP.run(org,p.id,1,p.name,p.team,p.assignedTo,JSON.stringify(p.data));
  if(i%4)continue;
  const vid=`${p.id}_v`,state=i%8?'confirmed':'draft',extra=i%24===0?{voidedAt:'2026-09-21T08:00:00.000Z'}:{},at=`2026-09-${String(1+(i%28)).padStart(2,'0')}T08:00:00.000Z`;
  insV.run(org,vid,p.id,2,1,state,JSON.stringify({id:vid,personId:p.id,version:2,state,facts:{date:'2026-09-20T08:00',systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',notes:'Synthetic',source:'measured'},createdAt:at,aiResults:[],recordVersion:1,...extra}));
  // Random-looking ids with tied creation times exercise the (time, id) order.
  const sid=`s${run}${String((i*7919)%10007).padStart(5,'0')}`,ss=SUB[i%7];
  insS.run(org,sid,vid,p.id,ss,JSON.stringify({id:sid,visitId:vid,personId:p.id,connectorId:'mis',connectorName:'Synthetic programme',state:ss,mode:'demo',payloadHash:'h',attempts:i%3,message:'Synthetic receipt',createdAt:`2026-09-${String(1+(i%9)).padStart(2,'0')}T09:00:00.000Z`,updatedAt:at}));
  if(i%8===0){const rid=`r${run}${String((i*31)%997).padStart(3,'0')}`;insR.run(org,rid,p.id,JSON.stringify({id:rid,personId:p.id,visitId:vid,facility:'Synthetic PHC',reason:'Synthetic reason',state:REF[(i/8)%6],...(i%16?{due:`2026-10-${String(1+(i%27)).padStart(2,'0')}`}:{}),createdAt:at,version:1}));}
 }
 sql.exec('COMMIT');
 const inB=new Set(seededB.map(p=>p.id));
 const paged={'x-saha-patients':'paged'};
 const ws=async(who,extra={})=>{const r=await fetch(`${base}/api/workspace`,{headers:{...who.headers,'x-saha-organisation':org,...extra}});const j=await r.json();check(()=>assert.equal(r.status,200,JSON.stringify(j).slice(0,300)));return j;};
 const urls=[];
 const page=async(who,q,status=200)=>{const u=`${base}/api/worklists?${q}`;urls.push(u);const r=await fetch(u,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const walk=async(who,view,tab='',limit=100)=>{const rows=[];let cursor=null,first=null,pages=0;do{const j=await page(who,`view=${view}&limit=${limit}${tab?`&tab=${tab}`:''}${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`);first??=j;check(()=>assert.equal(j.total,first.total));rows.push(...j.rows);cursor=j.nextCursor;pages++;}while(cursor&&pages<50);return {rows,first,pages};};
 const compare=async(who,label)=>{
  const full=await ws(who),want=oracle(full);
  const work=await walk(who,'work'),fu=await walk(who,'followups'),subs=await walk(who,'submissions'),att=await walk(who,'submissions','attention'),refs=await walk(who,'referrals');
  check(()=>assert.deepEqual(work.first.stats,want.stats,`${label} stats`));
  check(()=>assert.deepEqual(work.rows.map(r=>r.id),want.work,`${label} visit list`));
  check(()=>assert.deepEqual([fu.first.tasks,fu.rows.map(g=>`${g.personId}:${g.tasks.map(t=>t.id).join(',')}`)],[want.tasks,want.followups],`${label} follow-ups`));
  check(()=>assert.deepEqual([subs.first.all,subs.first.attention,subs.rows.map(r=>r.id)],[want.subs.length,want.attention.length,want.subs],`${label} submissions`));
  check(()=>assert.deepEqual(att.rows.map(r=>r.id),want.attention,`${label} needs attention`));
  check(()=>assert.deepEqual(refs.rows.map(r=>r.id),want.refs,`${label} referrals`));
  return {full,want,work,fu,subs,refs};
 };
 // The paged viewers: the workspace read is paged, and the server work lists equal the unpaged workspace.
 for(const who of [sv,o,cl]){const s=await ws(who,paged);check(()=>{assert.equal(s.patientPaging.total,560);assert.equal(s.people.length,0);});}
 const svc=await compare(sv,'supervisor');
 check(()=>{assert.equal(svc.work.first.total,560);assert.equal(svc.work.pages,6);assert.ok(svc.work.rows.every(r=>!inB.has(r.id)));assert.ok(svc.subs.rows.length>100&&svc.refs.rows.length>10&&svc.fu.rows.length>50);});
 // Owner authority does not widen scope: the owner (team A only) sees no team-B record in any list.
 const oc=await compare(o,'owner');
 check(()=>{assert.ok(oc.work.rows.every(r=>!inB.has(r.id))&&oc.subs.rows.every(r=>!inB.has(r.personId))&&oc.refs.rows.every(r=>!inB.has(r.personId))&&oc.fu.rows.every(r=>!inB.has(r.personId)));assert.equal(oc.work.first.total,560);});
 await compare(cl,'clinician');
 // ASHAs are not paged; the server lists still match their 20 assigned people.
 { const s=await ws(as,paged);check(()=>{assert.equal(s.patientPaging,undefined);assert.equal(s.people.length,20);}); const a=await compare(as,'asha');check(()=>assert.equal(a.work.first.total,20)); }
 // Administrators see nothing; a non-member is refused.
 { const a=await page(ad,'view=work');check(()=>{assert.equal(a.total,0);assert.deepEqual(a.stats,{toDo:0,inProgress:0,confirmed:0,attention:0});}); }
 await page(x,'view=work',403);
 // Rows are summaries: no delivery payloads, hashes or referral events; names only of in-scope patients.
 check(()=>{const s=svc.subs.rows[0],r=svc.refs.rows[0];assert.ok(!('delivery' in s)&&!('payloadHash' in s)&&!('events' in r)&&!('sources' in r));assert.equal(s.personName,svc.full.people.find(p=>p.id===s.personId).name);});
 // The address never carries a name, free text or record id: only view, tab, limit and an offset cursor.
 check(()=>{for(const u of urls){const q=new URL(u).searchParams;assert.ok([...q.keys()].every(k=>['view','tab','limit','cursor'].includes(k)),u);assert.ok(!q.has('cursor')||/^n:\d+$/.test(q.get('cursor')),u);assert.ok(!/Synthetic|Aster|birch|Cedar|wl_/.test(decodeURIComponent(u)),u);}});
 await page(sv,'view=work&q=aster',400);await page(sv,`view=work&cursor=${encodeURIComponent('after:'+seededA[0].id)}`,400);await page(sv,'view=people',400);await page(sv,'view=work&tab=attention',400);await page(sv,'limit=x',400);
 // After a command the lists follow the data: a clinician starts a visit; the supervisor's lists still equal the unpaged workspace.
 const target=seededA.find((p,i)=>i%4&&p.data.status==='due');
 await post(cl,{type:'startVisit',personId:target.id},200,crypto.randomUUID(),org,paged);
 const after=await compare(sv,'supervisor after a command');
 check(()=>{assert.equal(after.work.first.stats.inProgress,svc.work.first.stats.inProgress+1);assert.equal(after.work.rows.find(r=>r.id===target.id).status,'in_progress');});
}
