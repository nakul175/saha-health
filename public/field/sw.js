const CACHE='saha-field-shell-v1';
const ASSETS=['/field/index.html','/field/app.js','/field/vault.js','/field/style.css'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async cache=>{for(const url of ASSETS){const r=await fetch(url,{cache:'reload',redirect:'error'});if(!r.ok||r.redirected)throw Error('Shell unavailable');await cache.put(url,r);}}).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('saha-field-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// No patient, API, authentication or normal workspace response enters Cache Storage.
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==self.location.origin||u.search||!ASSETS.includes(u.pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{try{const r=await fetch(event.request);if(r.ok&&!r.redirected&&r.type!=='opaque'){await cache.put(event.request,r.clone());return r;}return (await cache.match(event.request))||r;}catch{return (await cache.match(event.request))||Response.error();}}));
});
