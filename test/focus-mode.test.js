const test = require('node:test');
const assert = require('node:assert');
const { createFocusMode, FOCUS_MAX_MS } = require('../lib/focus-mode');

// A clock we control: fire() runs the pending timer, as if its time had come.
function fakeTimers() {
  const pending = new Map();
  let next = 1;
  return {
    set: (fn, ms) => { pending.set(next, { fn, ms }); return next++; },
    clear: (id) => pending.delete(id),
    count: () => pending.size,
    lastDelay: () => [...pending.values()].pop().ms,
    fire: () => { for (const [id, t] of [...pending]) { pending.delete(id); t.fn(); } },
  };
}
const make = () => {
  const timers = fakeTimers();
  const changes = [];
  const focus = createFocusMode({ timers, onChange: (isOn) => changes.push(isOn) });
  return { focus, timers, changes };
};

test('focus mode starts off and tells you when it changes, once per change', () => {
  const { focus, changes } = make();
  assert.strictEqual(focus.isOn(), false);
  assert.strictEqual(focus.set(true), true);
  assert.strictEqual(focus.set(true), true);
  assert.deepStrictEqual(changes, [true], 'turning it on twice is one change');
  assert.strictEqual(focus.set(false), false);
  assert.strictEqual(focus.set(false), false);
  assert.deepStrictEqual(changes, [true, false]);
});
test('toggle flips it', () => {
  const { focus } = make();
  assert.strictEqual(focus.toggle(), true);
  assert.strictEqual(focus.toggle(), false);
});
test('it turns itself off after its limit, so it can never be forgotten', () => {
  const { focus, timers, changes } = make();
  focus.set(true);
  assert.strictEqual(timers.lastDelay(), FOCUS_MAX_MS);
  assert.ok(FOCUS_MAX_MS <= 3 * 60 * 60 * 1000, 'a few hours at most');
  timers.fire();
  assert.strictEqual(focus.isOn(), false);
  assert.deepStrictEqual(changes, [true, false]);
});
test('turning it off by hand cancels the timer, and turning it on again restarts it', () => {
  const { focus, timers, changes } = make();
  focus.set(true);
  focus.set(false);
  assert.strictEqual(timers.count(), 0);
  focus.set(true);
  focus.set(true);
  assert.strictEqual(timers.count(), 1, 'only one timer is ever waiting');
  timers.fire();
  assert.deepStrictEqual(changes, [true, false, true, false]);
});
