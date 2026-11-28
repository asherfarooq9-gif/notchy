const test = require('node:test');
const assert = require('node:assert');
const Reactions = require('../renderer/hero-reactions.js');

test('every reaction has a line that fits the notch and a drawing that exists', () => {
  for (const name of ['timerDone', 'lowBattery', 'plugged', 'breakTime']) {
    const reaction = Reactions.REACTIONS[name];
    assert.ok(reaction && reaction.line.length > 0 && reaction.line.length <= 40, `${name} has a short line`);
    assert.ok(Reactions.FX[reaction.fx], `${name} has a drawing`);
  }
});

test('running low on battery is noticed once, when the level first drops to the limit while unplugged', () => {
  const limit = Reactions.LOW_PERCENT;
  assert.strictEqual(Reactions.batteryReaction({ percent: limit + 1, charging: false }, { percent: limit, charging: false }), 'lowBattery');
  assert.strictEqual(Reactions.batteryReaction({ percent: limit, charging: false }, { percent: limit - 1, charging: false }), null, 'already low: no second warning');
  assert.strictEqual(Reactions.batteryReaction({ percent: limit + 1, charging: true }, { percent: limit, charging: true }), null, 'plugged in: no warning');
  assert.strictEqual(Reactions.batteryReaction(null, { percent: 10, charging: false }), null, 'the first reading is not news');
});

test('plugging in is noticed once', () => {
  assert.strictEqual(Reactions.batteryReaction({ percent: 50, charging: false }, { percent: 50, charging: true }), 'plugged');
  assert.strictEqual(Reactions.batteryReaction({ percent: 50, charging: true }, { percent: 51, charging: true }), null);
  assert.strictEqual(Reactions.batteryReaction({ percent: 50, charging: true }, { percent: 50, charging: false }), null, 'unplugging alone is not a reaction');
});

test('the break nudge comes after a long stretch, never in focus mode, when hidden or when switched off', () => {
  const base = { now: 100 * 60000, lastNudge: 0, everyMs: Reactions.BREAK_EVERY_MS, isFocus: false, isDormant: false, isOn: true, state: 'idle' };
  assert.strictEqual(Reactions.shouldNudge(base), true);
  assert.strictEqual(Reactions.shouldNudge({ ...base, now: Reactions.BREAK_EVERY_MS - 1 }), false, 'too soon');
  assert.strictEqual(Reactions.shouldNudge({ ...base, isFocus: true }), false);
  assert.strictEqual(Reactions.shouldNudge({ ...base, isDormant: true }), false);
  assert.strictEqual(Reactions.shouldNudge({ ...base, isOn: false }), false);
  assert.strictEqual(Reactions.shouldNudge({ ...base, state: 'working' }), false, 'never cuts in on Claude');
});

test('the break nudge never repeats faster than its interval', () => {
  const every = Reactions.BREAK_EVERY_MS;
  const args = { everyMs: every, isFocus: false, isDormant: false, isOn: true, state: 'idle' };
  assert.strictEqual(Reactions.shouldNudge({ ...args, now: every * 2, lastNudge: every * 2 - 1000 }), false);
  assert.strictEqual(Reactions.shouldNudge({ ...args, now: every * 2, lastNudge: every }), true);
});

test('the notch page loads the reactions and wires them in, using the same limit as the worried look', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
  assert.ok(read('renderer/index.html').includes('hero-reactions.js'));
  const app = read('renderer/app.js');
  for (const name of ['react(\'timerDone\')', 'react(\'breakTime\')', 'batteryReaction(']) assert.ok(app.includes(name), name);
  assert.match(app, new RegExp(`LOW_BATTERY_PERCENT = ${Reactions.LOW_PERCENT};`));
  const css = read('renderer/style.css');
  for (const fx of ['pow', 'low', 'spark', 'stretch']) assert.ok(css.includes(`data-move="${fx}"`), `${fx} has styles`);
});
