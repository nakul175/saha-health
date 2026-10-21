import type {ConditionalObjectDeletionCapability} from './retention-disposal';
import {s3VersionedDeleteCapability,type S3VersionedDeleteRequest,type S3VersionedDeleteResponse} from './s3-versioned-delete';

export type S3ExactDeleteSigningRequest=S3VersionedDeleteRequest&{
 endpoint:string;
 accountId:string;
 bucket:string;
};
export type S3ExactDeleteSigner={signedDelete:(request:S3ExactDeleteSigningRequest)=>Promise<S3VersionedDeleteResponse>};

const token=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const bucket=/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
function endpoint(value:unknown){
 if(typeof value!=='string')return null;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&(u.pathname==='/'||u.pathname==='')?u.origin:null;}catch{return null;}
}

/** Default-unset, non-production and partially configured runtimes all refuse capability creation. */
export function productionS3ConditionalDelete(runtime:Record<string,unknown>):ConditionalObjectDeletionCapability|null{
 if(runtime.SAHA_RETENTION_OBJECT_DELETE===undefined||runtime.SAHA_RETENTION_OBJECT_DELETE===''||runtime.SAHA_RETENTION_OBJECT_DELETE==='disabled')return null;
 if(runtime.SAHA_RETENTION_OBJECT_DELETE!=='s3-versioned-v1'||runtime.SAHA_ENVIRONMENT!=='production')return null;
 const origin=endpoint(runtime.SAHA_RETENTION_S3_ENDPOINT),accountId=runtime.SAHA_RETENTION_S3_ACCOUNT_ID,bucketName=runtime.SAHA_RETENTION_S3_BUCKET,
  versioningEvidence=runtime.SAHA_RETENTION_S3_VERSIONING_EVIDENCE,ifMatchEvidence=runtime.SAHA_RETENTION_S3_IF_MATCH_EVIDENCE,signer=runtime.RETENTION_DELETE_SIGNER as S3ExactDeleteSigner|undefined;
 if(!origin||typeof accountId!=='string'||!token.test(accountId)||typeof bucketName!=='string'||!bucket.test(bucketName)||typeof versioningEvidence!=='string'||versioningEvidence.trim().length<8||typeof ifMatchEvidence!=='string'||ifMatchEvidence.trim().length<8||!signer||typeof signer.signedDelete!=='function')return null;
 return s3VersionedDeleteCapability({enabled:true,providerKind:'s3-compatible',versioningVerified:true,ifMatchDeleteVerified:true,capabilityEvidenceRef:`${versioningEvidence.trim()} | ${ifMatchEvidence.trim()}`},request=>signer.signedDelete({...request,endpoint:origin,accountId,bucket:bucketName}));
}
