'use strict';
/* ==========================================================================
   Duo Infatico – QR-Gegenprobe (Decoder, Version 1–12)
   --------------------------------------------------------------------------
   Liest eine fertige QR-Matrix und prüft sie unabhängig:

     1. Funktionsmuster (Finder, Separatoren, Timing, Alignment, Dark Module)
     2. Versionsinfo (ab Version 7) inkl. BCH-Prüfung
     3. Formatinfo: beide Kopien, BCH, ECC-Level und Maske
     4. Datenrückgewinnung: Demaskierung, Zickzack-Reihenfolge, Entschachtelung
     5. Reed-Solomon: alle Syndrome jedes Blocks müssen 0 sein
     6. Nutzdaten: Modus, Länge, Bytes, Terminator und Prüfbytes

   Die RS-Blocktabellen kommen aus card/qr.js (dort gegen die normierten
   Kapazitätswerte geprüft); GF(256) ist hier eigenständig implementiert.
   ========================================================================== */

const qr = require('../card/qr.js');

/* ---------------------------------------------------------------- GF(256) */

const EXP = new Array(512).fill(0);
const LOG = new Array(256).fill(0);
(function buildTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x = x << 1;
    if (x & 0x100) { x ^= 0x11d; }
  }
  for (let i = 255; i < 512; i++) { EXP[i] = EXP[i - 255]; }
})();

const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

function polyEval(desc, x) {
  let y = 0;
  for (let i = 0; i < desc.length; i++) { y = mul(y, x) ^ desc[i]; }
  return y;
}

const FORMAT_MASK = 0x5412;
const G15 = 0x537;
const G18 = 0x1f25;

function bitLength(n) { let c = 0; while (n !== 0) { c++; n >>>= 1; } return c; }

function bchCheck(value, dataBits, generator) {
  const data = value >>> dataBits;
  let d = data << dataBits;
  while (bitLength(d) - bitLength(generator) >= 0) {
    d ^= (generator << (bitLength(d) - bitLength(generator)));
  }
  return value === ((data << dataBits) | d);
}

/* ------------------------------------------------------------- Struktur */

function functionMap(version, size) {
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));

  const markFinder = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const y = row + r;
        const x = col + c;
        if (y >= 0 && y < size && x >= 0 && x < size) { fn[y][x] = true; }
      }
    }
  };
  markFinder(0, 0);
  markFinder(size - 7, 0);
  markFinder(0, size - 7);

  for (let i = 0; i < size; i++) { fn[6][i] = true; fn[i][6] = true; }

  const centers = qr.ALIGN[version] || [];
  for (const r of centers) {
    for (const c of centers) {
      const overlaps = (r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
      if (overlaps) { continue; }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) { fn[r + dr][c + dc] = true; }
      }
    }
  }

  for (let i = 0; i < 15; i++) {
    if (i < 6) { fn[i][8] = true; }
    else if (i < 8) { fn[i + 1][8] = true; }
    else { fn[size - 15 + i][8] = true; }
    if (i < 8) { fn[8][size - 1 - i] = true; }
    else if (i < 9) { fn[8][15 - i] = true; }
    else { fn[8][15 - i - 1] = true; }
  }
  fn[size - 8][8] = true;                                  // Dark Module

  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      fn[Math.floor(i / 3)][(i % 3) + size - 11] = true;
      fn[(i % 3) + size - 11][Math.floor(i / 3)] = true;
    }
  }
  return fn;
}

function expect(cond, message) {
  if (!cond) { throw new Error(message); }
}

function checkFinder(m, row, col, label) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const edge = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const want = (edge || core) ? 1 : 0;
      expect(m[row + r][col + c] === want,
        'Finder ' + label + ': Modul (' + (row + r) + ',' + (col + c) + ') ist ' +
        m[row + r][col + c] + ', erwartet ' + want);
    }
  }
}

