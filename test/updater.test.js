const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { createUpdater, friendlyError, CHECK_DELAY_MS, CHECK_EVERY_MS } = require('../lib/updater');

function world({ isPackaged = true, enabled = true } = {}) {
  const auto = new EventEmitter();
  auto.checks = 0;
  auto.installs = [];
  auto.checkForUpdates = async () => { auto.checks += 1; };
  auto.quitAndInstall = (...args) => auto.installs.push(args);
  const timers = [];
  const w = { auto, enabled, statuses: [], timers };
  w.updater = createUpdater({
    autoUpdater: auto, version: '0.1.0', isPackaged, isEnabled: () => w.enabled,
    onStatus: (s) => w.statuses.push(s),
    schedule: (fn, ms) => { const t = { fn, ms, cancelled: false }; timers.push(t); return t; },
    cancel: (t) => { t.cancelled = true; },
  });
  return w;
}
const last = (w) => w.statuses[w.statuses.length - 1];

test('electron-updater is set to download by itself, install on quit, and never go back or take pre-releases', () => {
  const { auto } = world();
  assert.deepStrictEqual([auto.autoDownload, auto.autoInstallOnAppQuit, auto.allowPrerelease, auto.allowDowngrade], [true, true, false, false]);
});
test('the first check comes a little after start, then every six hours', async () => {
  const w = world();
  w.updater.start();
  assert.strictEqual(w.timers[0].ms, CHECK_DELAY_MS);
  await w.timers[0].fn();
  assert.strictEqual(w.auto.checks, 1);
  assert.strictEqual(w.timers[1].ms, CHECK_EVERY_MS);
  w.updater.stop();
  assert.ok(w.timers[1].cancelled, 'stop cancels the next check');
});
test('a development run never checks, and says why', async () => {
  const w = world({ isPackaged: false });
  w.updater.start();
  await w.timers[0].fn();
  assert.strictEqual(w.auto.checks, 0);
  assert.deepStrictEqual([last(w).phase, last(w).reason], ['off', 'dev']);
  await w.updater.checkNow();
  assert.strictEqual(w.auto.checks, 0, 'even "check now" does nothing in a development run');
});
test('with the setting off nothing is checked by the timer, and switching it on takes effect', async () => {
  const w = world({ enabled: false });
  w.updater.start();
  await w.timers[0].fn();
  assert.strictEqual(w.auto.checks, 0);
  assert.deepStrictEqual([last(w).phase, last(w).reason], ['off', 'setting']);
  w.enabled = true;
  w.updater.sync();
  assert.strictEqual(last(w).phase, 'idle');
  await w.timers[1].fn();
  assert.strictEqual(w.auto.checks, 1);
});
test('"check now" works even when the automatic check is off', async () => {
  const w = world({ enabled: false });
  w.updater.start();
  await w.updater.checkNow();
  assert.strictEqual(w.auto.checks, 1);
});
test('events become a simple status: checking, downloading with percent, ready', () => {
  const w = world();
  w.auto.emit('checking-for-update');
  assert.strictEqual(last(w).phase, 'checking');
  w.auto.emit('update-available', { version: '0.2.0' });
  assert.deepStrictEqual([last(w).phase, last(w).latest], ['downloading', '0.2.0']);
  w.auto.emit('download-progress', { percent: 41.6 });
  assert.strictEqual(last(w).percent, 42);
  w.auto.emit('download-progress', { percent: 400 });
  assert.strictEqual(last(w).percent, 100, 'never above 100');
  w.auto.emit('update-downloaded', { version: '0.2.0' });
  assert.deepStrictEqual([last(w).phase, last(w).latest], ['ready', '0.2.0']);
});
test('up to date, and errors, are reported without crashing', async () => {
  const w = world();
  w.auto.emit('update-not-available', {});
  assert.strictEqual(last(w).phase, 'current');
  w.auto.checkForUpdates = async () => { throw new Error('getaddrinfo ENOTFOUND github.com'); };
  await w.updater.checkNow();
  assert.deepStrictEqual([last(w).phase, last(w).error], ['error', 'Could not reach GitHub. Check your internet connection.']);
});
test('no second check starts while one is running, an update is downloading, or one is ready', async () => {
  const w = world();
  w.auto.emit('checking-for-update');
  await w.updater.checkNow();
  w.auto.emit('update-available', { version: '0.2.0' });
  await w.updater.checkNow();
  w.auto.emit('update-downloaded', { version: '0.2.0' });
  await w.updater.checkNow();
  assert.strictEqual(w.auto.checks, 0);
});
test('install runs only when an update is ready', () => {
  const w = world();
  assert.strictEqual(w.updater.install(), false);
  w.auto.emit('update-available', { version: '0.2.0' });
  assert.strictEqual(w.updater.install(), false, 'still downloading');
  assert.strictEqual(w.auto.installs.length, 0);
  w.auto.emit('update-downloaded', { version: '0.2.0' });
  assert.strictEqual(w.updater.install(), true);
  assert.deepStrictEqual(w.auto.installs, [[false, true]]);
});
test('error text is short and friendly', () => {
  assert.match(friendlyError(new Error('HttpError: 404 latest.yml')), /No update is published yet/);
  assert.strictEqual(friendlyError(new Error('x'.repeat(500))).length, 120);
  assert.strictEqual(friendlyError(null), 'The update check did not work.');
});
