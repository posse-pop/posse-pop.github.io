const VERSION = '1.2.0';
// Versioned asset paths prevent the old worker from mixing v1.0 JS with new HTML.
importScripts('./v1.2.0/asset-list.js');
const PREFIX = `posse-pop:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;
const ASSETS = self.PRECACHE_FILES;
const urls = new Set(ASSETS.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>{event.waitUntil((async()=>{await(await caches.open(CACHE)).addAll(ASSETS);await self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='GET_VERSION')event.ports[0]?.postMessage({version:VERSION});});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;const url=new URL(event.request.url);url.search='';url.hash='';
  if(!urls.has(url.href))return;
  if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match(new URL('./index.html',self.registration.scope).href))));
  else event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.href))||fetch(event.request)));
});
