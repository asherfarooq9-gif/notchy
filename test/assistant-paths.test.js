const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { createResolver, checkSegment } = require('../lib/assistant-paths');

const home = path.resolve('C:/Users/tester');
const roots = { Downloads: path.join(home, 'Downloads'), Documents: path.join(home, 'Documents'), Desktop: path.join(home, 'Desktop') };
const r = createResolver(roots);

test('a path inside an allowed folder resolves to a real path', () => {
  const ok = r.resolve('Downloads/Invoices/a.pdf');
  assert.deepStrictEqual([ok.ok, ok.abs, ok.root, ok.isRoot], [true, path.join(roots.Downloads, 'Invoices', 'a.pdf'), 'Downloads', false]);
  assert.strictEqual(r.resolve('downloads\\Invoices').abs, path.join(roots.Downloads, 'Invoices'), 'any case, either slash');
  assert.strictEqual(r.resolve('Documents/').isRoot, true, 'a folder itself');
  assert.strictEqual(r.resolve('Desktop/New folder/').abs, path.join(roots.Desktop, 'New folder'));
});
test('anything that leaves the allowed folders is refused', () => {
  const bad = ['Downloads/../Windows', '../Windows', 'C:/Windows/System32', 'C:\\Users\\tester\\Downloads\\a', '/etc/passwd', '\\\\server\\share\\x', '//server/share', 'Downloads/..', 'Downloads/./a', 'Pictures/a', 'Program Files/x', '', '   ', 'Downloads//a', 'Downloads/a/../../b'];
  for (const spec of bad) assert.strictEqual(r.resolve(spec).ok, false, JSON.stringify(spec));
  for (const notText of [null, undefined, 5, {}, []]) assert.strictEqual(r.resolve(notText).ok, false);
});
test('odd file names are refused', () => {
  for (const name of ['a<b', 'a>b', 'a:b', 'a"b', 'a|b', 'a?b', 'a*b', 'a\u0007b', 'trailing.', 'trailing ', 'CON', 'nul.txt', 'COM1', 'lpt9.log', 'x'.repeat(121)]) {
    assert.ok(checkSegment(name), JSON.stringify(name));
    assert.strictEqual(r.resolve('Downloads/' + name).ok, false, JSON.stringify(name));
  }
  for (const name of ['Report 2026.pdf', 'résumé.docx', 'a.b.c', '.hidden', 'console.txt', 'com10']) assert.strictEqual(checkSegment(name), null, name);
  assert.strictEqual(r.resolve('Downloads/' + 'a/'.repeat(200)).ok, false, 'too long overall');
});
test('contains() is a second check on real paths, and display() shows friendly paths', () => {
  assert.ok(r.contains(path.join(roots.Downloads, 'a', 'b.txt')));
  assert.ok(!r.contains(roots.Downloads), 'the folder itself is not inside itself');
  assert.ok(!r.contains(path.join(home, 'Downloads-evil', 'x')), 'a look-alike folder name');
  assert.ok(!r.contains(path.join(home, 'AppData', 'x')));
  assert.ok(!r.contains(path.join(roots.Downloads, '..', 'Secrets', 'x')));
  assert.strictEqual(r.display(path.join(roots.Documents, 'Work', 'plan.md')), 'Documents/Work/plan.md');
  assert.deepStrictEqual(r.rootNames(), ['Downloads', 'Documents', 'Desktop']);
});
