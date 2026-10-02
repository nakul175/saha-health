import { db, identity, loadFor, json, rawRuntime } from './server';
import { digest, fail, uuid } from './core';
import { scope } from './store';
import { z } from 'zod';
import { boundedJsonBody } from './request-body';
import { environmentOf } from './environment';
import { mayImport, planImport, publicPlan, csvBytes, MAX_CSV } from './patient-import';
import { planRecordImport, publicRecordPlan, recordImportInput } from './record-import';
import { rejectionReport, REJECTIONS_DEFINITION, REJECTION_KINDS } from './import-rejections';
import { recordExportAudit, sameCareScope } from './export-audit';
// Slice 2h: read-only dry run for enrolment and identifier imports, and the rejection report for any import dry run.
// The file travels in the request body, never in the URL.
async function body(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)fail(403,'Cross-origin requests are not allowed.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this operation.');
 const input=await boundedJsonBody(request,20000);
 const e=environmentOf(rawRuntime());if(e.name==='misconfigured')fail(409,'The environment is not configured correctly. Imports are refused until it is corrected.');
 return {input,env:e.name};
}
export async function recordImportDryRun(request:Request){
 const u=await identity(),{input,env}=await body(request);const parsed=recordImportInput.safeParse(input);if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid import.');
 const s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 return json({...publicRecordPlan(await planRecordImport(s,m,parsed.data!.kind,parsed.data!.csv,env)),generatedAt:new Date().toISOString()});
}
const tooLarge=`The file is larger than ${MAX_CSV.toLocaleString('en-IN')} bytes. Split it into smaller batches.`;
const rejectionInput=z.object({kind:z.enum(REJECTION_KINDS),csv:z.string().min(1,'Paste or choose a CSV file.').max(MAX_CSV,tooLarge).refine(x=>csvBytes(x)<=MAX_CSV,tooLarge)}).strict();
const REFUSED='Only an owner or supervisor with a clinician or supervisor role can import, for teams they belong to.';
export async function importRejections(request:Request){
 const u=await identity(),{input,env}=await body(request);const parsed=rejectionInput.safeParse(input);if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid import.');
 const {kind,csv}=parsed.data!,s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);if(!mayImport(s,m))fail(403,REFUSED);
 const plan=kind==='people'?publicPlan(await planImport(s,m,csv,env)):publicRecordPlan(await planRecordImport(s,m,kind,csv,env));
 const exportId=uuid(),generatedAt=new Date().toISOString(),report=await rejectionReport(plan,{exportId,kind,role:m.role,generatedAt});
 // The export's audit event goes through persist (slice 6p); a retry on a fresh read checks the exporter again.
 const orgId=s.organisation.id,again=(x:typeof s)=>{const o=scope(x,u.userId);if(!mayImport(x,o))fail(403,REFUSED);if(o.role!==m.role)fail(409,'Your role changed while the report was prepared. Download it again.');sameCareScope(m,o);return o;};
 await recordExportAudit(db(),{state:s,reload:()=>loadFor(u,orgId),authorize:again,event:o=>({id:uuid(),at:generatedAt,actorId:u.userId,actor:u.displayName,role:o.role,action:'importRejectionsExport',subject:orgId,detail:`Import rejection report exported for a ${kind} dry run (plan ${plan.planHash}); definition ${REJECTIONS_DEFINITION.id} ${REJECTIONS_DEFINITION.version}; export ${exportId}; ${plan.counts.rows} rows in file, ${report.listed} listed; ${report.rows} data rows; SHA-256 ${report.sha256}; control total ${report.reconciled?'reconciled':'NOT reconciled'}. Row numbers and reasons only.`}),actor:u,type:'importRejectionsExport',key:'export_'+uuid(),hash:await digest({kind,planHash:plan.planHash})});
 return new Response(report.csv,{headers:{'X-Saha-Export-Id':exportId,'X-Saha-Content-SHA256':report.sha256,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="saha-import-rejections.csv"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
