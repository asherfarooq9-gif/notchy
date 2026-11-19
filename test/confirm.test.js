const test = require('node:test');
const assert = require('node:assert');
const { createConfirmation } = require('../lib/confirm');
const { parseCommand } = require('../lib/commands');

// Fake timers: nothing runs until the test says time has passed.
function clock() {
  const timers = new Map();
  let nextId = 1;
  return {
    setTimer: (fn) => { const id = nextId++; timers.set(id, fn); return id; },
    clearTimer: (id) => { timers.delete(id); },
    pass: () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } },
    count: () => timers.size,
  };
}
const shutdown = parseCommand('shut down');
const yes = parseCommand('yes');
const no = parseCommand('no');

test('a clear yes runs the waiting command, once', () => {
  const c = createConfirmation({ ms: 20000, ...clock() });
  c.ask(shutdown);
  assert.ok(c.isOpen());
  assert.deepStrictEqual(c.answer(yes), { action: 'run', cmd: shutdown });
  assert.ok(!c.isOpen());
  assert.deepStrictEqual(c.answer(yes), { action: 'none' }, 'a second yes does nothing');
});
test('no cancels, and nothing runs', () => {
  const c = createConfirmation({ ms: 20000, ...clock() });
  c.ask(shutdown);
  assert.deepStrictEqual(c.answer(no), { action: 'cancel' });
  assert.ok(!c.isOpen());
});
test('a yes with no open question does nothing', () => {
  const c = createConfirmation({ ms: 20000, ...clock() });
  assert.deepStrictEqual(c.answer(yes), { action: 'none' });
});
test('saying something else drops the question, so a later yes cannot shut anything down', () => {
  const c = createConfirmation({ ms: 20000, ...clock() });
  c.ask(shutdown);
  assert.deepStrictEqual(c.answer(parseCommand('volume up')), { action: 'none' });
  assert.ok(!c.isOpen());
  assert.deepStrictEqual(c.answer(yes), { action: 'none' });
  c.ask(shutdown);
  assert.deepStrictEqual(c.answer(parseCommand('what is the capital of france')), { action: 'none' }, 'a question for Claude also drops it');
  assert.deepStrictEqual(c.answer(null), { action: 'none' });
});
test('waiting too long closes the question', () => {
  const t = clock();
  const c = createConfirmation({ ms: 20000, ...t });
  c.ask(shutdown);
  t.pass();
  assert.ok(!c.isOpen());
  assert.deepStrictEqual(c.answer(yes), { action: 'none' });
});
test('a new question replaces the old one, and clearing leaves no timer behind', () => {
  const t = clock();
  const c = createConfirmation({ ms: 20000, ...t });
  c.ask(shutdown);
  const restart = parseCommand('restart');
  c.ask(restart);
  assert.strictEqual(t.count(), 1, 'only one timer');
  assert.deepStrictEqual(c.answer(yes), { action: 'run', cmd: restart });
  c.ask(shutdown);
  c.clear();
  assert.strictEqual(t.count(), 0);
  assert.ok(!c.isOpen());
});
test('every risky command asks, and every safe one does not', () => {
  for (const phrase of ['sleep', 'restart', 'shut down', 'wifi off']) assert.ok(parseCommand(phrase).confirm, phrase);
  for (const phrase of ['wifi on', 'bluetooth off', 'brightness up', 'screenshot', 'snap left', 'battery', 'type hello', 'cancel shutdown', 'open downloads']) assert.ok(!parseCommand(phrase).confirm, phrase);
});
