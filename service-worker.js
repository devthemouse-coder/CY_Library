const CACHE_NAME = 'bcy-library-v25';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './api.js',
  './ai.js',
  './gist.js',
  './manifest.webmanifest',
  './icon.svg'
];

// 네트워크 우선으로 처리할 확장자 (앱 코드)
const NETWORK_FIRST_EXTS = ['.html', '.js', '.css', '.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // 외부 API 요청은 서비스 워커가 개입하지 않음 — 브라우저가 직접 처리
  // (event.respondWith를 호출하지 않으면 브라우저 기본 동작으로 넘어감)
  if (!isSameOrigin) return;

  const isAppFile = NETWORK_FIRST_EXTS.some((ext) => url.pathname.endsWith(ext))
                    || url.pathname === '/' || url.pathname.endsWith('/');

  if (isAppFile) {
    // ── 네트워크 우선: 항상 최신 파일을 가져오고, 오프라인일 때만 캐시 사용 ──
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone()); // 최신 버전으로 캐시 갱신
          return fresh;
        } catch {
          // 오프라인 → 캐시에서 서빙
          const cached = await caches.match(req, { ignoreSearch: true });
          if (cached) return cached;
          const fallback = await caches.match('./index.html');
          return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
  } else {
    // ── 캐시 우선: 아이콘·폰트 등 정적 리소스 ──
    event.respondWith(
      (async () => {
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
  }
});