function checkStructure(m, version, size) {
  checkFinder(m, 0, 0, 'oben links');
  checkFinder(m, size - 7, 0, 'unten links');
  checkFinder(m, 0, size - 7, 'oben rechts');

  for (let i = 0; i < 8; i++) {
    expect(m[7][i] === 0, 'Separator oben links verletzt (7,' + i + ')');
    expect(m[i][7] === 0, 'Separator oben links verletzt (' + i + ',7)');
  }

  for (let i = 8; i < size - 8; i++) {
    expect(m[6][i] === (i % 2 === 0 ? 1 : 0), 'Timing-Zeile bei Spalte ' + i);
    expect(m[i][6] === (i % 2 === 0 ? 1 : 0), 'Timing-Spalte bei Zeile ' + i);
  }

  const centers = qr.ALIGN[version] || [];
  for (const r of centers) {
    for (const c of centers) {
      const overlaps = (r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
      if (overlaps) { continue; }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          const want = ring === 1 ? 0 : 1;
          expect(m[r + dr][c + dc] === want, 'Alignment-Muster bei (' + (r + dr) + ',' + (c + dc) + ')');
        }
      }
    }
  }

  expect(m[size - 8][8] === 1, 'Dark Module fehlt');
  return true;
}

/* ------------------------------------------------------- Info-Blöcke */

function readFormat(m, size) {
  let a = 0;
  let b = 0;
  for (let i = 0; i < 15; i++) {
    let va;
    let vb;
    if (i < 6) { va = m[i][8]; } else if (i < 8) { va = m[i + 1][8]; } else { va = m[size - 15 + i][8]; }
    if (i < 8) { vb = m[8][size - 1 - i]; } else if (i < 9) { vb = m[8][15 - i]; } else { vb = m[8][15 - i - 1]; }
    a |= (va & 1) << i;
    b |= (vb & 1) << i;
  }
  return { a, b };
}

function readVersionInfo(m, size) {
  if ((size - 17) / 4 < 7) { return null; }
  let a = 0;
  let b = 0;
  for (let i = 0; i < 18; i++) {
    a |= (m[Math.floor(i / 3)][(i % 3) + size - 11] & 1) << i;
    b |= (m[(i % 3) + size - 11][Math.floor(i / 3)] & 1) << i;
  }
  return { a, b };
}

/** Liest die Codewörter in QR-Reihenfolge und demaskiert dabei. */
function readCodewords(m, size, version, mask, totalCodewords) {
  const fn = functionMap(version, size);
  const bits = [];
  let row = size - 1;
  let inc = -1;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) { col--; }
    for (;;) {
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        if (!fn[row][x]) {
          let v = m[row][x];
          if (qr.MASK_FN[mask](row, x)) { v ^= 1; }
          bits.push(v);
        }
      }
      row += inc;
      if (row < 0 || row >= size) { row -= inc; inc = -inc; break; }
    }
  }
  const needed = totalCodewords * 8;
  expect(bits.length >= needed,
    'Zu wenige Datenmodule: ' + bits.length + ' Bits, erwartet ' + needed);

  const cw = [];
  for (let i = 0; i < needed; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) { v = (v << 1) | bits[i + j]; }
    cw.push(v);
  }
  return cw;
}

/** Entschachtelt die Codewörter zurück in RS-Blöcke. */
function deinterleave(codewords, plan) {
  const blocks = plan.dataBlocks.map((len) => ({ dataLen: len, data: [], ec: [] }));
  let index = 0;
  const maxData = Math.max.apply(null, plan.dataBlocks);
  for (let i = 0; i < maxData; i++) {
    for (let b = 0; b < blocks.length; b++) {
      if (i < blocks[b].dataLen) { blocks[b].data.push(codewords[index++]); }
    }
  }
  for (let e = 0; e < plan.ecPerBlock; e++) {
    for (let b = 0; b < blocks.length; b++) { blocks[b].ec.push(codewords[index++]); }
  }
  return { blocks, consumed: index };
}

function checkSyndromes(block) {
  const full = block.data.concat(block.ec);
  const bad = [];
  for (let i = 0; i < block.ec.length; i++) {
    const s = polyEval(full, EXP[i]);
    if (s !== 0) { bad.push('S' + i + '=' + s); }
  }
  return bad;
}

