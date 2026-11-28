const { app, BrowserWindow, Menu, Tray, nativeImage, nativeTheme, ipcMain, screen, globalShortcut, shell, desktopCapturer } = require('electron');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { parseCommand, NEEDS_PC_CONTROL } = require('./lib/commands');
const { runPcAction, runPower } = require('./lib/pc-control');
const { runPs } = require('./lib/ps');
const { checkRoutines, findRoutine, runRoutine } = require('./lib/routines');
const { createConfirmation } = require('./lib/confirm');
const { watchNotifications } = require('./lib/notifs');
const { startLive } = require('./lib/live');
const { createMedia } = require('./lib/media-state');
const { createClaude } = require('./lib/claude');
const { createAwake, allowsAlert } = require('./lib/awake');
const { createPanelService } = require('./lib/panel-service');
const { MODULES } = require('./lib/modules');
const { THEME_INFO } = require('./lib/themes');
const { createTrayIcons } = require('./lib/tray-icon');
const { loadPacks } = require('./lib/packs');
const { loadFaces } = require('./lib/faces');
const { makeEventHandler } = require('./lib/event-server');
const { createClaudeLink } = require('./lib/claude-link');
const { createFocusMode } = require('./lib/focus-mode');
const { createAmbientService } = require('./lib/ambient-service');
const { createUpdater } = require('./lib/updater');
const Heroes = require('./renderer/heroes.js');
const settingsStore = require('./lib/settings');
const { applyWelcomeChoices } = require('./lib/welcome');

const PORT = 47800;
const WIN_W = 480;
const WIN_H = 170;
const STATES = new Set(['idle', 'thinking', 'working', 'needs', 'done', 'error', 'dance', 'asking', 'speaking']);
const ASSETS = path.join(__dirname, 'assets');
const AUTOSTART_NAME = 'WindowsNotch'; // internal name of the start-with-Windows entry; kept so an upgrade never adds a second one

const MIN_ANSWER_CARD_MS = 8000;
const NOTIFY_LINGER_MS = 7000; // how long a card keeps him on screen when it gives no time of its own
const MS_PER_ANSWER_CHAR = 70;

// Defense in depth: the app's windows only ever show its own files. Refuse new windows, and refuse to navigate anywhere else.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => { if (!url.startsWith('file://')) event.preventDefault(); });
});

app.setName('Windows Notch'); // the app is called Notchy, but this old name stays: it names the settings folder (changing it would lose everyone's saved settings)

let win = null;
let settingsWin = null;
let welcomeWin = null;
let tray = null;
// The desktop watcher: volume, full-screen apps and what is playing (lib/live.js).
let live = null;
const media = createMedia();
let lastVolume = null;
let isFullscreen = false;
let ambient = null; // glow around the screen edges (lib/ambient-service.js)
let updater = null; // new versions from GitHub Releases (lib/updater.js)
let pinnedMessage = null; // a line of your own, shown across the notch until cleared
const MESSAGE_MAX_CHARS = 80;
const MESSAGE_MOTIONS = ['none', 'pulse', 'scroll'];
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
let panelService = null; // the panel of tools (lib/panel-service.js)
let settings = settingsStore.sanitize();

// Claude answers questions (see lib/claude.js).
let claude = null;
let askToken = 0; // bumped on every question and cancel, so a late answer to an old question is dropped
let isAsking = false;

// Visibility: in hidden mode he is out of sight until called (see lib/awake.js).
let visibility = null;
const isBusy = () => isAsking || pinnedMessage !== null;
const trayTip = (isAwake) => (isAwake ? 'Notchy (click for settings)' : 'Notchy is asleep. Press the panel hotkey (click for settings)');

