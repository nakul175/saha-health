#!/usr/bin/env node
// SAHA-120 validation re-import. It never writes to a Saha runtime or an existing database.
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {readTar,verifyFiles,verifyPortableDictionary} from './verify-export.mjs';

const args=process.argv.slice(2),at=args.indexOf('--output');
if(at<0||!args[at+1]){console.error('Usage: node scripts/reimport-export.mjs --output NEW.sqlite <export.tar ...>');process.exit(2);}
const output=args[at+1],paths=args.filter((_,i)=>i!==at&&i!==at+1);
if(!paths.length){console.error('At least one export archive is required.');process.exit(2);}
if(existsSync(output)){console.error('Refusing to replace an existing validation database.');process.exit(2);}
const sha=value=>createHash('sha256').update(value).digest('hex');
const lineRows=bytes=>bytes.toString('utf8').split('\n').filter(Boolean).map(JSON.parse);
const same=(a,b)=>a===b||(a instanceof Uint8Array&&b instanceof Uint8Array&&Buffer.from(a).equals(Buffer.from(b)));
// Staged exports deliberately scope patient-linked entries inside shared organisation/team JSON rows
// to each part. Re-import therefore unions only those JSON fragments. Scalar conflicts fail closed: this
// is a reconstruction rule, not a last-writer-wins database restore.
const mergeJson=(left,right,path='data')=>{
 if(Array.isArray(left)&&Array.isArray(right)){const seen=new Set(left.map(x=>JSON.stringify(x)));return [...left,...right.filter(x=>{const key=JSON.stringify(x);if(seen.has(key))return false;seen.add(key);return true;})];}
 if(left&&right&&typeof left==='object'&&typeof right==='object'){const out={...left};for(const [key,value]of Object.entries(right))out[key]=key in out?mergeJson(out[key],value,`${path}.${key}`):value;return out;}
 if(Object.is(left,right))return left;
 throw Error(`Conflicting staged JSON scalar at ${path}.`);
};
const mergeRepeatedRow=(db,table,info,row)=>{
 const primary=info.filter(x=>x.pk).sort((a,b)=>a.pk-b.pk).map(x=>x.name);
 if(!primary.length||primary.some(x=>!(x in row)))throw Error(`${table}: a repeated row cannot be bound to its complete primary key.`);
 const where=primary.map(x=>`${x}=?`).join(' AND '),existing=db.prepare(`SELECT * FROM ${table} WHERE ${where}`).get(...primary.map(x=>row[x]));
 if(!existing)throw Error(`${table}: insert was ignored without a matching primary-key row.`);
 const updates={};
 for(const [column,value]of Object.entries(row)){
  if(same(existing[column],value))continue;
  if(staged&&column==='data'&&typeof existing[column]==='string'&&typeof value==='string'){
   let left,right;try{left=JSON.parse(existing[column]);right=JSON.parse(value);}catch{throw Error(`${table}: repeated data is not mergeable JSON.`);}
   updates.data=JSON.stringify(mergeJson(left,right,`${table}.data`));continue;
  }
  // Each download records its own audit after the archive is built. The portable source basis excludes
  // the resulting organisation command token/revision churn; keep the newest pair in the validation DB.
  if(staged&&table==='organisations'&&(column==='revision'||column==='last_command'))continue;
  throw Error(`${table}: conflicting repeated column ${column}.`);
 }
 if(staged&&table==='organisations'&&Number(row.revision)>Number(existing.revision)){updates.revision=row.revision;updates.last_command=row.last_command;}
 const names=Object.keys(updates);if(names.length)db.prepare(`UPDATE ${table} SET ${names.map(x=>`${x}=?`).join(',')} WHERE ${where}`).run(...names.map(x=>updates[x]),...primary.map(x=>row[x]));
 return names.length>0;
};
const archives=paths.map(path=>{const files=readTar(readFileSync(path)),report=verifyFiles(files),dictionary=verifyPortableDictionary(files);if(!report.ok)throw Error(`${path}: archive verification failed: ${report.failures.join('; ')}`);if(!dictionary.ok)throw Error(`${path}: field dictionary failed: ${dictionary.failures.join('; ')}`);const manifest=JSON.parse(files.get('manifest.json').toString('utf8'));return{path,files,manifest,report,dictionary};});
const orgs=new Set(archives.map(x=>x.manifest.organisation?.id)),formats=new Set(archives.map(x=>x.manifest.format));
if(orgs.size!==1||formats.size!==1)throw Error('Every archive must have the same organisation and format.');
const staged=archives.some(x=>x.manifest.stage);
if(staged){if(archives.some(x=>!x.manifest.stage))throw Error('Do not mix staged and unstaged archives.');const first=archives[0].manifest.stage,key=x=>JSON.stringify([x.basis,x.total,x.size]);if(new Set(archives.map(x=>key(x.manifest.stage))).size!==1)throw Error('Staged archives do not share one plan.');const numbers=archives.map(x=>x.manifest.stage.number).sort((a,b)=>a-b);if(first.total!==archives.length||numbers.some((n,i)=>n!==i+1))throw Error(`All ${first.total} staged parts are required exactly once.`);archives.sort((a,b)=>a.manifest.stage.number-b.manifest.stage.number);}
for(const {path,manifest}of archives)if(manifest.scope?.patientsAuthorised!==manifest.scope?.patients||!manifest.scope?.fullScopeRequested)throw Error(`${path}: archive was not prepared with full current patient authority.`);
if(staged){const ids=archives.flatMap(({files})=>lineRows(files.get('tables/patients.jsonl')).map(x=>x.id)),unique=new Set(ids),expected=archives[0].manifest.scope.patients;if(unique.size!==ids.length||unique.size!==expected)throw Error(`Staged patient coverage is not an exact ${expected}-person partition.`);}
else if(archives[0].manifest.scope?.patientsWithheld!==0)throw Error(`${archives[0].path}: archive is not a full authorised patient exit.`);

