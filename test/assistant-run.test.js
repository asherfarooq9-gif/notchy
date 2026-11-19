const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createResolver } = require('../lib/assistant-paths');
const { createRunner, uniquePath } = require('../lib/assistant-run');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-run-'));
const downloads = path.join(home, 'Downloads');
const documents = path.join(home, 'Documents');
const outside = path.join(home, 'Secrets');
for (const dir of [downloads, documents, outside]) fs.mkdirSync(dir);
test.after(() => fs.rmSync(home, { recursive: true, force: true }));

const resolver = createResolver({ Downloads: downloads, Documents: documents });
const touch = (file, text = 'x') => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return file; };
function setup() {
  const trashed = []; const opened = []; const urls = [];
  const runner = createRunner({
    resolver, trashItem: async (p) => { trashed.push(p); fs.rmSync(p, { recursive: true, force: true }); },
    openPath: async (p) => { opened.push(p); return p.endsWith('broken.txt') ? 'no app' : ''; }, openExternal: async (u) => { urls.push(u); },
  });
  return { runner, trashed, opened, urls };
}
const fresh = (name) => path.join(downloads, name + '-' + Math.random().toString(36).slice(2, 7));

test('make a folder, move a file in, rename it, copy it, then undo everything', async () => {
  const { runner, trashed } = setup();
  const base = fresh('t1');
  const file = touch(path.join(base, 'invoice.pdf'), 'data');
  const steps = [
    { op: 'makeFolder', abs: path.join(base, 'Invoices'), text: 'a' },
    { op: 'move', fromAbs: file, toAbs: path.join(base, 'Invoices'), text: 'b' },
    { op: 'rename', abs: path.join(base, 'Invoices', 'invoice.pdf'), newName: 'march.pdf', text: 'c' },
    { op: 'copy', fromAbs: path.join(base, 'Invoices', 'march.pdf'), toAbs: documents, text: 'd' },
  ];
  const { results, undo, stopped } = await runner.run(steps);
  assert.deepStrictEqual(results.map((r) => r.ok), [true, true, true, true]);
  assert.strictEqual(stopped, false);
  assert.strictEqual(fs.readFileSync(path.join(base, 'Invoices', 'march.pdf'), 'utf8'), 'data');
  assert.ok(fs.existsSync(path.join(documents, 'march.pdf')));
  assert.strictEqual(undo.length, 4);

  const outcome = await runner.undo(undo);
  assert.deepStrictEqual([outcome.undone, outcome.skipped.length], [4, 0]);
  assert.ok(fs.existsSync(file), 'the file is back where it started');
  assert.ok(!fs.existsSync(path.join(base, 'Invoices')), 'the empty folder is gone');
  assert.deepStrictEqual(trashed, [path.join(documents, 'march.pdf')], 'the copy went to the Recycle Bin');
});
test('a name that is taken never gets overwritten: it becomes "name (2)"', async () => {
  const { runner } = setup();
  const base = fresh('t2');
  const keep = touch(path.join(base, 'Dest', 'a.txt'), 'old');
  const mover = touch(path.join(base, 'a.txt'), 'new');
  const { results } = await runner.run([{ op: 'move', fromAbs: mover, toAbs: path.join(base, 'Dest'), text: 'm' }]);
  assert.strictEqual(results[0].ok, true);
  assert.strictEqual(fs.readFileSync(keep, 'utf8'), 'old', 'the existing file is untouched');
  assert.strictEqual(fs.readFileSync(path.join(base, 'Dest', 'a (2).txt'), 'utf8'), 'new');
  assert.strictEqual(path.basename(await uniquePath(fs.promises, path.join(base, 'Dest'), 'a.txt')), 'a (3).txt');
});
test('it stops at the first problem and says what is skipped', async () => {
  const { runner } = setup();
  const base = fresh('t3');
  const good = touch(path.join(base, 'good.txt'));
  const { results } = await runner.run([
    { op: 'makeFolder', abs: path.join(base, 'X'), text: '1' },
    { op: 'move', fromAbs: path.join(base, 'missing.txt'), toAbs: path.join(base, 'X'), text: '2' },
    { op: 'move', fromAbs: good, toAbs: path.join(base, 'X'), text: '3' },
  ]);
  assert.deepStrictEqual(results.map((r) => r.ok), [true, false, null]);
  assert.match(results[1].text, /no longer there/);
  assert.match(results[2].text, /Skipped/);
  assert.ok(fs.existsSync(good), 'the later step did not run');
});
test('the stop button halts between steps', async () => {
  const { runner } = setup();
  const base = fresh('t4');
  let calls = 0;
  const { results, stopped } = await runner.run(['A', 'B', 'C'].map((n) => ({ op: 'makeFolder', abs: path.join(base, n), text: n })), { isStopped: () => ++calls > 1 });
  assert.strictEqual(stopped, true);
  assert.deepStrictEqual(results.map((r) => r.ok), [true, null, null]);
  assert.match(results[1].text, /Stopped/);
});
test('a forged step that points outside the allowed folders is refused (the second lock)', async () => {
  const { runner, trashed } = setup();
  const secret = touch(path.join(outside, 'passwords.txt'));
  const forged = [
    { op: 'trash', abs: secret, text: 't' },
    { op: 'move', fromAbs: secret, toAbs: downloads, text: 'm' },
    { op: 'makeFolder', abs: path.join(outside, 'New'), text: 'f' },
    { op: 'rename', abs: secret, newName: 'x.txt', text: 'r' },
    { op: 'copy', fromAbs: secret, toAbs: downloads, text: 'c' },
    { op: 'move', fromAbs: path.join(downloads, '..', 'Secrets', 'passwords.txt'), toAbs: downloads, text: 'dots' },
  ];
  for (const step of forged) {
    const { results } = await runner.run([step]);
    assert.strictEqual(results[0].ok, false, step.text);
    assert.match(results[0].text, /outside the folders/, step.text);
  }
  assert.ok(fs.existsSync(secret));
  assert.deepStrictEqual(trashed, []);
  assert.ok(!fs.existsSync(path.join(outside, 'New')));
});
test('a whole allowed folder can be a destination but never a source', async () => {
  const { runner } = setup();
  const file = touch(path.join(downloads, 'dest-test-' + Math.random().toString(36).slice(2, 6) + '.txt'));
  assert.strictEqual((await runner.run([{ op: 'move', fromAbs: file, toAbs: documents, text: 'ok' }])).results[0].ok, true);
  assert.strictEqual((await runner.run([{ op: 'trash', abs: downloads, text: 'no' }])).results[0].ok, false);
  assert.strictEqual((await runner.run([{ op: 'move', fromAbs: documents, toAbs: downloads, text: 'no' }])).results[0].ok, false);
});
test('Recycle Bin and open steps call the right helpers; programs and bad addresses are refused', async () => {
  const { runner, trashed, opened, urls } = setup();
  const base = fresh('t7');
  const doc = touch(path.join(base, 'old.txt'));
  const exe = touch(path.join(base, 'setup.exe'));
  const broken = touch(path.join(base, 'broken.txt'));
  const { results, undo } = await runner.run([{ op: 'trash', abs: doc, text: 'bin' }]);
  assert.strictEqual(results[0].ok, true);
  assert.deepStrictEqual(trashed, [doc]);
  assert.deepStrictEqual(undo, [], 'the program cannot undo a Recycle Bin move');
  assert.strictEqual((await runner.run([{ op: 'open', abs: exe, text: 'x' }])).results[0].ok, false);
  assert.strictEqual((await runner.run([{ op: 'open', abs: broken, text: 'x' }])).results[0].ok, false);
  assert.deepStrictEqual(opened, [broken], 'the program was never handed to the system');
  assert.strictEqual((await runner.run([{ op: 'openUrl', url: 'https://example.com/a', text: 'u' }])).results[0].ok, true);
  assert.strictEqual((await runner.run([{ op: 'openUrl', url: 'file:///C:/Windows', text: 'u' }])).results[0].ok, false);
  assert.strictEqual((await runner.run([{ op: 'format', text: 'u' }])).results[0].ok, false);
  assert.deepStrictEqual(urls, ['https://example.com/a']);
});
test('undo is careful: it skips what got in the way, never forces, and leaves non-empty folders', async () => {
  const { runner } = setup();
  const base = fresh('t8');
  const a = touch(path.join(base, 'a.txt'));
  const b = touch(path.join(base, 'b.txt'));
  const { undo } = await runner.run([
    { op: 'makeFolder', abs: path.join(base, 'Box'), text: '1' },
    { op: 'move', fromAbs: a, toAbs: path.join(base, 'Box'), text: '2' },
    { op: 'move', fromAbs: b, toAbs: path.join(base, 'Box'), text: '3' },
  ]);
  touch(a, 'someone made a new a.txt'); // the old place is taken now
  fs.rmSync(path.join(base, 'Box', 'b.txt')); // and b.txt was deleted by hand
  touch(path.join(base, 'Box', 'extra.txt')); // and the folder has something new in it
  const outcome = await runner.undo(undo);
  assert.strictEqual(outcome.undone, 0);
  assert.strictEqual(outcome.skipped.length, 3);
  assert.strictEqual(fs.readFileSync(a, 'utf8'), 'someone made a new a.txt', 'nothing was overwritten');
  assert.ok(fs.existsSync(path.join(base, 'Box', 'a.txt')) && fs.existsSync(path.join(base, 'Box', 'extra.txt')));
});
