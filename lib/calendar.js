// Your own events with reminders, plus calendars you subscribe to (holidays, birthdays, any public .ics link).
// Reminders speak and show a card through announce(). Subscriptions are only ever read, never changed.
const crypto = require('crypto');
const { fetchText } = require('./web');
const { parseIcs, occurrencesBetween, keyOf, addDays } = require('./ics');

const FEED_MAX_BYTES = 1.5 * 1024 * 1024;
const FEED_REFRESH_MS = 6 * 60 * 60 * 1000;
const MAX_EVENTS = 500;
const MAX_FEEDS = 6;
const REMIND_CHOICES = [0, 5, 10, 30, 60];
const LATE_GRACE_MS = 5 * 60 * 1000; // a reminder missed while the PC slept is skipped once the event is this long past
const MAX_FIRED = 200;
const OLD_DAYS_KEPT = 400;

const PRESETS = [
  { name: 'India holidays', url: 'https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics' },
  { name: 'Pakistan holidays', url: 'https://calendar.google.com/calendar/ical/en.pk%23holiday%40group.v.calendar.google.com/public/basic.ics' },
  { name: 'US holidays', url: 'https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics' },
  { name: 'UK holidays', url: 'https://calendar.google.com/calendar/ical/en.uk%23holiday%40group.v.calendar.google.com/public/basic.ics' },
  { name: 'Canada holidays', url: 'https://calendar.google.com/calendar/ical/en.canadian%23holiday%40group.v.calendar.google.com/public/basic.ics' },
  { name: 'Australia holidays', url: 'https://calendar.google.com/calendar/ical/en.australian%23holiday%40group.v.calendar.google.com/public/basic.ics' },
];

const isDay = (text) => typeof text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(text) && keyOf(new Date(Number(text.slice(0, 4)), Number(text.slice(5, 7)) - 1, Number(text.slice(8, 10)))) === text;
const isClock = (text) => text === '' || (typeof text === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(text));

function cleanEvent(input) {
  const title = String((input && input.title) || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!title) throw new Error('Give the event a name');
  if (!isDay(input.date)) throw new Error('Pick a valid date');
  const time = input.time || '';
  if (!isClock(time)) throw new Error('Pick a valid time');
  const remind = time && REMIND_CHOICES.includes(input.remind) ? input.remind : null; // reminders need a time of day
  return { title, date: input.date, time, remind };
}

function startMs(event) {
  const [h, m] = event.time.split(':').map(Number);
  return new Date(Number(event.date.slice(0, 4)), Number(event.date.slice(5, 7)) - 1, Number(event.date.slice(8, 10)), h, m).getTime();
}

const reminderKey = (event) => `${event.id}|${event.date}|${event.time}|${event.remind}`;

