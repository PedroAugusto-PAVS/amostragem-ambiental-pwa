const CACHE_NAME = "pocos-cache-v38";

const FILES_TO_CACHE = [
  "/",
  "/index.html",

  "/dashboard.html",

  "/projetos.html",
  "/novo-projeto.html",
  "/projeto-detalhe.html",

  "/campanhas.html",
  "/nova-campanha.html",
  "/campanha-detalhe.html",
  "/editar-campanha.html",

  "/novo-poco.html",
  "/editar-poco.html",
  "/historico-poco.html",
  "/fotos-poco.html",

  "/nova-medicao.html",
  "/editar-medicao.html",
  "/duplicar-medicao.html",
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

  "/js/projetos.js",
  "/js/novo-projeto.js",
  "/js/projeto-detalhe.js",

  "/js/campanhas.js",
  "/js/nova-campanha.js",
  "/js/campanha-detalhe.js",
  "/js/editar-campanha.js",

  "/js/novo-poco.js",
  "/js/editar-poco.js",
  "/js/historico-poco.js",
  "/js/fotos-poco.js",

  "/js/nova-medicao.js",
  "/js/editar-medicao.js",
  "/js/duplicar-medicao.js",
  "/js/medicoes.js",

  "/js/mapa.js",
  "/js/configuracoes.js",
  "/js/admin.js",

  "/js/pdf.js",
  "/js/excel.js",
  "/js/alertas.js",
  "/libs/jspdf.umd.min.js",
  "/menu.html",
  "/ficha-impressao.html",
  "/js/ficha-impressao.js",
  "/editar-projeto.html",
  "/js/editar-projeto.js",
  "/exportar-fichas.html",
  "/js/exportar-fichas.js",
  "/libs/xlsx.full.min.js",

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
