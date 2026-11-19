const test = require('node:test');
const assert = require('node:assert');
const { createAwake, allowsAlert } = require('../lib/awake');

test('alerts stay out while he is hidden unless you allowed them', () => {
  const strict = { hideUntilCalled: true, alertsWhileHidden: false };
  assert.strictEqual(allowsAlert(strict, false), false, 'hidden + alerts off: blocked');
  assert.strictEqual(allowsAlert(strict, true), true, 'already awake: shown');
  assert.strictEqual(allowsAlert({ hideUntilCalled: true, alertsWhileHidden: true }, false), true, 'alerts allowed: shown');
  assert.strictEqual(allowsAlert({ hideUntilCalled: false, alertsWhileHidden: false }, false), true, 'not hiding: shown');
});

// A fake clock: timers fire only when the test moves time forward.
function fakeWorld({ hiding = true, busy = false } = {}) {
  const world = { time: 1000, timers: [], hiding, busy, changes: [] };
  const awake = createAwake({
    onChange: (value) => world.changes.push(value),
    isHiding: () => world.hiding,
    isBusy: () => world.busy,
    now: () => world.time,
    schedule: (fn, ms) => { const timer = { fn, at: world.time + ms }; world.timers.push(timer); return timer; },
    cancel: (timer) => { world.timers = world.timers.filter((t) => t !== timer); },
  });
  world.awake = awake;
  world.advance = (ms) => {
    const end = world.time + ms;
    for (;;) {
      const due = world.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      world.timers = world.timers.filter((t) => t !== due);
      world.time = due.at;
      due.fn();
    }
    world.time = end;
  };
  return world;
}

test('in hidden mode he starts out of sight', () => {
  assert.strictEqual(fakeWorld().awake.isAwake(), false);
});
test('waking shows him, and he leaves again after the linger time', () => {
  const w = fakeWorld();
  w.awake.wake(5000);
  assert.deepStrictEqual(w.changes, [true]);
  w.advance(4900);
  assert.strictEqual(w.awake.isAwake(), true);
  w.advance(200);
  assert.deepStrictEqual(w.changes, [true, false]);
});
test('he never leaves while busy listening or answering', () => {
  const w = fakeWorld({ busy: true });
  w.awake.wake(1000);
  w.advance(30000);
  assert.strictEqual(w.awake.isAwake(), true);
  w.busy = false;
  w.advance(1100);
  assert.strictEqual(w.awake.isAwake(), false);
});
test('a shorter later wake never cuts an earlier long one short', () => {
  const w = fakeWorld();
  w.awake.wake(10000);
  w.awake.wake(1000);
  w.advance(5000);
  assert.strictEqual(w.awake.isAwake(), true);
  w.advance(5500);
  assert.strictEqual(w.awake.isAwake(), false);
});
test('a full-screen app hides him at once and he ignores every wake until it ends', () => {
  const w = fakeWorld();
  w.awake.wake(60000);
  assert.strictEqual(w.awake.isAwake(), true);
  w.awake.suppress(true);
  assert.strictEqual(w.awake.isAwake(), false, 'hidden immediately');
  w.awake.wake(5000);
  w.awake.sync();
  assert.strictEqual(w.awake.isAwake(), false, 'wakes and settings changes do nothing while suppressed');
  w.awake.suppress(false);
  assert.strictEqual(w.awake.isAwake(), false, 'back to hidden mode, so still hidden until called');
  w.awake.wake(1000);
  assert.strictEqual(w.awake.isAwake(), true, 'works again once the full-screen app is gone');
});
test('with hidden mode off, ending full screen brings him back', () => {
  const w = fakeWorld({ hiding: false });
  w.awake.suppress(true);
  assert.strictEqual(w.awake.isAwake(), false);
  w.awake.suppress(false);
  assert.strictEqual(w.awake.isAwake(), true);
});
test('with hidden mode off he is always visible and never leaves', () => {
  const w = fakeWorld({ hiding: false });
  assert.strictEqual(w.awake.isAwake(), true);
  w.awake.wake(1000);
  w.advance(60000);
  assert.strictEqual(w.awake.isAwake(), true);
});
test('turning hidden mode on makes him leave soon, turning it off brings him back', () => {
  const w = fakeWorld({ hiding: false });
  w.hiding = true;
  w.awake.sync();
  w.advance(2000);
  assert.strictEqual(w.awake.isAwake(), false);
  w.hiding = false;
  w.awake.sync();
  assert.strictEqual(w.awake.isAwake(), true);
});
