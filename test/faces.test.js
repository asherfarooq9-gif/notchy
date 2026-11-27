const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadFaces, MAX_FACE_BYTES, checkTracedSvg, loadTracedFaces, MAX_TRACED_BYTES } = require('../lib/faces');
const Heroes = require('../renderer/heroes.js');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'notchy-faces-'));

test('a missing faces folder just means no faces', () => {
  assert.deepStrictEqual(loadFaces(path.join(tempDir(), 'nope'), ['thor']), { faces: {}, problems: [] });
});

test('a real PNG for a known hero becomes a picture the pages can show', () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, 'thor.png'), PNG);
  fs.writeFileSync(path.join(dir, 'galactus.png'), PNG);
  const { faces, problems } = loadFaces(dir, ['thor', 'hulk']);
  assert.deepStrictEqual(Object.keys(faces), ['thor'], 'unknown heroes and missing files are left out');
  assert.strictEqual(faces.thor, 'data:image/png;base64,' + PNG.toString('base64'));
  assert.deepStrictEqual(problems, []);
});

test('a file that is not a PNG, or is too large, is skipped with a reason', () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, 'hulk.png'), Buffer.from('<svg onload="x()">'));
  fs.writeFileSync(path.join(dir, 'joker.png'), Buffer.concat([PNG, Buffer.alloc(MAX_FACE_BYTES)]));
  const { faces, problems } = loadFaces(dir, ['hulk', 'joker']);
  assert.deepStrictEqual(faces, {});
  assert.strictEqual(problems.length, 2);
  assert.match(problems.join(' '), /hulk\.png/);
  assert.match(problems.join(' '), /joker\.png/);
});

const TRACED = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generator: visioncortex VTracer 0.6.12 -->\n<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="360" height="360">\n'
  + '<path d="M0 0 C0.8 -0 1.6 -0 2.5 -0 L4 4 Z " fill="#5EA023" transform="translate(145.3,-0.3)"/>\n'
  + '<path d="M0 0 C1.3 0 2.6 0 4 0 Z " fill="#020F06" transform="translate(286,160)"/>\n'
  + '<path d="" fill="#181B1C" transform="translate(0,0)"/>\n</svg>\n'; // the tracer leaves empty shapes like the last one

test('a traced face drawing is rebuilt from its shapes only, scaled to the face box', () => {
  const drawing = checkTracedSvg(TRACED);
  assert.match(drawing, /^<svg x="0" y="0" width="24" height="24" viewBox="0 0 360 360">/);
  const notchCss = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'style.css'), 'utf8');
  assert.ok(!drawing.includes('<g') || !notchCss.includes('.hero g'), 'the notch hides <g> inside the face, so a traced face must not use one');
  assert.strictEqual((drawing.match(/<path /g) || []).length, 2);
  assert.ok(drawing.includes('fill="#5EA023"') && drawing.includes('translate(286,160)'));
});

test('a traced file with anything other than plain shapes is refused', () => {
  const bad = [
    TRACED.replace('</svg>', '<script>alert(1)</script></svg>'),
    TRACED.replace('fill="#5EA023"', 'fill="url(javascript:x)"'),
    TRACED.replace('<path d="M0 0 C1.3', '<path onload="x()" d="M0 0 C1.3'),
    TRACED.replace('width="360"', 'width="0"'),
    '<svg width="360" height="360"></svg>',
  ];
  for (const text of bad) assert.throws(() => checkTracedSvg(text));
});

test('traced faces load from the folder; a bad or huge file is skipped with a reason', () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, 'thor.svg'), TRACED);
  fs.writeFileSync(path.join(dir, 'hulk.svg'), TRACED.replace('</svg>', '<script/></svg>'));
  fs.writeFileSync(path.join(dir, 'joker.svg'), TRACED + ' '.repeat(MAX_TRACED_BYTES));
  const { faces, problems } = loadTracedFaces(dir, ['thor', 'hulk', 'joker', 'batman']);
  assert.deepStrictEqual(Object.keys(faces), ['thor']);
  assert.strictEqual(problems.length, 2);
});

test('a hero with a traced face shows it, without the drawn eyes, ahead of photos and drawings', () => {
  const drawing = checkTracedSvg(TRACED);
  Heroes.setTraced({ thor: drawing, nobody: drawing });
  assert.ok(Heroes.hasTraced('thor') && !Heroes.hasTraced('nobody'));
  const picture = Heroes.markup('thor');
  assert.ok(picture.includes('fill="#5EA023"') && !picture.includes('<rect x="'), 'traced shapes, no drawn eyes');
  Heroes.setTraced({});
  assert.ok(!Heroes.markup('thor').includes('#5EA023'));
});

test('the notch never shows the face pictures: it keeps the animated drawings', () => {
  const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
  assert.ok(!read('renderer/app.js').includes('loadPhotos'), 'the notch page does not fetch the pictures');
  assert.ok(!read('preload.js').includes('faces:list'), 'the notch window cannot even ask for them');
});

test('a hero with a picture shows it round, without the drawn eyes; without one, the drawing comes back', () => {
  const url = 'data:image/png;base64,' + PNG.toString('base64');
  Heroes.setPhotos({ thor: url, hulk: 'javascript:alert(1)' });
  assert.ok(Heroes.hasPhoto('thor'));
  assert.ok(!Heroes.hasPhoto('hulk'), 'only PNG data pictures are accepted');
  assert.ok(!Heroes.hasPhoto('nobody'));
  const picture = Heroes.markup('thor');
  assert.ok(picture.includes('<image') && picture.includes(url) && picture.includes('clip-path'));
  assert.ok(!picture.includes('<rect x="'), 'no drawn eyes over the photo');
  Heroes.setPhotos({});
  assert.ok(!Heroes.markup('thor').includes('<image'));
});
