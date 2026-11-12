/* สร้าง QR Code ในเครื่อง (ไม่ส่งลิงก์ไปบริการภายนอก) · ข้อความ UTF-8 แบบไบต์ · แก้ผิดระดับ M · รุ่น 1–20
 * ใช้: KPIQR.svg('https://...', { dark: '#062a35', light: '#fff' }) → ข้อความ <svg> */
(function (root) {
  'use strict';
  var ECC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26];
  var BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16];

  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(v) { return Math.floor(rawModules(v) / 8) - ECC[v] * BLOCKS[v]; }

  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z & 0xFF;
  }
  function rsDivisor(d) {
    var r = []; for (var i = 0; i < d; i++) r.push(0);
    r[d - 1] = 1;
    var root = 1;
    for (i = 0; i < d; i++) {
      for (var j = 0; j < d; j++) { r[j] = gfMul(r[j], root); if (j + 1 < d) r[j] ^= r[j + 1]; }
      root = gfMul(root, 2);
    }
    return r;
  }
  function rsRemainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ r.shift(); r.push(0);
      for (var i = 0; i < div.length; i++) r[i] ^= gfMul(div[i], f);
    });
    return r;
  }
  function utf8(s) {
    var o = [], e = unescape(encodeURIComponent(s));
    for (var i = 0; i < e.length; i++) o.push(e.charCodeAt(i));
    return o;
  }

  function encode(text) {
    var bytes = utf8(String(text)), v, cap;
    for (v = 1; v <= 20; v++) {
      cap = dataCodewords(v) * 8;
      if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= cap) break;
    }
    if (v > 20) throw new Error('ข้อความยาวเกินไปสำหรับ QR');
    var bits = [];
    var put = function (val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) { var x = 0; for (var j = 0; j < 8; j++) x = (x << 1) | bits[i + j]; data.push(x); }
    return { v: v, codewords: interleave(data, v) };
  }

  function interleave(data, v) {
    var nb = BLOCKS[v], el = ECC[v], raw = Math.floor(rawModules(v) / 8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(el), blocks = [], k = 0;
    for (var i = 0; i < nb; i++) {
      var len = shortLen - el + (i < nShort ? 0 : 1), dat = data.slice(k, k + len);
      k += len;
      var ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var out = [];
    for (i = 0; i < blocks[0].length; i++)
      for (var j = 0; j < nb; j++)
        if (i !== shortLen - el || j >= nShort) out.push(blocks[j][i]);
    return out;
  }

  function build(text) {
    var enc = encode(text), v = enc.v, size = v * 4 + 17, m = [], fn = [];
    for (var y = 0; y < size; y++) { m.push([]); fn.push([]); for (var x = 0; x < size; x++) { m[y].push(false); fn[y].push(false); } }
    var setF = function (x, y, d) { m[y][x] = d; fn[y][x] = true; };

    for (var i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = c[0] + dx, yy = c[1] + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, d !== 2 && d !== 4);
      }
    });
    var pos = [];
    if (v > 1) {
      var n = Math.floor(v / 7) + 2, step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
      pos = [6];
      for (var p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
    }
    pos.forEach(function (a, ai) {
      pos.forEach(function (b, bi) {
        var last = pos.length - 1;
        if ((ai === 0 && bi === 0) || (ai === 0 && bi === last) || (ai === last && bi === 0)) return;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setF(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      });
    });
    var drawFormat = function (mask) {
      var data = mask, rem = data; // ระดับ M = 00
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412, g = function (i) { return ((bits >>> i) & 1) !== 0; };
      for (i = 0; i <= 5; i++) setF(8, i, g(i));
      setF(8, 7, g(6)); setF(8, 8, g(7)); setF(7, 8, g(8));
      for (i = 9; i < 15; i++) setF(14 - i, 8, g(i));
      for (i = 0; i < 8; i++) setF(size - 1 - i, 8, g(i));
      for (i = 8; i < 15; i++) setF(8, size - 15 + i, g(i));
      setF(8, size - 8, true);
    };
    drawFormat(0);
    if (v >= 7) {
      var rem = v;
      for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (v << 12) | rem;
      for (i = 0; i < 18; i++) {
        var bit = ((vb >>> i) & 1) !== 0, a = size - 11 + i % 3, b = Math.floor(i / 3);
        setF(a, b, bit); setF(b, a, bit);
      }
    }

    var cw = enc.codewords, k = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (var j = 0; j < 2; j++) {
        var xx = right - j, up = ((right + 1) & 2) === 0, yy = up ? size - 1 - vert : vert;
        if (!fn[yy][xx] && k < cw.length * 8) { m[yy][xx] = ((cw[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0; k++; }
      }
    }

    var maskFn = [
      function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; },
      function (x) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
      function (x, y) { return x * y % 2 + x * y % 3 === 0; },
      function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; },
      function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }
    ];
    var applyMask = function (mk) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!fn[y][x] && maskFn[mk](x, y)) m[y][x] = !m[y][x];
    };
    var best = 0, bestScore = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      applyMask(mk); drawFormat(mk);
      var s = penalty(m, size);
      if (s < bestScore) { bestScore = s; best = mk; }
      applyMask(mk);
    }
    applyMask(best); drawFormat(best);
    return { size: size, modules: m, version: v, mask: best };
  }

  function penalty(m, size) {
    var score = 0, dark = 0, x, y;
    var lineScore = function (get) {
      var s = 0;
      for (var a = 0; a < size; a++) {
        var run = 1, line = [];
        for (var b = 0; b < size; b++) line.push(get(a, b) ? 1 : 0);
        for (b = 1; b <= size; b++) {
          if (b < size && line[b] === line[b - 1]) run++;
          else { if (run >= 5) s += 3 + run - 5; run = 1; }
        }
        var str = line.join('');
        [/(?=10111010000)/g, /(?=00001011101)/g].forEach(function (re) { var mm = str.match(re); if (mm) s += 40 * mm.length; });
      }
      return s;
    };
    score += lineScore(function (a, b) { return m[a][b]; });
    score += lineScore(function (a, b) { return m[b][a]; });
    for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) {
      var c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
    }
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (m[y][x]) dark++;
    var total = size * size;
    score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
    return score;
  }

  function svg(text, opt) {
    opt = opt || {};
    var q = build(text), border = opt.border === undefined ? 4 : opt.border, n = q.size + border * 2, d = [];
    for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++) if (q.modules[y][x]) d.push('M' + (x + border) + ',' + (y + border) + 'h1v1h-1z');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" role="img" aria-label="' + (opt.label || 'QR Code') + '">' +
      '<rect width="100%" height="100%" fill="' + (opt.light || '#fff') + '"/><path d="' + d.join('') + '" fill="' + (opt.dark || '#000') + '"/></svg>';
  }

  root.KPIQR = { svg: svg, build: build, _rs: function (data, d) { return rsRemainder(data, rsDivisor(d)); } };
})(window);
