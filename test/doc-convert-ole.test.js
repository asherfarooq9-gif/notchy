const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDocConverter } = require('../lib/doc-convert');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-ole-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const oldDoc = (...texts) => Buffer.concat([MAGIC, Buffer.alloc(64), ...texts.flatMap((t) => [Buffer.from(t, 'utf16le'), Buffer.alloc(8)])]);
const touch = (name, content) => { const p = path.join(dir, name); fs.writeFileSync(p, content); return p; };

function setup() {
  const calls = [];
  const execFileImpl = (file, args, options, done) => { calls.push(args); fs.writeFileSync(args[args.indexOf('-Out') + 1], 'converted'); done(null, '', ''); };
  return { converter: createDocConverter({ execFileImpl }), calls };
}

test('an old .doc that names a remote template or a network share is refused before Word is started', async () => {
  const { converter, calls } = setup();
  for (const [name, text] of [['remote.doc', 'http://evil.example/t.dot'], ['share.doc', '\\\\evil\\share\\t.dot']]) {
    await assert.rejects(() => converter.convert({ sourcePath: touch(name, oldDoc(text)), to: 'pdf' }), /older \.doc.*save it as a \.docx/i, name);
  }
  assert.strictEqual(calls.length, 0);
});

test('an old .doc with only the usual Word addresses converts as before', async () => {
  const { converter, calls } = setup();
  const usual = oldDoc('http://schemas.openxmlformats.org/drawingml/2006/main"');
  assert.strictEqual((await converter.convert({ sourcePath: touch('usual.doc', usual), to: 'pdf' })).name, 'usual (converted).pdf');
  assert.strictEqual(calls.length, 1);
});

test('the advice works: the same text saved as a .docx with an ordinary web link converts', async () => {
  const { converter } = setup();
  const { buildDocx, outside } = require('./zip-builder');
  const resaved = touch('resaved.docx', buildDocx([outside('rId1', 'hyperlink', 'http://example.com/page')]));
  assert.strictEqual((await converter.convert({ sourcePath: resaved, to: 'pdf' })).name, 'resaved (converted).pdf');
});
