(function () {
  var $ = function (id) { return document.getElementById(id); };
  var form = $('form');
  var last = null;

  var EXAMPLES = [
    'for 1018 steel whats the max depth of surface for size 1/2 inch',
    'for 1215 rd 1 inch, its measuring at 0.018 in',
    'i have 1018 round cold drawn steel of 1-inch diameter which has a surface defect of 20 thousandths of an inch. Is this acceptable per ASTM?',
    'what is the acceptability of a 1/8th inch surface defect in a resulfurized carbon and alloy 10% sulfur of 1 inch diameter round bar',
    'i got a 1 inch defect in a steel bar, is that acceptable?',
    "I have 1-inch round material which is 1045 grade, and there is a defect about 20,000 deep.",
    'grade is 1-1/16-15, surface depth is 16 thousandths deep, size is 1 in.',
    "surface defect about 40,000 deep, size is 1.5 inches round, I don't know the grade",
    "depth of 32 thousandths but I don't have the grade. The size is 1.5 diameter."
  ];
  var SHORT = ['1018 · ½ in. limit', '1215 · 1 in. · 0.018', '1018 CD · 1 in. · 0.020', '“10 % S” · ⅛ in.', '“1 inch defect”', '1045 · “20,000 deep”', 'Unclear grade · 0.016', 'No grade · 1.5 in. · 0.040', 'No grade · 1.5 in. · 0.032'];

  // chips
  EXAMPLES.forEach(function (q, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = SHORT[i]; b.title = q;
    b.onclick = function () { $('q').value = q; ask(); };
    $('chips').appendChild(b);
  });
  // grade list
  var dl = $('grades');
  Object.keys(window.A108_GRADES).forEach(function (g) { var o = document.createElement('option'); o.value = g; dl.appendChild(o); });

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function num(v) { if (v === '' || v === null || v === undefined) return null; var n = parseFloat(v); return isNaN(n) ? null : n; }

  var parsedNotes = [], parsedDepthNote = null;

  function fillForm(p) {
    form.grade.value = p.grade || '';
    form.sulfur.value = p.sulfur !== null ? p.sulfur : '';
    form.size.value = p.size !== null ? p.size : '';
    form.shape.value = p.shape || '';
    form.finish.value = p.finish || '';
    form.depth.value = p.depth !== null ? p.depth : '';
    form.level.value = p.level ? String(p.level) : '';
    form.ambiguousDepth.checked = !!p.ambiguousDepth;
    parsedNotes = p.notes || []; parsedDepthNote = p.depthNote || null;
  }

  function readForm() {
    return {
      grade: form.grade.value.trim() || null,
      sulfur: num(form.sulfur.value),
      size: num(form.size.value),
      shape: form.shape.value || null,
      finish: form.finish.value || null,
      depth: num(form.depth.value),
      level: form.level.value ? parseInt(form.level.value, 10) : null,
      ambiguousDepth: form.ambiguousDepth.checked,
      notes: parsedNotes, depthNote: parsedDepthNote
    };
  }

  function ask() {
    var q = $('q').value.trim();
    if (!q) return;
    fillForm(A108Parse.parse(q));
    run(q);
  }

  function run(label) {
    var input = readForm();
    var r = A108.evaluate(input);
    last = r; render(r, input);
    $('copy').disabled = $('print').disabled = false;
    var li = document.createElement('li');
    li.innerHTML = '<span class="tag ' + r.signal + '">● ' + esc(r.headline.split(' · ')[0]) + '</span> — ' + esc(label || summary(input));
    li.title = 'Re-run this case';
    var snap = JSON.parse(JSON.stringify(input));
    li.onclick = function () { fillForm(snap); parsedNotes = snap.notes; parsedDepthNote = snap.depthNote; run(label); };
    $('log').prepend(li);
  }

  function summary(i) {
    return [i.grade || (i.sulfur !== null ? i.sulfur + ' % S' : 'grade ?'), i.size !== null ? i.size + ' in.' : 'size ?', i.depth !== null ? i.depth + ' in. deep' : 'depth ?', i.level ? 'Level ' + i.level : ''].filter(Boolean).join(' · ');
  }

  function render(r, input) {
    var rows = [];
    var prod = input.grade ? input.grade : (input.sulfur !== null ? 'Sulfur ' + input.sulfur + ' %' : '<i>Not given</i>');
    if (r.sources.length) prod += ' <span class="muted">· ' + esc(r.sources.join('; ')) + '</span>';
    rows.push(['Product', prod]);
    rows.push(['Size / shape / finish', [input.size !== null ? input.size.toFixed(3) + ' in.' : '<i>Not given</i>', input.shape, input.finish].filter(Boolean).join(' · ')]);
    rows.push(['Method', 'Eddy current (ET) · surface discontinuity']);
    rows.push(['Discontinuity', input.depth !== null ? '<b>' + input.depth.toFixed(3) + ' in.</b> ' + (input.ambiguousDepth ? '(depth or length?)' : 'deep, per side') : '<i>Not given</i>']);
    if (r.column) rows.push(['Table row / column', 'ASTM A108-18 Table A1.8 · <b>' + esc(r.row) + '</b> row · ' + esc(r.column)]);
    if (r.perClass.length) {
      var t = '<table class="cls"><tr><th>Column group</th><th>Table value</th><th>Limit per side</th>' + (r.perClass[0].within !== undefined ? '<th>Result</th>' : '') + '</tr>';
      r.perClass.forEach(function (p) {
        t += '<tr><td>' + esc(p.label.replace('Carbon and Alloy, ', '')) + '</td><td>' + esc(p.tableValue) + '</td><td>' + esc(p.calc) + '</td>';
        if (p.within !== undefined) t += '<td class="pill ' + (p.within ? 'ok">● Acceptable' : 'no">● Rejectable') + ' <span class="muted">' + (p.margin ? 'by ' + p.margin.toFixed(3) : 'at limit') + '</span></td>';
        t += '</tr>';
      });
      rows.push(['Tolerance', t + '</table>']);
    }
    rows.push(['Footnotes', esc(r.footnotes.join(' '))]);

    var html = '<div class="hdr"><span>EDDY CURRENT SURFACE INSPECTION RESULT · ASTM A108-18</span><span>TABLE A1.8</span></div>' +
      '<div class="band ' + r.signal + '"><div class="light"><div class="dot"></div></div><div><div class="verdict">' + esc(r.headline) + '</div><div class="detail">' + esc(r.detail) + '</div></div></div>' +
      '<div class="kv">' + rows.map(function (x) { return '<div class="k">' + x[0] + '</div><div>' + x[1] + '</div>'; }).join('') + '</div>';
    if (r.missing.length) html += '<div class="notes ask"><b>To give a firm answer, I need:</b><ul>' + r.missing.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>';
    var notes = r.warnings.concat(r.assumptions);
    if (notes.length) html += '<div class="notes"><b>Assumptions and flags</b><ul>' + notes.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>';
    html += '<p class="disc">' + esc(r.disclaimer) + '</p>';
    var card = $('card'); card.className = 'card'; card.innerHTML = html;
  }

  $('go').onclick = ask;
  $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask(); });
  form.addEventListener('change', function () { parsedNotes = []; parsedDepthNote = null; run(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  $('copy').onclick = function () {
    if (!last) return;
    var txt = A108.toText(last);
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { $('copied').textContent = 'Copied.'; }, function () {
      var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); $('copied').textContent = 'Copied.'; } catch (e) { $('copied').textContent = 'Copy failed'; }
      ta.remove();
    });
    setTimeout(function () { $('copied').textContent = ''; }, 2000);
  };
  $('print').onclick = function () { window.print(); };
})();
