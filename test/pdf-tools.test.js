const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { parsePages, createPdfService } = require('../lib/pdf-tools');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-pdf-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

async function makePdf(name, pages) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200 + i, 300]); // each page gets its own width, so pages can be told apart
  const file = path.join(dir, name);
  fs.writeFileSync(file, await doc.save());
  return file;
}
const widths = async (file) => (await PDFDocument.load(fs.readFileSync(file))).getPages().map((p) => Math.round(p.getWidth()));

test('page lists like "1-3,5" become page numbers, and anything odd is refused', () => {
  assert.deepStrictEqual(parsePages('1-3,5', 6), [0, 1, 2, 4]);
  assert.deepStrictEqual(parsePages(' 2 , 2 ,1 ', 3), [0, 1], 'repeats are dropped and order is page order');
  assert.deepStrictEqual(parsePages('4', 4), [3]);
  for (const bad of ['', '0', '7', '3-1', '1-', '-2', 'a', '1;2', '1-3-5', '1,,2', '99999999999', null, undefined, 5]) assert.throws(() => parsePages(bad, 6), Error, String(bad));
});
test('merging joins the pages in the order the files were given', async () => {
  const service = createPdfService();
  const a = await makePdf('a.pdf', 2); const b = await makePdf('b.pdf', 3);
  const result = await service.merge({ sourcePaths: [b, a] });
  assert.strictEqual(result.pages, 5);
  assert.strictEqual(path.dirname(result.path), dir);
  assert.deepStrictEqual(await widths(result.path), [200, 201, 202, 200, 201]);
  assert.ok(service.canReveal(result.path));
  const again = await service.merge({ sourcePaths: [a, b] });
  assert.notStrictEqual(again.path, result.path, 'a second merge never replaces the first');
});
test('splitting keeps only the chosen pages and leaves the original alone', async () => {
  const service = createPdfService();
  const src = await makePdf('five.pdf', 5);
  const before = fs.readFileSync(src);
  const result = await service.split({ sourcePath: src, pages: '2-3,5' });
  assert.deepStrictEqual(await widths(result.path), [201, 202, 204]);
  assert.ok(result.name.includes('pages'));
  assert.ok(fs.readFileSync(src).equals(before));
  await assert.rejects(() => service.split({ sourcePath: src, pages: '9' }), /page/i);
});
test('bad requests are refused with a plain sentence', async () => {
  const service = createPdfService();
  const one = await makePdf('one.pdf', 1);
  const fake = path.join(dir, 'fake.pdf'); fs.writeFileSync(fake, 'not a pdf at all');
  const notPdf = path.join(dir, 'doc.txt'); fs.writeFileSync(notPdf, 'x');
  const cases = [
    () => service.merge({ sourcePaths: [one] }),
    () => service.merge({ sourcePaths: [one, fake] }),
    () => service.merge({ sourcePaths: [one, notPdf] }),
    () => service.merge({ sourcePaths: [one, 'relative.pdf'] }),
    () => service.merge({ sourcePaths: [one, '\\\\server\\share\\x.pdf'] }),
    () => service.merge({ sourcePaths: [one, path.join(dir, 'missing.pdf')] }),
    () => service.merge({ sourcePaths: Array(31).fill(one) }),
    () => service.merge({ sourcePaths: 'x' }),
    () => service.merge({}),
    () => service.split({ sourcePath: fake, pages: '1' }),
    () => service.split({ sourcePath: notPdf, pages: '1' }),
    () => service.split({ sourcePath: one, pages: '' }),
  ];
  for (const run of cases) await assert.rejects(run, (e) => e instanceof Error && e.message.length > 5 && !/at .*\.js/.test(e.message));
});