const script = (name) => path.join(__dirname, 'scripts', name);
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function deliver(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// Anything he shows (a state or a card) wakes him, so he is visible whenever he is talking to you.
function send(channel, payload) {
  if (visibility) {
    if (channel === 'state') visibility.wake();
    else if (channel === 'notify') visibility.wake((payload && payload.ms) || NOTIFY_LINGER_MS);
    else if (channel === 'activity' && payload.kind !== 'message-clear') visibility.wake(payload.ms || NOTIFY_LINGER_MS);
  }
  deliver(channel, payload);
}

// Alerts from outside (Claude Code, WhatsApp messages) stay hidden unless you allowed them.
function sendAlert(channel, payload) {
  if (focusMode.isOn()) return; // focus mode keeps every outside alert away; timers and answers you asked for still show
  if (visibility && !allowsAlert(settings, visibility.isAwake())) return;
  send(channel, payload);
}

// Focus mode: the notch shows only your timer. The window and the tray menu follow the switch.
const focusMode = createFocusMode({
  onChange: (isOn) => {
    deliver('focus', isOn);
    if (tray) tray.setContextMenu(buildTrayMenu());
  },
});

function sendToSettings(channel, payload) {
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send(channel, payload);
}

function createWindow() {
  const { x, y, width } = screen.getPrimaryDisplay().bounds;
  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: x + Math.round((width - WIN_W) / 2),
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    deliver('settings', settings);
    deliver('awake', visibility ? visibility.isAwake() : true);
  });
}

// First run: ask what Notchy may do before it does any of it. Closing the window without finishing asks again next time.
function openWelcome() {
  if (welcomeWin && !welcomeWin.isDestroyed()) {
    welcomeWin.focus();
    return;
  }
  welcomeWin = new BrowserWindow({
    width: 540,
    height: Math.min(820, screen.getPrimaryDisplay().workAreaSize.height - 40), // a short screen scrolls; the button stays pinned
    useContentSize: true,
    resizable: false,
    maximizable: false,
    title: 'Welcome to Notchy',
    icon: path.join(ASSETS, 'icon.png'),
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0b0e' : '#f2f2f7',
    webPreferences: { preload: path.join(__dirname, 'welcome-preload.js'), contextIsolation: true, sandbox: true },
  });
  welcomeWin.loadFile(path.join(__dirname, 'renderer', 'welcome.html'));
}

function openSettings() {
  if (!settings.setupDone) return openWelcome(); // tray click or a second launch before the welcome is finished
  if (settingsWin && !settingsWin.isDestroyed()) {
    if (settingsWin.isMinimized()) settingsWin.restore();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 940,
    height: 680,
    minWidth: 780,
    minHeight: 560,
    title: 'Notchy settings',
    icon: path.join(ASSETS, 'icon.png'), // the same picture the installer and the .exe use
    autoHideMenuBar: true,
    backgroundColor: settings.colorMode === 'dark' ? '#0b0b0e' : '#f2f2f7', // matches the glass background, so there is no flash on open
    webPreferences: { preload: path.join(__dirname, 'settings-preload.js'), contextIsolation: true, sandbox: true },
  });
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
}

// Claude Code hooks post here: {"state":"working","text":"Edit"}
function startEventServer() {
  const handler = makeEventHandler({ port: PORT, states: STATES, onEvent: ({ state, text }) => sendAlert('state', { state, text }) });
  const server = http.createServer(handler);
  server.on('error', (err) => send('state', { state: 'error', text: 'Port ' + PORT + ': ' + err.code }));
  server.listen(PORT, '127.0.0.1');
}

