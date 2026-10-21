import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import ts from 'typescript';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.vault-audit-provider-'));let server;
try{
 const compiled=ts.transpileModule(readFileSync('lib/saha/vault-audit-detail-key-provider.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 writeFileSync(join(dir,'provider.mjs'),compiled);
 const {VaultKvV2AuditDetailKeyProvider,vaultAuditDetailKeyProvider}=await import(pathToFileURL(join(dir,'provider.mjs')));
 const secrets=new Map(),requests=[];let token='token-1',logins=0,renewals=0,force403=false,raceNext=false,invalidVersion=false;
 const readBody=req=>new Promise(resolve=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>resolve(body?JSON.parse(body):{}));});
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1'),body=await readBody(req);requests.push({method:req.method,path:url.pathname,body,token:req.headers['x-vault-token']});
  const send=(status,payload={},id='request-1')=>{res.writeHead(status,{'content-type':'application/json','x-vault-request-id':id});res.end(status===204?'':JSON.stringify(payload));};
  if(url.pathname==='/v1/auth/approle/login'){logins++;if(body.role_id!=='role-secret'||body.secret_id!=='app-secret')return send(403);token=`token-${logins}`;return send(200,{auth:{client_token:token,lease_duration:4,renewable:true}});}
  if(req.headers['x-vault-token']!==token)return send(403);
  if(force403){force403=false;return send(403);}
  if(url.pathname==='/v1/auth/token/renew-self'){renewals++;return send(200,{auth:{client_token:token,lease_duration:4,renewable:true}});}
  const dataPrefix='/v1/secret/data/',destroyPrefix='/v1/secret/destroy/';
  if(url.pathname.startsWith(dataPrefix)){
   const path=url.pathname.slice(dataPrefix.length),record=secrets.get(path),version=url.searchParams.get('version');
   if(req.method==='GET'){if(!record||record.deleted||version&&version!=='1')return send(404);return send(200,{data:{data:record.data,metadata:{version:invalidVersion?'bad':1}}});}
   if(req.method==='POST'){if(record)return send(400);secrets.set(path,{data:body.data,deleted:false});if(raceNext){raceNext=false;return send(400);}return send(200,{data:{version:1}},'write-1');}
  }
  if(url.pathname.startsWith(destroyPrefix)&&req.method==='POST'){const path=url.pathname.slice(destroyPrefix.length),record=secrets.get(path);if(record&&body.versions?.[0]===1)record.deleted=true;return send(204,{},'destroy-1');}
  return send(404);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const addr=`http://127.0.0.1:${server.address().port}`,provider=new VaultKvV2AuditDetailKeyProvider({addr,roleId:'role-secret',secretId:'app-secret',mount:'secret'}),base={plaintext:'synthetic detail',aad:'synthetic aad',keyPurpose:'audit-detail',idempotencyKey:'a'.repeat(64)};
 const logs=[];const oldError=console.error,oldWarn=console.warn;console.error=(...x)=>logs.push(x.join(' '));console.warn=(...x)=>logs.push(x.join(' '));
 const first=await provider.seal(base);assert.equal(first.algorithm,'AES-256-GCM');assert.equal(first.keyVersion,'1');assert.equal(logins,1);
 await new Promise(resolve=>setTimeout(resolve,2100));const replay=await provider.seal(base);assert.deepEqual(replay,first);assert.equal(requests.filter(x=>x.method==='POST'&&x.path.includes('/data/')).length,1);assert.equal(renewals,1);
 await assert.rejects(()=>provider.seal({...base,plaintext:'changed'}),e=>e.status===409);
 raceNext=true;const raced=await provider.seal({...base,idempotencyKey:'b'.repeat(64),aad:'race aad'});assert.equal(raced.keyVersion,'1');
 force403=true;const afterRelogin=await provider.seal({...base,idempotencyKey:'c'.repeat(64),aad:'relogin aad'});assert.equal(afterRelogin.keyVersion,'1');assert.equal(logins,2);
 const mismatch=await provider.destroy({keyId:first.keyId,keyVersion:first.keyVersion,expectedLifecycleTokenDigest:'0'.repeat(64)});assert.equal(mismatch.state,'mismatch');
 const lifecycleDigest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(first.lifecycleToken)).then(x=>Array.from(new Uint8Array(x),b=>b.toString(16).padStart(2,'0')).join(''));
 const destroyed=await provider.destroy({keyId:first.keyId,keyVersion:first.keyVersion,expectedLifecycleTokenDigest:lifecycleDigest});assert.equal(destroyed.state,'inaccessible');assert.match(destroyed.receipt,/destroy/);
 const repeatedDestroy=await provider.destroy({keyId:first.keyId,keyVersion:first.keyVersion,expectedLifecycleTokenDigest:lifecycleDigest});assert.equal(repeatedDestroy.state,'inaccessible');
 invalidVersion=true;await assert.rejects(()=>provider.seal({...base,idempotencyKey:'c'.repeat(64),aad:'relogin aad'}),e=>e.status===503);invalidVersion=false;
 assert.equal(logs.some(x=>x.includes('role-secret')||x.includes('app-secret')||x.includes(token)),false);console.error=oldError;console.warn=oldWarn;
 const missing=vaultAuditDetailKeyProvider({VAULT_ADDR:addr,ROLE_ID:'role-secret'});assert.equal(missing,null);const unavailable=new VaultKvV2AuditDetailKeyProvider({addr,roleId:'role-secret',secretId:'app-secret',mount:'secret'},async()=>{throw Error('synthetic network refusal');});await assert.rejects(()=>unavailable.seal({...base,idempotencyKey:'d'.repeat(64)}),e=>e.status===503);
 assert.equal(requests.some(x=>JSON.stringify(x).includes('app-secret')),true,'synthetic server received AppRole secret over loopback');
 console.log(JSON.stringify({suite:'Vault KV-v2 audit detail key provider',passed:16,logins,renewals,secretLogs:0}));
}finally{if(server)await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});}
