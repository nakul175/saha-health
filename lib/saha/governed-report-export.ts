type DynamicValue = ReturnType<typeof JSON.parse>;

import {fail} from './core';

export const GOVERNED_EXPORT_FORMAT='saha-governed-report-export-v1' as const;
export const GOVERNED_EXPORT_APPROVAL_HOURS=24;
export const GOVERNED_EXPORT_LIMIT=8;
export const GOVERNED_EXPORT_PAYLOAD_LIMIT=80_000;
export const GOVERNED_EXPORT_TOTAL_LIMIT=400_000;

export type GovernedReportExport={
 format:typeof GOVERNED_EXPORT_FORMAT;
 id:string;
 state:'prepared'|'approved'|'expired'|'cancelled';
 submissionState:'not-submitted';
 definition:{id:string;version:string};
 days:7|30|90;
 teamIds:string[];
 delegationIds:string[];
 filterHash:string;
 sourceHash:string;
 payloadHash:string;
 rows:number;
 payload:string;
 preparedAt:string;
 preparedBy:string;
 preparedByName:string;
 preparedMemberVersion:number;
 approvedAt?:string;
 approvedBy?:string;
 approvedByName?:string;
 approvedMemberVersion?:number;
 expiresAt?:string;
};

export type GovernedExportActor={userId:string;displayName:string;memberVersion:number;canReview:boolean};

export function exportsOf(operations:DynamicValue):GovernedReportExport[]{
 return Array.isArray(operations?.governedReportExports)?operations.governedReportExports:[];
}

export function expireExports(records:GovernedReportExport[],at:string){
 for(const record of records)if(record.state==='approved'&&record.expiresAt&&record.expiresAt<=at)record.state='expired';
}

export function prepareGovernedExport(input:Omit<GovernedReportExport,'format'|'state'|'submissionState'>):GovernedReportExport{
 if(![7,30,90].includes(input.days))fail(422,'Choose a 7, 30 or 90 day reporting period.');
 if(!input.teamIds.length)fail(422,'A governed export needs at least one authorised team.');
 if(new TextEncoder().encode(input.payload).byteLength>GOVERNED_EXPORT_PAYLOAD_LIMIT)fail(422,'This governed export is too large. Narrow the reporting period or team scope.');
 return {...input,format:GOVERNED_EXPORT_FORMAT,state:'prepared',submissionState:'not-submitted'};
}

export function approveGovernedExport(record:GovernedReportExport,actor:GovernedExportActor,at:string){
 if(record.state!=='prepared')fail(409,'Only a prepared export can be reviewed.');
 if(!actor.canReview)fail(403,'Current reporting reviewer authority is required.');
 if(actor.userId===record.preparedBy)fail(403,'A different authorised person must review this export.');
 record.state='approved';record.approvedAt=at;record.approvedBy=actor.userId;record.approvedByName=actor.displayName;record.approvedMemberVersion=actor.memberVersion;
 record.expiresAt=new Date(Date.parse(at)+GOVERNED_EXPORT_APPROVAL_HOURS*3600_000).toISOString();
 return record;
}

export function assertGovernedDownload(record:GovernedReportExport,input:{actorId:string;days:number;filterHash:string;sourceHash:string;payloadHash:string;at:string;preparerCurrent:boolean;reviewerCurrent:boolean}){
 if(record.state==='approved'&&record.expiresAt&&record.expiresAt<=input.at)record.state='expired';
 if(record.state!=='approved'||!record.expiresAt)fail(409,record.state==='expired'?'This reviewed export has expired. Prepare and review a new export.':'This export needs independent review before download.');
 if(!input.preparerCurrent||!input.reviewerCurrent)fail(409,'The preparer or reviewer authority changed. Prepare and review a new export.');
 if(input.days!==record.days||input.filterHash!==record.filterHash)fail(409,'Reporting filters changed after approval. Prepare and review a new export.');
 if(input.sourceHash!==record.sourceHash||input.payloadHash!==record.payloadHash)fail(409,'The governed report changed after approval. Prepare and review a new export.');
 if(![record.preparedBy,record.approvedBy].includes(input.actorId))fail(403,'Only the preparer or independent reviewer may download this reviewed export.');
 return record.payload;
}

export function governedExportView(record:GovernedReportExport){
 const {payload,...view}=record;return view;
}