function runAction(cmd) {
  switch (cmd.type) {
    case 'app':
      execFile('cmd.exe', ['/c', 'start', '', cmd.target], { windowsHide: true });
      return 'Opening ' + cmd.label;
    case 'url':
      shell.openExternal(cmd.url);
      return 'Opening ' + cmd.label;
    case 'key':
      return runPs(script('key.ps1'), ['-Key', cmd.key]).then(() => cmd.label);
    case 'lock':
      execFile('rundll32.exe', ['user32.dll,LockWorkStation']);
      return 'Locking';
    case 'folder':
      execFile('explorer.exe', [cmd.target], { windowsHide: true }); // a fixed "shell:" folder, never a path from speech
      return 'Opening ' + cmd.label;
    case 'pc':
      return runPcAction(cmd.action); // resolves with a sentence like "Brightness 60 percent"
    case 'typing':
      return runPcAction('type', cmd.text).then(() => 'Typed');
    case 'power':
      return runPower(cmd.action);
    case 'assistant-run':
      // Only the exact plan that was read out may run, and only if it is still waiting for approval.
      if (!panelService || panelService.assistant.state().summary !== cmd.summary) return Promise.reject(new Error('That plan changed, so nothing was run.'));
      return panelService.assistant.run().then((state) => state.note);
    case 'reply':
      return 'There was nothing to confirm';
    case 'say':
      return cmd.speech;
    case 'panel':
      if (panelService) panelService.show();
      return 'Opening the panel';
    case 'focus':
      focusMode.set(cmd.on);
      return cmd.on ? 'Focus mode on' : 'Focus mode off';
    default:
      return null;
  }
}

// ---- commands ----

const CONFIRM_MS = 20000; // how long a "yes or no" question stays open
const confirmation = createConfirmation({ ms: CONFIRM_MS });

// Asks "Shut down the computer?" on the card and opens the typing box for the answer.
function askToConfirm(cmd) {
  confirmation.ask(cmd);
  send('notify', { title: 'Batman', body: cmd.confirm + ' Type yes or no.', ms: CONFIRM_MS });
  if (panelService) panelService.command();
}

// Does the command and shows what happened. Some commands finish later (Wi-Fi, screenshot), so the result may be a promise.
function perform(cmd) {
  let result;
  try {
    result = runAction(cmd);
  } catch (err) {
    result = Promise.reject(err);
  }
  Promise.resolve(result).then(
    (message) => send('state', { state: 'done', text: message }),
    (err) => send('state', { state: 'error', text: String(err.message || 'That did not work.').slice(0, 60) })
  );
}

function respond(heard) {
  const cmd = parseCommand(heard);
  if (!cmd) { send('state', { state: 'idle', text: 'Didn’t catch that' }); return; }
  const decision = confirmation.answer(cmd); // anything but a clear yes or no drops an open question
  if (decision.action === 'run') { perform(decision.cmd); return; }
  if (decision.action === 'cancel') {
    send('state', { state: 'done', text: 'Okay, cancelled' });
    return;
  }
  if (NEEDS_PC_CONTROL.has(cmd.type) && !settings.pcControl) {
    send('state', { state: 'error', text: 'Computer control is off in settings' });
    return;
  }
  if (cmd.type === 'assistant') { startAssistantTask(cmd.text); return; }
  if (cmd.type === 'routine') { startRoutine(cmd.name); return; }
  if (cmd.confirm) { askToConfirm(cmd); return; }
  if (cmd.type === 'unknown') {
    // Not one of his commands, so it is a question: Claude answers it.
    if (settings.askClaude && claude) { askClaude(heard); return; }
    send('state', { state: 'error', text: 'Can’t do: ' + cmd.label.slice(0, 40) });
    return;
  }
  perform(cmd);
}

// A command typed in the panel goes through the same checks (confirmations, the computer-control switch, routines).
const MAX_COMMAND_CHARS = 300;
function runTypedCommand(text) {
  if (typeof text !== 'string') return;
  const typed = text.trim().slice(0, MAX_COMMAND_CHARS);
  if (typed) respond(typed);
}

// "run good morning": the saved steps run one after another, each through the same safe actions as a typed command.
function startRoutine(name) {
  const routine = findRoutine(settings.routines, name);
  if (!routine) { send('state', { state: 'error', text: 'No routine called ' + String(name).slice(0, 30) }); return; }
  if (routine.steps.some((step) => NEEDS_PC_CONTROL.has((parseCommand(step) || {}).type)) && !settings.pcControl) { send('state', { state: 'error', text: 'Computer control is off in settings' }); return; }
  send('state', { state: 'working', text: routine.name });
  runRoutine(routine.steps, (cmd) => Promise.resolve(runAction(cmd))).then(({ done, failed }) => {
    const message = failed ? `Stopped after ${done} of ${routine.steps.length}: ${failed}` : `${routine.name} done`;
    send('state', { state: failed ? 'error' : 'done', text: message.slice(0, 60) });
  });
}

