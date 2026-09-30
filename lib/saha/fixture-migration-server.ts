import { identity, loadFor, json } from './server';
import { fail } from './core';
import { scope } from './store';
import { planFixtureMarking } from './fixture-migration';
// Slice 2d: the dry run and batch history, for owners. Ids, versions, counts and reasons only.
export async function fixtureMigrationRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 if(!m.isOwner)fail(403,'Only an organisation owner can run a data migration.');
 return json({dryRun:await planFixtureMarking(s,m),batches:s.operations?.fixtureBatches??[],generatedAt:new Date().toISOString()});
}
