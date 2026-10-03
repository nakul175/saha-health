import { env } from 'cloudflare:workers';
import { identityConfig, principalFromHeaders } from './identity';
// Fixed route and numeric status only. Never store URLs, queries, payloads,
// patient/actor IDs, headers, provider errors or raw exception messages.
export async function measured(request:Request,route:'anaemia-provider'|'anaemia-screenings'|'workforce-import'|'incentive-claims'|'identifier-search'|'trace'|'record-opened'|'aggregate-reports'|'alerts'|'notification-channel'|'record-import'|'import-rejections'|'household'|'pack-installations'|'referral-requests'|'patients'|'patient-detail'|'worklists'|'delegations'|'worker-activity'|'action-plan'|'exceptions'|'caseload'|'identity-cases'|'exceptional'|'rights'|'retention'|'indicators'|'referral-escalations'|'roster'|'abdm'|'media'|'governance'|'provider-sandbox'|'patient-matches'|'continuity'|'workspace'|'commands'|'operations'|'pilot'|'outreach'|'expansion'|'history'|'audit'|'audit-chain'|'data-exit'|'environment'|'fixture-migration'|'programme-migration'|'patient-import'|'facility-scope'|'purpose-scope'|'fhir',action:()=>Promise<Response>){
 const started=performance.now(),response=await action(),elapsed=Math.max(0,Math.round(performance.now()-started)),requestId=crypto.randomUUID();
 // A request rejected before its body was read (CSRF, media type, early scope checks) leaves the
 // body unconsumed. Draining a bounded amount (64 KB) and cancelling the rest lets the connection close cleanly; an unread body on a reused
 // local dev connection surfaced as the intermittent 'worker restarted mid-request' 503 (slice 0c).
 if(request.body&&!request.bodyUsed){try{const reader=request.body.getReader();let read=0;const drainLimit=route==='anaemia-screenings'?220001:65536;while(read<drainLimit){const {done,value}=await reader.read();if(done)break;read+=value?.length??0;}await reader.cancel();}catch{/* already closed */}}
 response.headers.set('X-Saha-Request-Id',requestId);response.headers.set('Referrer-Policy','no-referrer');
 try{const user=await principalFromHeaders(request.headers,identityConfig(env as unknown as Record<string,unknown>));if(user&&env.DB){const org=request.headers.get('x-saha-organisation')??new URL(request.url).searchParams.get('organisationId')??(await env.DB.prepare('SELECT active_org_id FROM accounts WHERE user_id=?').bind(user.userId).first<{active_org_id:string}>())?.active_org_id;
 if(org){const bucket=new Date().toISOString().slice(0,13)+':00:00.000Z';await env.DB.batch([
 env.DB.prepare(`INSERT INTO request_metrics (org_id,bucket,route,status,count,total_ms,max_ms) SELECT ?,?,?,?,1,?,? WHERE EXISTS (SELECT 1 FROM memberships WHERE org_id=? AND user_id=? AND status='active') ON CONFLICT(org_id,bucket,route,status) DO UPDATE SET count=count+1,total_ms=total_ms+excluded.total_ms,max_ms=max(max_ms,excluded.max_ms)`).bind(org,bucket,route,response.status,elapsed,elapsed,org,user.userId),
 env.DB.prepare('DELETE FROM request_metrics WHERE org_id=? AND bucket<?').bind(org,new Date(Date.now()-30*86400000).toISOString())]);}}}catch{console.error('Saha request metrics unavailable');}
 console.log(JSON.stringify({event:'saha_request',requestId,route,status:response.status,durationMs:elapsed}));return response;
}
