// Reads new Windows toast popups from the system notification database.
// WhatsApp Web in Chrome/Edge shows up here as a normal toast.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_DIR = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Notifications');
const POLL_MS = 2000;

function readTexts(payload) {
  const xml = Buffer.from(payload).toString('utf8');
  return [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => decode(m[1]).trim()).filter(Boolean);
}

function decode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// The live db is locked by Windows, so read a copy.
function snapshot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-'));
  for (const f of ['wpndatabase.db', 'wpndatabase.db-wal', 'wpndatabase.db-shm']) {
    try { fs.copyFileSync(path.join(DB_DIR, f), path.join(tmp, f)); } catch { /* wal/shm may not exist */ }
  }
  return tmp;
}

function readSince(lastOrder) {
  const tmp = snapshot();
  try {
    const db = new DatabaseSync(path.join(tmp, 'wpndatabase.db'), { readOnly: true });
    const rows = db.prepare('SELECT "Order" AS ord, Payload FROM Notification WHERE "Order" > ? AND Type = ? ORDER BY "Order"').all(lastOrder, 'toast');
    const maxRow = db.prepare('SELECT MAX("Order") AS m FROM Notification').get();
    db.close();
    return { rows, max: maxRow.m || lastOrder };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// getFilter: returns a RegExp tested against the toast text, or null for everything.
// It is called on every popup so settings changes apply immediately.
function watchNotifications({ getFilter, onNotify, onError }) {
  let last = null;
  const tick = () => {
    try {
      const { rows, max } = readSince(last === null ? Number.MAX_SAFE_INTEGER : last);
      if (last === null) { last = max; return; } // ignore what was already there at startup
      for (const r of rows) {
        const texts = readTexts(r.Payload);
        const filter = getFilter();
        if (!texts.length || (filter && !filter.test(texts.join(' ')))) continue;
        onNotify({ title: texts[0], body: texts.slice(1).join(' ') });
      }
      last = Math.max(last, max);
    } catch (err) {
      onError(err);
    }
  };
  tick();
  return setInterval(tick, POLL_MS);
}

module.exports = { watchNotifications };