function parsePayload(dataCodewords, version) {
  const bits = [];
  for (const cw of dataCodewords) {
    for (let i = 7; i >= 0; i--) { bits.push((cw >>> i) & 1); }
  }
  const read = (pos, len) => {
    let v = 0;
    for (let i = 0; i < len; i++) { v = (v << 1) | bits[pos + i]; }
    return v;
  };

  const mode = read(0, 4);
  expect(mode === 0b0100, 'Modus ist ' + mode.toString(2) + ', erwartet 0100 (Byte)');
  const countBits = version < 10 ? 8 : 16;
  const length = read(4, countBits);
  const bytes = [];
  for (let i = 0; i < length; i++) { bytes.push(read(4 + countBits + i * 8, 8)); }
  const text = Buffer.from(bytes).toString('utf8');

  const usedBits = 4 + countBits + length * 8;
  let pos = usedBits;
  while (pos < bits.length && pos < usedBits + 4 && bits[pos] === 0) { pos++; }
  while (pos % 8 !== 0) { pos++; }
  const pads = [];
  while (pos + 8 <= bits.length) { pads.push(read(pos, 8)); pos += 8; }

  return { text, mode, length, pads };
}

/* --------------------------------------------------------------- Decode */

function decode(m) {
  const size = m.length;
  for (const row of m) { expect(row.length === size, 'Zeile hat falsche Länge'); }
  expect(size >= 21 && size <= 65 && (size - 17) % 4 === 0,
    'Ungültige Matrixgröße: ' + size);
  const version = (size - 17) / 4;

  checkStructure(m, version, size);

  const versionInfo = readVersionInfo(m, size);
  if (versionInfo) {
    expect(versionInfo.a === versionInfo.b, 'Beide Versionsinfo-Kopien unterscheiden sich');
    expect(bchCheck(versionInfo.a, 6, G18), 'BCH-Prüfung der Versionsinfo fehlgeschlagen');
    const declared = versionInfo.a >>> 12;
    expect(declared === version, 'Versionsinfo sagt Version ' + declared + ', Matrix ist ' + version);
  }

  const fmt = readFormat(m, size);
  expect(fmt.a === fmt.b, 'Beide Formatinfo-Kopien unterscheiden sich');
  const raw = fmt.a ^ FORMAT_MASK;
  expect(bchCheck(raw, 10, G15), 'BCH-Prüfung der Formatinfo fehlgeschlagen');
  const eccIndicator = (raw >>> 13) & 0b11;
  const mask = (raw >>> 10) & 0b111;
  const eccLevel = eccIndicator === 0b00 ? 'M' : (eccIndicator === 0b01 ? 'L' : null);
  expect(eccLevel !== null, 'Nicht unterstütztes ECC-Level: ' + eccIndicator.toString(2));

  const plan = qr.blockPlan(version, eccLevel);
  const codewords = readCodewords(m, size, version, mask, plan.totalCodewords);
  const { blocks, consumed } = deinterleave(codewords, plan);
  expect(consumed === plan.totalCodewords,
    'Entschachtelung verbrauchte ' + consumed + ' statt ' + plan.totalCodewords + ' Codewörter');

  const syndromes = [];
  for (let i = 0; i < blocks.length; i++) {
    const bad = checkSyndromes(blocks[i]);
    if (bad.length) { syndromes.push('Block ' + i + ': ' + bad.join(', ')); }
  }

  const data = [];
  for (const block of blocks) { for (const cw of block.data) { data.push(cw); } }
  expect(data.length === plan.dataCodewords,
    'Datencodewörter: ' + data.length + ' statt ' + plan.dataCodewords);
  const payload = parsePayload(data, version);

  return {
    size,
    version,
    eccLevel,
    mask,
    formatBits: fmt.a,
    blocks: blocks.length,
    codewords,
    data,
    syndromesOk: syndromes.length === 0,
    syndromes,
    text: payload.text,
    length: payload.length,
    pads: payload.pads
  };
}

module.exports = { decode, functionMap, polyEval, EXP, bitLength, G15, G18 };
