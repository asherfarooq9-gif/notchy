const test = require('node:test');
const assert = require('node:assert');
const { dayKey, addFocus, streakOf, moodFor, milestoneHit, nextMilestone, summary } = require('../lib/life');

const days = (map) => ({ days: map });

test('a day is written as year-month-day in local time', () => {
  assert.strictEqual(dayKey(new Date(2026, 10, 19, 23, 59)), '2026-11-19');
  assert.strictEqual(dayKey(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});
test('finishing a focus session adds one to that day and never changes the old object', () => {
  const before = days({ '2026-11-19': 1 });
  const after = addFocus(before, '2026-11-19');
  assert.strictEqual(after.days['2026-11-19'], 2);
  assert.strictEqual(before.days['2026-11-19'], 1);
  assert.strictEqual(addFocus({}, '2026-11-20').days['2026-11-20'], 1);
  assert.strictEqual(addFocus(null, '2026-11-20').days['2026-11-20'], 1);
});
test('only the last 120 days are kept', () => {
  const many = {};
  for (let i = 0; i < 150; i++) many[dayKey(new Date(2026, 0, 1 + i))] = 1;
  const kept = Object.keys(addFocus(days(many), '2026-12-31').days);
  assert.ok(kept.length <= 120);
  assert.ok(kept.includes('2026-12-31'));
});
test('a streak counts days in a row, and stays alive until today ends', () => {
  const life = days({ '2026-11-17': 2, '2026-11-18': 1, '2026-11-19': 1 });
  assert.strictEqual(streakOf(life, '2026-11-19'), 3);
  assert.strictEqual(streakOf(days({ '2026-11-17': 2, '2026-11-18': 1 }), '2026-11-19'), 2, 'today has no session yet, but yesterday keeps it alive');
  assert.strictEqual(streakOf(days({ '2026-11-16': 1 }), '2026-11-19'), 0, 'a missed day ends it');
  assert.strictEqual(streakOf(days({ '2026-11-15': 1, '2026-11-17': 1, '2026-11-18': 1 }), '2026-11-18'), 2, 'a gap splits it');
  assert.strictEqual(streakOf({}, '2026-11-19'), 0);
  assert.strictEqual(streakOf(days({ '2026-02-28': 1, '2026-03-01': 1 }), '2026-03-01'), 2, 'month ends are handled');
  assert.strictEqual(streakOf(days({ '2026-12-31': 1, '2027-01-01': 1 }), '2027-01-01'), 2, 'year ends are handled');
  assert.strictEqual(streakOf(days({ '2026-11-19': 0 }), '2026-11-19'), 0, 'zero sessions is not a day');
});
test('the mood follows today and the streak', () => {
  const today = '2026-11-19';
  assert.strictEqual(moodFor(days({ [today]: 4 }), today, 14).mood, 'proud');
  assert.strictEqual(moodFor(days({ [today]: 2 }), today, 14).mood, 'warm');
  assert.strictEqual(moodFor(days({ '2026-11-18': 1, '2026-11-17': 1 }), today, 14).mood, 'hopeful');
  assert.match(moodFor(days({ '2026-11-18': 1, '2026-11-17': 1 }), today, 14).line, /2-day streak/);
  assert.strictEqual(moodFor({}, today, 14).mood, 'ready');
  assert.strictEqual(moodFor({}, today, 23).mood, 'sleepy');
  assert.match(moodFor(days({ [today]: 1 }), today, 9).line, /1 focus session/);
  assert.match(moodFor(days({ [today]: 3 }), today, 9).line, /3 focus sessions/);
});
test('milestones are reached once, going up', () => {
  assert.strictEqual(milestoneHit(2, 3), 3);
  assert.strictEqual(milestoneHit(3, 3), null);
  assert.strictEqual(milestoneHit(6, 7), 7);
  assert.strictEqual(milestoneHit(0, 1), null);
  assert.strictEqual(milestoneHit(3, 0), null);
  assert.strictEqual(nextMilestone(0), 3);
  assert.strictEqual(nextMilestone(3), 7);
  assert.strictEqual(nextMilestone(100), null);
});
test('the summary is what the Home card needs', () => {
  const now = new Date(2026, 10, 19, 10, 0);
  const life = days({ '2026-11-18': 1, '2026-11-19': 2 });
  assert.deepStrictEqual(summary(life, now), { streak: 2, today: 2, mood: 'warm', line: '2 focus sessions today. Nice rhythm.', next: 3 });
  assert.deepStrictEqual(summary(null, now), { streak: 0, today: 0, mood: 'ready', line: 'Ready when you are. Start a focus session.', next: 3 });
});
