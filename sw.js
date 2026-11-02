// Uygulama kabuğu önbellekte; veri her açılışta ağdan, ağ yoksa son kayıttan.
const VERSION = "v13";
const SHELL = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const networkFirst = url.origin === location.origin && (url.pathname.includes("/data/") || SHELL.some((p) => url.pathname.endsWith(p.replace("./", "/"))));
  if (networkFirst) {
    e.respondWith(
      // no-cache: tarayıcının HTTP önbelleğini atlayıp sunucuya sorar, yeni sürüm hemen gelir
      fetch(e.request, { cache: "no-cache" }).then((r) => {
        const copy = r.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request))
    );
  } else if (url.hostname.endsWith("espncdn.com")) {
    // Logolar: önbellekten, yoksa ağdan alıp sakla
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return r;
    })));
  }
});