// "task sort my downloads": Claude makes a plan. A small plan with no deleting can be approved by typing "yes"; anything else waits in the panel.
function startAssistantTask(text) {
  const fail = (reason) => send('state', { state: 'error', text: reason.slice(0, 60) });
  if (!settings.assistantTasks || !panelService) { fail('Tasks are turned off in settings.'); return; }
  send('state', { state: 'asking' });
  panelService.assistant.plan(text).then((plan) => {
    if (plan.phase !== 'review') { fail(plan.error || 'I could not make a plan.'); return; }
    if (plan.canQuickApprove) {
      const count = plan.steps.length;
      askToConfirm({ type: 'assistant-run', label: 'task', summary: plan.summary, confirm: `Plan: ${plan.summary}. ${count} step${count === 1 ? '' : 's'}. Run it?` });
      return;
    }
    panelService.show();
    send('state', { state: 'done', text: 'Plan ready in the panel' });
  }, (err) => fail(String((err && err.message) || 'I could not make a plan.')));
}

function askClaude(question) {
  const token = ++askToken;
  isAsking = true;
  send('state', { state: 'asking' });
  claude.ask(question).then(
    (answer) => { if (token === askToken) deliverAnswer(answer); },
    (err) => {
      if (token !== askToken) return;
      isAsking = false;
      send('state', { state: 'error', text: err.message.slice(0, 60) });
    }
  );
}

// Shows the answer on the card.
function deliverAnswer(answer) {
  isAsking = false;
  const text = answer || 'I don’t have an answer for that.';
  send('notify', { title: 'Batman', body: text, ms: Math.max(MIN_ANSWER_CARD_MS, text.length * MS_PER_ANSWER_CHAR) });
  send('state', { state: 'idle' });
}

// Stops what he is doing: waiting for Claude, or an open "yes or no" question.
function cancelAsk() {
  confirmation.clear();
  if (!isAsking) return;
  askToken += 1; // an answer still on its way is dropped
  isAsking = false;
  send('state', { state: 'idle', text: 'Cancelled' });
}

function registerHotkey(accelerator, handler) {
  try {
    return globalShortcut.register(accelerator, handler);
  } catch {
    return false; // Electron throws on a malformed accelerator
  }
}

// What is playing, as the notch and the panel use it. Nothing about a paused song is ever shared.
function musicPayload() {
  const s = media.snapshot();
  if (!s.playing) return { playing: false, title: '', artist: '', art: null, remaining: null, duration: 0 };
  return { playing: true, title: s.title, artist: s.artist, art: s.art, remaining: s.remaining, duration: s.duration };
}

// While a full-screen app or game runs he hides completely and the panel does not open by hovering.
function applyFullscreen() {
  const shouldStepAside = settings.stepAside && isFullscreen;
  if (visibility) visibility.suppress(shouldStepAside);
  if (panelService) panelService.setHoverSuppressed(shouldStepAside);
}

function onLiveEvent(event) {
  if (event.e === 'volume') {
    const isChange = lastVolume !== null && (lastVolume.level !== event.level || lastVolume.muted !== event.muted);
    lastVolume = { level: event.level, muted: event.muted };
    if (isChange && settings.showVolumeBar) sendAlert('activity', { kind: 'volume', level: event.level, muted: event.muted, ms: 1800 });
  } else if (event.e === 'fullscreen') {
    isFullscreen = event.on === true;
    applyFullscreen();
    if (ambient) ambient.sync();
  } else if (event.e === 'media') {
    const { isNewTrack } = media.update(event);
    const payload = musicPayload();
    send('music', payload);
    if (panelService) panelService.sendMusic(payload);
    if (isNewTrack && payload.playing && settings.showMusicActivity) sendAlert('activity', { kind: 'music', ...payload, ms: 6000 });
  } else if (event.e === 'activity') {
    if (panelService) panelService.onActivity(event);
  } else if (event.e === 'error') {
    sendAlert('state', { state: 'error', text: 'Desktop watcher: ' + String(event.message).slice(0, 40) });
  }
}

