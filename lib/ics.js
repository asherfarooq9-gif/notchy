// Reads calendar files (.ics) and lists the days an event happens on.
// Understands the common repeat rules: daily, weekly (with weekdays), monthly and yearly, with INTERVAL, COUNT and UNTIL.
// Times with a named time zone are shown as local time (a small approximation); all-day events are exact.
const MAX_EVENTS = 3000;
const MAX_REPEATING = 400; // a file with more repeating events than this is not a normal calendar
const MAX_STEPS = 1500; // most days or repeats looked at for one event
const MAX_OCCURRENCES = 5000; // most results for one request
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const dateOf = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const addDays = (key, days) => { const d = dateOf(key); d.setDate(d.getDate() + days); return keyOf(d); };

function unescapeText(text) {
  return text.replace(/\\[nN]/g, '\n').replace(/\\([,;\\])/g, '$1');
}

// "20210216", "20210216T093000" or "20210216T093000Z" -> {date:'2021-02-16', time:'09:30'|''}. Z times are turned into local time.
function parseWhen(value) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , isUtc] = m;
  if (h === undefined) return { date: `${y}-${mo}-${d}`, time: '' };
  if (!isUtc) return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
  const local = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)));
  return { date: keyOf(local), time: `${pad(local.getHours())}:${pad(local.getMinutes())}` };
}

function parseRule(text) {
  const rule = {};
  for (const part of text.split(';')) {
    const [name, value] = part.split('=');
    if (name && value) rule[name.toUpperCase()] = value;
  }
  const freq = rule.FREQ;
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;
  return {
    freq,
    interval: Math.max(1, Number(rule.INTERVAL) || 1),
    count: Number(rule.COUNT) > 0 ? Number(rule.COUNT) : null,
    until: rule.UNTIL ? (parseWhen(rule.UNTIL.slice(0, 8)) || {}).date || null : null,
    days: rule.BYDAY ? rule.BYDAY.split(',').map((d) => WEEKDAYS.indexOf(d.slice(-2))).filter((i) => i >= 0) : [],
  };
}

function parseIcs(text) {
  const events = [];
  let current = null;
  let repeating = 0;
  for (const line of String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/)) {
    if (line === 'BEGIN:VEVENT') { current = { title: '', date: '', time: '', rule: null, skip: [] }; continue; }
    if (line === 'END:VEVENT') {
      if (current && current.rule) repeating++;
      // The repeating-event limit applies to repeating events only: single appointments are always kept.
      if (current && current.title && current.date && events.length < MAX_EVENTS && (!current.rule || repeating <= MAX_REPEATING) && !current.cancelled) events.push({ title: current.title.slice(0, 120), date: current.date, time: current.time, rule: current.rule, skip: current.skip });
      current = null;
      continue;
    }
    if (!current) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const name = line.slice(0, colon).split(';')[0].toUpperCase();
    const value = line.slice(colon + 1);
    if (name === 'SUMMARY') current.title = unescapeText(value).replace(/\s+/g, ' ').trim();
    else if (name === 'DTSTART') Object.assign(current, parseWhen(value.trim()) || {});
    else if (name === 'RRULE') current.rule = parseRule(value);
    else if (name === 'EXDATE') current.skip.push(...value.split(',').map((v) => (parseWhen(v.trim()) || {}).date).filter(Boolean));
    else if (name === 'STATUS' && value.trim().toUpperCase() === 'CANCELLED') current.cancelled = true;
  }
  return events;
}

// How many whole repeats can be skipped to get near fromKey. Only safe without COUNT, which must count from the start.
function repeatsBefore(rule, base, fromKey) {
  const from = dateOf(fromKey);
  const days = Math.floor((from - base) / 86400000);
  if (days <= 0) return 0;
  const months = (from.getFullYear() - base.getFullYear()) * 12 + from.getMonth() - base.getMonth();
  const skipped = { DAILY: days / rule.interval, WEEKLY: days / (7 * rule.interval), MONTHLY: months / rule.interval, YEARLY: months / 12 / rule.interval }[rule.freq];
  return Math.max(0, Math.floor(skipped) - 1);
}

function* repeatDates(event, fromKey, toKey) {
  const { rule, date } = event;
  let emitted = 0;
  const base = dateOf(date);
  if (rule.freq === 'WEEKLY' && rule.days.length) {
    const weekStart = addDays(date, -((base.getDay() + 6) % 7)); // Monday of the first week
    const first = !rule.count && fromKey > date ? addDays(fromKey, -7) : date; // jump straight to the asked days (COUNT must count from the start)
    for (let day = first < date ? date : first, steps = 0; day <= toKey && steps < MAX_STEPS; day = addDays(day, 1), steps++) {
      const weeks = Math.round((dateOf(addDays(day, -((dateOf(day).getDay() + 6) % 7))) - dateOf(weekStart)) / 604800000);
      if (weeks % rule.interval !== 0 || !rule.days.includes(dateOf(day).getDay())) continue;
      if (rule.until && day > rule.until) return;
      yield day;
      if (rule.count && ++emitted >= rule.count) return;
    }
    return;
  }
  const start = rule.count ? 0 : repeatsBefore(rule, base, fromKey);
  for (let n = start; n < start + MAX_STEPS; n++) {
    const d = new Date(base);
    if (rule.freq === 'DAILY') d.setDate(base.getDate() + n * rule.interval);
    else if (rule.freq === 'WEEKLY') d.setDate(base.getDate() + n * 7 * rule.interval);
    else if (rule.freq === 'MONTHLY') { d.setDate(1); d.setMonth(base.getMonth() + n * rule.interval); d.setDate(base.getDate()); if (d.getDate() !== base.getDate()) continue; } // e.g. the 31st skips short months
    else { d.setDate(1); d.setFullYear(base.getFullYear() + n * rule.interval); d.setDate(base.getDate()); if (d.getDate() !== base.getDate()) continue; }
    const day = keyOf(d);
    if (day > toKey || (rule.until && day > rule.until)) return;
    yield day;
    if (rule.count && ++emitted >= rule.count) return;
  }
}

// Every happening between two days (inclusive, 'YYYY-MM-DD'), as {title, date, time}.
function occurrencesBetween(events, fromKey, toKey) {
  const out = [];
  for (const event of events) {
    const skip = new Set(event.skip || []);
    const days = event.rule ? repeatDates(event, fromKey, toKey) : [event.date];
    for (const day of days) {
      if (day >= fromKey && day <= toKey && !skip.has(day)) out.push({ title: event.title, date: day, time: event.time });
      if (out.length >= MAX_OCCURRENCES) return out;
    }
  }
  return out;
}

module.exports = { parseIcs, occurrencesBetween, parseWhen, keyOf, addDays };
