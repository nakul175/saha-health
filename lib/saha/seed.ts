import type { Workspace, Programme, Integration } from './types';
export function seedWorkspace(now=new Date().toISOString()):Workspace {
 const people:[string,string,number,string,string,Programme[],string][]=[
 ['p_meena','Meena Devi',26,'Female','Rampur',['Maternal care','General care'],'Antenatal home visit'],
 ['p_rajesh','Rajesh Kumar',54,'Male','Rampur',['Chronic care','General care'],'Blood pressure follow-up'],
 ['p_sunita','Sunita Bai',38,'Female','Kheda',['TB screening','General care'],'Symptom screening'],
 ['p_aarav','Aarav Singh',3,'Male','Kheda',['Child health','General care'],'Growth follow-up'],
 ['p_farida','Farida Begum',47,'Female','Rampur',['Chronic care','General care'],'Facility follow-up'],
 ['p_kamla','Kamla Devi',62,'Female','Kheda',['Chronic care','General care'],'Medication history review'],
 ];
 const integrations:Integration[]=[
 {id:'mis_maternal',name:'Maternal & child register',kind:'mis',mode:'demo',status:'active',version:1,description:'A programme register simulator. Records acceptance and a distinct receipt.',programmes:['Maternal care','Child health'],behavior:'accept'},
 {id:'mis_community',name:'Community health MIS',kind:'mis',mode:'demo',status:'active',version:1,description:'A programme simulator that demonstrates a lost response and safe reconciliation.',programmes:['General care','Chronic care','TB screening'],behavior:'uncertain'},
 {id:'ai_summary',name:'Visit summariser',kind:'ai',mode:'demo',status:'active',version:1,description:'Creates a structured summary from confirmed facts. Deterministic demo adapter; no clinical inference.',programmes:[],capability:'summary'},
 {id:'ai_completeness',name:'Record completeness',kind:'ai',mode:'demo',status:'active',version:1,description:'Checks missing visit fields and provenance. Deterministic demo adapter; no diagnosis.',programmes:[],capability:'completeness'},
 {id:'ehr_fhir',name:'Facility EHR',kind:'ehr',mode:'unconfigured',status:'unconfigured',version:1,description:'FHIR R4 example export is available. Live access needs an owner-approved endpoint and resource mapping.',programmes:[]},
 {id:'abdm',name:'ABDM exchange',kind:'abdm',mode:'unconfigured',status:'unconfigured',version:1,description:'ABHA, HIP and HIU connections require separate onboarding, consent flows and current conformance validation.',programmes:[]},
 ];
 return {schemaVersion:1,revision:1,role:'asha',people:people.map(([id,name,age,sex,village,programmes,task],i)=>({id,name,age,sex,village,programmes,task,due:i<4?'Today':'Tomorrow',status:'due',aiConsent:true,exchangeConsent:false,consentVersion:1,assigned:i!==5,createdAt:now,version:1,teamId:'default',assignedTo:null})),visits:[],integrations,submissions:[],referrals:[],audit:[],receipts:{}};
}