// Message tool: a line of your own across the notch, in a color you pick, until you clear it.
function showMessage(input) {
  const text = String((input && input.text) || '').trim().slice(0, MESSAGE_MAX_CHARS);
  if (!text) throw new Error('Type a message first');
  pinnedMessage = {
    text,
    color: COLOR_PATTERN.test(input.color) ? input.color : '#facc15',
    motion: MESSAGE_MOTIONS.includes(input.motion) ? input.motion : 'none',
  };
  send('activity', { kind: 'message', ...pinnedMessage });
}

function clearMessage() {
  pinnedMessage = null;
  send('activity', { kind: 'message-clear' });
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Open panel', click: () => panelService && panelService.show() },
    { label: 'Open settings', click: openSettings },
    { label: 'Focus mode', type: 'checkbox', checked: focusMode.isOn(), click: (item) => focusMode.set(item.checked) },
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: settings.autostart, click: (item) => saveSettings({ ...settings, autostart: item.checked }) },
    { type: 'separator' },
    { label: 'Quit Notchy', click: () => app.quit() },
  ]);
}

// Keeps Claude running in the background only while the "answer my questions" setting is on.
function syncClaude() {
  if (settings.askClaude && !claude) {
    claude = createClaude();
    claude.warm();
  } else if (!settings.askClaude && claude) {
    askToken += 1; // drop any answer still on its way
    isAsking = false;
    claude.stop();
    claude = null;
  }
}

function applySettings(next) {
  settings = next;
  app.setLoginItemSettings({
    openAtLogin: settings.autostart,
    name: AUTOSTART_NAME,
    path: `"${process.execPath}"`, // quotes: the folder name has a space
    args: app.isPackaged ? ['--autostart'] : [`"${app.getAppPath()}"`, '--autostart'], // the installed app is its own exe; only the dev run needs the folder
  });
  applyFullscreen();
  if (ambient) ambient.sync();
  if (updater) updater.sync();
  syncClaude();
  if (tray) tray.setContextMenu(buildTrayMenu());
  refreshTrayIcon();
  deliver('settings', settings);
  deliver('focus', focusMode.isOn()); // a reloaded notch window learns the current state
  if (visibility) visibility.sync();
  if (panelService) panelService.sync();
}

// Returns {ok, settings} or {ok:false, error}. Nothing is saved when it fails.
function saveSettings(raw) {
  const next = settingsStore.sanitize(raw);
  const routineProblem = checkRoutines(raw && raw.routines).errors[0];
  if (routineProblem) return { ok: false, error: routineProblem };
  if (new Set([next.panelHotkey, next.captureHotkey, next.commandHotkey]).size < 3) return { ok: false, error: 'The panel, quick note and command hotkeys must all be different.' };
  const hotkeys = [
    { key: 'panelHotkey', handler: () => panelService && panelService.toggle() },
    { key: 'captureHotkey', handler: () => panelService && panelService.capture() },
    { key: 'commandHotkey', handler: () => panelService && panelService.command() },
  ];
  for (const { key, handler } of hotkeys) {
    if (next[key] === settings[key]) continue;
    globalShortcut.unregister(settings[key]);
    if (!registerHotkey(next[key], handler)) {
      registerHotkey(settings[key], handler);
      return { ok: false, error: next[key] + ' is taken by another app. Try a different one.' };
    }
  }
  settingsStore.save(settingsFile(), next);
  applySettings(next);
  return { ok: true, settings: next };
}

