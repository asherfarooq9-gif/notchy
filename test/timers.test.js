const test = require('node:test');
const assert = require('node:assert');
const { createTimer, createReminder, formatClock } = require('../lib/timers');

const MIN = 60000;
function clock(start = 1000) {
  const c = { time: start };
  c.now = () => c.time;
  c.advance = (ms) => { c.time += ms; };
  return c;
}

test('a countdown counts down, can pause and resume, then finishes once', () => {
  const c = clock();
  const timer = createTimer({ now: c.now });
  timer.start('countdown', 10);
  c.advance(4 * MIN);
  assert.strictEqual(timer.snapshot().remainingMs, 6 * MIN);
  timer.pause();
  c.advance(30 * MIN);
  assert.strictEqual(timer.snapshot().remainingMs, 6 * MIN, 'paused time does not count');
  timer.resume();
  c.advance(6 * MIN);
  assert.deepStrictEqual(timer.tick(), [{ type: 'finished' }]);
  assert.deepStrictEqual(timer.tick(), [], 'finishes only once');
  assert.strictEqual(timer.snapshot().isRunning, false);
});
test('a pomodoro goes focus, short break, focus, and a long break after four focuses', () => {
  const c = clock();
  const timer = createTimer({ now: c.now });
  timer.start('pomodoro');
  const seen = [];
  for (let i = 0; i < 8; i++) {
    c.advance(30 * MIN); // longer than any phase
    for (const event of timer.tick()) seen.push(event.to);
  }
  assert.deepStrictEqual(seen, ['break', 'focus', 'break', 'focus', 'break', 'focus', 'long-break', 'focus']);
  assert.strictEqual(timer.snapshot().focusDone, 4);
});
test('a stopwatch counts up and holds still while paused', () => {
  const c = clock();
  const timer = createTimer({ now: c.now });
  timer.start('stopwatch');
  c.advance(90000);
  timer.pause();
  c.advance(60000);
  assert.strictEqual(timer.snapshot().elapsedMs, 90000);
  timer.resume();
  c.advance(10000);
  assert.strictEqual(timer.snapshot().elapsedMs, 100000);
  assert.deepStrictEqual(timer.tick(), []);
});
test('a countdown is limited to a day and an unknown kind is refused', () => {
  const timer = createTimer({ now: clock().now });
  timer.start('countdown', 99999);
  assert.strictEqual(timer.snapshot().remainingMs, 24 * 60 * MIN);
  assert.throws(() => timer.start('egg'), /Unknown timer kind/);
});
test('reset clears everything', () => {
  const timer = createTimer({ now: clock().now });
  timer.start('pomodoro');
  timer.reset();
  assert.strictEqual(timer.snapshot().kind, null);
});
test('the water reminder fires once per interval and stops when turned off', () => {
  const c = clock();
  const reminder = createReminder({ intervalMinutes: 45, now: c.now });
  assert.strictEqual(reminder.tick(), false, 'off until started');
  reminder.start();
  c.advance(44 * MIN);
  assert.strictEqual(reminder.tick(), false);
  c.advance(2 * MIN);
  assert.strictEqual(reminder.tick(), true);
  assert.strictEqual(reminder.tick(), false, 'once per interval');
  reminder.stop();
  c.advance(100 * MIN);
  assert.strictEqual(reminder.tick(), false);
});
test('the clock text rounds up so 0:00 only shows at the end', () => {
  assert.strictEqual(formatClock(25 * MIN), '25:00');
  assert.strictEqual(formatClock(59001), '01:00');
  assert.strictEqual(formatClock(3600000 + 5000), '1:00:05');
  assert.strictEqual(formatClock(0), '00:00');
});
