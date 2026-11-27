const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadFaces, MAX_FACE_BYTES } = require('../lib/faces');
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

test('every hero can blink on the notch: two eyelids for the bot and for the face picture, none elsewhere', () => {
  for (const table of [Heroes.LIDS, Heroes.PHOTO_LIDS]) {
    assert.deepStrictEqual(Object.keys(table).sort(), [...Heroes.ids].sort());
    for (const [id, lid] of Object.entries(table)) {
      assert.ok(lid.cx.every((x) => x > 0 && x < 24) && lid.y > 0 && lid.y < 24, `${id} eyes inside the face box`);
      assert.match(lid.color, /^#[0-9a-f]{6}$/i, id);
    }
  }
  const lids = (text) => (text.match(/class="lid"/g) || []).length;
  assert.strictEqual(lids(Heroes.markup('thor', { withLids: true })), 2, 'the bot blinks');
  assert.strictEqual(lids(Heroes.markup('thor')), 0, 'Settings and the tray show open eyes');
  Heroes.setPhotos({ thor: 'data:image/png;base64,' + PNG.toString('base64') });
  assert.strictEqual(lids(Heroes.markup('thor', { withLids: true })), 2, 'the face picture blinks too');
  Heroes.setPhotos({});
  for (const id of Heroes.ids) assert.ok((Heroes.markup(id).match(/class="eyeball"/g) || []).length >= 2, `${id} bot has two eyes`);
});

test('the notch shows your face cut-out with blinking eyelids', () => {
  const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
  assert.ok(read('renderer/app.js').includes('loadPhotos(window.notch.faces)'), 'the notch fetches your face pictures');
  assert.match(read('renderer/app.js'), /withLids: true/);
  assert.ok(read('preload.js').includes('faces:list'));
});

test('a hero with a face picture shows it, without the bot, and only PNG pictures are taken', () => {
  const url = 'data:image/png;base64,' + PNG.toString('base64');
  Heroes.setPhotos({ thor: url, hulk: 'javascript:alert(1)' });
  assert.ok(Heroes.hasPhoto('thor'));
  assert.ok(!Heroes.hasPhoto('hulk'), 'only PNG data pictures are accepted');
  assert.ok(!Heroes.hasPhoto('nobody'));
  const picture = Heroes.markup('thor');
  assert.ok(picture.includes('<image') && picture.includes(url) && !picture.includes('class="eyeball"'));
  assert.ok(!picture.includes('<rect x="'), 'no drawn eyes over the photo');
  Heroes.setPhotos({});
  assert.ok(!Heroes.markup('thor').includes('<image'));
});
