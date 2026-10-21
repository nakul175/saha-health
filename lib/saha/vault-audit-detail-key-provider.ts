import type {AuditDetailKeyProvider,AuditDetailSeal} from './audit-detail-protection';

type VaultConfig={addr:string;roleId:string;secretId:string;mount:string};
type VaultSession={token:string;renewable:boolean;expiresAt:number;renewAt:number};
type StoredSeal={schema:'saha-audit-detail-v1';idempotencyKey:string;keyPurpose:'audit-detail';aadDigest:string;plaintextDigest:string;algorithm:'AES-256-GCM';dek:string;nonce:string;ciphertext:string;lifecycleToken:string};
type VaultReply={auth?:{client_token?:string;lease_duration?:number;renewable?:boolean};data?:{data?:StoredSeal;metadata?:{version?:number};auth?:unknown;version?:number};request_id?:string};

const encoder=new TextEncoder(),decoder=new TextDecoder();
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const digest=(value:string)=>crypto.subtle.digest('SHA-256',encoder.encode(value)).then(hex);
const random=(size:number)=>{const bytes=new Uint8Array(size);crypto.getRandomValues(bytes);return bytes;};
const b64=(bytes:Uint8Array)=>{let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);};
const unb64=(value:string)=>{const binary=atob(value),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;};
const fault=(message:string,status=503)=>Object.assign(new Error(message),{status});
const safe=(value:unknown,max:number)=>typeof value==='string'&&value.length>0&&value.length<=max;

