// Classified compatibility adapters preserve pinned historical drivers and their assertions.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export async function verificationFixture(file){
 const source=readFileSync(resolve('tests',file),'utf8');
 if(!/['"]send-gate['"]/.test(source)&&!source.includes("readdirSync"))throw new Error('Expected module inventory');
 const adapted=source.replace(/(\[[^\]]*['"]send-gate['"][^\]]*)(\])/g,'$1, "verification-disputes"$2').replace(/^(  )F\.applyFactReview\(/gm,'$1await F.applyFactReview(');
 const withOutput=adapted.replace(/writeFileSync\('tests\/([^']+-result\.json)'/g,"writeFileSync('tests/evidence/verification-send/$1'");
 const path=resolve('tests','.verification-current-'+crypto.randomUUID()+'.mjs');writeFileSync(path,withOutput);
 try{await import(pathToFileURL(path).href);}finally{unlinkSync(path);}
}
