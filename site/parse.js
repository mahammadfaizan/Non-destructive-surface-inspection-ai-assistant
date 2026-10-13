/*
 * Plain-English question → structured inputs for the engine.
 * Deliberately conservative: anything it can't read cleanly is left blank so the engine asks.
 */
(function (root) {
  var A108 = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.A108;

  function frac(s) {
    s = String(s).trim().replace(/\s*-\s*/g, ' ');
    var m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10);
    m = s.match(/^(\d+)\/(\d+)$/);
    if (m) return parseInt(m[1], 10) / parseInt(m[2], 10);
    var v = parseFloat(s.replace(/,/g, ''));
    return isNaN(v) ? null : v;
  }

  var NUM = '(\\d+\\s*-\\s*\\d+\\/\\d+|\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d{1,3}(?:,\\d{3})+|\\d*\\.\\d+|\\d+)';
  var UNIT = '(?:\\s*(?:-inch(?:es)?|inch(?:es)?|in\\b\\.?|"|”))?';

  function parse(text) {
    var t = ' ' + String(text || '').toLowerCase().replace(/[‐–—]/g, '-') + ' ';
    var out = { grade: null, sulfur: null, size: null, depth: null, level: null, shape: null, finish: null,
                ambiguousDepth: false, depthNote: null, notes: [], read: [] };
    var work = t;

    // ---- level ----
    var m = work.match(/level\s*([12])\b/);
    if (m) { out.level = parseInt(m[1], 10); work = work.replace(m[0], ' '); }

    // ---- sulfur % ----
    m = work.match(/(\d*\.?\d+)\s*%\s*(?:s\b|sulfur|sulphur)/);
    if (m) {
      var s = parseFloat(m[1]);
      if (s > 0.35 && s <= 35) {
        out.notes.push('“' + m[1] + ' % sulfur” is outside Table A1.8 (max 0.35 %). Read as ' + (s / 100).toFixed(2) + ' %. Please confirm from the mill cert.');
        s = s / 100;
      }
      out.sulfur = s; work = work.replace(m[0], ' ');
    }

    // ---- grade (must exist in A29 tables) ----
    var gRe = /\b(e?\d{2}[lb]?v?\d{2,3}|m\s?\d{4})\b/g, g;
    while ((g = gRe.exec(work))) {
      if (A108.lookupGrade(g[1])) { out.grade = A108.lookupGrade(g[1]).grade; work = work.replace(g[0], ' '); break; }
    }

    // ---- depth ----
    var depthPats = [
      [new RegExp(NUM + '\\s*(?:thou|thousandths?|mils?)\\b'), function (v, raw) { return v / 1000; }],
      [new RegExp('(?:depth|deep)\\s*(?:of|is|at|about|around|=|:)?\\s*(?:about\\s*)?' + NUM + UNIT), null],
      [new RegExp(NUM + '(?:th)?' + UNIT + '\\s*(?:deep|depth|in depth)\\b'), null],
      [new RegExp('(?:measur\\w*|reads?|reading|found)\\s*(?:at|of|is|=|:)?\\s*(?:about\\s*)?' + NUM + UNIT), null],
      [new RegExp('(?:defect|discontinuity|seam|crack|flaw|lap|indication)\\s*(?:of|is|at|measuring)\\s*(?:about\\s*)?' + NUM + UNIT + '(?!\\s*(?:round|rd|dia))'), null],
      [/\b(0?\.0\d+)\b/, null]
    ];
    for (var i = 0; i < depthPats.length && out.depth === null; i++) {
      m = work.match(depthPats[i][0]);
      if (!m) continue;
      var raw = m[1], v = frac(raw);
      if (v === null) continue;
      if (depthPats[i][1]) v = depthPats[i][1](v, raw);
      else if (/,/.test(raw) || v >= 1000) {
        out.depthNote = '“' + raw + '” read as ' + (v / 1e6).toFixed(3) + ' in. (' + Math.round(v / 1000) + ' thousandths). Please confirm.';
        v = v / 1e6;
      } else if (v >= 1 && v < 1000 && !/\./.test(raw) && !/\//.test(raw) && !/in|inch|"/.test(m[0])) {
        out.depthNote = '“' + raw + '” read as ' + (v / 1000).toFixed(3) + ' in. (thousandths). Please confirm.';
        v = v / 1000;
      }
      out.depth = Math.round(v * 10000) / 10000;
      work = work.replace(m[0], ' ');
    }

    // ---- "<n> inch defect": depth if small, otherwise ask depth-or-length ----
    if (out.depth === null) {
      m = work.match(new RegExp(NUM + '(?:th)?\\s*(?:-inch(?:es)?|inch(?:es)?|in\\b\\.?|"|”)\\s*(?:long\\s*)?(?:surface\\s*)?(?:defect|discontinuity|seam|crack|flaw|lap|indication)'));
      if (m) {
        var dv = frac(m[1]);
        if (dv !== null && dv < 0.25) {
          out.depth = dv; out.depthNote = '“' + m[0].trim() + '” read as a depth of ' + dv.toFixed(3) + ' in. per side. Please confirm.';
        } else if (dv !== null) { out.ambiguousDepth = true; out.depth = dv; }
        work = work.replace(m[0], ' ');
      }
    }

    // ---- size ----
    var sizePats = [
      new RegExp(NUM + UNIT + '\\s*(?:-|\\s)?\\s*(?:round|rd|dia(?:meter)?|hex|square|sq|bar|od)\\b'),
      new RegExp('(?:size|diameter|dia)\\s*(?:is|of|=|:)?\\s*(?:about\\s*)?' + NUM + UNIT),
      new RegExp(NUM + '\\s*(?:-inch(?:es)?|inch(?:es)?|in\\b\\.?|"|”)')
    ];
    for (i = 0; i < sizePats.length && out.size === null; i++) {
      m = work.match(sizePats[i]);
      if (!m) continue;
      // a "<n> inch defect" with no depth word is ambiguous: depth or length?
      var after = work.slice(work.indexOf(m[0]) + m[0].length, work.indexOf(m[0]) + m[0].length + 14);
      if (/^\s*(?:long\s*)?(?:surface\s*)?(?:defect|discontinuity|seam|crack|flaw|lap|indication)/.test(after) && out.depth === null) {
        var dv = frac(m[1]);
        if (dv !== null && dv < 0.25) {
          // too small to be a bar size or a meaningful length: read as depth, and say so
          out.depth = dv; out.depthNote = '“' + m[0].trim() + '” read as a discontinuity depth of ' + dv.toFixed(3) + ' in. per side. Please confirm.';
        } else { out.ambiguousDepth = true; out.depth = dv; }
        work = work.replace(m[0], ' ');
        i--; continue;
      }
      var sv = frac(m[1]);
      if (sv !== null && sv > 0 && sv <= 100) { out.size = sv; work = work.replace(m[0], ' '); }
    }

    // ---- shape / finish ----
    if (/\b(round|rd|dia(meter)?)\b/.test(t)) out.shape = 'round';
    else if (/\bhex\b/.test(t)) out.shape = 'hex';
    else if (/\b(square|sq)\b/.test(t)) out.shape = 'square';
    if (/cold[\s-]?drawn|\bcd\b/.test(t)) out.finish = 'cold drawn';
    else if (/turned/.test(t)) out.finish = 'turned and polished';
    else if (/ground/.test(t)) out.finish = 'ground and polished';

    // ---- unreadable grade-like token ----
    if (!out.grade && out.sulfur === null && /grade\s*(?:is|of|:)?\s*([\w\-\/]+)/.test(t)) {
      var gg = t.match(/grade\s*(?:is|of|:)?\s*([\w\-\/]+)/)[1];
      if (!/^(unknown|not|n\/a|na|missing)/.test(gg) && !/know/.test(gg)) out.notes.push('Grade “' + gg + '” is not a designation in ASTM A29-20 Tables 1–2; treated as unknown.');
    }
    return out;
  }

  var API = { parse: parse, frac: frac };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.A108Parse = API;
})(typeof self !== 'undefined' ? self : this);
