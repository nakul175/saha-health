import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

const root='lib/saha';
const callers=[];
for(const file of readdirSync(root).filter(name=>name.endsWith('.ts'))){
 const source=readFileSync(join(root,file),'utf8');
 if(!source.includes('await linkRows'))continue;
 callers.push(file);
 assert.match(source,/compensateUncommittedAuditDetails|compensatedAuditWriteError/,`${file} must compensate a terminal audit-detail provider reservation`);
}
assert.deepEqual(callers.sort(),['device-work.ts','indicator-figures-server.ts','offline-opens.ts','reporting-completeness-server.ts','store.ts','work-burden-ledger-store.ts']);
const chain=readFileSync(join(root,'audit-chain.ts'),'utf8');
assert.match(chain,/receiptDigest:result\.receipt\?await sha256\(result\.receipt\):null/,'compensation evidence must retain only a receipt digest');
assert.match(chain,/state:'provider-error',receiptDigest:null/,'provider compensation failure must remain explicit');
console.log(JSON.stringify({suite:'audit detail direct-writer compensation coverage',passed:9,callers:callers.length}));
