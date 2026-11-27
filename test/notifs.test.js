const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

// The reader looks in %LOCALAPPDATA%\Microsoft\Windows\Notifications, so point it at a throw-away folder with a real database
// shaped like Windows' own (checked against a real one: "Order" is a plain INTEGER PRIMARY KEY, ArrivalTime is a 64-bit number).
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'notifs-test-'));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'notifs-scratch-'));
const dbDir = path.join(home, 'Microsoft', 'Windows', 'Notifications');
fs.mkdirSync(dbDir, { recursive: true });
process.env.LOCALAPPDATA = home;
const { watchNotifications, sweepStaleSnapshots } = require('../lib/notifs');
test.after(() => { fs.rmSync(home, { recursive: true, force: true }); fs.rmSync(tempRoot, { recursive: true, force: true }); });

const toast = (...lines) => `<toast><visual><binding>${lines.map((l) => `<text>${l}</text>`).join('')}</binding></visual></toast>`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const BIG_ARRIVAL = 134400141568129704n; // a real Windows arrival time: too big for a plain JavaScript number

const insert = (db, order, text, arrival = BIG_ARRIVAL + BigInt(order)) => db.prepare('INSERT INTO Notification ("Order", Payload, Type, ArrivalTime) VALUES (?, ?, ?, ?)').run(order, Buffer.from(text), 'toast', arrival);

function freshDb(rows = []) {
  const file = path.join(dbDir, 'wpndatabase.db');
  fs.rmSync(file, { force: true });
  const db = new DatabaseSync(file);
  db.prepare('CREATE TABLE Notification ("Order" INTEGER NOT NULL PRIMARY KEY, Payload BLOB, Type TEXT NOT NULL, ArrivalTime INT64)').run();
  for (const [order, text] of rows) insert(db, order, text);
  return db;
}

// Starts watching, lets the start-up look happen, changes the database, and returns what was announced and what went wrong.
async function listenWhile(db, change, { settleMs = 700 } = {}) {
  const heard = [];
  const errors = [];
  const timer = watchNotifications({ getFilter: () => null, onNotify: (n) => heard.push(n), onError: (e) => errors.push(e.message), pollMs: 100, tempRoot });
  try {
    await wait(350);
    change(db);
    await wait(settleMs);
  } finally {
    clearInterval(timer);
    db.close();
  }
  return { heard, errors };
}

test('a popup that arrives while the database was empty at start-up is still shown', async () => {
  const { heard, errors } = await listenWhile(freshDb(), (db) => insert(db, 1, toast('Mum', 'Dinner is ready')));
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(heard, [{ title: 'Mum', body: 'Dinner is ready' }]);
});

test('popups already there at start-up are ignored, a new one is shown exactly once', async () => {
  const { heard } = await listenWhile(freshDb([[5, toast('Old', 'already seen')]]), (db) => insert(db, 6, toast('New', 'just now')), { settleMs: 1000 });
  assert.deepStrictEqual(heard, [{ title: 'New', body: 'just now' }]);
});

test('Windows hands out the same number again after the newest popup is removed, and the next popup is still shown', async () => {
  const db = freshDb([[5, toast('First', 'seen at start')]]);
  const { heard } = await listenWhile(db, (d) => {
    d.prepare('DELETE FROM Notification WHERE "Order" = 5').run(); // dismissed
    insert(d, 5, toast('Second', 'reuses number 5'), BIG_ARRIVAL + 999n); // the next popup gets number 5 again
  });
  assert.deepStrictEqual(heard, [{ title: 'Second', body: 'reuses number 5' }]);
});

test('64-bit arrival times do not crash the reader', async () => {
  const { heard, errors } = await listenWhile(freshDb([[1, toast('A', 'a')]]), (db) => insert(db, 2, toast('B', 'b'), 9007199254740993n));
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(heard, [{ title: 'B', body: 'b' }]);
});

test('removing a popup, with nothing new, announces nothing', async () => {
  const { heard } = await listenWhile(freshDb([[1, toast('A', 'a')], [2, toast('B', 'b')]]), (db) => db.prepare('DELETE FROM Notification WHERE "Order" = 2').run());
  assert.deepStrictEqual(heard, []);
});

test('no copy of the notification database is left behind after reading', async () => {
  await listenWhile(freshDb([[1, toast('A', 'a')]]), (db) => insert(db, 2, toast('B', 'b')));
  assert.deepStrictEqual(fs.readdirSync(tempRoot).filter((name) => name.startsWith('notch-')), []);
});

test('old leftover copies are swept away, but fresh ones and unrelated folders are not touched', () => {
  const make = (name, files, ageMinutes) => {
    const dir = path.join(tempRoot, name);
    fs.mkdirSync(dir);
    for (const file of files) fs.writeFileSync(path.join(dir, file), 'x');
    const when = new Date(Date.now() - ageMinutes * 60000);
    fs.utimesSync(dir, when, when);
    return dir;
  };
  const staleCopy = make('notch-AbCdE1', ['wpndatabase.db', 'wpndatabase.db-wal', 'wpndatabase.db-shm'], 30);
  const staleEmpty = make('notch-AbCdE2', [], 30);
  const freshCopy = make('notch-AbCdE3', ['wpndatabase.db'], 0);
  const otherPurpose = make('notch-AbCdE4', ['important.txt'], 30); // same name pattern, but not ours
  const unrelated = make('something-else', ['wpndatabase.db'], 30);
  assert.strictEqual(sweepStaleSnapshots(tempRoot), 2);
  assert.ok(!fs.existsSync(staleCopy) && !fs.existsSync(staleEmpty), 'old copies are gone');
  for (const kept of [freshCopy, otherPurpose, unrelated]) assert.ok(fs.existsSync(kept), kept);
});
