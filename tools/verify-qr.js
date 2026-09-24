'use strict';
/* ==========================================================================
   Duo Infatico – automatischer QR-Test
   --------------------------------------------------------------------------
   Aufruf:  node tools/verify-qr.js

   Der Test liest die FERTIGE Datei card/qr.svg (nicht den Encoder) und
   weist die QR-Funktionen nach:

     1. SVG-Struktur: Ruhezone, weißer Hintergrund, Modulraster
     2. Funktionsmuster, Formatinfo, Versionsinfo, Reed-Solomon, Nutzdaten
     3. Inhalt = öffentliche Website-Adresse (Modus „Website")
     4. Kapazitätstabelle gegen die Normwerte (Version 1–12, Stufe L/M)
     5. Persönliche Kontakt-Links (Modi „Vadim" und „Nataliya")
     6. Payload-Format: Base64URL, Formatversion, Ablehnung ungültiger Daten

   Es werden ausschließlich FIKTIVE Testdaten verwendet.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const decoder = require('./qr-decode');
const qr = require('../card/qr.js');
const contactData = require('../card/contact-data.js');
const config = require('./config');

const ROOT = path.join(__dirname, '..');
const QR_FILE = path.join(ROOT, 'card', 'qr.svg');
const QUIET = 4;
const FAKE_PHONE = '+491234567890';          // nur Testdaten, niemals echte Nummern
const CARD_BASES = [
  'https://infatico-duo.github.io/card/',
  'https://infatico-duo.de/card/'
];

/* Normwerte: maximale Nutzdaten im Byte-Modus */
const PUBLISHED = {
  1: { L: 17, M: 14 }, 2: { L: 32, M: 26 }, 3: { L: 53, M: 42 },
  4: { L: 78, M: 62 }, 5: { L: 106, M: 84 }, 6: { L: 134, M: 106 },
  7: { L: 154, M: 122 }, 8: { L: 192, M: 152 }, 9: { L: 230, M: 180 },
  10: { L: 271, M: 213 }, 11: { L: 321, M: 251 }, 12: { L: 367, M: 287 }
};

const results = [];
let failed = 0;

function check(label, condition, detail) {
  const ok = !!condition;
  if (!ok) { failed++; }
  results.push({ ok, label, detail: detail || '' });
}

/* ------------------------------------------------------- SVG einlesen */

function readSvgMatrix(svgText) {
  const group = svgText.match(/<g fill="#[0-9a-f]{6}">([\s\S]*?)<\/g>/);
  if (!group) { return null; }
  const rects = group[1].match(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\/>/g) || [];
  const size = 0;   // wird vom Aufrufer anhand des viewBox bestimmt
  return { rects, group };
}

