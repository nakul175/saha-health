// Transport-only cleanup for refusals before a body reader runs. Never parses or retains bytes.
// The bounded discard matches the global cross-site refusal; authority and business caps stay in handlers.
export async function discardUnreadRequest(request:Request){
 if(!request.body||request.bodyUsed)return;
 try{const reader=request.body.getReader();let bytes=0;while(bytes<262144){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;}await reader.cancel();}catch{/* transport already closed */}
}