// Character packs: JSON files in the "packs" folder, checked by lib/packs.js. Read again each time so a new file shows up without a restart.
const packsDir = () => path.join(app.getPath('userData'), 'packs');
function readPacks() {
  const result = loadPacks(packsDir());
  Heroes.setPacks(result.packs); // the tray icon draws from the same list
  return result;
}

// Your own face pictures: <hero>.png files in the "faces" folder, checked by lib/faces.js. Read again each time, like packs.
const facesDir = () => path.join(app.getPath('userData'), 'faces');
const bundledFacesDir = () => path.join(__dirname, 'assets', 'faces'); // the pictures that ship with the app
function readFaces() {
  // your own file of the same name in the faces folder replaces the shipped one
  const faces = { ...loadFaces(bundledFacesDir(), Heroes.ids).faces, ...loadFaces(facesDir(), Heroes.ids).faces };
  Heroes.setPhotos(faces); // the tray icon draws from the same pictures
  return faces;
}
// The tray icon follows the look: a hero's drawing for hero looks, the Batman icon for the plain ones.
let trayIcons = null;
let trayLook = null;
async function refreshTrayIcon() {
  if (!tray || !trayIcons || trayLook === settings.theme) return;
  const look = settings.theme;
  trayLook = look;
  const image = await trayIcons.imageFor(look);
  if (tray && trayLook === look) tray.setImage(image); // skip if the look changed again while painting
}

function createTray() {
  const batman = nativeImage.createFromPath(path.join(ASSETS, 'tray.png'));
  trayIcons = createTrayIcons({ BrowserWindow, fallback: batman });
  tray = new Tray(batman);
  refreshTrayIcon();
  tray.setToolTip(trayTip(visibility ? visibility.isAwake() : true));
  tray.on('click', openSettings);
  tray.setContextMenu(buildTrayMenu());
}

