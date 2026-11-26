/* Service worker: guarda o app inteiro em cache para funcionar offline.
 * Estratégia: pré-cache de todos os arquivos na instalação;
 * navegação e arquivos do app = cache primeiro, atualizando em segundo plano. */
const VERSION = 'cerato-obd-v1.4.0';

const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/elm327.js',
  './js/obd.js',
  './js/kia.js',
  './js/storage.js',
  './js/dtcdb.js',
  './js/settings.js',
  './js/util.js',
  './js/coleta.js',
  './js/transport/base.js',
  './js/transport/serial-bt.js',
  './js/transport/ble.js',
  './js/transport/simulator.js',
  './js/ui/icons.js',
  './js/ui/dom.js',
  './js/ui/gauge.js',
  './js/ui/chart.js',
  './js/ui/home.js',
  './js/ui/dtc.js',
  './js/ui/live.js',
  './js/ui/history.js',
  './js/ui/more.js',
  './js/ui/report.js',
  './data/dtc-db.json',
  './data/pids.json',
  './data/modo06.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const emCache = await cache.match(req, { ignoreSearch: true });
      // Atualiza em segundo plano (stale-while-revalidate)
      const rede = fetch(req)
        .then((resp) => {
          if (resp && resp.ok) cache.put(req, resp.clone());
          return resp;
        })
        .catch(() => null);
      if (emCache) return emCache;
      const resp = await rede;
      if (resp) return resp;
      // Offline e sem cache: para navegação devolve o index
      if (req.mode === 'navigate') return cache.match('./index.html');
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});

// Permite que a página peça para ativar a nova versão imediatamente
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
