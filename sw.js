// Service Worker for 習慣・体調トラッカー
// Android PWA インストール & オフライン対応

const CACHE_NAME = 'hhtracker-v21';
const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg',
];

// インストール時: アプリファイルをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// アクティベート時: 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// フェッチ: キャッシュ優先（同一オリジンのみ）、Google APIはスルー
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google API / アカウント系はキャッシュしない
  if (url.hostname.includes('google') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic')) {
    return; // ブラウザのデフォルト処理に任せる
  }

  // 同一オリジンのリクエスト: キャッシュ優先 → なければネットワーク
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});
