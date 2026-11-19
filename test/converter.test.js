const test = require('node:test');
const assert = require('node:assert');
const { buildIco, buildPdf, pngSize, jpegSize } = require('../lib/image-files');
const { uniqueOutputPath } = require('../lib/paths');
const { squeezeToSize } = require('../renderer/panel/squeeze');

// Real tiny pictures: a 1x1 PNG and a 2x1 JPEG header with just enough blocks to read its size.
const png = (w, h) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const jpeg = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]);

test('picture sizes are read, and impostors are refused', () => {
  assert.deepStrictEqual(pngSize(png(64, 32)), { width: 64, height: 32 });
  assert.deepStrictEqual(jpegSize(jpeg(300, 200)), { width: 300, height: 200 });
  assert.throws(() => pngSize(Buffer.from('hello world, not a picture at all')), /not a PNG/);
  assert.throws(() => jpegSize(Buffer.from('nope')), /not a JPEG/);
});
test('an icon file holds every picture with the right table', () => {
  const ico = buildIco([png(16, 16), png(256, 256)]);
  assert.strictEqual(ico.readUInt16LE(2), 1);
  assert.strictEqual(ico.readUInt16LE(4), 2);
  assert.strictEqual(ico[6], 16);
  assert.strictEqual(ico[6 + 16], 0); // 256 is stored as 0
  const secondOffset = ico.readUInt32LE(6 + 16 + 12);
  assert.ok(ico.subarray(secondOffset, secondOffset + 8).equals(png(256, 256).subarray(0, 8)));
  assert.strictEqual(ico.length, 6 + 32 + 33 + 33);
  assert.throws(() => buildIco([png(512, 512)]), /256/);
  assert.throws(() => buildIco([]), /no pictures/);
});
test('a PDF has a correct address table, one page per picture, sized to the picture', () => {
  const pdf = buildPdf([jpeg(400, 200), jpeg(100, 100)]);
  const text = pdf.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4') && text.trimEnd().endsWith('%%EOF'));
  assert.match(text, /\/Count 2/);
  assert.match(text, /\/MediaBox \[0 0 300 150\]/); // 400 x 200 px = 300 x 150 pt
  const table = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.ok(text.slice(table).startsWith('xref'));
  // every listed object really starts where the table says
  const lines = text.slice(table).split('\n').slice(3, 3 + 8);
  lines.forEach((line, i) => assert.ok(text.slice(Number(line.slice(0, 10))).startsWith(`${i + 1} 0 obj`), `object ${i + 1}`));
  assert.throws(() => buildPdf([]), /no pictures/);
  assert.throws(() => buildPdf([Buffer.from('x')]), /not a JPEG/);
});
test('converted files get a new name and never overwrite', () => {
  const taken = new Set();
  const exists = (p) => taken.has(p);
  const first = uniqueOutputPath('C:\\p', 'Photo.png', 'jpg', exists);
  assert.ok(first.endsWith('Photo (converted).jpg'));
  taken.add(first);
  assert.ok(uniqueOutputPath('C:\\p', 'Photo.png', 'jpg', exists).endsWith('Photo (converted 2).jpg'));
  assert.ok(uniqueOutputPath('C:\\p', 'a<b>.png', 'png', exists).endsWith('a_b_ (converted).png'));
});
test('squeezing keeps the best quality that fits, and shrinks only when it must', async () => {
  const fake = (q, s) => ({ length: Math.round(1000 * q * s * s) });
  const easy = await squeezeToSize(async (q, s) => fake(q, s), 2000);
  assert.deepStrictEqual([easy.quality, easy.scale], [0.95, 1]);
  const medium = await squeezeToSize(async (q, s) => fake(q, s), 600);
  assert.strictEqual(medium.scale, 1);
  assert.ok(medium.bytes.length <= 600 && medium.quality < 0.95 && medium.quality >= 0.3);
  const hard = await squeezeToSize(async (q, s) => fake(q, s), 100);
  assert.ok(hard.scale < 1 && hard.bytes.length <= 100);
  assert.strictEqual(await squeezeToSize(async () => ({ length: 5000 }), 100), null);
});
test('a picture type with no quality setting is only shrunk', async () => {
  const seen = [];
  const result = await squeezeToSize(async (q, s) => { seen.push(q); return { length: Math.round(1000 * s * s) }; }, 300, { usesQuality: false });
  assert.ok(result.scale < 1 && result.bytes.length <= 300);
  assert.ok(seen.every((q) => q === 0.95));
});

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createConverterService } = require('../lib/converter-service');

test('saving puts the file next to the original, never overwrites, and only reveals what it made', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-conv-'));
  try {
    const service = createConverterService();
    const source = path.join(dir, 'Photo.png');
    fs.writeFileSync(source, 'original');
    const first = service.save({ kind: 'jpg', sourcePath: source, parts: [jpeg(10, 10)] });
    const second = service.save({ kind: 'jpg', sourcePath: source, parts: [jpeg(10, 10)] });
    assert.strictEqual(first.name, 'Photo (converted).jpg');
    assert.strictEqual(second.name, 'Photo (converted 2).jpg');
    assert.strictEqual(fs.readFileSync(source, 'utf8'), 'original');
    assert.ok(service.canReveal(first.path));
    assert.strictEqual(service.canReveal(source), false);
    assert.ok(service.save({ kind: 'pdf', sourcePath: source, parts: [jpeg(40, 20)] }).name.endsWith('.pdf'));
    assert.ok(service.save({ kind: 'ico', sourcePath: source, parts: [png(16, 16), png(32, 32)] }).size > 100);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('saving refuses wrong types, relative places and empty pictures', () => {
  const service = createConverterService();
  const abs = path.join(os.tmpdir(), 'x.png');
  assert.throws(() => service.save({ kind: 'exe', sourcePath: abs, parts: [Buffer.from('x')] }), /Unknown/);
  assert.throws(() => service.save({ kind: 'png', sourcePath: 'x.png', parts: [png(1, 1)] }), /where the original/);
  assert.throws(() => service.save({ kind: 'png', sourcePath: abs, parts: [Buffer.alloc(0)] }), /empty/);
  assert.throws(() => service.save({ kind: 'png', sourcePath: abs, parts: [jpeg(2, 2)] }), /not a PNG/);
});
test('saving refuses network shares and things that are not byte data, before copying anything', () => {
  const service = createConverterService();
  const local = path.join(os.tmpdir(), 'a.png');
  assert.throws(() => service.save({ kind: 'png', sourcePath: '\\\\host\\share\\a.png', parts: [png(1, 1)] }), /network share/);
  assert.throws(() => service.save({ kind: 'png', sourcePath: local, parts: [{ length: 4e9 }] }), /not valid data/);
  assert.throws(() => service.save({ kind: 'png', sourcePath: local, parts: ['text'] }), /not valid data/);
});
