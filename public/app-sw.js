const CACHE='saha-app-public-shell-v11';
const SHELL='/app/offline/';
const ASSETS=[SHELL,'/app/offline/style.css','/field/app.js','/field/vault.js','/field/app-grants.js','/field/device-work.js','/field/registration-privacy.js','/field/offline-opens.js','/field/style.css'];
function publicResponse(response,path){const type=response.headers.get('content-type')??'',expected=path.endsWith('/')||path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'javascript';return response.ok&&!response.redirected&&response.type!=='opaque'&&new URL(response.url).origin===self.location.origin&&new URL(response.url).pathname===path&&type.includes(expected);}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const path of ASSETS){const response=await fetch(path,{cache:'reload',redirect:'error'});if(!publicResponse(response,path))throw Error('Public shell unavailable');await cache.put(path,response);}await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('saha-app-public-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'&&(url.pathname==='/app'||url.pathname==='/app/')){const fallback=async()=>await (await caches.open(CACHE)).match(SHELL)??Response.error();event.respondWith(self.navigator.onLine?fetch(event.request,{cache:'no-store'}).catch(fallback):fallback());return;}
 if(url.search||!ASSETS.includes(url.pathname))return;
 event.respondWith(fetch(event.request).then(response=>publicResponse(response,url.pathname)?response:Promise.reject(Error('Public asset unavailable'))).catch(async()=>await (await caches.open(CACHE)).match(url.pathname)??Response.error()));
});
