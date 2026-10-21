import type {ConditionalObjectDeletionCapability} from './retention-disposal';
import {s3VersionedDeleteCapability,type S3VersionedDeleteRequest,type S3VersionedDeleteResponse} from './s3-versioned-delete';
import {spacesVersionDeleteCapability,type SpacesVersionDeleteRequest,type SpacesVersionDeleteResponse} from './digitalocean-spaces-versioned-delete';

export type S3ExactDeleteSigningRequest=S3VersionedDeleteRequest&{
 endpoint:string;
 accountId:string;
 bucket:string;
};
export type S3ExactDeleteSigner={signedDelete:(request:S3ExactDeleteSigningRequest)=>Promise<S3VersionedDeleteResponse>};
export type SpacesExactDeleteSigningRequest=SpacesVersionDeleteRequest&{endpoint:string;region:string;accountId:string;bucket:string};
export type SpacesExactDeleteSigner={signedVersionDelete:(request:SpacesExactDeleteSigningRequest)=>Promise<SpacesVersionDeleteResponse>};

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

export function productionSpacesExactDelete(runtime:Record<string,unknown>):ConditionalObjectDeletionCapability|null{
 if(runtime.SAHA_RETENTION_OBJECT_DELETE!=='digitalocean-spaces-versioned-v1'||runtime.SAHA_ENVIRONMENT!=='production')return null;
 const origin=endpoint(runtime.SAHA_RETENTION_SPACES_ENDPOINT),region=runtime.SAHA_RETENTION_SPACES_REGION,accountId=runtime.SAHA_RETENTION_SPACES_ACCOUNT_ID,bucketName=runtime.SAHA_RETENTION_SPACES_BUCKET,
  versioningEvidence=runtime.SAHA_RETENTION_SPACES_VERSIONING_EVIDENCE,deleteEvidence=runtime.SAHA_RETENTION_SPACES_EXACT_VERSION_DELETE_EVIDENCE,accountBucketEvidence=runtime.SAHA_RETENTION_SPACES_ACCOUNT_BUCKET_EVIDENCE,signer=runtime.RETENTION_DELETE_SIGNER as SpacesExactDeleteSigner|undefined;
 if(!origin||typeof region!=='string'||!/^[a-z]{2,8}[0-9]$/.test(region)||origin!==`https://${region}.digitaloceanspaces.com`||typeof accountId!=='string'||!token.test(accountId)||typeof bucketName!=='string'||!bucket.test(bucketName)||typeof versioningEvidence!=='string'||versioningEvidence.trim().length<8||typeof deleteEvidence!=='string'||deleteEvidence.trim().length<8||typeof accountBucketEvidence!=='string'||accountBucketEvidence.trim().length<8||!signer||typeof signer.signedVersionDelete!=='function')return null;
 return spacesVersionDeleteCapability({enabled:true,providerKind:'digitalocean-spaces',versioningVerified:true,exactVersionDeleteVerified:true,capabilityEvidenceRef:`${versioningEvidence.trim()} | ${deleteEvidence.trim()} | ${accountBucketEvidence.trim()}`},request=>signer.signedVersionDelete({...request,endpoint:origin,region,accountId,bucket:bucketName}));
}

export function productionObjectDeleteCapability(runtime:Record<string,unknown>):ConditionalObjectDeletionCapability|null{
 return productionS3ConditionalDelete(runtime)??productionSpacesExactDelete(runtime);
}
