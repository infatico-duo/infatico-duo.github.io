'use strict';
/* ==========================================================================
   Duo Infatico – QR-Encoder (Browser + Node, keine Abhängigkeiten)
   --------------------------------------------------------------------------
   Byte-Modus, Fehlerkorrektur-Level L und M, automatische Versionswahl
   (Version 1–12). Erzeugt KEINE personenbezogenen Daten – der Aufrufer
   übergibt den Text, der codiert werden soll.

   Verwendung im Browser:
     var res = DuoQR.encode('https://…');        // { size, modules, version, … }
     DuoQR.renderToCanvas(canvas, res, { scale: 8, quiet: 4 });

   Verwendung in Node:
     const DuoQR = require('./card/qr.js');

   Warum Version 1–12: die Website-Adresse passt in Version 3 (29×29),
   persönliche Kontakt-Links brauchen wegen des Fragments Version 5–6.
   Die Version wird automatisch nach der Nutzdatengröße gewählt.
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.DuoQR = api; }
}(typeof self !== 'undefined' ? self : this, function () {

  /* ------------------------------------------------ Tabellen (ISO/IEC 18004) */

  /* Je Version und Stufe: [ECC-Codewörter pro Block, [[Blöcke, Datencodewörter], …]] */
  var RS_TABLE = {
    1:  { L: [7,  [[1, 19]]],             M: [10, [[1, 16]]] },
    2:  { L: [10, [[1, 34]]],             M: [16, [[1, 28]]] },
    3:  { L: [15, [[1, 55]]],             M: [26, [[1, 44]]] },
    4:  { L: [20, [[1, 80]]],             M: [18, [[2, 32]]] },
    5:  { L: [26, [[1, 108]]],            M: [24, [[2, 43]]] },
    6:  { L: [18, [[2, 68]]],             M: [16, [[4, 27]]] },
    7:  { L: [20, [[2, 78]]],             M: [18, [[4, 31]]] },
    8:  { L: [24, [[2, 97]]],             M: [22, [[2, 38], [2, 39]]] },
    9:  { L: [30, [[2, 116]]],            M: [22, [[3, 36], [2, 37]]] },
    10: { L: [18, [[2, 68], [2, 69]]],    M: [26, [[4, 43], [1, 44]]] },
    11: { L: [20, [[4, 81]]],             M: [30, [[1, 50], [4, 51]]] },
    12: { L: [24, [[2, 92], [2, 93]]],    M: [22, [[6, 36], [2, 37]]] }
  };

  /* Ausrichtungsmuster (Mitten) */
  var ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
    11: [6, 30, 54], 12: [6, 32, 58]
  };

  /* Restbits nach den Codewörtern */
  var REMAINDER = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };

  var ECC_INDICATOR = { L: 0b01, M: 0b00 };
  var VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  var DEFAULT_ECC = 'M';

  /* ------------------------------------------------------------- GF(256) */

  var EXP = new Array(512).fill(0);
  var LOG = new Array(256).fill(0);
  (function initGF() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) { x ^= 0x11d; }
    }
    for (var j = 255; j < 512; j++) { EXP[j] = EXP[j - 255]; }
  }());

  function gfMul(a, b) {
    if (a === 0 || b === 0) { return 0; }
    return EXP[LOG[a] + LOG[b]];
  }

  function rsGenerator(degree) {
    var g = [1];
    for (var i = 0; i < degree; i++) {
      var next = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) {
        next[j] ^= g[j];
        next[j + 1] ^= gfMul(g[j], EXP[i]);
      }
      g = next;
    }
    return g;
  }

  function rsEncode(data, ecLen) {
    var gen = rsGenerator(ecLen);
    var res = data.concat(new Array(ecLen).fill(0));
    for (var i = 0; i < data.length; i++) {
      var coef = res[i];
      if (coef !== 0) {
        for (var j = 0; j < gen.length; j++) { res[i + j] ^= gfMul(gen[j], coef); }
      }
    }
    return res.slice(data.length);
  }

  /* ------------------------------------------------------------- Kapazität */

  function blockPlan(version, eccLevel) {
    var row = RS_TABLE[version];
    if (!row) { throw new Error('Version ' + version + ' wird nicht unterstützt'); }
    var entry = row[eccLevel || DEFAULT_ECC];
    if (!entry) { throw new Error('ECC-Level ' + eccLevel + ' wird nicht unterstützt'); }

    var blocks = [];
    var dataCodewords = 0;
    for (var i = 0; i < entry[1].length; i++) {
      var count = entry[1][i][0];
      var size = entry[1][i][1];
      for (var k = 0; k < count; k++) { blocks.push(size); }
      dataCodewords += count * size;
    }
    var total = 0;
    for (var b = 0; b < blocks.length; b++) { total += blocks[b]; }
    total += entry[0] * blocks.length;

    return { ecPerBlock: entry[0], dataBlocks: blocks, dataCodewords: dataCodewords, totalCodewords: total };
  }

  /** Maximale Nutzdatenlänge (Byte-Modus) für Version/Stufe. */
  function capacity(version, eccLevel) {
    var plan = blockPlan(version, eccLevel);
    var countBits = version < 10 ? 8 : 16;
    return Math.floor((plan.dataCodewords * 8 - 4 - countBits) / 8);
  }

  /* ---------------------------------------------------------- Bitstrom */

  function utf8Bytes(text) {
    if (typeof TextEncoder !== 'undefined') { return new TextEncoder().encode(text); }
    return Uint8Array.from(Buffer.from(text, 'utf8'));   // Node-Rückfall
  }

  function dataCodewords(text, version, eccLevel) {
    var bytes = utf8Bytes(text);
    var plan = blockPlan(version, eccLevel);
    var capacityBytes = capacity(version, eccLevel);
    if (bytes.length > capacityBytes) {
      throw new Error('Nutzdaten zu lang: ' + bytes.length + ' > ' + capacityBytes + ' Bytes');
    }

    var bits = [];
    var push = function (value, len) {
      for (var i = len - 1; i >= 0; i--) { bits.push((value >>> i) & 1); }
    };

    push(0b0100, 4);                                        // Byte-Modus
    push(bytes.length, version < 10 ? 8 : 16);              // Zeichenzahl
    for (var i = 0; i < bytes.length; i++) { push(bytes[i], 8); }

    var maxBits = plan.dataCodewords * 8;
    for (var t = 0; t < 4 && bits.length < maxBits; t++) { bits.push(0); }   // Terminator
    while (bits.length % 8 !== 0) { bits.push(0); }
    var pads = [0xec, 0x11];
    var p = 0;
    while (bits.length < maxBits) { push(pads[p++ % 2], 8); }

    var out = [];
    for (var b = 0; b < bits.length; b += 8) {
      var v = 0;
      for (var k = 0; k < 8; k++) { v = (v << 1) | bits[b + k]; }
      out.push(v);
    }
    return out;
  }

  /** Datenblöcke bilden, ECC berechnen, beides verschränken. */
  function interleave(codewords, version, eccLevel) {
    var plan = blockPlan(version, eccLevel);
    var blocks = [];
    var offset = 0;
    for (var i = 0; i < plan.dataBlocks.length; i++) {
      var len = plan.dataBlocks[i];
      blocks.push({ data: codewords.slice(offset, offset + len), ec: [] });
      offset += len;
    }
    for (var b = 0; b < blocks.length; b++) {
      blocks[b].ec = rsEncode(blocks[b].data, plan.ecPerBlock);
    }

    var result = [];
    var maxData = Math.max.apply(null, plan.dataBlocks);
    for (var d = 0; d < maxData; d++) {
      for (var bi = 0; bi < blocks.length; bi++) {
        if (d < blocks[bi].data.length) { result.push(blocks[bi].data[d]); }
      }
    }
    for (var e = 0; e < plan.ecPerBlock; e++) {
      for (var bj = 0; bj < blocks.length; bj++) { result.push(blocks[bj].ec[e]); }
    }
    return result;
  }

  /* ------------------------------------------------------- Funktionsmuster */

  var MASK_FN = [
    function (r, c) { return (r + c) % 2 === 0; },
    function (r) { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return ((r * c) % 2) + ((r * c) % 3) === 0; },
    function (r, c) { return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; },
    function (r, c) { return (((r * c) % 3) + ((r + c) % 2)) % 2 === 0; }
  ];

  function bitLength(n) { var c = 0; while (n !== 0) { c++; n >>>= 1; } return c; }

  function formatBits(eccIndicator, mask) {
    var data = (eccIndicator << 3) | mask;
    var d = data << 10;
    var G15 = 0x537;
    while (bitLength(d) - bitLength(G15) >= 0) { d ^= (G15 << (bitLength(d) - bitLength(G15))); }
    return ((data << 10) | d) ^ 0x5412;
  }

  function versionBits(version) {
    var d = version << 12;
    var G18 = 0x1f25;
    while (bitLength(d) - bitLength(G18) >= 0) { d ^= (G18 << (bitLength(d) - bitLength(G18))); }
    return (version << 12) | d;
  }

  function writeFormatInfo(m, size, bits) {
    for (var i = 0; i < 15; i++) {
      var bit = (bits >> i) & 1;
      if (i < 6) { m[i][8] = bit; }
      else if (i < 8) { m[i + 1][8] = bit; }
      else { m[size - 15 + i][8] = bit; }

      if (i < 8) { m[8][size - 1 - i] = bit; }
      else if (i < 9) { m[8][15 - i] = bit; }
      else { m[8][15 - i - 1] = bit; }
    }
    m[size - 8][8] = 1;                     // Dark Module
  }

  function writeVersionInfo(m, size, version) {
    if (version < 7) { return; }
    var bits = versionBits(version);
    for (var i = 0; i < 18; i++) {
      var bit = (bits >> i) & 1;
      m[Math.floor(i / 3)][(i % 3) + size - 11] = bit;
      m[(i % 3) + size - 11][Math.floor(i / 3)] = bit;
    }
  }

  function placeFinder(m, row, col) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var y = row + r;
        var x = col + c;
        if (y < 0 || y >= m.length || x < 0 || x >= m.length) { continue; }
        var inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        var v = 0;
        if (inside) {
          var edge = r === 0 || r === 6 || c === 0 || c === 6;
          var core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          v = (edge || core) ? 1 : 0;
        }
        m[y][x] = v;
      }
    }
  }

  function placeAlignment(m, row, col) {
    for (var r = -2; r <= 2; r++) {
      for (var c = -2; c <= 2; c++) {
        var ring = Math.max(Math.abs(r), Math.abs(c));
        m[row + r][col + c] = ring === 1 ? 0 : 1;
      }
    }
  }

  function penalty(m) {
    var size = m.length;
    var score = 0;
    var i;
    var j;

    for (i = 0; i < size; i++) {
      var row = m[i];
      var col = [];
      for (j = 0; j < size; j++) { col.push(m[j][i]); }
      var lines = [row, col];
      for (var li = 0; li < 2; li++) {
        var line = lines[li];
        var run = 1;
        for (j = 1; j < size; j++) {
          if (line[j] === line[j - 1]) { run++; }
          else { if (run >= 5) { score += 3 + (run - 5); } run = 1; }
        }
        if (run >= 5) { score += 3 + (run - 5); }
      }
    }

    for (i = 0; i < size - 1; i++) {
      for (j = 0; j < size - 1; j++) {
        var v = m[i][j];
        if (v === m[i][j + 1] && v === m[i + 1][j] && v === m[i + 1][j + 1]) { score += 3; }
      }
    }

    var P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    var P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (i = 0; i < size; i++) {
      var colLine = [];
      for (j = 0; j < size; j++) { colLine.push(m[j][i]); }
      var both = [m[i], colLine];
      for (var k = 0; k < 2; k++) {
        var ln = both[k];
        for (j = 0; j + 11 <= size; j++) {
          var ok1 = true;
          var ok2 = true;
          for (var q = 0; q < 11; q++) {
            if (ln[j + q] !== P1[q]) { ok1 = false; }
            if (ln[j + q] !== P2[q]) { ok2 = false; }
          }
          if (ok1) { score += 40; }
          if (ok2) { score += 40; }
        }
      }
    }

    var dark = 0;
    for (i = 0; i < size; i++) {
      for (j = 0; j < size; j++) { if (m[i][j]) { dark++; } }
    }
    score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    return score;
  }

  /* ------------------------------------------------------------------ API */

  /** Wählt die kleinste passende Version (erst Stufe M, dann L). */
  function pickVersion(byteLength) {
    var levels = [DEFAULT_ECC, 'L'];
    for (var li = 0; li < levels.length; li++) {
      for (var i = 0; i < VERSIONS.length; i++) {
        if (capacity(VERSIONS[i], levels[li]) >= byteLength) {
          return { version: VERSIONS[i], eccLevel: levels[li] };
        }
      }
    }
    return null;
  }

  /**
   * Erzeugt die QR-Matrix.
   * @param {string} text
   * @param {{version?:number, eccLevel?:string}} [options]
   */
  function encode(text, options) {
    options = options || {};
    var bytes = utf8Bytes(text);
    var selected = options.version
      ? { version: options.version, eccLevel: options.eccLevel || DEFAULT_ECC }
      : pickVersion(bytes.length);

    if (!selected) {
      throw new Error('Nutzdaten zu lang für Version 12: ' + bytes.length + ' Bytes');
    }

    var version = selected.version;
    var eccLevel = selected.eccLevel || DEFAULT_ECC;
    var size = version * 4 + 17;

    var data = dataCodewords(text, version, eccLevel);
    var codewords = interleave(data, version, eccLevel);
    var plan = blockPlan(version, eccLevel);
    if (codewords.length !== plan.totalCodewords) {
      throw new Error('Codewortzahl stimmt nicht: ' + codewords.length + ' ≠ ' + plan.totalCodewords);
    }

    var base = [];
    var r;
    var c;
    for (r = 0; r < size; r++) {
      base.push(new Array(size).fill(null));
    }

    placeFinder(base, 0, 0);
    placeFinder(base, size - 7, 0);
    placeFinder(base, 0, size - 7);

    for (var i = 8; i < size - 8; i++) {
      base[6][i] = i % 2 === 0 ? 1 : 0;
      base[i][6] = i % 2 === 0 ? 1 : 0;
    }

    var centers = ALIGN[version];
    for (var ai = 0; ai < centers.length; ai++) {
      for (var aj = 0; aj < centers.length; aj++) {
        var ar = centers[ai];
        var ac = centers[aj];
        var overlaps = (ar <= 8 && ac <= 8) ||
          (ar <= 8 && ac >= size - 9) ||
          (ar >= size - 9 && ac <= 8);
        if (!overlaps) { placeAlignment(base, ar, ac); }
      }
    }

    writeFormatInfo(base, size, formatBits(ECC_INDICATOR[eccLevel], 0));   // reserviert
    writeVersionInfo(base, size, version);

    var isData = [];
    for (r = 0; r < size; r++) { isData.push(new Array(size).fill(false)); }

    var bitIndex = 7;
    var byteIndex = 0;
    var row = size - 1;
    var inc = -1;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) { col--; }
      for (;;) {
        for (c = 0; c < 2; c++) {
          var x = col - c;
          if (base[row][x] === null) {
            var dark = 0;
            if (byteIndex < codewords.length) {
              dark = (codewords[byteIndex] >>> bitIndex) & 1;
            }
            base[row][x] = dark;
            isData[row][x] = true;
            bitIndex--;
            if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
          }
        }
        row += inc;
        if (row < 0 || row >= size) { row -= inc; inc = -inc; break; }
      }
    }

    var bestMask = 0;
    var bestScore = Infinity;
    var best = null;
    for (var mask = 0; mask < 8; mask++) {
      var candidate = base.map(function (line) { return line.slice(); });
      for (r = 0; r < size; r++) {
        for (c = 0; c < size; c++) {
          if (isData[r][c] && MASK_FN[mask](r, c)) { candidate[r][c] ^= 1; }
        }
      }
      writeFormatInfo(candidate, size, formatBits(ECC_INDICATOR[eccLevel], mask));
      var s = penalty(candidate);
      if (s < bestScore) { bestScore = s; best = candidate; bestMask = mask; }
    }

    return {
      text: text,
      size: size,
      version: version,
      eccLevel: eccLevel,
      mask: bestMask,
      score: bestScore,
      modules: best,
      codewords: codewords
    };
  }

  /** Zeichnet eine Matrix auf ein Canvas (nur im Browser). quiet = Module Ruhezone. */
  function renderToCanvas(canvas, result, options) {
    options = options || {};
    var quiet = options.quiet === undefined ? 4 : options.quiet;
    var scale = options.scale || 6;
    var total = (result.size + quiet * 2) * scale;
    var dark = options.dark || '#2c2418';
    var light = options.light || '#ffffff';

    canvas.width = total;
    canvas.height = total;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, total, total);
    ctx.fillStyle = dark;
    for (var r = 0; r < result.size; r++) {
      for (var c = 0; c < result.size; c++) {
        if (result.modules[r][c]) {
          ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
      }
    }
    return canvas;
  }

  return {
    encode: encode,
    capacity: capacity,
    blockPlan: blockPlan,
    pickVersion: pickVersion,
    renderToCanvas: renderToCanvas,
    formatBits: formatBits,
    versionBits: versionBits,
    RS_TABLE: RS_TABLE,
    ALIGN: ALIGN,
    REMAINDER: REMAINDER,
    ECC_INDICATOR: ECC_INDICATOR,
    VERSIONS: VERSIONS,
    DEFAULT_ECC: DEFAULT_ECC,
    MASK_FN: MASK_FN
  };
}));
