/* 나의 플래너 — 오프라인 지원 (sw.js)
   앱 파일을 휴대폰·PC에 보관해 두었다가 인터넷이 없을 때 꺼내 씁니다.
   인터넷이 되면 항상 최신 파일을 먼저 받으므로, GitHub에서 고친 내용이 바로 반영됩니다.
   이 파일은 수정하지 않아도 됩니다. */
var CACHE = 'my-planner-v15';
var SHELL = ['./', './index.html', './app.js', './store.js', './lunar.js', './config.js', './firebase.js',
  './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () { /* 일부 실패 허용 */ }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function putCache(req, res, allowOpaque) {
  if (res && ((res.ok && (res.type === 'basic' || res.type === 'cors')) || (allowOpaque && res.type === 'opaque'))) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
  }
  return res;
}

/* 인터넷 먼저, 느리거나 안 되면 보관본 */
function networkFirst(req, isNav) {
  return new Promise(function (resolve) {
    var settled = false;
    function done(r) { if (!settled && r) { settled = true; resolve(r); } }
    function fromCache() {
      return caches.match(req, { ignoreSearch: true }).then(function (r) {
        return r || (isNav ? caches.match('./index.html') : null);
      });
    }
    var timer = setTimeout(function () { fromCache().then(done); }, 4000);
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
      clearTimeout(timer);
      done(putCache(req, res));
    }).catch(function () {
      clearTimeout(timer);
      fromCache().then(function (r) { done(r || Response.error()); });
    });
  });
}

/* 보관본 먼저 (글꼴 파일 — 바뀌지 않음) */
function cacheFirst(req) {
  return caches.match(req).then(function (r) {
    return r || fetch(req).then(function (res) { return putCache(req, res, true); });
  });
}

/* 보관본을 바로 쓰고, 뒤에서 새 버전으로 갱신 (글꼴 목록 CSS) */
function staleWhileRevalidate(req) {
  return caches.match(req).then(function (r) {
    var net = fetch(req).then(function (res) { return putCache(req, res, true); });
    if (r) { net.catch(function () { /* 오프라인 */ }); return r; }
    return net;
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req, req.mode === 'navigate'));
  } else if (url.hostname === 'fonts.googleapis.com') {
    e.respondWith(staleWhileRevalidate(req));
  } else if (url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req));
  }
  /* 그 밖의 요청(Firebase 서버 등)은 그대로 통과 */
});
