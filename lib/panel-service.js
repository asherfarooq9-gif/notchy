// Everything behind the panel of tools: saved data, clipboard history, timers, system numbers, and the window.
// main.js creates one of these and passes in the few things it needs from the rest of the app.
const fs = require('fs');
const path = require('path');
const { app, clipboard, nativeImage, ipcMain, shell } = require('electron');
const { createResolver, ROOT_NAMES } = require('./assistant-paths');
const { createPlanner, runClaudeOnce } = require('./assistant-ask');
const { createRunner } = require('./assistant-run');
const { createAssistantService } = require('./assistant-service');
const { findClaude } = require('./claude');
const { MODULES } = require('./modules');
const { createStore } = require('./store');
const { createPanel } = require('./panel');
const { createSampler } = require('./system');
const { createClipboardWatcher } = require('./clipboard-watcher');
const { createTimerService } = require('./timer-service');
const { convert, unitsOf, CATEGORY_NAMES } = require('./units');
const { createWeatherService } = require('./weather');
const { createCurrencyService } = require('./currency');
const { createCalendarService } = require('./calendar');
const { createShelfService } = require('./shelf');
const { copyFilesToClipboard } = require('./file-clipboard');
const { createConverterService } = require('./converter-service');
const { createDocConverter } = require('./doc-convert');
const { createPdfService } = require('./pdf-tools');
const { createPhoneLink } = require('./phone-link');
const life = require('./life');
const { qrSvg } = require('./phone-qr');
const { createScreenTime } = require('./screen-time');

const SERVICE_OWNED_DATA = new Set(['shelves', 'calendar', 'calendarFeeds', 'screentime', 'weather', 'currencyRates', 'life']);
const MAX_COPY_CHARS = 20000;
const MAX_PEEK_CHARS = 2000;
const ALERT_CARD_MS = 9000;
const NOTCH_TIMER_WAKE_MS = 1500;

function timerLabel(snapshot) {
  if (snapshot.kind === 'stopwatch') return `Stopwatch ${snapshot.text}`;
  if (snapshot.kind === 'countdown') return `Timer ${snapshot.text}`;
  return `${snapshot.phase === 'focus' ? 'Focus' : 'Break'} ${snapshot.text}`;
}

function alertMessage(event) {
  if (event.type === 'water') return 'Time for some water.';
  if (event.type === 'finished') return 'Your timer is finished.';
  if (event.to === 'focus') return 'Break is over. Time to focus.';
  return event.to === 'long-break' ? 'Focus session done. Take a long break.' : 'Focus session done. Take a short break.';
}

// Only web links may be opened from the panel.
function assertWebUrl(value) {
  const url = new URL(String(value));
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Only web links can be opened');
  return url.toString();
}

