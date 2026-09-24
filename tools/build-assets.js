'use strict';
/* ==========================================================================
   Duo Infatico – Asset-Generator (offline, ohne externe Dienste)
   --------------------------------------------------------------------------
   Erzeugt:
     card/qr.svg                     QR-Code (Version 3, ECC M, 4 Module Ruhezone)
     card/icons/icon.svg             Vektormotiv (Geige & Gitarre)
     card/icons/icon-192.png         PNG 192×192
     card/icons/icon-512.png         PNG 512×512
     card/icons/icon-maskable-512.png PNG 512×512, Motiv innerhalb der Safe Zone

   Aufruf:  node tools/build-assets.js
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const qr = require('../card/qr.js');
const config = require('./config');

const ROOT = path.join(__dirname, '..');
const CARD_DIR = path.join(ROOT, 'card');
const ICON_DIR = path.join(CARD_DIR, 'icons');

const IVORY = '#f5f0e8';
const CHARCOAL = '#2c2418';
const GOLD = '#b8860b';
const BURGUNDY = '#6e2231';

const QUIET = 4; // Module Ruhezone (Standard: 4)

/* ----------------------------------------------------------------- PNG */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) { c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); }
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) { c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // Filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // Bittiefe
  ihdr[9] = 6;   // Farbtyp RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

/* ------------------------------------------------------------ Rasterizer */

const SS = 3; // Supersampling für weiche Kanten

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
}

function createCanvas(size) {
  return { size, px: Buffer.alloc(size * size * 4, 0) };
}

function blend(canvas, x, y, rgb, alpha) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size || alpha <= 0) { return; }
  const i = (y * canvas.size + x) * 4;
  const a = Math.min(1, alpha);
  const dstA = canvas.px[i + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA <= 0) { return; }
  for (let k = 0; k < 3; k++) {
    const src = rgb[k];
    const dst = canvas.px[i + k];
    canvas.px[i + k] = Math.round((src * a + dst * dstA * (1 - a)) / outA);
  }
  canvas.px[i + 3] = Math.round(outA * 255);
}

/** Füllt einen Bereich, für den `inside(x, y)` (in 0..1) wahr ist. */
function fill(canvas, inside, rgb, alpha, box) {
  const size = canvas.size;
  const x0 = Math.max(0, Math.floor(box ? box.x0 : 0));
  const y0 = Math.max(0, Math.floor(box ? box.y0 : 0));
  const x1 = Math.min(size - 1, Math.ceil(box ? box.x1 : size - 1));
  const y1 = Math.min(size - 1, Math.ceil(box ? box.y1 : size - 1));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (inside((x + 0.5) / size, (y + 0.5) / size)) {
        blend(canvas, x, y, rgb, alpha === undefined ? 1 : alpha);
      }
    }
  }
}

/** Pixel-Begrenzungsrahmen für einen Kreis in normierten Koordinaten. */
function circleBox(canvas, cx, cy, radius) {
  const size = canvas.size;
  return {
    x0: (cx - radius) * size,
    y0: (cy - radius) * size,
    x1: (cx + radius) * size,
    y1: (cy + radius) * size
  };
}

function ring(canvas, cx, cy, radius, thickness, rgb, alpha) {
  const outer = radius + thickness / 2;
  fill(canvas, (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    return d <= outer && d >= radius - thickness / 2;
  }, rgb, alpha, circleBox(canvas, cx, cy, outer));
}

function disc(canvas, cx, cy, radius, rgb, alpha) {
  fill(canvas, (x, y) => Math.hypot(x - cx, y - cy) <= radius, rgb, alpha,
    circleBox(canvas, cx, cy, radius));
}

function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
  ];
}

