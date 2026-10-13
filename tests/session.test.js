// Regression tests: every question asked in the 12 Oct 2026 test session, in the user's own words.
// Run with: npm test   (Node 18+, no dependencies)
const test = require('node:test');
const assert = require('node:assert/strict');
const A108 = require('../site/engine.js');
const { parse } = require('../site/parse.js');

function ask(q) { return A108.evaluate(parse(q)); }

const cases = [
  { q: 'for 1018 steel whats the max depth of surface for size 1/2 inch', verdict: 'limit', limit: 0.008 },
  { q: 'how about 1045 rd 1 inch', verdict: 'limit', limit: 0.016 },
  { q: 'for 1215 rd 1 inch, its measuring at 0.018 in', verdict: 'within', limit: 0.024 },
  { q: 'i have 1018 round cold drawn steel of 1-inch diameter which has a surface defect of 20 thousandths of an inch. Is this acceptable per ASTM?', verdict: 'exceeds', limit: 0.016 },
  { q: 'what is the acceptability of a 1/8th inch  surface defect in a resulfurized carbon and alloy 10% sulfur of 1 inch diameter round bar', verdict: 'exceeds', limit: 0.020 },
  { q: 'i got a 1 inch defect in a steel bar, is that acceptable?', verdict: 'hold' },
  { q: "I have 1-inch round material which is 1045 grade, and there is a defect about 20,000 deep. Let me know if it's acceptable or not.", verdict: 'exceeds', limit: 0.016 },
  { q: 'How about if I have a material 1-1/16-15, and the surface depth is at 16 thousandths deep? This is 1-1/16-15, the grade is 1-1/16-15, and the size is 1 in. Will this be acceptable?', verdict: 'within' },
  { q: "There is a surface defect about 40,000 deep, and its size is 1.5 inches round, but I don't know the grade. Can you tell me whether this will be acceptable or not?", verdict: 'exceeds' },
  { q: "How about there is a material which has a depth of 32 thousandths  but I don't have the grade. The size is 1.5 diameter. Can you tell me  it is acceptable ?", verdict: 'hold' }
];

for (const c of cases) {
  test(c.q.slice(0, 70), () => {
    const r = ask(c.q);
    assert.equal(r.verdict, c.verdict, JSON.stringify({ parsed: parse(c.q), r: { h: r.headline, d: r.detail, m: r.missing } }, null, 1));
    if (c.limit !== undefined) assert.equal(Math.min(...r.perClass.map(p => p.limit)), c.limit);
    assert.ok(r.disclaimer.includes('confirm against your engineering criteria'));
  });
}

test('size outside ¼–6 in. is not specified', () => {
  assert.equal(A108.evaluate({ grade: '1018', size: 7, depth: 0.01 }).verdict, 'hold');
});
test('sulfur above 0.35 % is not specified', () => {
  assert.equal(A108.evaluate({ sulfur: 0.4, size: 1, depth: 0.01 }).verdict, 'hold');
});
test('Level 2 is Nil', () => {
  assert.equal(A108.evaluate({ grade: '1215', size: 1, depth: 0.005, level: 2 }).verdict, 'exceeds');
});
test('exactly ⅝ in. uses the fixed-inch column (no interpolation)', () => {
  const r = A108.evaluate({ grade: '1045', size: 0.625, depth: 0.009 });
  assert.equal(r.perClass[0].limit, 0.008);
  assert.equal(r.verdict, 'exceeds');
});
test('1116 sulfur range spans two columns', () => {
  const r = A108.evaluate({ grade: '1116', size: 1, depth: 0.022 });
  assert.equal(r.perClass.length, 2);
  assert.equal(r.verdict, 'hold');
});
test('leaded grade maps to base grade', () => {
  assert.equal(A108.lookupGrade('41L40').S, A108.lookupGrade('4140').S);
});
