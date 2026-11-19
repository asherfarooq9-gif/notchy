// Screen Time: how long each program was in front while you were actually using the computer.
// Off until you turn it on. It records only program names (like "chrome") and seconds, never window titles or what you type.
// All numbers stay in a file on this computer.
const IDLE_LIMIT_S = 120; // no key or mouse for this long: the time is not counted
const MAX_GAP_S = 15; // readings arrive every 5 seconds; a longer gap (sleep, pause) counts as at most this much
const KEEP_DAYS = 35;
const MAX_APPS_PER_DAY = 60;
const FLUSH_EVERY_S = 60;
const MAX_LIMIT_MINUTES = 24 * 60;

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const cleanApp = (name) => String(name || '').replace(/\.exe$/i, '').replace(/[^\w .+\-()]/g, '').trim().slice(0, 40).toLowerCase();

function createScreenTime({ store, announce, now = Date.now }) {
  const fresh = { enabled: false, limitMinutes: 0, days: {}, nudgedOn: '' };
  let data = { ...fresh, ...store.get('screentime', {}) };
  let lastAt = 0;
  let unsaved = 0;

  const flush = () => { store.set('screentime', data); unsaved = 0; };
  const totalOf = (day) => Object.values((day && day.apps) || {}).reduce((sum, s) => sum + s, 0);

  function prune() {
    const keep = Object.keys(data.days).sort().slice(-KEEP_DAYS);
    data = { ...data, days: Object.fromEntries(keep.map((k) => [k, data.days[k]])) };
  }

  return {
    // One reading from the desktop watcher: {app, idle seconds}.
    tick({ app, idle }) {
      const at = now();
      const gap = lastAt ? Math.min((at - lastAt) / 1000, MAX_GAP_S) : 0;
      lastAt = at;
      const name = cleanApp(app);
      if (!data.enabled || !name || !(idle < IDLE_LIMIT_S) || gap <= 0) return;
      const key = dayKey(at);
      const day = data.days[key] || { apps: {} };
      const known = (n) => Object.hasOwn(day.apps, n); // own entries only: a program named "constructor" must not hit built-in properties
      const slot = known(name) || Object.keys(day.apps).length < MAX_APPS_PER_DAY ? name : 'other';
      data = { ...data, days: { ...data.days, [key]: { apps: { ...day.apps, [slot]: (known(slot) ? day.apps[slot] : 0) + gap } } } };
      unsaved += gap;
      if (data.limitMinutes > 0 && data.nudgedOn !== key && totalOf(data.days[key]) >= data.limitMinutes * 60) {
        data = { ...data, nudgedOn: key };
        flush();
        announce(`You have used the computer for ${data.limitMinutes >= 60 ? `${+(data.limitMinutes / 60).toFixed(1)} hours` : `${data.limitMinutes} minutes`} today. Time for a break?`);
        return;
      }
      if (unsaved >= FLUSH_EVERY_S) { prune(); flush(); }
    },
    get() {
      const at = now();
      const today = data.days[dayKey(at)] || { apps: {} };
      const week = Array.from({ length: 7 }, (_, i) => dayKey(at - (6 - i) * 86400000)).map((date) => ({ date, seconds: Math.round(totalOf(data.days[date])) }));
      const apps = Object.entries(today.apps).map(([name, seconds]) => ({ name, seconds: Math.round(seconds) })).sort((a, b) => b.seconds - a.seconds).slice(0, 10);
      return { enabled: data.enabled, limitMinutes: data.limitMinutes, today: { seconds: Math.round(totalOf(today)), apps }, week };
    },
    set({ enabled, limitMinutes }) {
      const limit = Number(limitMinutes);
      data = {
        ...data,
        enabled: enabled === true,
        limitMinutes: Number.isFinite(limit) && limit > 0 ? Math.min(Math.round(limit), MAX_LIMIT_MINUTES) : 0,
      };
      lastAt = 0;
      flush();
    },
    clear() { data = { ...data, days: {}, nudgedOn: '' }; flush(); },
    flush,
  };
}

module.exports = { createScreenTime, cleanApp };
