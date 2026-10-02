import type { Role } from './types';
// Slice 9b: which workspace views appear in the menu for a membership. Display only: the server still checks every read
// and command exactly as before, so hiding a view never grants or removes access.
export type View='work'|'people'|'receipts'|'outreach'|'continuity'|'governance'|'pilot'|'expansion'|'operations'|'programmes'|'ai'|'connections'|'activity'|'organisation';
// Care work first, then oversight, then administration.
export const VIEW_ORDER:readonly View[]=['work','people','receipts','outreach','continuity','governance','pilot','expansion','operations','programmes','ai','connections','activity','organisation'];
// Views a non-owner ASHA or supervisor has nothing to do in. An ASHA still gets Pilot readiness while they hold a training
// record of their own in the current rehearsal (only they can acknowledge it), see `pilotTask`.
export const HIDDEN_FOR:Partial<Record<Role,readonly View[]>>={asha:['governance','pilot','expansion','operations','programmes','ai','connections','activity'],supervisor:['governance','programmes','ai']};
export type NavMember={role:Role;isOwner:boolean;reporting:boolean};
export function shownViews(m:NavMember|null,pilotTask=false):View[]{
 return VIEW_ORDER.filter(id=>{
  if(m?.role==='provider')return ['governance','activity','organisation'].includes(id);
  if(id==='continuity')return m?.role!=='admin';
  if(id==='expansion')return !!m&&(m.isOwner||m.role==='admin');
  if(id==='operations')return !!m&&(m.isOwner||m.role==='supervisor'||m.role==='admin'||m.reporting);
  if(!m||m.isOwner)return true;
  if(id==='pilot'&&m.role==='asha')return pilotTask;
  return !(HIDDEN_FOR[m.role]??[]).includes(id);
 });
}
