const test = require('node:test');
const assert = require('node:assert');
const { createCalendarService, cleanEvent, dueReminders } = require('../lib/calendar');

const memoryStore = () => { const d = {}; return { get: (n, f) => (n in d ? d[n] : f), set: (n, v) => { d[n] = JSON.parse(JSON.stringify(v)); } }; };
const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const FEED = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261225\nSUMMARY:Christmas\nEND:VEVENT\nEND:VCALENDAR';

function setup(clock = at(2026, 11, 14, 9), fetchImpl = async () => FEED) {
  const spoken = [];
  const state = { clock };
  const service = createCalendarService({ store: memoryStore(), announce: (m) => spoken.push(m), fetchImpl, now: () => state.clock });
  return { service, spoken, state };
}

test('an event needs a name, a real date and a real time', () => {
  assert.throws(() => cleanEvent({ title: ' ', date: '2026-11-14' }), /name/);
  assert.throws(() => cleanEvent({ title: 'x', date: '2026-02-30' }), /date/);
  assert.throws(() => cleanEvent({ title: 'x', date: '2026-11-14', time: '25:00' }), /time/);
  assert.strictEqual(cleanEvent({ title: ' Dentist ', date: '2026-11-14', time: '10:30', remind: 10 }).remind, 10);
});
test('a reminder needs a time of day, an all-day event gets none', () => {
  assert.strictEqual(cleanEvent({ title: 'x', date: '2026-11-14', remind: 10 }).remind, null);
  assert.strictEqual(cleanEvent({ title: 'x', date: '2026-11-14', time: '10:00', remind: 7 }).remind, null);
});
test('events are listed in time order and removed by id', () => {
  const { service } = setup();
  const late = service.add({ title: 'Late', date: '2026-11-15', time: '18:00' });
  service.add({ title: 'Early', date: '2026-11-15', time: '08:00' });
  service.add({ title: 'All day', date: '2026-11-15' });
  assert.deepStrictEqual(service.list('2026-11-15', '2026-11-15').map((e) => e.title), ['All day', 'Early', 'Late']);
  service.remove(late.id);
  assert.strictEqual(service.list('2026-11-15', '2026-11-15').length, 2);
  assert.strictEqual(service.list('2026-11-16', '2026-11-30').length, 0);
});
test('a reminder goes off once, at the right time, and not again', () => {
  const { service, spoken, state } = setup(at(2026, 11, 14, 9, 0));
  service.add({ title: 'Dentist', date: '2026-11-14', time: '10:00', remind: 10 });
  state.clock = at(2026, 11, 14, 9, 49); service.checkReminders();
  assert.strictEqual(spoken.length, 0);
  state.clock = at(2026, 11, 14, 9, 51); service.checkReminders();
  assert.strictEqual(spoken.length, 1);
  assert.match(spoken[0], /Dentist starts in 10 minutes/);
  state.clock = at(2026, 11, 14, 9, 55); service.checkReminders();
  assert.strictEqual(spoken.length, 1);
});
test('a reminder missed long ago (PC was asleep) is skipped', () => {
  const event = { id: 'a', title: 'x', date: '2026-11-14', time: '10:00', remind: 0 };
  assert.strictEqual(dueReminders([event], at(2026, 11, 14, 10, 3), []).length, 1);
  assert.strictEqual(dueReminders([event], at(2026, 11, 14, 11, 0), []).length, 0);
});
test('a followed calendar is checked, saved, shown with its name and can be removed', async () => {
  const { service } = setup();
  const feed = await service.addFeed({ name: 'Holidays', url: 'webcal://example.com/h.ics' });
  assert.strictEqual(service.feeds()[0].count, 1);
  assert.deepStrictEqual(service.list('2026-12-01', '2026-12-31').map((e) => [e.title, e.source]), [['Christmas', 'Holidays']]);
  service.removeFeed(feed.id);
  assert.strictEqual(service.list('2026-12-01', '2026-12-31').length, 0);
});
test('bad calendar links are refused before anything is saved', async () => {
  const { service } = setup(undefined, async () => { throw new Error('offline'); });
  await assert.rejects(service.addFeed({ url: 'http://example.com/a.ics' }), /secure/);
  await assert.rejects(service.addFeed({ url: 'not a link' }), /web address/);
  await assert.rejects(service.addFeed({ url: 'https://example.com/a.ics' }), /offline/);
  assert.strictEqual(service.feeds().length, 0);
  const empty = setup(undefined, async () => 'BEGIN:VCALENDAR\nEND:VCALENDAR');
  await assert.rejects(empty.service.addFeed({ url: 'https://example.com/a.ics' }), /no events/);
});
test('when a followed calendar cannot be refreshed its old events stay and the problem is shown', async () => {
  let fail = false;
  const { service, state } = setup(at(2026, 11, 14), async () => { if (fail) throw new Error('offline'); return FEED; });
  await service.addFeed({ url: 'https://example.com/h.ics' });
  fail = true; state.clock += 7 * 3600 * 1000;
  await service.refresh();
  assert.strictEqual(service.list('2026-12-01', '2026-12-31').length, 1);
  assert.strictEqual(service.feeds()[0].error, 'offline');
});
