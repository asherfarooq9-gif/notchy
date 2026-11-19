// The character's "life": it keeps a tally of the focus sessions you finish each day, and turns that into a streak and a mood.
// Everything here is plain functions on a small object ({ days: { '2026-11-19': 3 } }), so it is easy to test.
const MAX_DAYS_KEPT = 120;
const MILESTONES = [3, 7, 14, 30, 60, 100];
const PROUD_SESSIONS = 4;
const SLEEPY_HOUR = 22;

const two = (n) => String(n).padStart(2, '0');
const dayKey = (date = new Date()) => `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`; // local time, not UTC
const countOn = (life, day) => Number(life && life.days && life.days[day]) || 0;

function previousDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1)); // the Date constructor rolls over months, years and clock changes for us
}

// A new object with one more session on that day. Old days beyond the limit are dropped.
function addFocus(life, day) {
  const days = { ...((life && life.days) || {}), [day]: countOn(life, day) + 1 };
  const kept = Object.keys(days).sort().slice(-MAX_DAYS_KEPT);
  return { days: Object.fromEntries(kept.map((key) => [key, days[key]])) };
}

// Days in a row with at least one session. If today has none yet, yesterday keeps the streak alive.
function streakOf(life, today) {
  let day = countOn(life, today) > 0 ? today : previousDay(today);
  let streak = 0;
  while (countOn(life, day) > 0) { streak += 1; day = previousDay(day); }
  return streak;
}

function moodFor(life, today, hour) {
  const done = countOn(life, today);
  const streak = streakOf(life, today);
  if (done >= PROUD_SESSIONS) return { mood: 'proud', line: `${done} focus sessions today. Proud of you.` };
  if (done > 0) return { mood: 'warm', line: `${done} focus session${done === 1 ? '' : 's'} today. Nice rhythm.` };
  if (streak > 0) return { mood: 'hopeful', line: `Your ${streak}-day streak needs one session today.` };
  if (hour >= SLEEPY_HOUR) return { mood: 'sleepy', line: 'Quiet day. Rest well.' };
  return { mood: 'ready', line: 'Ready when you are. Start a focus session.' };
}

// The milestone passed when the streak goes from `before` to `after`, or null.
const milestoneHit = (before, after) => MILESTONES.find((m) => before < m && after >= m) ?? null;
const nextMilestone = (streak) => MILESTONES.find((m) => m > streak) ?? null;

function summary(life, now = new Date()) {
  const today = dayKey(now);
  const streak = streakOf(life, today);
  return { streak, today: countOn(life, today), ...moodFor(life, today, now.getHours()), next: nextMilestone(streak) };
}

module.exports = { dayKey, addFocus, streakOf, moodFor, milestoneHit, nextMilestone, summary };
