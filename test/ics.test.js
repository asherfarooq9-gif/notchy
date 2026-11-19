const test = require('node:test');
const assert = require('node:assert');
const { parseIcs, occurrencesBetween, parseWhen, addDays } = require('../lib/ics');

const wrap = (...events) => ['BEGIN:VCALENDAR', ...events.map((e) => `BEGIN:VEVENT\n${e}\nEND:VEVENT`), 'END:VCALENDAR'].join('\r\n');
const days = (events, from, to) => occurrencesBetween(parseIcs(wrap(...events)), from, to).map((o) => o.date);

test('an all-day event and a timed event are read, with escapes and folded lines', () => {
  const [a, b] = parseIcs(wrap('DTSTART;VALUE=DATE:20261225\nSUMMARY:Christmas\\, Day', 'DTSTART:20261112T093000\nSUMMARY:Long\n  title here'));
  assert.deepStrictEqual([a.title, a.date, a.time], ['Christmas, Day', '2026-12-25', '']);
  assert.deepStrictEqual([b.title, b.date, b.time], ['Long title here', '2026-11-12', '09:30']);
});
test('UTC times are turned into local time', () => {
  const local = new Date(Date.UTC(2026, 5, 1, 12, 0));
  const parsed = parseWhen('20260601T120000Z');
  assert.strictEqual(parsed.time, `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`);
});
test('cancelled events and junk lines are ignored', () => {
  assert.strictEqual(parseIcs(wrap('DTSTART:20261201\nSUMMARY:Gone\nSTATUS:CANCELLED', 'SUMMARY:No date')).length, 0);
  assert.strictEqual(parseIcs('not a calendar at all').length, 0);
});
test('a plain event only shows inside the asked range', () => {
  assert.deepStrictEqual(days(['DTSTART:20261110\nSUMMARY:x'], '2026-11-01', '2026-11-30'), ['2026-11-10']);
  assert.deepStrictEqual(days(['DTSTART:20261110\nSUMMARY:x'], '2026-12-01', '2026-12-31'), []);
});
test('daily with an interval and a count stops after the count', () => {
  assert.deepStrictEqual(days(['DTSTART:20261101\nSUMMARY:x\nRRULE:FREQ=DAILY;INTERVAL=2;COUNT=3'], '2026-11-01', '2026-12-31'), ['2026-11-01', '2026-11-03', '2026-11-05']);
});
test('weekly on chosen weekdays, every second week, until a date', () => {
  // 2026-11-02 is a Monday
  const rule = 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261130T000000Z';
  assert.deepStrictEqual(days([`DTSTART:20261102\nSUMMARY:x\n${rule}`], '2026-11-01', '2026-12-31'), ['2026-11-02', '2026-11-04', '2026-11-16', '2026-11-18', '2026-11-30']);
});
test('monthly skips short months and yearly repeats on the same day', () => {
  assert.deepStrictEqual(days(['DTSTART:20261031\nSUMMARY:x\nRRULE:FREQ=MONTHLY'], '2026-10-01', '2027-01-31'), ['2026-10-31', '2026-12-31', '2027-01-31']);
  assert.deepStrictEqual(days(['DTSTART:20240229\nSUMMARY:x\nRRULE:FREQ=YEARLY'], '2024-01-01', '2029-01-01'), ['2024-02-29', '2028-02-29']);
  assert.deepStrictEqual(days(['DTSTART:20200315\nSUMMARY:bday\nRRULE:FREQ=YEARLY'], '2026-01-01', '2027-12-31'), ['2026-03-15', '2027-03-15']);
});
test('skipped days in a repeat are left out', () => {
  assert.deepStrictEqual(days(['DTSTART:20261101\nSUMMARY:x\nRRULE:FREQ=DAILY;COUNT=3\nEXDATE:20261102'], '2026-11-01', '2026-11-30'), ['2026-11-01', '2026-11-03']);
});
test('a repeat that started years ago is still found today, and day maths crosses month ends', () => {
  assert.deepStrictEqual(days(['DTSTART:20200101\nSUMMARY:x\nRRULE:FREQ=WEEKLY;BYDAY=FR'], '2026-11-13', '2026-11-13'), ['2026-11-13']);
  assert.strictEqual(addDays('2026-11-30', 1), '2026-12-01');
});

test('a feed full of old repeating events cannot freeze the app', () => {
  const one = (i) => `DTSTART:19900${(i % 9) + 1}01\nSUMMARY:e${i}\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU`;
  const text = wrap(...Array.from({ length: 3000 }, (_, i) => one(i)));
  const events = parseIcs(text);
  assert.ok(events.length <= 400, 'too many repeating events are cut off');
  const started = Date.now();
  occurrencesBetween(events, '2026-11-01', '2026-11-30');
  assert.ok(Date.now() - started < 1500, `took ${Date.now() - started} ms`);
});
test('skipping ahead gives the same days as counting from the start', () => {
  const rules = ['FREQ=DAILY;INTERVAL=3', 'FREQ=WEEKLY;INTERVAL=2', 'FREQ=MONTHLY;INTERVAL=2', 'FREQ=YEARLY', 'FREQ=WEEKLY;BYDAY=MO,FR;INTERVAL=2'];
  for (const rule of rules) {
    const events = parseIcs(wrap(`DTSTART:20200115\nSUMMARY:x\nRRULE:${rule}`));
    const narrow = occurrencesBetween(events, '2026-03-01', '2026-05-31').map((o) => o.date);
    const wide = occurrencesBetween(events, "2023-01-01", "2026-12-31").map((o) => o.date).filter((d) => d >= '2026-03-01' && d <= '2026-05-31');
    assert.deepStrictEqual(narrow, wide, rule);
  }
});