function strokeCurve(canvas, points, width, rgb, alpha) {
  const size = canvas.size;
  const radius = (width / 2) * size;          // Strichradius in Pixeln
  const radiusSq = radius * radius;

  /* Abdeckungsmaske: entlang der Kurve wird an jedem Stützpunkt ein Kreis
     gesetzt. Das ist um Größenordnungen schneller als „jeder Pixel gegen
     alle Stützpunkte" und verhindert doppelte Alpha-Blendung an Überlappungen. */
  const mask = new Uint8Array(size * size);

  for (let i = 0; i < points.length; i++) {
    const cx = points[i][0] * size;
    const cy = points[i][1] * size;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(size - 1, Math.ceil(cx + radius));
    const y1 = Math.min(size - 1, Math.ceil(cy + radius));

    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        if (dx * dx + dy * dy <= radiusSq) { mask[y * size + x] = 1; }
      }
    }
  }

  for (let y = 0; y < size; y++) {
    const row = y * size;
    for (let x = 0; x < size; x++) {
      if (mask[row + x]) { blend(canvas, x, y, rgb, alpha); }
    }
  }
}

/** Zeichnet das Motiv aus images/hero.svg (zwei Bögen + zwei Kreise). */
function drawMotif(canvas, scale, color, opacity) {
  const cx = 0.5;
  const cy = 0.5;
  const S = (v) => 0.5 + (v - 0.5) * scale;

  const curveA = [];
  const curveB = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    curveA.push(cubicPoint([S(0.16), S(0.86)], [S(0.34), S(0.60)], [S(0.40), S(0.44)], [S(0.45), S(0.14)], t));
    curveB.push(cubicPoint([S(0.84), S(0.86)], [S(0.66), S(0.60)], [S(0.60), S(0.44)], [S(0.55), S(0.14)], t));
  }

  const gold = hexToRgb(color);
  ring(canvas, cx, cy, 0.30 * scale, 0.022 * scale, gold, opacity);
  ring(canvas, cx, cy, 0.395 * scale, 0.016 * scale, gold, opacity * 0.75);
  strokeCurve(canvas, curveA, 0.020 * scale, gold, opacity);
  strokeCurve(canvas, curveB, 0.020 * scale, gold, opacity);
  disc(canvas, cx, cy - 0.30 * scale, 0.030 * scale, hexToRgb(BURGUNDY), opacity);
}

function downsample(canvas, outSize) {
  const out = Buffer.alloc(outSize * outSize * 4);
  const factor = canvas.size / outSize;
  for (let y = 0; y < outSize; y++) {
    for (let x = 0; x < outSize; x++) {
      let r = 0; let g = 0; let b = 0; let a = 0; let n = 0;
      for (let sy = Math.floor(y * factor); sy < Math.floor((y + 1) * factor); sy++) {
        for (let sx = Math.floor(x * factor); sx < Math.floor((x + 1) * factor); sx++) {
          const i = (sy * canvas.size + sx) * 4;
          const alpha = canvas.px[i + 3] / 255;
          r += canvas.px[i] * alpha;
          g += canvas.px[i + 1] * alpha;
          b += canvas.px[i + 2] * alpha;
          a += alpha;
          n++;
        }
      }
      const o = (y * outSize + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
        out[o + 3] = Math.round((a / n) * 255);
      }
    }
  }
  return out;
}

function renderIcon(size, scale) {
  const canvas = createCanvas(size * SS);
  const bg = hexToRgb(CHARCOAL);
  fill(canvas, () => true, bg, 1);
  drawMotif(canvas, scale, GOLD, 1);
  return downsample(canvas, size);
}

/* ------------------------------------------------------------------ QR-SVG */

function buildQrSvg() {
  const result = qr.encode(config.CARD_URL);
  const size = result.size;
  const view = size + QUIET * 2;
  const rects = [];

  // Dunkle Module zeilenweise zu Läufen zusammenfassen (kleinere Datei)
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (result.modules[r][c] === 1) {
        let len = 1;
        while (c + len < size && result.modules[r][c + len] === 1) { len++; }
        rects.push('<rect x="' + (c + QUIET) + '" y="' + (r + QUIET) + '" width="' + len + '" height="1"/>');
        c += len;
      } else {
        c++;
      }
    }
  }

  const pixelTarget = 740;
  const moduleSize = Math.round(pixelTarget / view);
  const rendered = view * moduleSize;

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + view + ' ' + view + '"',
    ' width="' + rendered + '" height="' + rendered + '" role="img" aria-labelledby="qrTitle qrDesc"',
    ' shape-rendering="crispEdges">',
    '  <title id="qrTitle">QR-Code – Duo Infatico</title>',
    '  <desc id="qrDesc">' + config.CARD_URL + '</desc>',
    '  <!-- Version ' + result.version + ' (' + size + '×' + size + '), ECC ' + result.eccLevel +
      ', Ruhezone ' + QUIET + ' Module -->',
    '  <rect width="' + view + '" height="' + view + '" fill="#ffffff"/>',
    '  <g fill="' + CHARCOAL + '">',
    '    ' + rects.join('\n    '),
    '  </g>',
    '</svg>',
    ''
  ].join('\n');

  return { svg, result, view, rectCount: rects.length };
}

