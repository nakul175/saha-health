const digest=async(value:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');

export type ActionAuthorityFacts={
 actorId:string;
 actorVersion:number;
 taskId:string;
 taskVersion:number;
 evidenceHash:string;
 action:string;
 destination:string;
 purpose:string;
 capabilityVersions:Record<string,number|string>;
};

export type ActionAuthority=ActionAuthorityFacts&{
 approvedAt:string;
 expiresAt:string;
 bindingHash:string;
};

const canonical=(facts:ActionAuthorityFacts)=>({
 actorId:facts.actorId,
 actorVersion:facts.actorVersion,
 taskId:facts.taskId,
 taskVersion:facts.taskVersion,
 evidenceHash:facts.evidenceHash,
 action:facts.action,
 destination:facts.destination,
 purpose:facts.purpose,
 capabilityVersions:Object.fromEntries(Object.entries(facts.capabilityVersions).sort(([a],[b])=>a.localeCompare(b))),
});

export async function bindActionAuthority(facts:ActionAuthorityFacts,approvedAt:string,ttlMs:number):Promise<ActionAuthority>{
 if(!Number.isFinite(ttlMs)||ttlMs<=0)throw Error('Action authority expiry must be positive.');
 return {...facts,approvedAt,expiresAt:new Date(Date.parse(approvedAt)+ttlMs).toISOString(),bindingHash:await digest(canonical(facts))};
}

export async function actionAuthorityCurrent(approval:ActionAuthority|undefined,facts:ActionAuthorityFacts,now:string){
 if(!approval||Date.parse(approval.expiresAt)<Date.parse(now))return false;
 const currentHash=await digest(canonical(facts));
 return approval.bindingHash===currentHash&&approval.bindingHash===await digest(canonical(approval));
}
