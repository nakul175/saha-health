import type { View } from '@/lib/saha/navigation';
import type { AppTab } from './frontline-navigation';

export type AppLocation={organisationId:string;view:View;tab:AppTab;personId:string|null;visitId:string|null};
type Marker={session:string;index:number};
type HistoryPort={state:unknown;pushState:(state:unknown,title:string)=>void;replaceState:(state:unknown,title:string)=>void;go:(delta:number)=>void};
const sameScreen=(a:AppLocation,b:AppLocation)=>a.organisationId===b.organisationId&&a.view===b.view&&a.tab===b.tab&&a.personId===b.personId;
const marker=(state:unknown):Marker|null=>{
 const value=(state as {sahaApp?:Marker}|null)?.sahaApp;
 return value&&typeof value.session==='string'&&Number.isInteger(value.index)?value:null;
};

/** Session-only navigation. Browser history contains an opaque session/index, never record identifiers or facts. */
export class FrontlineHistory {
 private index=0;
 private entries=new Map<number,AppLocation>();
 private restoring=false;
 private pending:number|null=null;
 private correcting=false;
 private approved:number|null=null;
 constructor(private history:HistoryPort,private session:string,initial:AppLocation,
  private restore:(location:AppLocation)=>void,private guard:()=> 'dirty'|'busy'|'clear',
  private confirm:(proceed:()=>void)=>void){
  this.entries.set(0,initial);this.history.replaceState(this.state(0),'');
 }
 private state(index:number){return {sahaApp:{session:this.session,index}};}
 observe(location:AppLocation){
  if(this.correcting||this.pending!==null)return;
  const previous=this.entries.get(this.index);
  if(this.restoring||previous&&!previous.organisationId||previous&&sameScreen(previous,location)){
   this.restoring=false;this.entries.set(this.index,location);return;
  }
  for(const key of this.entries.keys())if(key>this.index)this.entries.delete(key);
  this.index++;this.entries.set(this.index,location);
  while(this.entries.size>128)this.entries.delete(this.entries.keys().next().value!);
  this.history.pushState(this.state(this.index),'');
 }
 cancel(){this.pending=null;}
 pop(state:unknown){
  const target=marker(state);
  // Document boundaries and earlier sessions belong to the browser, not an endless sentinel loop.
  if(!target||target.session!==this.session)return;
  if(target.index===this.index){
   if(this.correcting){
    this.correcting=false;
    if(this.pending!==null){const destination=this.pending;this.confirm(()=>{
     this.pending=null;this.approved=destination;this.history.go(destination-this.index);
    });}
   }
   return;
  }
  const blocked=this.guard();
  if(this.approved!==target.index&&(blocked!=='clear'||this.pending!==null||this.correcting)){
   if(blocked==='dirty'&&this.pending===null)this.pending=target.index;
   this.correcting=true;this.history.go(this.index-target.index);return;
  }
  this.approved=null;this.index=target.index;this.restoring=true;
  const current=this.entries.get(target.index),newest=[...this.entries.values()].at(-1)!;
  this.restore(current??{...newest,view:'work',tab:'workspace',personId:null,visitId:null});
 }
}
