const test = require('node:test');
const assert = require('node:assert');
const { createScreenTime, cleanApp } = require('../lib/screen-time');

const memoryStore = () => { const d = {}; return { get: (n, f) => (n in d ? d[n] : f), set: (n, v) => { d[n] = JSON.parse(JSON.stringify(v)); } }; };
function setup(start = new Date(2026, 10, 14, 9, 0, 0).getTime()) {
  const state = { clock: start };
  const nudges = [];
  const store = memoryStore();
  const make = () => createScreenTime({ store, announce: (m) => nudges.push(m), now: () => state.clock });
  return { state, nudges, store, make, tracker: make() };
}
const reading = (t, app, idle = 0, seconds = 5) => { t.state.clock += seconds * 1000; t.tracker.tick({ app, idle }); };

test('nothing is counted until it is turned on', () => {
  const t = setup();
  reading(t, 'chrome'); reading(t, 'chrome');
  assert.strictEqual(t.tracker.get().today.seconds, 0);
});
test('time is added per program, biggest first', () => {
  const t = setup();
  t.tracker.set({ enabled: true });
  t.tracker.tick({ app: 'chrome', idle: 0 }); // first reading only starts the clock
  for (let i = 0; i < 4; i++) reading(t, 'chrome');
  for (let i = 0; i < 2; i++) reading(t, 'Code.exe');
  const { today } = t.tracker.get();
  assert.deepStrictEqual(today.apps, [{ name: 'chrome', seconds: 20 }, { name: 'code', seconds: 10 }]);
  assert.strictEqual(today.seconds, 30);
});
test('idle time and long gaps are not counted in full', () => {
  const t = setup();
  t.tracker.set({ enabled: true });
  t.tracker.tick({ app: 'chrome', idle: 0 });
  reading(t, 'chrome', 300); // away from the keyboard
  assert.strictEqual(t.tracker.get().today.seconds, 0);
  reading(t, 'chrome', 0, 3600); // the PC slept for an hour
  assert.strictEqual(t.tracker.get().today.seconds, 15);
});
test('program names are cleaned and an empty name is ignored', () => {
  assert.strictEqual(cleanApp('Chrome.EXE'), 'chrome');
  assert.strictEqual(cleanApp('<b>x</b>'), 'bxb');
  const t = setup();
  t.tracker.set({ enabled: true });
  t.tracker.tick({ app: '', idle: 0 }); reading(t, '');
  assert.strictEqual(t.tracker.get().today.seconds, 0);
});
test('the week shows seven days, today last', () => {
  const t = setup();
  t.tracker.set({ enabled: true });
  t.tracker.tick({ app: 'a', idle: 0 }); reading(t, 'a');
  const { week } = t.tracker.get();
  assert.strictEqual(week.length, 7);
  assert.strictEqual(week[6].seconds, 5);
  assert.strictEqual(week[0].seconds, 0);
});
test('the daily limit nudges once per day', () => {
  const t = setup();
  t.tracker.set({ enabled: true, limitMinutes: 1 });
  t.tracker.tick({ app: 'a', idle: 0 });
  for (let i = 0; i < 20; i++) reading(t, 'a');
  assert.strictEqual(t.nudges.length, 1);
  assert.match(t.nudges[0], /1 minutes/);
  t.state.clock += 24 * 3600 * 1000;
  t.tracker.tick({ app: 'a', idle: 0 });
  for (let i = 0; i < 20; i++) reading(t, 'a');
  assert.strictEqual(t.nudges.length, 2);
});
test('numbers survive a restart, and clearing wipes them', () => {
  const t = setup();
  t.tracker.set({ enabled: true });
  t.tracker.tick({ app: 'a', idle: 0 }); reading(t, 'a');
  t.tracker.flush();
  const again = t.make();
  assert.strictEqual(again.get().today.seconds, 5);
  assert.strictEqual(again.get().enabled, true);
  again.clear();
  assert.strictEqual(t.make().get().today.seconds, 0);
});
test('the limit is kept to a sensible number', () => {
  const t = setup();
  t.tracker.set({ enabled: true, limitMinutes: 99999 });
  assert.strictEqual(t.tracker.get().limitMinutes, 1440);
  t.tracker.set({ enabled: true, limitMinutes: -5 });
  assert.strictEqual(t.tracker.get().limitMinutes, 0);
});

test('a program named like a built-in property is counted normally', () => {
  const t = setup();
  t.tracker.set({ enabled: true });
  t.tracker.tick({ app: 'constructor', idle: 0 });
  reading(t, 'constructor'); reading(t, 'constructor'); reading(t, '__proto__'); reading(t, 'toString');
  const { today } = t.tracker.get();
  assert.strictEqual(today.seconds, 20);
  const byName = Object.fromEntries(today.apps.map((a) => [a.name, a.seconds]));
  assert.strictEqual(byName.constructor, 10);
  assert.strictEqual(byName.__proto__ === undefined ? 5 : byName.__proto__, 5);
});
