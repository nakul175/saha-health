// Open models run on-device. The provider receives only worker-reviewed synthetic text.
//
// Slice 13b (review of #145, M2): the open-model libraries are third-party code loaded from a CDN at run time, with no integrity
// check and outside the SBOM and audit gate. They no longer run in Saha's page: each read runs in a fresh hidden iframe with
// `sandbox="allow-scripts"` and no `allow-same-origin`, so the libraries execute in an opaque origin. From there they cannot read
// Saha's page, storage or cookies, and any request they make to Saha carries `Origin: null`, which the Worker refuses before the
// application runs (slice 13a, lib/saha/cross-site.ts). The page sends the chosen file's bytes in and accepts back only text of
// the expected kind and length; the frame is removed after each read.
export const SANDBOX_LIBRARIES = {
    ocr: { url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js', engine: 'Tesseract.js 5.1.1 LSTM eng' },
    asr: { url: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2', engine: 'onnx-community/whisper-tiny q8 / Transformers.js 3.5.2' },
};
const LIMIT = 15 * 1024 * 1024, TIMEOUT_MS = 10 * 60 * 1000;
// The frame's whole program. It answers only messages from its parent, keeps nothing between reads (no Cache API, IndexedDB or
// local storage: an opaque origin has none), and reports errors as text.
export const SANDBOX_HTML = `<!doctype html><meta charset="utf-8"><script type="module">
const L=${JSON.stringify(SANDBOX_LIBRARIES)};
const send=m=>parent.postMessage(m,'*');
async function ocr(buf,type,status){const T=await import(L.ocr.url),worker=await T.default.createWorker('eng',1,{cacheMethod:'none',logger:m=>status(m.status+' '+Math.round((m.progress||0)*100)+'%')});try{const r=await worker.recognize(new Blob([buf],{type}));const text=String(r?.data?.text??'');if(!text.trim())throw Error('No usable printed text found.');return {text:text.slice(0,4000),kind:'ocr',engine:L.ocr.engine};}finally{await worker.terminate();}}
async function asr(buf,status){status('Downloading the open speech model; processing stays on this device.');const T=await import(L.asr.url);T.env.allowLocalModels=false;T.env.useBrowserCache=false;T.env.backends.onnx.wasm.numThreads=1;const transcriber=await T.pipeline('automatic-speech-recognition','onnx-community/whisper-tiny',{dtype:'q8',device:'wasm',progress_callback:p=>status('Speech model: '+p.status)}),ctx=new AudioContext({sampleRate:16000});try{const audio=await ctx.decodeAudioData(buf);if(audio.duration>90)throw Error('Use a recording shorter than 90 seconds.');let wave=audio.getChannelData(0);if(audio.sampleRate!==16000){const off=new OfflineAudioContext(1,Math.ceil(audio.duration*16000),16000),source=off.createBufferSource();source.buffer=audio;source.connect(off.destination);source.start();wave=(await off.startRendering()).getChannelData(0);}const r=await transcriber(wave,{language:'english',task:'transcribe',chunk_length_s:25,stride_length_s:5});const text=String(r?.text??'');if(!text.trim())throw Error('No usable speech found.');return {text:text.slice(0,4000),kind:'asr',engine:L.asr.engine};}finally{await ctx.close();await transcriber.dispose();}}
addEventListener('message',async e=>{if(e.source!==parent)return;const {id,input,buf,type}=e.data||{};if(typeof id!=='string'||!(buf instanceof ArrayBuffer))return;const status=t=>send({id,kind:'status',text:String(t).slice(0,200)});
 try{send({id,kind:'done',ok:true,result:input==='document'?await ocr(buf,String(type||''),status):await asr(buf,status)});}catch(err){send({id,kind:'done',ok:false,error:String(err&&err.message||err).slice(0,300)});}});
send({kind:'ready'});
</script>`;
// What the page accepts from the frame: text of the kind it asked for, within the length the provider contract allows.
export function acceptRead(result, input) {
    const r = result, kind = input === 'document' ? 'ocr' : 'asr';
    if (!r || typeof r !== 'object' || r.kind !== kind || r.engine !== SANDBOX_LIBRARIES[kind].engine || typeof r.text !== 'string' || !r.text.trim() || r.text.length > 4000)
        throw Error('The on-device reader returned an unexpected result.');
    return { text: r.text, kind, engine: r.engine };
}
export async function readSyntheticFile(file, input, status) {
    if (file.size > LIMIT)
        throw Error('Choose a file smaller than 15 MB.');
    const buf = await file.arrayBuffer(), id = crypto.randomUUID(), frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('title', 'On-device reader');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.display = 'none';
    frame.srcdoc = SANDBOX_HTML;
    let onMessage = null, timer;
    try {
        return await new Promise((resolve, reject) => {
            timer = setTimeout(() => reject(Error('The on-device reader did not finish in time.')), TIMEOUT_MS);
            onMessage = (e) => {
                if (e.source !== frame.contentWindow)
                    return;
                const m = e.data;
                if (m?.kind === 'ready') {
                    frame.contentWindow?.postMessage({ id, input, buf, type: file.type }, '*', [buf]);
                    return;
                }
                if (m?.id !== id)
                    return;
                if (m.kind === 'status')
                    status(String(m.text ?? '').slice(0, 200));
                else if (m.kind === 'done') {
                    if (m.ok) {
                        try {
                            resolve(acceptRead(m.result, input));
                        }
                        catch (err) {
                            reject(err);
                        }
                    }
                    else
                        reject(Error(String(m.error ?? 'The on-device reader failed.').slice(0, 300)));
                }
            };
            window.addEventListener('message', onMessage);
            document.body.appendChild(frame);
        });
    }
    finally {
        if (timer)
            clearTimeout(timer);
        if (onMessage)
            window.removeEventListener('message', onMessage);
        frame.remove();
    }
}
