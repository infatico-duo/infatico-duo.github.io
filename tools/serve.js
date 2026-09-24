'use strict';
/* ==========================================================================
   Duo Infatico – kleiner lokaler Entwicklungsserver
   --------------------------------------------------------------------------
   Nötig, um die PWA (/card/) wirklich zu testen: Manifest, Service Worker
   und der Installations-Dialog funktionieren nur über http/https, nicht
   über file://.

   Aufruf:   node tools/serve.js [port]
   Danach:   http://localhost:8145/          (Website)
             http://localhost:8145/card/     (Visitenkarte / PWA)

   Nur für die Entwicklung – auf dem Server liegen die Dateien statisch.
   ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.argv[2]) || 8145;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.vcf': 'text/vcard; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg'
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (err) {
    res.writeHead(400).end('Bad request');
    return;
  }

  let filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 – nicht gefunden: ' + urlPath);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',           // beim Entwickeln immer frisch laden
      'Service-Worker-Allowed': '/'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('Duo Infatico – lokaler Server läuft');
  console.log('  Website      : http://localhost:' + PORT + '/');
  console.log('  Visitenkarte : http://localhost:' + PORT + '/card/');
  console.log('Beenden mit Strg+C');
});
