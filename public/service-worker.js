const CACHE_NAME = "pocos-cache-v5";
const FILES_TO_CACHE = [
  "/",
  "/index.html",

  "/dashboard.html",
  "/novo-poco.html",
  "/historico-poco.html",
  "/nova-medicao.html",
  "/medicoes.html",
  "/mapa.html",
  "/configuracoes.html",
  "/admin.html",

  "/css/style.css",

  "/js/supabase.js",
  "/js/auth.js",
  "/js/db-local.js",
  "/js/calculos.js",
  "/js/sync.js",

  "/js/dashboard-lista.js",
  "/js/novo-poco.js",
  "/js/historico-poco.js",
  "/js/nova-medicao.js",
  "/js/medicoes.js",
  "/js/mapa.js",
  "/js/configuracoes.js",
  "/js/admin.js",

  "/js/pdf.js",
  "/js/excel.js",
  "/editar-medicao.html",
  "/js/editar-medicao.js",
"/projetos.html",
"/novo-projeto.html",
"/projeto-detalhe.html",
"/js/projetos.js",
"/js/novo-projeto.js",
"/js/projeto-detalhe.js",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