function reminderText(event) {
  const clock = new Date(startMs(event)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (event.remind === 0) return `${event.title} is starting now.`;
  const lead = event.remind === 60 ? '1 hour' : `${event.remind} minutes`;
  return `${event.title} starts in ${lead}, at ${clock}.`;
}

// Reminders that should go off right now and have not gone off yet.
function dueReminders(events, nowMs, fired) {
  return events.filter((e) => e.time && e.remind !== null && !fired.includes(reminderKey(e))).filter((e) => {
    const start = startMs(e);
    return nowMs >= start - e.remind * 60000 && nowMs <= start + LATE_GRACE_MS;
  });
}

const byTime = (a, b) => (a.date + (a.time || '00:00')).localeCompare(b.date + (b.time || '00:00')) || a.title.localeCompare(b.title);

function createCalendarService({ store, announce, fetchImpl = fetchText, now = Date.now }) {
  const state = () => ({ events: [], feeds: [], fired: [], ...store.get('calendar', {}) });
  const save = (next) => store.set('calendar', next);
  const caches = () => store.get('calendarFeeds', {});
  let timer = null;

  async function pullFeed(feed) {
    const events = parseIcs(await fetchImpl(feed.url, { maxBytes: FEED_MAX_BYTES }));
    const oldest = addDays(keyOf(new Date(now())), -OLD_DAYS_KEPT);
    const kept = events.filter((e) => e.rule || e.date >= oldest); // old one-off events are dropped to keep the saved file small
    store.set('calendarFeeds', { ...caches(), [feed.id]: { at: now(), events: kept, error: '' } });
    return kept.length;
  }

  async function refreshFeeds({ force = false } = {}) {
    for (const feed of state().feeds) {
      const cache = caches()[feed.id];
      if (!force && cache && now() - cache.at < FEED_REFRESH_MS) continue;
      try {
        await pullFeed(feed);
      } catch (err) {
        store.set('calendarFeeds', { ...caches(), [feed.id]: { ...(cache || { events: [], at: 0 }), error: err.message } }); // old events stay visible
      }
    }
  }

  function checkReminders() {
    const current = state();
    const due = dueReminders(current.events, now(), current.fired);
    if (!due.length) return;
    save({ ...current, fired: [...current.fired, ...due.map(reminderKey)].slice(-MAX_FIRED) });
    due.forEach((event) => announce(reminderText(event)));
  }

  return {
    // Everything happening between two days, mine and subscribed, in time order.
    list(fromKey, toKey) {
      if (!isDay(fromKey) || !isDay(toKey) || fromKey > toKey) throw new Error('Pick a valid range');
      const current = state();
      const mine = current.events.filter((e) => e.date >= fromKey && e.date <= toKey).map((e) => ({ ...e, source: 'me' }));
      const cache = caches();
      const subscribed = current.feeds.flatMap((feed) => occurrencesBetween((cache[feed.id] || { events: [] }).events, fromKey, toKey).map((o) => ({ ...o, source: feed.name })));
      return [...mine, ...subscribed].sort(byTime);
    },
    add(input) {
      const current = state();
      if (current.events.length >= MAX_EVENTS) throw new Error('Too many events saved. Delete some first.');
      const event = { id: crypto.randomUUID(), ...cleanEvent(input) };
      save({ ...current, events: [...current.events, event] });
      checkReminders();
      return event;
    },
    remove(id) {
      const current = state();
      save({ ...current, events: current.events.filter((e) => e.id !== id) });
    },
    feeds() {
      const cache = caches();
      return state().feeds.map((feed) => ({ ...feed, count: ((cache[feed.id] || {}).events || []).length, error: (cache[feed.id] || {}).error || '' }));
    },
    async addFeed({ name, url }) {
      const current = state();
      if (current.feeds.length >= MAX_FEEDS) throw new Error(`You can follow up to ${MAX_FEEDS} calendars`);
      const address = String(url || '').trim().replace(/^webcal:/i, 'https:');
      let parsed;
      try { parsed = new URL(address); } catch { throw new Error('That is not a web address'); }
      if (parsed.protocol !== 'https:') throw new Error('Only secure (https) calendar links work');
      if (current.feeds.some((f) => f.url === parsed.toString())) throw new Error('You already follow that calendar');
      const feed = { id: crypto.randomUUID(), name: String(name || parsed.hostname).trim().slice(0, 40) || parsed.hostname, url: parsed.toString() };
      const count = await pullFeed(feed); // fails here, before saving, if the link does not work
      if (count === 0) {
        store.set('calendarFeeds', Object.fromEntries(Object.entries(caches()).filter(([id]) => id !== feed.id)));
        throw new Error('That link has no events in it');
      }
      save({ ...state(), feeds: [...state().feeds, feed] });
      return feed;
    },
    removeFeed(id) {
      const current = state();
      save({ ...current, feeds: current.feeds.filter((f) => f.id !== id) });
      store.set('calendarFeeds', Object.fromEntries(Object.entries(caches()).filter(([key]) => key !== id)));
    },
    refresh: () => refreshFeeds({ force: true }),
    presets: () => PRESETS,
    start() {
      checkReminders();
      refreshFeeds();
      timer = setInterval(() => { checkReminders(); refreshFeeds(); }, 30000);
    },
    stop() { clearInterval(timer); },
    checkReminders,
  };
}

module.exports = { createCalendarService, cleanEvent, dueReminders, PRESETS };
