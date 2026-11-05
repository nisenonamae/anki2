/* Anki2 r4.15:電波がなくても開けるように、アプリと部品をとっておく */
const CACHE = "anki2-r4.15";
const FILES = ["./", "index.html", "style.css", "core.js", "app.js", "exercise.js", "sync.js", "manifest.webmanifest",
  "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js", "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.wasm",
  "https://cdn.jsdelivr.net/npm/fzstd@0.1.1/umd/index.js", "https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js", "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => { if (e.request.method !== "GET") return; const u = new URL(e.request.url);
  if (u.origin === location.origin) { e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request))); return; }
  if (u.hostname === "cdn.jsdelivr.net") e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }))); });
