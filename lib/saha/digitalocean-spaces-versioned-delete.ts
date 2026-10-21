import type {ConditionalObjectDeletionCapability} from './retention-disposal';

export type SpacesVersionDeletePolicy={enabled:boolean;providerKind:'digitalocean-spaces';versioningVerified:boolean;exactVersionDeleteVerified:boolean;capabilityEvidenceRef:string};
export type SpacesVersionDeleteRequest={method:'DELETE';key:string;versionId:string};
export type SpacesVersionDeleteResponse={status:number;versionId?:string;requestId?:string};
export type SpacesVersionDeleteTransport=(request:SpacesVersionDeleteRequest)=>Promise<SpacesVersionDeleteResponse>;

export function spacesVersionDeleteCapability(policy:SpacesVersionDeletePolicy,transport:SpacesVersionDeleteTransport):ConditionalObjectDeletionCapability|null{
 if(!policy.enabled||policy.providerKind!=='digitalocean-spaces'||!policy.versioningVerified||!policy.exactVersionDeleteVerified||policy.capabilityEvidenceRef.trim().length<8)return null;
 return {kind:'exact-immutable-version-delete-v1',async deleteExact({key,version}){
  if(!key||!version)return 'unconfirmed';
  const response=await transport({method:'DELETE',key,versionId:version});
  if(response.status===204)return response.versionId===version?'deleted':'unconfirmed';
  if(response.status===404)return 'absent';
  if(response.status===409||response.status===412)return 'mismatch';
  return 'unconfirmed';
 }};
}
