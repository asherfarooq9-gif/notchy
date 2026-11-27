const test = require('node:test');
const assert = require('node:assert');
const { inspectOle, inspectDocument } = require('../lib/doc-links');

// The old binary Word format (.doc). Word follows an attached template named inside it (checked with real Word), and the
// address is stored as plain or UTF-16 text. These buffers only need the file's first 8 bytes and the text: the check never
// parses the file, it looks for addresses. Each backslash below is written twice because this is JavaScript text.
const MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const padding = (n) => Buffer.alloc(n, 0x41);
const oleWith = (...parts) => Buffer.concat([MAGIC, padding(37), ...parts.flatMap((p) => [p, padding(11)])]);
const plain = (text) => Buffer.from(text, 'latin1');
const wide = (text) => Buffer.from(text, 'utf16le');

test('a web address or network share named inside an old .doc is found, in plain or UTF-16 text', () => {
  for (const make of [plain, wide]) {
    assert.strictEqual(inspectOle(oleWith(make('http://evil.example/t.dot'))).links.length, 1);
    assert.strictEqual(inspectOle(oleWith(make('https://evil.example/t.dot'))).links.length, 1);
    assert.strictEqual(inspectOle(oleWith(make('\\\\evil\\share\\t.dot'))).links.length, 1, 'a network share');
    assert.strictEqual(inspectOle(oleWith(make('file://evil/share/t.dot'))).links.length, 1);
  }
});

test('the harmless vendor addresses every Word file carries are ignored', () => {
  const benign = 'http://schemas.openxmlformats.org/drawingml/2006/main"';
  assert.deepStrictEqual(inspectOle(oleWith(plain(benign))), { isOle: true, links: [] });
  assert.deepStrictEqual(inspectOle(oleWith(wide(benign))), { isOle: true, links: [] });
  assert.deepStrictEqual(inspectOle(oleWith(plain('http://schemas.microsoft.com/office/word/2003/wordml'), plain('http://www.w3.org/1999/xhtml'))).links, []);
});

test('a look-alike address does not get the same pass', () => {
  assert.strictEqual(inspectOle(oleWith(plain('http://schemas.microsoft.com.evil.example/x'))).links.length, 1);
  assert.strictEqual(inspectOle(oleWith(plain('http://schemas.microsoft.com@evil.example/x'))).links.length, 1);
  assert.strictEqual(inspectOle(oleWith(plain('http://www.w3.org.evil.example/'))).links.length, 1);
});

test('an address cut in two by the edge of a scan window is still found', () => {
  const address = plain('http://evil.example/t.dot');
  const hasWhole = (result) => result.links.some((link) => link.target === 'http://evil.example/t.dot'); // a cut piece may also show up, shorter
  let missedWithoutOverlap = 0;
  for (let shift = 0; shift < 64; shift++) {
    const file = Buffer.concat([MAGIC, Buffer.alloc(shift + 100), address, Buffer.alloc(300)]); // zero bytes end an address, as in a real file
    assert.ok(hasWhole(inspectOle(file, { windowBytes: 64, overlapBytes: 60 })), `shift ${shift}`);
    if (!hasWhole(inspectOle(file, { windowBytes: 64, overlapBytes: 0 }))) missedWithoutOverlap += 1;
  }
  assert.ok(missedWithoutOverlap > 0, 'the test really does cut addresses in two when pieces do not overlap');
});

test('an old .doc with no addresses is clean, and a file that is not old-format Word is not called one', () => {
  assert.deepStrictEqual(inspectOle(oleWith(plain('just some words'))), { isOle: true, links: [] });
  assert.deepStrictEqual(inspectOle(Buffer.from('http://evil.example/ but no magic')), { isOle: false, links: [] });
  assert.deepStrictEqual(inspectOle(Buffer.alloc(0)), { isOle: false, links: [] });
});

test('the entry point treats it as an old-format file', () => {
  const found = inspectDocument(oleWith(wide('http://evil.example/t.dot')));
  assert.strictEqual(found.kind, 'ole');
  assert.strictEqual(found.links.length, 1);
  assert.strictEqual(inspectDocument(oleWith(plain('hello'))).links.length, 0);
});

test('the bytes under test really contain a double backslash (guards against this file losing its backslashes)', () => {
  assert.strictEqual('\\\\evil'.length, 6);
  assert.strictEqual('\\\\evil'.charCodeAt(0), 92);
});