function main() {
  console.log('QR-Test – Duo Infatico');
  console.log('Datei: card/qr.svg\n');

  if (!fs.existsSync(QR_FILE)) {
    console.error('FEHLER: card/qr.svg fehlt. Zuerst `node tools/build-assets.js` ausführen.');
    process.exit(1);
  }

  const svgText = fs.readFileSync(QR_FILE, 'utf8');

  /* --- 1. SVG-Grundgerüst ------------------------------------------------ */
  const viewBox = (svgText.match(/viewBox="0 0 (\d+) (\d+)"/) || []);
  const view = Number(viewBox[1]);
  check('viewBox ist quadratisch (' + view + '×' + view + ')',
    view > 0 && viewBox[1] === viewBox[2],
    'gefunden: ' + (viewBox[1] || '?') + '×' + (viewBox[2] || '?'));

  check('Quiet Zone von 4 Modulen ist im viewBox enthalten (' + (view - 8) + ' Nutzmodule)',
    (view - 8 - 17) % 4 === 0 && view - 8 >= 21);

  check('Weißer Hintergrund deckt die Ruhezone ab',
    new RegExp('<rect width="' + view + '" height="' + view + '" fill="#ffffff"').test(svgText));

  const parsed = readSvgMatrix(svgText);
  check('Dunkle Module als <g>-Gruppe vorhanden', !!parsed);
  if (!parsed) { report(null); return; }

  /* --- 2. Matrix rekonstruieren ----------------------------------------- */
  const size = view - QUIET * 2;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(0));
  let outside = 0;
  let painted = 0;

  for (const rect of parsed.rects) {
    const m = rect.match(/x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/);
    const x = Number(m[1]);
    const y = Number(m[2]);
    const w = Number(m[3]);
    const h = Number(m[4]);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const mx = x + dx - QUIET;
        const my = y + dy - QUIET;
        if (mx < 0 || my < 0 || mx >= size || my >= size || matrix[my][mx] === 1) { outside++; continue; }
        matrix[my][mx] = 1;
        painted++;
      }
    }
  }

  check('Kein Modul ragt in die Ruhezone oder ist doppelt belegt', outside === 0,
    outside + ' fehlerhafte Module');
  check('Modulzahl plausibel (' + painted + ' dunkle Module)', painted > 150 && painted < 700);

  /* --- 3. Dekodieren und Inhalt prüfen ---------------------------------- */
  let decoded = null;
  try {
    decoded = decoder.decode(matrix);
    check('Strukturprüfung (Finder, Timing, Alignment, Dark Module)', true, 'bestanden');
    check('Formatinfo: beide Kopien identisch, BCH gültig', true,
      'ECC ' + decoded.eccLevel + ', Maske ' + decoded.mask);
    check('Reed-Solomon: alle Syndrome = 0', decoded.syndromesOk,
      decoded.syndromesOk ? 'ECC gültig' : decoded.syndromes.join(', '));
  } catch (err) {
    check('Dekodierung des statischen QR', false, err.message);
  }

  if (decoded) {
    check('Website-QR nutzt Version 3 (29×29)', decoded.version === 3,
      'Version ' + decoded.version + ', ' + decoded.size + '×' + decoded.size);
    check('Website-QR nutzt ECC-Level M', decoded.eccLevel === 'M', decoded.eccLevel);
    check('Website-QR enthält die öffentliche Adresse', decoded.text === config.CARD_URL,
      'gelesen: "' + decoded.text + '"');

    const desc = (svgText.match(/<desc[^>]*>([^<]*)<\/desc>/) || [])[1] || '';
    check('<desc> im SVG stimmt mit den Nutzdaten überein', desc === decoded.text,
      'desc: "' + desc + '"');

    check('Byte-Modus mit erwarteter Länge',
      decoded.length === Buffer.byteLength(config.CARD_URL, 'utf8'),
      decoded.length + ' Bytes');
    check('Terminator und Prüfbytes (0xEC/0x11) korrekt',
      decoded.pads.every((p, i) => p === (i % 2 === 0 ? 0xec : 0x11)),
      decoded.pads.map((p) => '0x' + p.toString(16)).join(' '));
  }

  /* --- 4. Kapazitätstabelle gegen die Normwerte ------------------------- */
  let capacityOk = true;
  const capacityDetail = [];
  for (const v of Object.keys(PUBLISHED)) {
    for (const level of ['L', 'M']) {
      const got = qr.capacity(Number(v), level);
      if (got !== PUBLISHED[v][level]) {
        capacityOk = false;
        capacityDetail.push('v' + v + '-' + level + ': ' + got + ' ≠ ' + PUBLISHED[v][level]);
      }
    }
  }
  check('Kapazitätstabelle entspricht der Norm (Version 1–12, L und M)', capacityOk,
    capacityOk ? '24 Werte geprüft' : capacityDetail.join(', '));

  let roundTripOk = true;
  const roundTripDetail = [];
  for (const v of Object.keys(PUBLISHED).map(Number)) {
    for (const level of ['L', 'M']) {
      const cap = qr.capacity(v, level);
      const text = 'A'.repeat(cap);
      try {
        const res = qr.encode(text, { version: v, eccLevel: level });
        const out = decoder.decode(res.modules);
        if (out.text !== text || !out.syndromesOk) {
          roundTripOk = false;
          roundTripDetail.push('v' + v + '-' + level);
        }
      } catch (err) {
        roundTripOk = false;
        roundTripDetail.push('v' + v + '-' + level + ' (' + err.message + ')');
      }
    }
  }
  check('Round-Trip Encoder → Decoder für alle Versionen (24 Kombinationen)', roundTripOk,
    roundTripOk ? 'alle Syndrome 0, Text identisch' : roundTripDetail.join(', '));

  /* --- 5. Persönliche Kontakt-Links (Modi Vadim / Nataliya) ------------- */
  for (const base of CARD_BASES) {
    const label = base.indexOf('github.io') !== -1 ? 'github.io' : 'infatico-duo.de';
    for (const profileId of contactData.PROFILE_ORDER) {
      const url = contactData.contactUrl(base, profileId, FAKE_PHONE);
      let res = null;
      let out = null;
      try {
        res = qr.encode(url);
        out = decoder.decode(res.modules);
      } catch (err) {
        check('Persönlicher QR ' + profileId + ' (' + label + ')', false, err.message);
        continue;
      }
      const name = contactData.PROFILES[profileId].name;
      check('Persönlicher QR ' + profileId + ' (' + label + ') = ' + name,
        out.text === url && out.syndromesOk,
        'Version ' + res.version + ' (' + res.size + '×' + res.size + '), ECC ' + res.eccLevel +
        ', ' + Buffer.byteLength(url, 'utf8') + ' Bytes');
      check('  → Version 4–6 für persönliche Links (' + profileId + '/' + label + ')',
        res.version >= 4 && res.version <= 6, 'Version ' + res.version);
      check('  → Fragment ist Base64URL (' + profileId + '/' + label + ')',
        /^#[A-Za-z0-9\-_]+$/.test(url.slice(url.indexOf('#'))),
        url.slice(url.indexOf('#')).slice(0, 40) + '…');
    }
  }

  /* --- 6. Payload-Format ------------------------------------------------ */
  const payload = contactData.encodePayload('vadim', FAKE_PHONE);
  const parsedPayload = contactData.decodePayload(payload);
  check('Payload-Round-Trip (Profil + Nummer)', parsedPayload &&
    parsedPayload.profile === 'vadim' && parsedPayload.phone === FAKE_PHONE,
    JSON.stringify(parsedPayload));
  check('Payload enthält KEINE weiteren Daten (nur Version, Profil, Nummer)',
    /^\["1","vadim","\+491234567890"\]$/.test(Buffer.from(
      payload.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - payload.length % 4) % 4), 'base64').toString('utf8')),
    Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/') + '===', 'base64').toString('utf8').slice(0, 60));

  check('Leeres Fragment → null', contactData.decodePayload('') === null);
  check('Ungültiges Fragment → null', contactData.decodePayload('###') === null);
  check('Falsche Formatversion → null',
    contactData.decodePayload(Buffer.from('["9","vadim","' + FAKE_PHONE + '"]').toString('base64url')) === null);
  check('Unbekanntes Profil → null',
    contactData.decodePayload(Buffer.from('["1","fremd","' + FAKE_PHONE + '"]').toString('base64url')) === null);

  report(decoded);
}

function report(decoded) {
  console.log('');
  for (const r of results) {
    console.log((r.ok ? '  PASS  ' : '  FAIL  ') + r.label + (r.detail ? '\n          → ' + r.detail : ''));
  }
  console.log('');
  if (decoded) {
    console.log('Statischer QR-Inhalt : ' + decoded.text);
    console.log('Version / ECC        : ' + decoded.version + ' / ' + decoded.eccLevel);
  }
  console.log('');
  if (failed === 0) {
    console.log('ERGEBNIS: alle ' + results.length + ' Prüfungen bestanden.');
  } else {
    console.log('ERGEBNIS: ' + failed + ' von ' + results.length + ' Prüfungen FEHLGESCHLAGEN.');
    process.exitCode = 1;
  }
}

main();
