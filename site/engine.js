/*
 * A108 surface discontinuity rules engine.
 * Source: ASTM A108-18 Table A1.8 (footnotes A, B); grade sulfur from ASTM A29/A29M-20 Tables 1–2.
 * Every limit below is a value printed in Table A1.8. Nothing is interpolated (project rule 4).
 */
(function (root) {
  var GRADES = (typeof module !== 'undefined' && module.exports) ? require('./grades.js') : root.A108_GRADES;

  var CLASSES = {
    non:  { key: 'non',  label: 'Carbon and Alloy, Non-resulfurized', fixedIn: 0.008, fixedMm: '0.20', pct: 1.6 },
    low:  { key: 'low',  label: 'Carbon and Alloy, Resulfurized (0.08 thru 0.19 % Sulfur)', fixedIn: 0.010, fixedMm: '0.25', pct: 2.0 },
    high: { key: 'high', label: 'Carbon and Alloy, Resulfurized (0.20 thru 0.35 % Sulfur)', fixedIn: 0.012, fixedMm: '0.30', pct: 2.4 }
  };
  var ORDER = ['non', 'low', 'high'];

  var COL_FIXED = 'Maximum Depth ¼ (6.35 mm) thru ⅝ (15.88 mm), max. in. (mm)';
  var COL_PCT = 'Maximum Depth (% of Size) over ⅝ (15.88 mm) thru 6 (152.40 mm), max. percentage';

  var FOOTNOTES = [
    'A: Expected maximum depth within good manufacturing practice; occasional bars in a shipment may exceed it. For critical applications the purchaser may require non-destructive surface testing before shipment (see S7).',
    'B: Level 2 requires surface stock removal by turning or multiple grinding passes when Level 1 depth is not acceptable in a cold drawn bar.'
  ];

  var DISCLAIMER = 'Per the cited table; confirm against your engineering criteria.';
  var EPS = 1e-9;

  function r4(x) { return Math.round(x * 10000) / 10000; }
  function fmt(x) { return x.toFixed(3) + ' in.'; }
  function mm(x) { return (x * 25.4).toFixed(2) + ' mm'; }

  /* ---------- sulfur → Table A1.8 column group ---------- */
  function parseSulfur(s) {
    if (s === null || s === undefined || s === '') return null;
    if (typeof s === 'number') return { min: s, max: s, single: true };
    var m = String(s).match(/(\d*\.?\d+)\s*[–-]\s*(\d*\.?\d+)/);
    if (m) return { min: parseFloat(m[1]), max: parseFloat(m[2]), single: false };
    var v = parseFloat(s);
    if (isNaN(v)) return null;
    return { min: null, max: v, single: false, maxOnly: true };
  }

  function classesForSulfur(sp) {
    // returns { classes: [...], note }
    if (!sp) return { classes: [] };
    if (sp.maxOnly) {
      // A single printed value is a maximum (A29 Table 1, note A): non-resulfurized when below 0.08 %.
      if (sp.max < 0.08) return { classes: ['non'] };
    }
    var lo = sp.single || sp.maxOnly ? sp.max : sp.min;
    var hi = sp.max;
    if (sp.single || sp.maxOnly) lo = hi = sp.max;
    if (sp.single && hi < 0.08) return { classes: ['non'] };
    if (hi > 0.35) return { classes: [], note: 'Sulfur above 0.35 % is not covered by Table A1.8: not specified in the provided text.' };
    if (!sp.single && !sp.maxOnly && hi < 0.08) {
      return { classes: [], note: 'This grade is resulfurized (sulfur ' + sp.min + '–' + sp.max + ' %) but below the 0.08 % band of Table A1.8: not specified in the provided text.' };
    }
    var out = [];
    if (lo <= 0.19 + EPS && hi >= 0.08 - EPS) out.push('low');
    if (lo <= 0.35 + EPS && hi >= 0.20 - EPS) out.push('high');
    if (!out.length) return { classes: [], note: 'Sulfur ' + hi + ' % falls between the Table A1.8 bands (0.08–0.19 % and 0.20–0.35 %): not specified in the provided text.' };
    var note = out.length > 1 ? 'Sulfur range ' + sp.min + '–' + sp.max + ' % spans two Table A1.8 columns; both were checked.' : null;
    return { classes: out, note: note };
  }

  function lookupGrade(g) {
    if (!g) return null;
    var key = String(g).toUpperCase().replace(/\s+/g, ' ').trim();
    key = key.replace(/^M(\d)/, 'M $1');
    if (GRADES[key]) return { grade: key, S: GRADES[key].S, src: GRADES[key].src };
    var lead = key.match(/^(E?\d{2})L(\d{2,3})$/);
    if (lead && GRADES[lead[1] + lead[2]]) {
      var b = lead[1] + lead[2];
      return { grade: key, S: GRADES[b].S, src: GRADES[b].src, note: key + ' is leaded ' + b + ' (A29 Table 1, footnote D); sulfur taken from ' + b + '.' };
    }
    return null;
  }

  /* ---------- main evaluation ---------- */
  function evaluate(input) {
    input = input || {};
    var res = {
      input: input, verdict: null, signal: null, headline: '', detail: '',
      column: null, row: null, perClass: [], footnotes: FOOTNOTES.slice(),
      assumptions: [], missing: [], warnings: [], sources: [], disclaimer: DISCLAIMER
    };
    var size = input.size, depth = input.depth;
    var level = input.level === 2 || input.level === '2' ? 2 : 1;
    if (!input.level) res.assumptions.push('Tolerance level not given; Level 1 assumed.');

    (input.notes || []).forEach(function (n) { res.warnings.push(n); });

    // ---- size ----
    if (size === null || size === undefined || isNaN(size)) {
      res.missing.push('Bar size (diameter or across-flats), e.g. 1 in. round');
    } else if (size < 0.25 - EPS || size > 6 + EPS) {
      res.verdict = 'hold'; res.signal = 'amber';
      res.headline = 'HOLD · NOT COVERED';
      res.detail = 'Size ' + size + ' in. is outside Table A1.8 (¼ thru 6 in.): not specified in the provided text.';
      return finish(res);
    }

    // ---- grade / sulfur ----
    var classes = null, gradeInfo = null;
    if (input.sulfur !== null && input.sulfur !== undefined && input.sulfur !== '') {
      var cs = classesForSulfur(parseSulfur(Number(input.sulfur)));
      classes = cs.classes; if (cs.note) res.warnings.push(cs.note);
      res.sources.push('Sulfur ' + input.sulfur + ' % as given');
    } else if (input.grade) {
      gradeInfo = lookupGrade(input.grade);
      if (!gradeInfo) {
        res.warnings.push('Grade "' + input.grade + '" is not in ASTM A29-20 Tables 1–2; treated as unknown.');
      } else {
        var c2 = classesForSulfur(parseSulfur(gradeInfo.S));
        classes = c2.classes; if (c2.note) res.warnings.push(c2.note);
        if (gradeInfo.note) res.warnings.push(gradeInfo.note);
        res.sources.push('Sulfur ' + gradeInfo.S + ' % (' + gradeInfo.src + ')');
      }
    }
    var gradeKnown = classes !== null;
    if (gradeKnown && classes.length === 0) {
      res.verdict = 'hold'; res.signal = 'amber';
      res.headline = 'HOLD · NOT COVERED';
      res.detail = res.warnings[res.warnings.length - 1];
      return finish(res);
    }
    if (!gradeKnown) {
      classes = ORDER.slice();
      res.assumptions.push('Grade / sulfur unknown: every Table A1.8 sulfur column was checked.');
    }

    if (res.missing.length) {
      if (input.ambiguousDepth) res.missing.unshift('Is the stated dimension the defect depth or its length? Table A1.8 limits depth only.');
      else if (depth === null || depth === undefined || isNaN(depth)) res.missing.push('Measured defect depth per side');
      if (!gradeKnown) res.missing.push('Grade or sulfur % (to pick the Table A1.8 column)');
      res.verdict = 'hold'; res.signal = 'amber';
      res.headline = 'HOLD · NEED MORE INFO';
      res.detail = 'Cannot determine until the missing details are supplied.';
      return finish(res);
    }

    // ---- limits per class ----
    var fixed = size <= 0.625 + EPS;
    res.column = fixed ? COL_FIXED : COL_PCT;
    res.row = 'Level ' + level;
    classes.forEach(function (k) {
      var c = CLASSES[k];
      var limit = level === 2 ? 0 : (fixed ? c.fixedIn : r4(c.pct / 100 * size));
      var tableValue = level === 2 ? 'Nil' : (fixed ? c.fixedIn.toFixed(3) + ' (' + c.fixedMm + ')' : c.pct.toFixed(1) + ' %');
      var calc = level === 2 ? 'Nil' : (fixed ? fmt(limit) : c.pct.toFixed(1) + ' % × ' + size.toFixed(3) + ' in. = ' + fmt(limit));
      var row = { key: k, label: c.label, tableValue: tableValue, calc: calc, limit: limit };
      if (depth !== null && depth !== undefined && !isNaN(depth)) {
        row.within = depth <= limit + EPS;
        row.margin = r4(Math.abs(limit - depth));
        row.atLimit = Math.abs(limit - depth) < EPS;
      }
      res.perClass.push(row);
    });

    // ---- depth ----
    if (input.ambiguousDepth) {
      res.verdict = 'hold'; res.signal = 'amber';
      res.headline = 'HOLD · DEPTH OR LENGTH?';
      res.detail = 'Table A1.8 limits depth per side only. Confirm whether ' + (depth ? fmt(depth) : 'the stated dimension') + ' is the depth.';
      res.missing.push('Is the stated dimension the defect depth or its length?');
      return finish(res);
    }
    if (depth === null || depth === undefined || isNaN(depth)) {
      res.verdict = 'limit'; res.signal = 'blue';
      res.headline = 'LIMIT · ' + limitText(res.perClass);
      res.detail = 'No measured depth given; maximum allowable depth per side shown.';
      return finish(res);
    }
    if (size && depth >= size / 2) {
      res.verdict = 'hold'; res.signal = 'amber';
      res.headline = 'HOLD · CHECK THE INPUT';
      res.detail = 'A depth of ' + fmt(depth) + ' is half the bar size or more. Please re-check the measurement and units.';
      return finish(res);
    }

    var w = res.perClass.filter(function (p) { return p.within; }).length;
    if (w === res.perClass.length) {
      res.verdict = 'within'; res.signal = 'green';
      res.headline = 'YES · WITHIN LIMIT';
    } else if (w === 0) {
      res.verdict = 'exceeds'; res.signal = 'red';
      res.headline = 'NO · EXCEEDS LIMIT';
    } else {
      res.verdict = 'hold'; res.signal = 'amber';
      res.headline = 'HOLD · GRADE DECIDES';
      res.missing.push('Grade or sulfur % (mill cert, heat tag or PO)');
    }
    var lims = res.perClass.map(function (p) { return p.limit; });
    var lo = Math.min.apply(null, lims), hi = Math.max.apply(null, lims);
    res.detail = fmt(depth) + ' found vs ' + (lo === hi ? fmt(lo) : fmt(lo) + '–' + fmt(hi)) + ' allowed per side';
    res.perClass.forEach(function (p) { if (p.atLimit) res.warnings.push('Depth equals the ' + p.label + ' limit exactly: zero margin, so gauge resolution matters.'); });
    if (level === 1 && res.verdict === 'within') res.warnings.push('At Level 2 the limit is Nil, so this would exceed.');
    return finish(res);
  }

  function limitText(pc) {
    var l = pc.map(function (p) { return p.limit; });
    var lo = Math.min.apply(null, l), hi = Math.max.apply(null, l);
    return lo === hi ? fmt(lo) + ' (' + mm(lo) + ') per side' : fmt(lo) + '–' + fmt(hi) + ' per side';
  }

  function finish(res) {
    if (res.input.depthNote) res.assumptions.unshift(res.input.depthNote);
    res.assumptions.push('Depth is measured per side of bar, radially from the surface.');
    return res;
  }

  /* Plain-text record for an inspection log or NCR (output format from the project instructions). */
  function toText(res) {
    var L = [];
    L.push('A108 SURFACE INSPECTION · ' + res.headline);
    if (res.detail) L.push(res.detail);
    if (res.column) L.push('- Applicable table row/column: ASTM A108-18 Table A1.8, ' + res.row + ' row; ' + res.column);
    res.perClass.forEach(function (p) {
      L.push('- Tolerance (' + p.label + '): ' + p.tableValue + (p.calc !== p.tableValue ? '  →  ' + p.calc : '') +
        (p.within === undefined ? '' : (p.within ? '  [WITHIN by ' : '  [EXCEEDS by ') + fmt(p.margin) + ']'));
    });
    L.push('- Footnotes/conditions: ' + res.footnotes.join(' '));
    L.push('- Result: ' + ({ within: 'within', exceeds: 'exceeds', hold: 'cannot determine', limit: 'limit only (no depth given)' }[res.verdict]));
    var a = res.sources.concat(res.warnings, res.assumptions, res.missing.map(function (m) { return 'Missing: ' + m; }));
    if (a.length) L.push('- Assumptions or missing info: ' + a.join(' '));
    L.push(res.disclaimer);
    return L.join('\n');
  }

  var API = { evaluate: evaluate, lookupGrade: lookupGrade, toText: toText, CLASSES: CLASSES, FOOTNOTES: FOOTNOTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.A108 = API;
})(typeof self !== 'undefined' ? self : this);
