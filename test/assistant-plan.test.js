const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createResolver } = require('../lib/assistant-paths');
const { parseReply, validatePlan, planFacts, extractJson, MAX_STEPS } = require('../lib/assistant-plan');

// A real temporary "Downloads" and "Documents" so existence checks are honest.
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-plan-'));
const roots = { Downloads: path.join(home, 'Downloads'), Documents: path.join(home, 'Documents') };
for (const dir of Object.values(roots)) fs.mkdirSync(dir);
fs.writeFileSync(path.join(roots.Downloads, 'invoice.pdf'), 'x');
fs.writeFileSync(path.join(roots.Downloads, 'photo.jpg'), 'x');
fs.writeFileSync(path.join(roots.Downloads, 'setup.exe'), 'x');
fs.mkdirSync(path.join(roots.Downloads, 'Old'));
test.after(() => fs.rmSync(home, { recursive: true, force: true }));

const resolver = createResolver(roots);
const kindOf = (abs) => { try { return fs.statSync(abs).isDirectory() ? 'dir' : 'file'; } catch { return null; } };
const check = (steps, summary = 'Tidy up') => validatePlan({ summary, steps }, { resolver, kindOf });

test('Claude\'s reply is read whether it is clean JSON, fenced, or has a sentence around it', () => {
  assert.deepStrictEqual(parseReply('{"list":["Downloads"]}'), { kind: 'list', folders: ['Downloads'] });
  assert.deepStrictEqual(parseReply('Sure!\n```json\n{"list":["Downloads","Documents"]}\n```'), { kind: 'list', folders: ['Downloads', 'Documents'] });
  assert.strictEqual(parseReply('{"cannot":"I cannot read inside files"}').kind, 'cannot');
  assert.strictEqual(parseReply('{"summary":"x","steps":[]}').kind, 'plan');
  assert.strictEqual(parseReply('{"list":["a","b","c","d","e"]}').folders.length, 3, 'at most three folders at a time');
  for (const junk of ['', 'hello', '{broken', '[]', '{"other":1}', '{"list":[]}', '{"list":[5]}', null]) assert.strictEqual(parseReply(junk).kind, 'bad', String(junk));
  assert.strictEqual(extractJson('no json here'), null);
});
test('a good plan becomes steps with real paths and plain sentences', () => {
  const result = check([
    { op: 'makeFolder', path: 'Downloads/Invoices' },
    { op: 'move', from: 'Downloads/invoice.pdf', to: 'Downloads/Invoices' },
    { op: 'rename', path: 'Downloads/photo.jpg', newName: 'beach.jpg' },
    { op: 'copy', from: 'Downloads/beach.jpg', to: 'Documents' },
    { op: 'open', path: 'Documents/beach.jpg' },
  ]);
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.steps.length, 5);
  assert.strictEqual(result.steps[0].text, 'Make the folder Downloads/Invoices');
  assert.strictEqual(result.steps[1].text, 'Move invoice.pdf to Downloads/Invoices');
  assert.strictEqual(result.steps[1].fromAbs, path.join(roots.Downloads, 'invoice.pdf'));
  assert.strictEqual(result.steps[2].text, 'Rename photo.jpg to beach.jpg');
});
test('a later step may use what an earlier step makes, but not something that never exists', () => {
  assert.strictEqual(check([{ op: 'makeFolder', path: 'Downloads/A/B' }, { op: 'move', from: 'Downloads/invoice.pdf', to: 'Downloads/A/B' }]).ok, true);
  assert.strictEqual(check([{ op: 'move', from: 'Downloads/invoice.pdf', to: 'Downloads/Nope' }]).ok, false);
  assert.strictEqual(check([{ op: 'move', from: 'Downloads/ghost.pdf', to: 'Downloads/Old' }]).ok, false);
  assert.strictEqual(check([{ op: 'move', from: 'Downloads/invoice.pdf', to: 'Downloads/Old' }, { op: 'move', from: 'Downloads/invoice.pdf', to: 'Documents' }]).ok, false, 'the file is already gone');
});
test('steps that leave the allowed folders, or break a rule, make the whole plan invalid', () => {
  const bad = [
    { op: 'move', from: 'Downloads/invoice.pdf', to: 'Downloads/../..' },
    { op: 'trash', path: 'C:/Windows/notepad.exe' },
    { op: 'trash', path: 'Downloads' },
    { op: 'move', from: 'Downloads', to: 'Documents' },
    { op: 'rename', path: 'Downloads', newName: 'x' },
    { op: 'rename', path: 'Downloads/photo.jpg', newName: '../evil.jpg' },
    { op: 'rename', path: 'Downloads/photo.jpg', newName: 'invoice.pdf' },
    { op: 'rename', path: 'Downloads/photo.jpg', newName: 'CON' },
    { op: 'open', path: 'Downloads/setup.exe' },
    { op: 'open', path: 'Downloads/nothing.txt' },
    { op: 'openUrl', url: 'http://example.com' },
    { op: 'openUrl', url: 'https://192.168.1.1/admin' },
    { op: 'openUrl', url: 'file:///C:/Windows' },
    { op: 'run', command: 'del *.*' },
    { op: 'powershell', script: 'x' },
    { op: 'move', from: 'Downloads/Old', to: 'Downloads/Old' },
    { op: 'makeFolder', path: 'Downloads/invoice.pdf' },
    { op: 'makeFolder', path: 'Downloads' },
    'delete everything', null, 5,
  ];
  for (const step of bad) {
    const result = check([{ op: 'makeFolder', path: 'Downloads/Fine' }, step]);
    assert.strictEqual(result.ok, false, JSON.stringify(step));
    assert.ok(result.errors.some((e) => e.startsWith('Step 2')), JSON.stringify(step));
  }
});
test('a folder cannot be moved inside itself', () => {
  fs.mkdirSync(path.join(roots.Downloads, 'Old', 'Inner'), { recursive: true });
  assert.strictEqual(check([{ op: 'move', from: 'Downloads/Old', to: 'Downloads/Old/Inner' }]).ok, false);
});
test('deleting is only ever "move to the Recycle Bin", flagged as dangerous', () => {
  const result = check([{ op: 'trash', path: 'Downloads/photo.jpg' }]);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual([result.steps[0].danger, result.steps[0].text], ['trash', 'Move Downloads/photo.jpg to the Recycle Bin']);
});
test('things already in place are left alone with a note, not an error', () => {
  const result = check([{ op: 'move', from: 'Downloads/Old', to: 'Downloads' }, { op: 'makeFolder', path: 'Downloads/Old' }, { op: 'makeFolder', path: 'Downloads/New' }]);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.steps.length, 1);
  assert.strictEqual(result.warnings.length, 2);
  assert.strictEqual(check([{ op: 'makeFolder', path: 'Downloads/Old' }]).ok, false, 'nothing left to do');
});
test('plans have limits: not empty, not huge, and a short clean summary', () => {
  assert.strictEqual(check([]).ok, false);
  assert.strictEqual(check(Array.from({ length: MAX_STEPS + 1 }, (_, i) => ({ op: 'makeFolder', path: `Downloads/F${i}` }))).ok, false);
  assert.strictEqual(check(Array.from({ length: MAX_STEPS }, (_, i) => ({ op: 'makeFolder', path: `Downloads/G${i}` }))).ok, true);
  assert.strictEqual(validatePlan({ summary: 'a\n  b'.repeat(200), steps: [{ op: 'makeFolder', path: 'Downloads/S' }] }, { resolver, kindOf }).summary.length, 200);
  assert.strictEqual(validatePlan({ steps: [{ op: 'makeFolder', path: 'Downloads/T' }] }, { resolver, kindOf }).summary, 'Do the task');
  assert.strictEqual(validatePlan(null, { resolver, kindOf }).ok, false);
});
test('how a plan may be approved: voice only for a few safe steps, never with a delete', () => {
  const steps = (n, op = 'makeFolder') => Array.from({ length: n }, (_, i) => ({ op, abs: 'x' + i }));
  assert.deepStrictEqual(planFacts(steps(3)), { count: 3, hasTrash: false, canQuickApprove: true });
  assert.strictEqual(planFacts(steps(4)).canQuickApprove, false);
  assert.strictEqual(planFacts(steps(1, 'trash')).canQuickApprove, false);
  assert.strictEqual(planFacts([]).canQuickApprove, false);
});
