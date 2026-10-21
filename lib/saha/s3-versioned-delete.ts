import type {ConditionalObjectDeletionCapability} from './retention-disposal';

export type S3VersionedDeletePolicy={
 enabled:boolean;
 providerKind:'s3-compatible';
 versioningVerified:boolean;
 ifMatchDeleteVerified:boolean;
 capabilityEvidenceRef:string;
};

export type S3VersionedDeleteRequest={
 method:'DELETE';
 key:string;
 versionId:string;
 ifMatch:string;
};

export type S3VersionedDeleteResponse={status:number;requestId?:string};
export type S3VersionedDeleteTransport=(request:S3VersionedDeleteRequest)=>Promise<S3VersionedDeleteResponse>;

const approved=(policy:S3VersionedDeletePolicy)=>
 policy.enabled&&policy.providerKind==='s3-compatible'&&policy.versioningVerified&&policy.ifMatchDeleteVerified&&policy.capabilityEvidenceRef.trim().length>=8;

/**
 * Builds only the deletion semantics. Credential loading, request signing, endpoint selection and
 * provider activation belong to a separately reviewed server adapter and are deliberately absent.
 */
export function s3VersionedDeleteCapability(policy:S3VersionedDeletePolicy,transport:S3VersionedDeleteTransport):ConditionalObjectDeletionCapability|null{
 if(!approved(policy))return null;
 return {kind:'conditional-version-specific-delete-v1',async deleteExact({key,version,etag}){
  if(!key||!version||!etag)return 'unconfirmed';
  const response=await transport({method:'DELETE',key,versionId:version,ifMatch:etag});
  if(response.status===204)return 'deleted';
  if(response.status===404)return 'absent';
  if(response.status===409||response.status===412)return 'mismatch';
  return 'unconfirmed';
 }};
}