if (!app.requestSingleInstanceLock()) {
  app.quit(); // already running: the running copy opens its settings window instead
} else {
  app.on('second-instance', openSettings);
  app.whenReady().then(() => {
    settings = settingsStore.load(settingsFile());
    visibility = createAwake({
      isHiding: () => settings.hideUntilCalled,
      isBusy,
      onChange: (isAwake) => {
        deliver('awake', isAwake);
        if (tray) tray.setToolTip(trayTip(isAwake));
      },
    });
    readPacks(); // before the tray, so a pack look has its drawing
    readFaces(); // and a hero with your own picture shows it in the tray too
    createWindow();
    ambient = createAmbientService({
      desktopCapturer, screen, BrowserWindow, ipcMain,
      onError: (message) => sendAlert('state', { state: 'error', text: ('Screen glow: ' + message).slice(0, 40) }),
      preload: path.join(__dirname, 'ambient-preload.js'),
      page: path.join(__dirname, 'renderer', 'ambient.html'),
      getSettings: () => settings,
      isFullscreen: () => isFullscreen,
    });
    let lastPhase = null;
    updater = createUpdater({
      autoUpdater: require('electron-updater').autoUpdater, // loaded here so a development run does not need it at start-up
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      isEnabled: () => settings.autoUpdate,
      onStatus: (status) => {
        sendToSettings('updates:status', { ...updater.status(), ...status });
        if (status.phase === 'ready' && lastPhase !== 'ready') sendAlert('notify', { title: 'Update ready', body: `Notchy ${status.latest || ''} is ready. Open settings, General, and press Restart and update.`.replace('  ', ' '), ms: 12000 });
        lastPhase = status.phase;
      },
    });
    createTray();
    panelService = createPanelService({
      dataDir: path.join(app.getPath('userData'), 'data'),
      rootDir: __dirname,
      getSettings: () => settings,
      setActivityWatch: (isOn) => { if (live) live.activity(isOn); },
      deliverToNotch: deliver,
      wakeNotch: (ms) => visibility.wake(ms),
      runCommand: runTypedCommand,
      celebrate: () => { if (settings.reactiveHero && !isBusy()) send('state', { state: 'done', text: 'Timer done' }); }, // never cut in while you are talking to him
      onCopied: () => {
        if (settings.showCopiedTick) sendAlert('activity', { kind: 'copied', ms: 1200 });
      },
      // timer alerts and water reminders are alarms you set yourself, so they show even while he is hidden
      announce: (message) => {
        send('notify', { title: 'Timer', body: message, ms: 9000 });
      },
    });
    panelService.start();
    live = startLive({ onEvent: onLiveEvent });
    panelService.syncActivity(); // if Screen Time was left on, tell the watcher to start looking again
    startEventServer();
    ipcMain.on('mouse-ignore', (_e, ignore) => win.setIgnoreMouseEvents(ignore, { forward: true }));
    ipcMain.on('open-panel', () => panelService && panelService.show());
    ipcMain.on('cancel-ask', cancelAsk);
    ipcMain.handle('settings:get', () => settings);
    ipcMain.handle('settings:meta', () => { const { packs, problems } = readPacks(); return { modules: MODULES, themes: [...THEME_INFO, ...packs], packProblems: problems }; });
    const claudeLink = createClaudeLink({ home: os.homedir(), hookSource: path.join(__dirname, 'scripts', 'notch-hook.js'), hookDest: path.join(app.getPath('userData'), 'notch-hook.js') });
    ipcMain.handle('claude:status', () => claudeLink.status());
    ipcMain.handle('claude:connect', () => claudeLink.connect());
    ipcMain.handle('claude:disconnect', () => claudeLink.disconnect());
    ipcMain.handle('packs:list', () => readPacks().packs);
    ipcMain.handle('faces:list', () => readFaces());    ipcMain.handle('packs:open', () => { fs.mkdirSync(packsDir(), { recursive: true }); return shell.openPath(packsDir()); });
    ipcMain.handle('media:control', (_e, command) => { if (live) live.media(String(command)); });
    ipcMain.handle('message:show', (_e, input) => showMessage(input));
    ipcMain.handle('message:clear', () => clearMessage());
    ipcMain.handle('updates:status', () => updater.status());
    ipcMain.handle('updates:check', async () => { await updater.checkNow(); return updater.status(); });
    ipcMain.handle('updates:install', () => updater.install());
    ipcMain.handle('settings:save', (_e, raw) => saveSettings(raw));
    ipcMain.handle('welcome:finish', (_e, choices) => {
      const result = saveSettings(applyWelcomeChoices(settings, choices));
      if (result.ok && welcomeWin && !welcomeWin.isDestroyed()) welcomeWin.close();
      return result;
    });
    ipcMain.on('settings:test-notify', () => send('notify', { title: 'Test message', body: 'Hello from your notch' }));
    ipcMain.on('settings:quit', () => app.quit());

    if (!registerHotkey(settings.panelHotkey, () => panelService.toggle())) {
      send('state', { state: 'error', text: settings.panelHotkey + ' is taken' });
    }
    if (!registerHotkey(settings.captureHotkey, () => panelService.capture())) {
      send('state', { state: 'error', text: settings.captureHotkey + ' is taken' });
    }
    if (!registerHotkey(settings.commandHotkey, () => panelService.command())) {
      send('state', { state: 'error', text: settings.commandHotkey + ' is taken' });
    }
    applySettings(settings);
    updater.start();
    watchNotifications({
      getFilter: () => settingsStore.keywordFilter(settings.notifyKeyword),
      onNotify: (n) => sendAlert('notify', n),
      onError: (err) => sendAlert('state', { state: 'error', text: 'Notifications: ' + err.message.slice(0, 40) }),
    });
    if (!process.argv.includes('--autostart') || !settings.setupDone) openSettings(); // openSettings shows the welcome screen until it is finished
  });
}

app.on('window-all-closed', () => {}); // keep running in the tray
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (live) live.stop();
  if (ambient) ambient.stop();
  if (updater) updater.stop();
  if (claude) claude.stop();
  if (panelService) panelService.stop();
});
