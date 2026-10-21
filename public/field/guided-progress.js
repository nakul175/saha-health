// Guided progress is metadata inside the already encrypted field notebook. It
// never grants access, changes clinical facts, or starts/retries a sync.
const validText=(value,max=300)=>typeof value==='string'&&value.length>0&&value.length<=max;

function identity(book,draft){
 const payload=draft?.packet?.payload;
 if(!book||!payload||!validText(book.userId)||payload.userId!==book.userId)throw Error('Prepared visit does not belong to this notebook worker.');
 if(!validText(payload.organisationId)||!validText(payload.leaseId)||!validText(draft.packageHash,128))throw Error('Prepared visit identity is incomplete.');
 return {userId:book.userId,organisationId:payload.organisationId,leaseId:payload.leaseId,packageHash:draft.packageHash};
}

export function checkpointGuidedStep(book,draft,stepKey,full=false){
 const bound=identity(book,draft);if(!validText(stepKey,200))throw Error('Guided step is unavailable.');
 const progress={schema:1,...bound,stepKey,full:full===true};
 draft.guidedProgress=progress;
 book.activePreparedTask={schema:1,...bound};
 return progress;
}

export function restoredGuidedStep(book,draft,allowedSteps){
 let bound;try{bound=identity(book,draft);}catch{return null;}
 const progress=draft.guidedProgress;
 if(!progress||progress.schema!==1||progress.userId!==bound.userId||progress.organisationId!==bound.organisationId||progress.leaseId!==bound.leaseId||progress.packageHash!==bound.packageHash||!allowedSteps.includes(progress.stepKey))return null;
 return {key:progress.stepKey,full:progress.full===true};
}

export function restoredPreparedTask(book){
 const active=book?.activePreparedTask;if(!active||active.schema!==1||active.userId!==book.userId)return null;
 const draft=(book.drafts??[]).find(item=>{const payload=item?.packet?.payload;return payload?.userId===book.userId&&payload.organisationId===active.organisationId&&payload.leaseId===active.leaseId&&item.packageHash===active.packageHash;});
 return draft?.packet?.payload?.leaseId??null;
}

export function rememberPreparedTask(book,draft){
 const bound=identity(book,draft);book.activePreparedTask={schema:1,...bound};return book.activePreparedTask;
}

export function clearPreparedTask(book,draft){
 const active=book?.activePreparedTask,payload=draft?.packet?.payload;
 if(active&&payload&&active.userId===book.userId&&active.organisationId===payload.organisationId&&active.leaseId===payload.leaseId&&active.packageHash===draft.packageHash)delete book.activePreparedTask;
}