export class VaultKvV2AuditDetailKeyProvider implements AuditDetailKeyProvider{
 private session:VaultSession|null=null;private authFlight:Promise<VaultSession>|null=null;
 constructor(private readonly config:VaultConfig,private readonly fetcher:typeof fetch=fetch){
  const url=new URL(config.addr),loopback=['127.0.0.1','localhost','::1'].includes(url.hostname);
  if((url.protocol!=='https:'&&!loopback)||url.username||url.password||url.search||url.hash||(url.pathname&&url.pathname!=='/'))throw fault('Vault address is invalid.');
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(config.mount)||![config.roleId,config.secretId].every(x=>safe(x,1000)))throw fault('Vault AppRole or KV mount configuration is invalid.');
  this.config={...config,addr:url.origin};
 }
 private async call(path:string,init:RequestInit={},authenticated=true,retry=true):Promise<{response:Response;body:VaultReply;requestId:string|null}>{
  const headers=new Headers(init.headers);headers.set('content-type','application/json');if(authenticated)headers.set('x-vault-token',(await this.token()).token);
  let response:Response;try{response=await this.fetcher(`${this.config.addr}/v1/${path}`,{...init,headers,redirect:'manual',signal:AbortSignal.timeout(10000)});}catch{throw fault('Vault did not return a confirmed response.');}
  if(authenticated&&response.status===403&&retry){this.session=null;return this.call(path,init,true,false);}
  let body:VaultReply={};if(response.status!==204)try{body=await response.json() as VaultReply;}catch{if(response.ok)throw fault('Vault returned an invalid response.');}
  return {response,body,requestId:response.headers.get('x-vault-request-id')??body.request_id??null};
 }
 private async login(){
  if(this.authFlight)return this.authFlight;
  this.authFlight=(async()=>{const {response,body}=await this.call('auth/approle/login',{method:'POST',body:JSON.stringify({role_id:this.config.roleId,secret_id:this.config.secretId})},false);const token=body.auth?.client_token,lease=body.auth?.lease_duration;if(!response.ok||!safe(token,2000)||!Number.isFinite(lease)||lease!<=0)throw fault('Vault AppRole authentication failed.');const now=Date.now(),duration=Number(lease)*1000;return this.session={token:token!,renewable:body.auth?.renewable===true,expiresAt:now+duration,renewAt:now+Math.max(1000,Math.floor(duration/2))};})().finally(()=>{this.authFlight=null;});
  return this.authFlight;
 }
 private async token(){
  const now=Date.now();if(!this.session||now>=this.session.expiresAt-1000)return this.login();if(now<this.session.renewAt)return this.session;
  if(this.session.renewable){const current=this.session;try{const {response,body}=await this.call('auth/token/renew-self',{method:'POST',headers:{'x-vault-token':current.token},body:'{}'},false,false),lease=body.auth?.lease_duration,token=body.auth?.client_token??current.token;if(response.ok&&safe(token,2000)&&Number.isFinite(lease)&&lease!>0){const duration=Number(lease)*1000;return this.session={token:token!,renewable:body.auth?.renewable!==false,expiresAt:now+duration,renewAt:now+Math.max(1000,Math.floor(duration/2))};}}catch{/* re-login below */}}
  this.session=null;return this.login();
 }
 private secretPath(idempotencyKey:string){if(!/^[0-9a-f]{64}$/.test(idempotencyKey))throw fault('Audit detail key identity is invalid.');return `saha-audit-detail/${idempotencyKey}`;}
 private async read(path:string,version?:string){const suffix=`${this.config.mount}/data/${path}${version?`?version=${encodeURIComponent(version)}`:''}`,reply=await this.call(suffix,{method:'GET'});if(reply.response.status===404)return null;if(!reply.response.ok)throw fault('Vault KV read failed.');const data=reply.body.data?.data,number=reply.body.data?.metadata?.version;if(!data||!Number.isSafeInteger(number)||number!<=0)throw fault('Vault KV evidence is incomplete.');return {data,version:String(number),requestId:reply.requestId};}
 private async restore(data:StoredSeal,version:string,input:{plaintext:string;aad:string;keyPurpose:'audit-detail';idempotencyKey:string}):Promise<AuditDetailSeal>{
  if(data.schema!=='saha-audit-detail-v1'||data.idempotencyKey!==input.idempotencyKey||data.keyPurpose!==input.keyPurpose||data.algorithm!=='AES-256-GCM'||data.aadDigest!==await digest(input.aad)||data.plaintextDigest!==await digest(input.plaintext))throw fault('Vault idempotent key reservation does not match this audit event.',409);
  if(![data.dek,data.nonce,data.ciphertext,data.lifecycleToken].every(x=>safe(x,24000)))throw fault('Vault key reservation is incomplete.');
  try{const key=await crypto.subtle.importKey('raw',unb64(data.dek),{name:'AES-GCM'},false,['decrypt']),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(data.nonce),additionalData:encoder.encode(input.aad)},key,unb64(data.ciphertext));if(decoder.decode(plain)!==input.plaintext)throw Error('mismatch');}catch{throw fault('Vault key reservation integrity check failed.',409);}
  return {keyId:`vault-kv-v2:${this.secretPath(input.idempotencyKey)}`,keyVersion:version,algorithm:data.algorithm,nonce:data.nonce,ciphertext:data.ciphertext,lifecycleToken:data.lifecycleToken};
 }
 async seal(input:{plaintext:string;aad:string;keyPurpose:'audit-detail';idempotencyKey:string}){
  const path=this.secretPath(input.idempotencyKey),existing=await this.read(path);if(existing)return this.restore(existing.data,existing.version,input);
  const rawKey=random(32),nonce=random(12),key=await crypto.subtle.importKey('raw',rawKey,{name:'AES-GCM'},false,['encrypt']),ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,additionalData:encoder.encode(input.aad)},key,encoder.encode(input.plaintext)));
  const data:StoredSeal={schema:'saha-audit-detail-v1',idempotencyKey:input.idempotencyKey,keyPurpose:input.keyPurpose,aadDigest:await digest(input.aad),plaintextDigest:await digest(input.plaintext),algorithm:'AES-256-GCM',dek:b64(rawKey),nonce:b64(nonce),ciphertext:b64(ciphertext),lifecycleToken:b64(random(32))};
  const write=await this.call(`${this.config.mount}/data/${path}`,{method:'POST',body:JSON.stringify({options:{cas:0},data})});
  if(write.response.ok){const version=write.body.data?.version;if(!Number.isSafeInteger(version)||version!<=0)throw fault('Vault KV version receipt is incomplete.');return this.restore(data,String(version),input);}
  // CAS=0 permits only one creator. A concurrent winner is accepted only after
  // its complete reservation is read and cryptographically bound to this input.
  const raced=await this.read(path);if(raced)return this.restore(raced.data,raced.version,input);throw fault('Vault KV key reservation failed.');
 }
 async destroy(input:{keyId:string;keyVersion:string;expectedLifecycleTokenDigest:string}){
  const prefix='vault-kv-v2:',path=input.keyId.startsWith(prefix)?input.keyId.slice(prefix.length):'';if(!/^saha-audit-detail\/[0-9a-f]{64}$/.test(path)||!/^[1-9][0-9]*$/.test(input.keyVersion)||!/^[0-9a-f]{64}$/.test(input.expectedLifecycleTokenDigest))return {state:'mismatch' as const,receipt:null};
  const exact=await this.read(path,input.keyVersion);if(!exact)return {state:'inaccessible' as const,receipt:`vault-kv-v2:already-absent:${input.keyVersion}`};
  if(await digest(exact.data.lifecycleToken)!==input.expectedLifecycleTokenDigest)return {state:'mismatch' as const,receipt:null};
  const destroyed=await this.call(`${this.config.mount}/destroy/${path}`,{method:'POST',body:JSON.stringify({versions:[Number(input.keyVersion)]})});if(!destroyed.response.ok)throw fault('Vault exact-version destruction failed.');
  const after=await this.read(path,input.keyVersion);if(after)return {state:'pending' as const,receipt:destroyed.requestId};return {state:'inaccessible' as const,receipt:destroyed.requestId??`vault-kv-v2:destroyed:${input.keyVersion}`};
 }
}

let cached:{signature:string;provider:VaultKvV2AuditDetailKeyProvider}|null=null;
export function vaultAuditDetailKeyProvider(env:Record<string,unknown>){
 const values=[env.VAULT_ADDR,env.ROLE_ID,env.SECRET_ID,env.KV_MOUNT];if(values.every(x=>x==null||x===''))return null;if(!values.every(x=>typeof x==='string'&&x.length>0))return null;
 const [addr,roleId,secretId,mount]=values as string[],signature=[addr,roleId,secretId,mount].join('\0');if(cached?.signature===signature)return cached.provider;
 try{const provider=new VaultKvV2AuditDetailKeyProvider({addr,roleId,secretId,mount});cached={signature,provider};return provider;}catch{return null;}
}
