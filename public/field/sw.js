const CACHE='saha-field-shell-v16';
const ASSETS=['/field/','/field/app.js','/field/offline-capacity.js','/field/guided-capture.js','/field/vault.js','/field/app-grants.js','/field/device-work.js','/field/sync-receipt.js','/field/registration-privacy.js','/field/offline-opens.js','/field/burden.js','/field/burden-capture.js','/field/style.css'];
const valid=(response,path)=>{const expected=path.endsWith('/')?'text/html':path.endsWith('.css')?'text/css':'javascript';return response.ok&&!response.redirected&&response.type!=='opaque'&&new URL(response.url).origin===self.location.origin&&new URL(response.url).pathname===path&&(response.headers.get('content-type')??'').includes(expected);};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async cache=>{for(const url of ASSETS){const r=await fetch(url,{cache:'reload',redirect:'error'});if(!valid(r,url))throw Error('Shell unavailable');await cache.put(url,r);}}).then(()=>self.skipWaiting())));
const CACHE='saha-field-shell-v2';
const ASSETS=['/field/index.html','/field/app.js','/field/vault.js','/field/style.css'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async cache=>{for(const url of ASSETS){const r=await fetch(url,{cache:'reload',redirect:'error'});if(!r.ok||r.redirected)throw Error('Shell unavailable');await cache.put(url,r);}}).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('saha-field-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// Only canonical public resources are cached. Keep the bookmarked index.html alias readable offline.
self.addEventListener('fetch',event=>{const u=new URL(event.request.url),path=u.pathname==='/field/index.html'?'/field/':u.pathname;if(event.request.method!=='GET'||u.origin!==self.location.origin||u.search||!ASSETS.includes(path))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{try{const r=await fetch(path,{redirect:'error'});if(valid(r,path)){await cache.put(path,r.clone());return r;}return (await cache.match(path))||Response.error();}catch{return (await cache.match(path))||Response.error();}}));
});
