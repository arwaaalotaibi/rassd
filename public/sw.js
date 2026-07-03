// عامل الخدمة: يخزّن صفحات المصحف والخط والأصول للعمل بدون إنترنت
const STATIC = 'rassd-static-v1';
const QURAN = 'rassd-quran-v1';
const PRECACHE = ['/', '/quran/chapters.json', '/fonts/UthmanicHafs.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => ![STATIC, QURAN].includes(k)).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // بيانات المصحف والخطوط وأصول البناء ثابتة → من الكاش أولاً وتُخزَّن عند أول طلب
  if (
    url.pathname.startsWith('/quran/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/_next/static/')
  ) {
    e.respondWith(
      caches.open(QURAN).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }

  // التنقل: الشبكة أولاً، وعند الانقطاع نعرض النسخة المخزّنة
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          caches.open(STATIC).then((c) => c.put('/', res.clone()));
          return res;
        })
        .catch(() => caches.match('/'))
    );
  }
});