/* ------------------------------------------------------------------- vCard */

/* Nur öffentliche Angaben, die auch auf der Website stehen.
   Bewusst OHNE Telefonnummer (auf der Website noch ein Platzhalter
   "+49 (0) 000 000 000") und ohne Anschrift. */
function buildVCard() {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:;Duo Infatico;;;',
    'FN:Duo Infatico',
    'ORG:Duo Infatico',
    'NOTE:Duo Infatico – Nataliya Salavei (Violine) und Vadim Bektemirov (Gitarre). Bielefeld, Nordrhein-Westfalen.',
    'EMAIL;TYPE=WORK,INTERNET:' + config.EMAIL,
    'URL:' + config.SITE_URL,
    'END:VCARD'
  ];
  return lines.join('\r\n') + '\r\n';   // vCard 3.0: CRLF-Zeilenenden
}

/* ------------------------------------------------------------------- SVG-Icon */

function buildIconSvg() {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Duo Infatico">',
    '  <rect width="512" height="512" fill="' + CHARCOAL + '"/>',
    '  <g fill="none" stroke="' + GOLD + '" stroke-width="11" stroke-linecap="round">',
    '    <circle cx="256" cy="256" r="154"/>',
    '    <circle cx="256" cy="256" r="202" stroke-width="8" stroke-opacity="0.75"/>',
    '    <path d="M82 440 C 174 307, 205 225, 230 72"/>',
    '    <path d="M430 440 C 338 307, 307 225, 282 72"/>',
    '  </g>',
    '  <circle cx="256" cy="102" r="15" fill="' + BURGUNDY + '"/>',
    '</svg>',
    ''
  ].join('\n');
}

/* --------------------------------------------------------------------- Main */

function main() {
  fs.mkdirSync(ICON_DIR, { recursive: true });

  const { svg, result, view, rectCount } = buildQrSvg();
  fs.writeFileSync(path.join(CARD_DIR, 'qr.svg'), Buffer.from(svg, 'utf8'));
  fs.writeFileSync(path.join(ICON_DIR, 'icon.svg'), Buffer.from(buildIconSvg(), 'utf8'));
  fs.writeFileSync(path.join(CARD_DIR, 'duo-infatico.vcf'), Buffer.from(buildVCard(), 'utf8'));

  const icons = [
    ['icon-192.png', 192, 1],
    ['icon-512.png', 512, 1],
    ['icon-maskable-512.png', 512, 0.78]
  ];
  for (const [name, size, scale] of icons) {
    const rgba = renderIcon(size, scale);
    fs.writeFileSync(path.join(ICON_DIR, name), encodePNG(size, size, rgba));
  }

  console.log('QR-Inhalt      : ' + config.CARD_URL);
  console.log('QR-Version     : ' + result.version + ' (' + result.size + '×' + result.size + '), ECC ' + result.eccLevel);
  console.log('QR-Maske       : ' + result.mask + ', Penalty ' + result.score);
  console.log('Ruhezone       : ' + QUIET + ' Module, viewBox 0 0 ' + view + ' ' + view);
  console.log('Rechtecke      : ' + rectCount);
  console.log('geschrieben    : card/qr.svg, card/icons/icon.svg, 3 PNG-Icons, card/duo-infatico.vcf');
}

if (require.main === module) { main(); }

module.exports = { buildQrSvg, buildIconSvg, buildVCard, encodePNG, renderIcon, QUIET };