mkdirSync(dirname(output),{recursive:true});
const db=new DatabaseSync(output);db.exec('PRAGMA foreign_keys=OFF');
try{
 for(const file of readdirSync('drizzle').filter(x=>/^\d{4}_.*\.sql$/.test(x)).sort())for(const statement of readFileSync(join('drizzle',file),'utf8').split('--> statement-breakpoint'))if(statement.trim())db.exec(statement);
 const inserted={},merged={};
 for(const {files,manifest}of archives)for(const entry of manifest.files.filter(x=>x.table)){
  if(!/^[a-z][a-z0-9_]*$/.test(entry.table))throw Error(`Unsafe table name ${entry.table}.`);
  const info=db.prepare(`PRAGMA table_info(${entry.table})`).all(),known=new Set(info.map(x=>x.name));
  for(const raw of lineRows(files.get(entry.path))){if(raw.withheld)throw Error(`${entry.table}: digest-only protected rows cannot be re-imported as records.`);const row={...raw};
   if(entry.table==='accounts'){row.email=`portable-${row.user_id}@example.invalid`;row.active_org_id=manifest.organisation.id;}
   if(entry.table==='invitations'&&!('token_hash'in row))row.token_hash=sha(`portable:${row.id}`);
   if(entry.table==='command_receipts'&&!('result'in row))row.result='{}';
   if(entry.table==='indicator_figures'&&!('data'in row))row.data='{}';
   if(entry.table==='reporting_completeness_snapshots'&&!('data'in row))row.data='{}';
   if(entry.table==='media'){const media=[...files.keys()].find(x=>x.startsWith(`media/${row.id}.`));if(!('data'in row))row.data=media?files.get(media).toString('base64'):'';if(!('storage_ref'in row))row.storage_ref=null;}
   const columns=Object.keys(row);if(columns.some(x=>!known.has(x)||!/^[a-z][a-z0-9_]*$/.test(x)))throw Error(`${entry.table}: unsupported exported column.`);
   for(const column of info)if(column.notnull&&!column.dflt_value&&!column.pk&&!columns.includes(column.name))throw Error(`${entry.table}: required omitted column ${column.name} has no safe validation placeholder.`);
   const sql=`INSERT OR IGNORE INTO ${entry.table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,result=db.prepare(sql).run(...columns.map(x=>row[x]));inserted[entry.table]=(inserted[entry.table]??0)+Number(result.changes);
   if(!result.changes&&mergeRepeatedRow(db,entry.table,info,row))merged[entry.table]=(merged[entry.table]??0)+1;
  }
 }
 db.exec('PRAGMA foreign_keys=ON');const foreignKeys=db.prepare('PRAGMA foreign_key_check').all();if(foreignKeys.length)throw Error(`Re-import has ${foreignKeys.length} foreign-key failures.`);
 const org=[...orgs][0],counts={};for(const table of new Set(archives.flatMap(x=>x.manifest.files.filter(f=>f.table).map(f=>f.table)))){if(table==='accounts')counts[table]=Number(db.prepare('SELECT count(*) n FROM accounts a WHERE EXISTS (SELECT 1 FROM memberships m WHERE m.user_id=a.user_id AND m.org_id=?)').get(org).n);else{const where=table==='organisations'?'id':'org_id';counts[table]=Number(db.prepare(`SELECT count(*) n FROM ${table} WHERE ${where}=?`).get(org).n);}}
 console.log(JSON.stringify({format:'saha-validation-reimport-v1',ok:true,organisation:org,archives:archives.length,staged,inserted,merged,counts,foreignKeyFailures:0,output},null,2));
}catch(error){db.close();throw error;}
db.close();
