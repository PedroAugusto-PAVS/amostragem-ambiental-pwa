const CACHE_NAME = "pocos-cache-v57";

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
  "/foto-poco.html",

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
  "/js/backup-local.js",
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
  "/js/foto-poco.js",

  "/js/nova-medicao.js",
  "/js/editar-medicao.js",
  "/js/codigos-amostras-form.js",
  "/js/duplicar-medicao.js",
  "/js/medicoes.js",

  "/js/mapa.js",
  "/js/configuracoes.js",
  "/js/admin.js",

  "/js/pdf.js",
  "/js/pdf-fiscal.js",
  "/js/alertas.js",
  "/libs/jspdf.umd.min.js",
  "/menu.html",
  "/ficha-impressao.html",
  "/js/ficha-impressao.js",
  "/editar-projeto.html",
  "/js/editar-projeto.js",
  "/exportar-fichas.html",
  "/exportar-fichas-fiscal.html",
  "/js/exportar-fichas.js",
  "/js/exportar-fichas-fiscal.js",

  "/manifest.json",
  "/icons/icon_48.png",
  "/icons/icon_72.png",
  "/icons/icon_96.png",
  "/icons/icon_128.png",
  "/icons/icon_144.png",
  "/icons/icon_152.png",
  "/icons/icon_192.png",
  "/icons/icon_384.png",
  "/icons/icon_512.png",
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
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || !response.ok) {
          return caches
            .match(event.request)
            .then((cached) => cached || response);
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);

        if (cached) return cached;

        if (event.request.mode === "navigate") {
          return caches.match("/index.html");
        }

        return new Response("Recurso indisponível offline.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })
  );
});
