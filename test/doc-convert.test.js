const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDocConverter, routeFor } = require('../lib/doc-convert');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-doc-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
const touch = (name, text = 'x') => { const p = path.join(dir, name); fs.writeFileSync(p, text); return p; };

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
  assert.strictEqual(fs.readFileSync(source, 'utf8'), 'x', 'the original is untouched');
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
