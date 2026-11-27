// Reads new Windows toast popups from the system notification database.
// WhatsApp Web in Chrome/Edge shows up here as a normal toast.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_DIR = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Notifications');
const POLL_MS = 2000;
const STALE_COPY_MS = 2 * 60 * 1000; // a copy this old was left by a program that was stopped half way through reading
const COPY_FOLDER = /^notch-[A-Za-z0-9]{6}$/; // what the folder from fs.mkdtempSync('notch-') looks like

function readTexts(payload) {
  const xml = Buffer.from(payload).toString('utf8');
  return [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => decode(m[1]).trim()).filter(Boolean);
}

function decode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// The live db is locked by Windows, so read a copy. The copy holds private messages, so it is deleted right after reading.
function snapshot(tempRoot) {
  const tmp = fs.mkdtempSync(path.join(tempRoot, 'notch-'));
  for (const f of ['wpndatabase.db', 'wpndatabase.db-wal', 'wpndatabase.db-shm']) {
    try { fs.copyFileSync(path.join(DB_DIR, f), path.join(tmp, f)); } catch { /* wal/shm may not exist */ }
  }
  return tmp;
}

// Removes copies left behind when the app was stopped in the middle of a read (a crash, a forced stop, a power cut).
// Only old folders of this exact shape that hold nothing but database files are touched. Returns how many were removed.
function sweepStaleSnapshots(tempRoot = os.tmpdir(), now = Date.now()) {
  let removed = 0;
  try {
    for (const name of fs.readdirSync(tempRoot)) {
      if (!COPY_FOLDER.test(name)) continue;
      const dir = path.join(tempRoot, name);
      try {
        if (now - fs.statSync(dir).mtimeMs < STALE_COPY_MS) continue;
        if (!fs.readdirSync(dir).every((file) => file.startsWith('wpndatabase.db'))) continue; // not ours
        fs.rmSync(dir, { recursive: true, force: true });
        removed += 1;
      } catch { /* in use or already gone: the next start tries again */ }
    }
  } catch { /* no temp folder to look in */ }
  return removed;
}

// Every toast now in the database. Windows can reuse a popup number once the newest popup is removed, so the number alone says
// nothing about whether a popup is new: the arrival time goes with it, as text because it is too big for a plain JavaScript number.
function readToasts(tempRoot) {
  const tmp = snapshot(tempRoot);
  let db = null;
  try {
    db = new DatabaseSync(path.join(tmp, 'wpndatabase.db'), { readOnly: true });
    return db.prepare('SELECT "Order" AS ord, CAST(ArrivalTime AS TEXT) AS at, Payload FROM Notification WHERE Type = ? ORDER BY "Order"').all('toast');
  } finally {
    try { if (db) db.close(); } catch { /* closing twice is harmless */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* the sweep at the next start removes it */ }
  }
}

const keyOf = (row) => `${row.ord}:${row.at}`;

// getFilter: returns a RegExp tested against the toast text, or null for everything.
// It is called on every popup so settings changes apply immediately.
function watchNotifications({ getFilter, onNotify, onError, pollMs = POLL_MS, tempRoot = os.tmpdir() }) {
  sweepStaleSnapshots(tempRoot);
  let seen = null; // the popups already handled; null until the first successful look
  const tick = () => {
    try {
      const rows = readToasts(tempRoot);
      const fresh = seen === null ? [] : rows.filter((row) => !seen.has(keyOf(row))); // what was already there at start-up is ignored
      seen = new Set(rows.map(keyOf));
      for (const r of fresh) {
        const texts = readTexts(r.Payload);
        const filter = getFilter();
        if (!texts.length || (filter && !filter.test(texts.join(' ')))) continue;
        onNotify({ title: texts[0], body: texts.slice(1).join(' ') });
      }
    } catch (err) {
      onError(err);
    }
  };
  tick();
  return setInterval(tick, pollMs);
}

module.exports = { watchNotifications, sweepStaleSnapshots };
