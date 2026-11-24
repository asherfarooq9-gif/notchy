// Auto-update from GitHub Releases, through electron-updater. This file only decides WHEN to check and keeps a simple status;
// the download, the checksum check and the install are done by electron-updater (autoUpdater is passed in, so tests can fake it).
// Nothing is checked in a development run (npm start), only in the installed app, and only while the setting is on.
const CHECK_DELAY_MS = 30 * 1000; // first check, a little after start-up
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const MAX_ERROR_CHARS = 120;

const firstLine = (text) => String(text || '').trim().split(/\r?\n/)[0].slice(0, MAX_ERROR_CHARS);

function friendlyError(error) {
  const text = firstLine(error && error.message);
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EAI_AGAIN|net::|network/i.test(text)) return 'Could not reach GitHub. Check your internet connection.';
  if (/404|no published versions|latest\.yml/i.test(text)) return 'No update is published yet.';
  return text || 'The update check did not work.';
}

// phase: off | idle | checking | downloading | ready | current | error
function createUpdater({ autoUpdater, version, isPackaged, isEnabled, onStatus = () => {}, schedule = setTimeout, cancel = clearTimeout }) {
  let state = { phase: 'idle', version, latest: null, percent: 0, error: null, reason: null };
  let timer = null;
  let isRunning = false;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // an update that is ready installs by itself when you quit
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  const canRun = () => isPackaged && isEnabled();
  const set = (patch) => {
    state = { ...state, ...patch };
    onStatus({ ...state });
  };
  const reasonOff = () => (isPackaged ? 'setting' : 'dev');
  const isBusy = () => state.phase === 'checking' || state.phase === 'downloading' || state.phase === 'ready';

  autoUpdater.on('checking-for-update', () => set({ phase: 'checking', error: null }));
  autoUpdater.on('update-available', (info) => set({ phase: 'downloading', latest: info && info.version ? String(info.version) : null, percent: 0 }));
  autoUpdater.on('update-not-available', () => set({ phase: 'current', latest: null }));
  autoUpdater.on('download-progress', (progress) => set({ phase: 'downloading', percent: Math.min(100, Math.max(0, Math.round(Number(progress && progress.percent) || 0))) }));
  autoUpdater.on('update-downloaded', (info) => set({ phase: 'ready', latest: info && info.version ? String(info.version) : state.latest, percent: 100 }));
  autoUpdater.on('error', (error) => set({ phase: 'error', error: friendlyError(error) }));

  async function check() {
    if (isBusy()) return;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      set({ phase: 'error', error: friendlyError(error) });
    }
  }

  let isFirst = true;
  function loop() {
    const wait = isFirst ? CHECK_DELAY_MS : CHECK_EVERY_MS;
    isFirst = false;
    timer = schedule(async () => {
      timer = null;
      if (!isRunning) return;
      if (canRun()) await check();
      if (isRunning) loop();
    }, wait);
  }

  return {
    status: () => ({ ...state, enabled: canRun(), canCheck: isPackaged }),
    // Starts the schedule. Safe to call again.
    start() {
      if (isRunning) return;
      isRunning = true;
      if (!canRun()) set({ phase: 'off', reason: reasonOff() });
      loop();
    },
    // Call when a setting changed: switching the check on or off takes effect at once.
    sync() {
      if (!canRun()) { if (!isBusy()) set({ phase: 'off', reason: reasonOff() }); return; }
      if (state.phase === 'off') set({ phase: 'idle', reason: null });
    },
    // "Check now" button. Does nothing in a development run.
    async checkNow() {
      if (!isPackaged) { set({ phase: 'off', reason: 'dev' }); return; }
      await check();
    },
    // "Restart and update" button. Only when an update has been downloaded.
    install() {
      if (state.phase !== 'ready') return false;
      autoUpdater.quitAndInstall(false, true); // not silent: the installer shows progress; start the app again afterwards
      return true;
    },
    stop() {
      isRunning = false;
      if (timer) cancel(timer);
      timer = null;
    },
  };
}

module.exports = { createUpdater, friendlyError, CHECK_DELAY_MS, CHECK_EVERY_MS };
