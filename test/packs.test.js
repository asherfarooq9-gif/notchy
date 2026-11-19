const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkPack, loadPacks, MAX_PACKS } = require('../lib/packs');

const good = () => ({
  name: 'Sunny',
  a: '#d97706', b: '#2563eb', ink: '#000000',
  shapes: [{ d: 'M12 2C6 2 3 7 3 12S7 22 12 22 21 17 21 12 18 2 12 2Z', fill: '#fbbf24' }, { d: 'M8 16Q12 19 16 16', fill: 'none', stroke: '#7c2d12' }],
  eyes: { cx: [8, 16], y: 10, w: 3, h: 2, color: '#ffffff', tilt: 0 },
});

test('a good pack becomes a look with readable text colors and a drawing', () => {
  const look = checkPack(good(), 'sunny');
  assert.strictEqual(look.id, 'pack-sunny');
  assert.strictEqual(look.label, 'Sunny');
  assert.ok(look.isPack && look.isHero);
  assert.ok(look.textLight && look.textDark && look.accent === '#d97706');
  assert.ok(look.drawing.includes('<path') && look.drawing.includes('fill="#fbbf24"'));
  assert.deepStrictEqual(look.eyes.cx, [8, 16]);
});
test('a pack without eyes is fine', () => {
  const raw = good(); delete raw.eyes;
  assert.strictEqual(checkPack(raw, 'x').eyes, null);
});
test('anything unsafe or odd is refused with a plain sentence', () => {
  const bad = (change) => { const raw = good(); change(raw); return () => checkPack(raw, 'x'); };
  const cases = [
    bad((r) => { r.name = ''; }),
    bad((r) => { r.name = 'x'.repeat(31); }),
    bad((r) => { r.name = '<b>hi</b>'; }),
    bad((r) => { r.a = 'red'; }),
    bad((r) => { r.b = '#12345'; }),
    bad((r) => { r.ink = '#d97706'; }), // unreadable on its own main color
    bad((r) => { r.shapes = []; }),
    bad((r) => { r.shapes = Array(13).fill(r.shapes[0]); }),
    bad((r) => { r.shapes[0].d = 'M0 0 L1 1 <script>'; }),
    bad((r) => { r.shapes[0].d = 'M0 0 url(http://evil)'; }),
    bad((r) => { r.shapes[0].d = 'M' + '1 '.repeat(400); }),
    bad((r) => { r.shapes[0].d = 'M99999 0L1 1'; }),
    bad((r) => { r.shapes[0].fill = 'url(#x)'; }),
    bad((r) => { r.shapes[0].fill = 'red" onload="x'; }),
    bad((r) => { r.shapes[1].stroke = 'javascript:1'; }),
    bad((r) => { r.eyes.cx = [1]; }),
    bad((r) => { r.eyes.w = 99; }),
    bad((r) => { r.eyes.color = 'blue'; }),
    () => checkPack(null, 'x'),
    () => checkPack('text', 'x'),
    () => checkPack([], 'x'),
  ];
  for (const run of cases) assert.throws(run, (e) => e instanceof Error && e.message.length > 5);
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-packs-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('loading a folder keeps good packs, skips bad ones and says why', () => {
  fs.writeFileSync(path.join(dir, 'sunny.json'), JSON.stringify(good()));
  fs.writeFileSync(path.join(dir, 'Broken One.json'), '{ not json');
  fs.writeFileSync(path.join(dir, 'bad.json'), JSON.stringify({ ...good(), a: 'red' }));
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignore me');
  fs.writeFileSync(path.join(dir, 'huge.json'), 'x'.repeat(30 * 1024));
  const { packs, problems } = loadPacks(dir);
  assert.deepStrictEqual(packs.map((p) => p.id), ['pack-sunny']);
  assert.strictEqual(problems.length, 3);
  assert.ok(problems.every((p) => /\.json/.test(p)));
});
test('a missing folder is just no packs, and the count is capped', () => {
  assert.deepStrictEqual(loadPacks(path.join(dir, 'nope')), { packs: [], problems: [] });
  const many = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-many-'));
  try {
    for (let i = 0; i < MAX_PACKS + 3; i++) fs.writeFileSync(path.join(many, `p${i}.json`), JSON.stringify(good()));
    assert.strictEqual(loadPacks(many).packs.length, MAX_PACKS);
  } finally { fs.rmSync(many, { recursive: true, force: true }); }
});

test('packs past the limit are reported, and a read error is not called bad JSON', () => {
  const many = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-limit-'));
  try {
    for (let i = 0; i < MAX_PACKS + 2; i++) fs.writeFileSync(path.join(many, `p${String(i).padStart(2, '0')}.json`), JSON.stringify(good()));
    const { packs, problems } = loadPacks(many);
    assert.strictEqual(packs.length, MAX_PACKS);
    assert.strictEqual(problems.length, 1);
    assert.match(problems[0], /2 more/);
    assert.match(problems[0], new RegExp(String(MAX_PACKS)));
    const unreadable = { ...fs, readFileSync: () => { throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }); } };
    const result = loadPacks(many, unreadable);
    assert.strictEqual(result.packs.length, 0);
    assert.ok(result.problems[0].includes('could not be read'), result.problems[0]);
    assert.ok(!result.problems[0].includes('valid JSON'));
  } finally { fs.rmSync(many, { recursive: true, force: true }); }
});
