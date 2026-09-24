'use strict';
/* ==========================================================================
   Duo Infatico – Service Worker für /card/
   --------------------------------------------------------------------------
   Macht Visitenkarte, Einrichtung und Kontaktseite offline nutzbar.
   Bewusst schlank und ohne Tracking:

     - Vorinstallation der Kartendateien beim ersten Besuch
     - Seitenaufrufe: zuerst Netz (damit Änderungen ankommen), sonst die
       gespeicherte Fassung DERSELBEN Adresse – erst danach die Startseite
     - Übrige Dateien: erst Cache, dann im Hintergrund auffrischen
       (stale-while-revalidate)
     - Nur eigene Herkunft (same-origin), nur GET

   Das Fragment (#…) wird vom Browser nie an den Server gesendet und ist
   deshalb auch nicht Teil des Cache-Schlüssels.

   Wichtig: Bei inhaltlichen Änderungen CACHE_NAME erhöhen (v3, v4 …).
   ========================================================================== */

const CACHE_NAME = 'duo-infatico-card-v3';
const START_URL = './index.html';
const PRECACHE = [
  './',
  './index.html',
  './card.css',
  './card.js',
  './i18n.js',
  './contact-data.js',
  './qr.js',
  './manifest.webmanifest',
  './qr.svg',
  './duo-infatico.vcf',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './setup/',
  './setup/index.html',
  './setup/setup.js',
  './contact/',
  './contact/index.html',
  './contact/contact.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE.map(async function (url) {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (err) {
        /* Einzelne Datei nicht erreichbar – Installation nicht abbrechen */
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.map(function (key) {
      return key === CACHE_NAME ? null : caches.delete(key);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') { return; }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) { return; }

  const scopePath = new URL('./', self.location).pathname;
  if (url.pathname.indexOf(scopePath) !== 0) { return; }

  // Seitenaufrufe: Netz zuerst, sonst die gespeicherte Fassung dieser Adresse
  if (request.mode === 'navigate') {
    const key = url.pathname;
    event.respondWith((async function () {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(key, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match(key);
        if (cached) { return cached; }
        const start = await caches.match(START_URL);
        return start || Response.error();
      }
    })());
    return;
  }

  // Statische Dateien: erst aus dem Cache, parallel auffrischen
  event.respondWith((async function () {
    const cached = await caches.match(request);

    const fromNetwork = fetch(request).then(function (fresh) {
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, fresh.clone()); });
      }
      return fresh;
    }).catch(function () { return null; });

    if (cached) { return cached; }
    const fresh = await fromNetwork;
    return fresh || Response.error();
  })());
});