function createPanelService({ dataDir, rootDir, getSettings, deliverToNotch, wakeNotch, announce, celebrate = () => {}, runCommand = () => {}, onCopied, setActivityWatch = () => {} }) {
  const store = createStore(dataDir);
  let sampler = null;

  const panel = createPanel({
    preload: path.join(rootDir, 'panel-preload.js'),
    page: path.join(rootDir, 'renderer', 'panel.html'),
    getSettings,
    onShown: () => sampler.start(),
    onHidden: () => sampler.stop(),
  });
  sampler = createSampler({ onSample: (stats) => panel.send('system:stats', stats) });

  const clipboardWatcher = createClipboardWatcher({
    clipboard,
    nativeImage,
    store,
    onChange: () => panel.send('clipboard:changed', null),
    onCopy: onCopied,
  });

  const timerService = createTimerService({
    store,
    onTick(snapshot) {
      panel.send('timer', snapshot);
      const isShownInNotch = getSettings().showTimerInNotch && snapshot.isRunning;
      deliverToNotch('timer', { text: isShownInNotch ? timerLabel(snapshot) : '' });
      if (isShownInNotch) wakeNotch(NOTCH_TIMER_WAKE_MS);
    },
    onEvent: (event) => {
      announce(alertMessage(event));
      if (event.type !== 'water') celebrate();
      if (event.type === 'phase' && event.from === 'focus') recordFocusDone();
    },
  });

  // A finished focus session goes in the character's daily tally. Passing a streak milestone gets its own cheer.
  function recordFocusDone() {
    const today = life.dayKey(new Date());
    const before = store.get('life', {});
    const after = life.addFocus(before, today);
    store.set('life', after);
    const hit = life.milestoneHit(life.streakOf(before, today), life.streakOf(after, today));
    if (hit) announce(`${hit}-day focus streak. Nice work!`);
  }

  const weatherService = createWeatherService({ store });
  const currencyService = createCurrencyService({ store });
  const calendarService = createCalendarService({ store, announce });
  const shelfService = createShelfService({ store });
  const converterService = createConverterService();
  const docConverter = createDocConverter();
  const pdfTools = createPdfService();
  const screenTime = createScreenTime({ store, announce });
  const resolver = createResolver(Object.fromEntries(ROOT_NAMES.map((name) => [name, app.getPath(name.toLowerCase())])));
  const assistant = createAssistantService({
    planner: createPlanner({ resolver, runModel: (prompt) => runClaudeOnce(prompt, { findClaude }) }),
    runner: createRunner({ resolver, trashItem: (p) => shell.trashItem(p), openPath: (p) => shell.openPath(p), openExternal: (u) => shell.openExternal(u) }),
    onUpdate: (state) => panel.send('assistant:update', state),
    isEnabled: () => getSettings().assistantTasks,
  });
  // Phone link: off until started in the Phone tab. The QR picture is kept here because the link (with its code) only exists at start.
  let phoneQr = null;
  const phoneView = (s) => ({ running: s.running, url: s.url, expiresAt: s.expiresAt, phone: s.phone, received: s.received, saveDir: s.saveDir, qr: s.running ? phoneQr : null });
  const phone = createPhoneLink({
    saveDir: path.join(app.getPath('downloads'), 'From phone'),
    onChange: (s) => panel.send('phone:update', phoneView(s)),
  });
  const dragIcon = nativeImage.createFromPath(path.join(rootDir, 'assets', 'tray.png')).resize({ width: 32, height: 32 });

  const panelSettings = () => ({
    modules: getSettings().modules.map((id) => MODULES.find((m) => m.id === id)).filter(Boolean),
    theme: getSettings().theme,
    colorMode: getSettings().colorMode,
  });

  function registerIpc() {
    ipcMain.handle('panel:settings', panelSettings);
    // These tools keep their data through their own checked commands, so the general save command may not touch it.
    const assertOpenData = (name) => { if (SERVICE_OWNED_DATA.has(name)) throw new Error('That data can only be changed by its own tool'); return name; };
    ipcMain.handle('data:get', (_e, name, fallback) => store.get(assertOpenData(String(name)), fallback));
    ipcMain.handle('data:set', (_e, name, value) => store.set(assertOpenData(String(name)), value));
    ipcMain.handle('timer:get', () => timerService.snapshot());
    ipcMain.handle('timer:act', (_e, action, args) => timerService.act(String(action), args && typeof args === 'object' ? args : {}));
    ipcMain.handle('clipboard:list', (_e, query) => clipboardWatcher.list(String(query || '')));
    ipcMain.handle('clipboard:act', (_e, action, id) => clipboardWatcher.act(String(action), String(id || '')));
    ipcMain.handle('clipboard:current-text', () => clipboardWatcher.currentText().slice(0, MAX_PEEK_CHARS));
    ipcMain.handle('units:meta', () => ({ categories: CATEGORY_NAMES.map((name) => ({ name, units: unitsOf(name) })) }));
    ipcMain.handle('units:convert', (_e, category, value, from, to) => convert(String(category), Number(value), String(from), String(to)));
    ipcMain.handle('currency:meta', () => currencyService.meta());
    ipcMain.handle('currency:convert', (_e, amount, from, to) => currencyService.convert(Number(amount), from, to));
    ipcMain.handle('weather:search', (_e, query) => weatherService.search(query));
    ipcMain.handle('weather:choose', (_e, place) => weatherService.choose(place));
    ipcMain.handle('weather:unit', (_e, unit) => weatherService.setUnit(unit));
    ipcMain.handle('weather:get', (_e, force) => weatherService.get({ force: force === true }));
    ipcMain.handle('calendar:list', (_e, from, to) => calendarService.list(from, to));
    ipcMain.handle('calendar:add', (_e, input) => calendarService.add(input));
    ipcMain.handle('calendar:remove', (_e, id) => calendarService.remove(String(id)));
    ipcMain.handle('calendar:feeds', () => ({ feeds: calendarService.feeds(), presets: calendarService.presets() }));
    ipcMain.handle('calendar:add-feed', (_e, input) => calendarService.addFeed(input || {}));
    ipcMain.handle('calendar:remove-feed', (_e, id) => calendarService.removeFeed(String(id)));
    ipcMain.handle('calendar:refresh', () => calendarService.refresh());
    ipcMain.handle('shelf:list', () => shelfService.list());
    ipcMain.handle('shelf:create', (_e, name) => shelfService.create(name));
    ipcMain.handle('shelf:rename', (_e, shelfId, name) => shelfService.rename(String(shelfId), name));
    ipcMain.handle('shelf:delete', (_e, shelfId) => shelfService.delete(String(shelfId)));
    ipcMain.handle('shelf:add', (_e, shelfId, paths) => shelfService.add(String(shelfId), paths));
    ipcMain.handle('shelf:remove', (_e, shelfId, fileId) => shelfService.removeFile(String(shelfId), String(fileId)));
    ipcMain.handle('shelf:clear', (_e, shelfId) => shelfService.clear(String(shelfId)));
    ipcMain.handle('shelf:open', async (_e, shelfId, fileId) => {
      const problem = await shell.openPath(shelfService.openablePath(String(shelfId), String(fileId)));
      if (problem) throw new Error(problem);
    });
    ipcMain.handle('shelf:reveal', (_e, shelfId, fileId) => shell.showItemInFolder(shelfService.pathOf(String(shelfId), String(fileId))));
    ipcMain.handle('shelf:copy-all', (_e, shelfId) => copyFilesToClipboard(shelfService.existingPaths(String(shelfId))));
    ipcMain.on('shelf:drag', (event, shelfId, fileId) => {
      try {
        event.sender.startDrag({ file: shelfService.pathOf(String(shelfId), String(fileId)), icon: dragIcon });
      } catch (err) {
        announce('Could not drag that file out of the shelf.');
      }
    });
    ipcMain.handle('screentime:get', () => screenTime.get());
    ipcMain.handle('screentime:set', (_e, input) => { screenTime.set(input || {}); setActivityWatch(screenTime.get().enabled); return screenTime.get(); });
    ipcMain.handle('screentime:clear', () => { screenTime.clear(); return screenTime.get(); });
    ipcMain.handle('converter:save', (_e, input) => converterService.save(input || {}));
    ipcMain.handle('converter:pdf', (_e, input) => {
      const request = input && typeof input === 'object' ? input : {};
      if (request.action === 'merge') return pdfTools.merge({ sourcePaths: request.sourcePaths });
      if (request.action === 'split') return pdfTools.split({ sourcePath: request.sourcePath, pages: request.pages });
      throw new Error('That is not something the PDF tools can do.');
    });
    ipcMain.handle('converter:doc', (_e, input) => docConverter.convert({ sourcePath: input && input.sourcePath, to: input && input.to }));
    ipcMain.handle('converter:reveal', (_e, file) => {
      if (!converterService.canReveal(String(file)) && !docConverter.canReveal(String(file)) && !pdfTools.canReveal(String(file))) throw new Error('That file was not made by the converter');
      shell.showItemInFolder(String(file));
    });
    ipcMain.handle('assistant:get', () => assistant.state());
    ipcMain.handle('assistant:plan', (_e, text) => assistant.plan(String(text || '')));
    ipcMain.handle('assistant:run', () => assistant.run());
    ipcMain.handle('assistant:cancel', () => assistant.cancel());
    ipcMain.handle('assistant:undo', () => assistant.undo());
    ipcMain.on('assistant:stop', () => assistant.stop());
    ipcMain.handle('life:get', () => life.summary(store.get('life', {}), new Date()));
    ipcMain.on('command:run', (_e, text) => runCommand(text)); // the same safe path as a spoken command
    ipcMain.handle('phone:get', () => phoneView(phone.status()));
    ipcMain.handle('phone:start', async () => {
      const started = await phone.start();
      try { phoneQr = qrSvg(started.link); } catch (error) { phone.stop(); throw error; } // never leave a link open that has no code to scan
      return phoneView(phone.status());
    });
    ipcMain.handle('phone:stop', () => { phone.stop(); phoneQr = null; return phoneView(phone.status()); });
    ipcMain.handle('phone:open', async () => {
      const folder = phone.status().saveDir;
      fs.mkdirSync(folder, { recursive: true });
      const problem = await shell.openPath(folder);
      if (problem) throw new Error('The folder could not be opened.');
    });
    ipcMain.handle('copy-text', (_e, text) => clipboard.writeText(String(text).slice(0, MAX_COPY_CHARS)));
    ipcMain.handle('open-url', (_e, url) => shell.openExternal(assertWebUrl(url)));
    ipcMain.on('panel:hide', () => panel.hide());
    ipcMain.on('panel:editing', (_e, isEditing) => panel.setEditing(isEditing));
  }
  registerIpc();

  return {
    start() {
      clipboardWatcher.start();
      timerService.start();
      calendarService.start();
      panel.prepare();
      this.sync();
    },
    // Call after settings change.
    sync() {
      panel.syncHover();
      panel.send('panel:settings', panelSettings());
      if (!getSettings().showTimerInNotch) deliverToNotch('timer', { text: '' });
    },
    show: panel.show,
    // Quick capture: open the panel and ask it for a fresh note.
    capture() { panel.show(); panel.send('panel:capture', null); },
    command() { panel.show(); panel.send('panel:command', null); },
    hide: panel.hide,
    setHoverSuppressed: panel.setHoverSuppressed,
    toggle: panel.toggle,
    sendMusic: (music) => panel.send('music', music),
    assistant, // typed commands use this to start a task and to run a small plan the user said "yes" to
    // Tells the desktop watcher whether to look at the front program at all (only while Screen Time is on).
    syncActivity: () => setActivityWatch(screenTime.get().enabled),
    onActivity: (reading) => screenTime.tick({ app: reading.app, idle: Number(reading.idle) }),
    stop() {
      screenTime.flush();
      sampler.stop();
      phone.stop(); // never leave the phone page open when the app closes
      clipboardWatcher.stop();
      timerService.stop();
      calendarService.stop();
      panel.destroy();
    },
  };
}

module.exports = { createPanelService, timerLabel, alertMessage, assertWebUrl };
