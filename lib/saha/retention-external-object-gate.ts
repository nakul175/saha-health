import type {RetentionArtifact,SpacesRetentionCustody} from './retention';
import {productionSpacesExactDelete} from './s3-versioned-delete-runtime';

type BoundArtifact=RetentionArtifact&{externalDeletion?:SpacesRetentionCustody};
export type ExternalObjectDeletionGate={ready:boolean;state:'not-applicable'|'custody-unavailable'|'provider-unavailable'|'custody-mismatch'|'policy-refused'|'ready';reason:string};

const present=(value:unknown)=>typeof value==='string'&&value.trim().length>=3;
const hex=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer),x=>x.toString(16).padStart(2,'0')).join('');
export async function externalCustodySummary(c:SpacesRetentionCustody){const coordinatesDigest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([c.endpoint,c.region,c.accountId,c.bucket,c.objectKey,c.versionId,c.etag,c.custodyEvidenceRef]))));return {provider:c.provider,coordinatesDigest};}
export function externalObjectDeletionGate(artifact:BoundArtifact,runtime:Record<string,unknown>):ExternalObjectDeletionGate{
 if(artifact.recordClass!=='export'&&artifact.recordClass!=='backup')return {ready:false,state:'not-applicable',reason:'This class does not use the external export/backup object gate.'};
 const c=artifact.externalDeletion;if(!c||c.provider!=='digitalocean-spaces'||!present(c.objectKey)||!present(c.versionId)||!present(c.etag)||!present(c.custodyEvidenceRef))return {ready:false,state:'custody-unavailable',reason:'The registered inventory is metadata-only and has no exact Spaces key/version custody binding.'};
 const capability=productionSpacesExactDelete(runtime);if(!capability)return {ready:false,state:'provider-unavailable',reason:'The verified DigitalOcean Spaces exact-version capability is not configured.'};
 if(c.endpoint!==runtime.SAHA_RETENTION_SPACES_ENDPOINT||c.region!==runtime.SAHA_RETENTION_SPACES_REGION||c.accountId!==runtime.SAHA_RETENTION_SPACES_ACCOUNT_ID||c.bucket!==runtime.SAHA_RETENTION_SPACES_BUCKET)return {ready:false,state:'custody-mismatch',reason:'The registered object custody does not match the verified provider account, region and bucket.'};
 if(artifact.recordClass==='export'&&(!c.destinationRegistered||!present(c.accountableOwnerRef)||c.serverPayloadPersisted!==false||!c.keyInaccessible))return {ready:false,state:'policy-refused',reason:'Export deletion requires a registered accountable destination, no retained server payload and an inaccessible export key.'};
 if(artifact.recordClass==='backup'&&(!c.recoveryWindowApproved||!c.tombstoneAwareRestoreVerified||!c.generationKeyInaccessible||!c.cadence))return {ready:false,state:'policy-refused',reason:'Backup deletion requires an approved recovery window, tombstone-aware restore evidence, an inaccessible generation key and recorded cadence.'};
 return {ready:true,state:'ready',reason:'Exact Spaces version custody and the class-specific pre-deletion gates are present; execution still requires the durable disposal job and provider receipt.'};
}
