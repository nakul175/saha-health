export const REFERENCE_OFFLINE_PROFILE=Object.freeze({
  allowanceBytes:500*1024*1024,
  structuredLimit:200,
  mediaLimit:100,
  mediaItemMaxBytes:4*1024*1024,
  warningBytes:50*1024*1024,
  warningUseRatio:0.8
});

export function offlineCapacity(book,storage={},profile=REFERENCE_OFFLINE_PROFILE){
  const drafts=Array.isArray(book?.drafts)?book.drafts:[];
  const media=drafts.flatMap(d=>Array.isArray(d.media)?d.media:[]).filter(m=>m?.state!=='uploaded');
  const mediaBytes=media.reduce((total,item)=>total+(Number.isFinite(item?.size)&&item.size>0?item.size:0),0);
  const usage=Number.isFinite(storage.usage)&&storage.usage>=0?storage.usage:null;
  const quota=Number.isFinite(storage.quota)&&storage.quota>0?storage.quota:null;
  const free=usage!==null&&quota!==null?Math.max(0,quota-usage):null;
  const browserLow=free!==null&&(free<profile.warningBytes||usage/quota>profile.warningUseRatio);
  return Object.freeze({
    drafts:drafts.length,
    media:media.length,
    mediaBytes,
    allowanceBytes:profile.allowanceBytes,
    remainingDrafts:Math.max(0,profile.structuredLimit-drafts.length),
    remainingMedia:Math.max(0,profile.mediaLimit-media.length),
    remainingAllowanceBytes:Math.max(0,profile.allowanceBytes-mediaBytes),
    persistent:storage.persisted===true,
    measurable:free!==null,
    browserLow
  });
}

export function capacityRefusal(capacity,addition={},profile=REFERENCE_OFFLINE_PROFILE){
  if(!capacity.persistent)return 'Persistent device storage is required before adding offline work.';
  if(!capacity.measurable)return 'Storage capacity is unavailable. Existing unsent work is retained; reconnect or use the approved reference device before adding work.';
  if(capacity.browserLow)return 'Device storage is low. Existing unsent work is retained; sync and remove acknowledged copies before adding work.';
  const drafts=addition.drafts??0,media=addition.media??0,mediaBytes=addition.mediaBytes??0;
  if(mediaBytes>profile.mediaItemMaxBytes)return 'This media item exceeds the accepted offline profile.';
  if(capacity.drafts+drafts>profile.structuredLimit)return `The offline profile holds at most ${profile.structuredLimit} structured encounters.`;
  if(capacity.media+media>profile.mediaLimit)return `The offline profile holds at most ${profile.mediaLimit} media items.`;
  if(capacity.mediaBytes+mediaBytes>profile.allowanceBytes)return 'The offline allowance is full.';
  return null;
}
