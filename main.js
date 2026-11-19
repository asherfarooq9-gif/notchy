const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen, globalShortcut, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { parseCommand, VOICE_VOCAB, NEEDS_PC_CONTROL } = require('./lib/commands');
const { runPcAction, runPower } = require('./lib/pc-control');
const { runPs } = require('./lib/ps');
const { checkRoutines, findRoutine, runRoutine } = require('./lib/routines');
const { createConfirmation } = require('./lib/confirm');
const { watchNotifications } = require('./lib/notifs');
const { startLive } = require('./lib/live');
const { createMedia } = require('./lib/media-state');
const { startVoice } = require('./lib/voice');
const { createClaude } = require('./lib/claude');
const { createAwake, allowsAlert } = require('./lib/awake');
const { createPanelService } = require('./lib/panel-service');
const { MODULES } = require('./lib/modules');
const { THEME_INFO } = require('./lib/themes');
const { createTrayIcons } = require('./lib/tray-icon');
const { loadPacks } = require('./lib/packs');
const { createFocusMode } = require('./lib/focus-mode');
const Heroes = require('./renderer/heroes.js');
const settingsStore = require('./lib/settings');

const PORT = 47800;
const WIN_W = 480;
const WIN_H = 170;
const STATES = new Set(['idle', 'thinking', 'working', 'needs', 'done', 'error', 'dance', 'asking', 'speaking']);
const MAX_BODY_BYTES = 4096;
const SPEECH_MAX_CHARS = 200;
const ASSETS = path.join(__dirname, 'assets');
const AUTOSTART_NAME = 'WindowsNotch';

const WAKE_PHRASES = ['hey batman', 'okay batman'];
const MIN_COMMAND_CONFIDENCE = 0.3; // free questions score lower than fixed commands
// A real microphone scores lower than clean test audio did (a quiet one gave 0.60 and 0.27 for a clear "hey batman").
const WAKE_CONFIDENCE_BY_SENSITIVITY = { 1: 0.7, 2: 0.6, 3: 0.5, 4: 0.4, 5: 0.3 };
const MIN_LOGGED_CONFIDENCE = 0.2; // below this a "miss" is just background noise, not worth logging
const LISTEN_LIMIT_MS = 12000;
const FOLLOW_UP_LIMIT_MS = 8000; // after an answer he keeps listening this long for a follow-up question
const MIN_ANSWER_CARD_MS = 8000;
const NOTIFY_LINGER_MS = 7000; // how long a card keeps him on screen when it gives no time of its own
const MS_PER_ANSWER_CHAR = 70;
const NOISE_CONFIDENCE = 0.2; // an "unclear" result below this was a noise blip, not speech
const MAX_NOISE_RETRIES = 3;
const MIC_TEST_MS = 15000;
const VOICE_LOG_LINES = 200;
const VOICE_RESTARTS = 3;

app.setName('Windows Notch'); // names the autostart entry and the settings folder

let win = null;
let settingsWin = null;
let tray = null;
// The desktop watcher: volume, full-screen apps and what is playing (lib/live.js).
let live = null;
const media = createMedia();
let lastVolume = null;
let isFullscreen = false;
let pinnedMessage = null; // a line of your own, shown across the notch until cleared
const MESSAGE_MAX_CHARS = 80;
const MESSAGE_MOTIONS = ['none', 'pulse', 'scroll'];
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
let panelService = null; // the panel of tools (lib/panel-service.js)
let settings = settingsStore.sanitize();
let isQuitting = false;

// Voice: one long-running speech engine (see scripts/voice-host.ps1).
let voice = null;
let isVoiceReady = false;
let voiceRestarts = 0;
let isListening = false;
let heardText = '';
let lastUnclear = 1; // confidence of the latest unclear result (1 = none)
let noiseRetries = 0;
let listenTimer = null;
let afterGreeting = null; // runs when he finishes saying "Yes?"
let isMicTesting = false;
let micTestTimer = null;

// Claude answers questions (see lib/claude.js).
let claude = null;
let askToken = 0; // bumped on every question and cancel, so a late answer to an old question is dropped
let isAsking = false;
let isSpeakingAnswer = false;
let isFollowUp = false;

// Visibility: in hidden mode he is out of sight until called (see lib/awake.js).
let visibility = null;
const isBusy = () => isListening || isAsking || isSpeakingAnswer || isMicTesting || afterGreeting !== null || pinnedMessage !== null;
const trayTip = (isAwake) => (isAwake ? 'Notch (click for settings)' : 'Notch is asleep. Say "Hey Batman" (click for settings)');
const voiceLog = [];

const script = (name) => path.join(__dirname, 'scripts', name);
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const wakeConfidence = () => WAKE_CONFIDENCE_BY_SENSITIVITY[settings.wakeSensitivity];

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

function openSettings() {
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
    title: 'Notch settings',
    icon: path.join(ASSETS, 'icon.png'), // the same picture the installer and the .exe use
    autoHideMenuBar: true,
    backgroundColor: settings.colorMode === 'dark' ? '#0b0b0e' : '#f2f2f7', // matches the glass background, so there is no flash on open
    webPreferences: { preload: path.join(__dirname, 'settings-preload.js'), contextIsolation: true, sandbox: true },
  });
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWin.on('closed', stopMicTest);
}

// Claude Code hooks post here: {"state":"working","text":"Edit"}
function startEventServer() {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/event') { res.writeHead(404).end(); return; }
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY_BYTES) req.destroy();
    });
    req.on('end', () => {
      try {
        const { state, text } = JSON.parse(raw);
        if (!STATES.has(state)) { res.writeHead(400).end(); return; }
        sendAlert('state', { state, text: typeof text === 'string' ? text.slice(0, 80) : undefined });
        res.writeHead(204).end();
      } catch {
        res.writeHead(400).end();
      }
    });
  });
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

// ---- voice ----

function logVoice(event) {
  voiceLog.push(`${new Date().toISOString()} ${event.e} "${event.text}" ${event.confidence}`);
  if (voiceLog.length > VOICE_LOG_LINES) voiceLog.shift();
  try {
    fs.writeFileSync(path.join(app.getPath('userData'), 'voice-log.txt'), voiceLog.join('\n'));
  } catch {
    // the log is only for diagnosing; a failed write must never interrupt listening
  }
}

function say(text) {
  if (voice && isVoiceReady && settings.talkBack) voice.say(String(text).slice(0, SPEECH_MAX_CHARS));
}

// What the microphone should be doing when he is not in the middle of a command.
function syncVoiceMode() {
  if (!voice || !isVoiceReady || isListening || isMicTesting) return;
  voice.setMode(settings.wakeWord ? 'wake' : 'off');
}

function didntCatch() {
  send('state', { state: 'idle', text: 'Didn’t catch that' });
  say('I didn’t catch that.');
}

// ---- risky commands wait for a spoken "yes" ----

const CONFIRM_MS = 20000; // how long a "yes or no" question stays open
const confirmation = createConfirmation({ ms: CONFIRM_MS });

// Asks "Shut down the computer? Say yes or no." out loud and on the card, then listens for the answer.
function askToConfirm(cmd) {
  confirmation.ask(cmd);
  const question = cmd.confirm + ' Say yes or no.';
  send('notify', { title: 'Batman', body: question, ms: CONFIRM_MS });
  if (settings.talkBack && voice && isVoiceReady) {
    isSpeakingAnswer = true; // when he finishes speaking he listens for the answer
    send('state', { state: 'speaking' });
    voice.say(question);
  } else {
    listenForFollowUp();
  }
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
    (message) => { send('state', { state: 'done', text: message }); say(message); },
    (err) => { const reason = String(err.message || 'That did not work.'); send('state', { state: 'error', text: reason.slice(0, 60) }); say(reason); }
  );
}

function respond(heard) {
  const cmd = parseCommand(heard);
  if (!cmd) { didntCatch(); return; }
  const decision = confirmation.answer(cmd); // anything but a clear yes or no drops an open question
  if (decision.action === 'run') { perform(decision.cmd); return; }
  if (decision.action === 'cancel') {
    send('state', { state: 'done', text: 'Okay, cancelled' });
    say('Okay, cancelled.');
    return;
  }
  if (NEEDS_PC_CONTROL.has(cmd.type) && !settings.pcControl) {
    send('state', { state: 'error', text: 'Computer control is off in settings' });
    say('Computer control is turned off in settings.');
    return;
  }
  if (cmd.type === 'assistant') { startAssistantTask(cmd.text); return; }
  if (cmd.type === 'routine') { startRoutine(cmd.name); return; }
  if (cmd.confirm) { askToConfirm(cmd); return; }
  if (cmd.type === 'unknown') {
    // Not one of his commands, so it is a question: Claude answers it.
    if (settings.askClaude && claude) { askClaude(heard); return; }
    send('state', { state: 'error', text: 'Can’t do: ' + cmd.label.slice(0, 40) });
    say('Sorry, I can’t do that.');
    return;
  }
  perform(cmd);
}

// A command typed in the panel goes through the same checks as a spoken one (confirmations, the computer-control switch, routines).
const MAX_COMMAND_CHARS = 300;
function runTypedCommand(text) {
  if (typeof text !== 'string') return;
  const typed = text.trim().slice(0, MAX_COMMAND_CHARS);
  if (typed) respond(typed);
}

// "run good morning": the saved steps run one after another, each through the same safe actions as a spoken command.
function startRoutine(name) {
  const routine = findRoutine(settings.routines, name);
  if (!routine) { send('state', { state: 'error', text: 'No routine called ' + String(name).slice(0, 30) }); say('I do not have a routine with that name.'); return; }
  if (routine.steps.some((step) => NEEDS_PC_CONTROL.has((parseCommand(step) || {}).type)) && !settings.pcControl) { send('state', { state: 'error', text: 'Computer control is off in settings' }); say('Computer control is turned off in settings.'); return; }
  send('state', { state: 'working', text: routine.name });
  const spoken = [];
  runRoutine(routine.steps, (cmd) => Promise.resolve(runAction(cmd)).then((line) => { if (cmd.type === 'say' || cmd.type === 'pc') spoken.push(line); })).then(({ done, failed }) => {
    const message = failed ? `Stopped after ${done} of ${routine.steps.length}: ${failed}` : `${routine.name} done`;
    send('state', { state: failed ? 'error' : 'done', text: message.slice(0, 60) });
    say(failed ? message : [...spoken, 'All done.'].join(' '));
  });
}

// "task sort my downloads": Claude makes a plan. A small plan with no deleting can be approved by voice; anything else waits in the panel.
function startAssistantTask(text) {
  const fail = (reason) => { send('state', { state: 'error', text: reason.slice(0, 60) }); say(reason); };
  if (!settings.assistantTasks || !panelService) { fail('Tasks are turned off in settings.'); return; }
  send('state', { state: 'asking' });
  panelService.assistant.plan(text).then((plan) => {
    if (plan.phase !== 'review') { fail(plan.error || 'I could not make a plan.'); return; }
    if (plan.canApproveByVoice) {
      const count = plan.steps.length;
      askToConfirm({ type: 'assistant-run', label: 'task', summary: plan.summary, confirm: `Plan: ${plan.summary}. ${count} step${count === 1 ? '' : 's'}. Run it?` });
      return;
    }
    panelService.show();
    send('state', { state: 'done', text: 'Plan ready in the panel' });
    say('Your plan is ready. Open the Assistant tab, check it, and press Run.');
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
      say('Sorry, I couldn’t get an answer from Claude.');
    }
  );
}

// Shows the answer on the card and speaks it. When he finishes talking he listens for a follow-up.
function deliverAnswer(answer) {
  isAsking = false;
  const text = answer || 'I don’t have an answer for that.';
  send('notify', { title: 'Batman', body: text, ms: Math.max(MIN_ANSWER_CARD_MS, text.length * MS_PER_ANSWER_CHAR) });
  if (settings.talkBack && voice && isVoiceReady) {
    isSpeakingAnswer = true;
    send('state', { state: 'speaking' });
    voice.say(text);
  } else {
    send('state', { state: 'idle' });
  }
}

function endListening() {
  clearTimeout(listenTimer);
  afterGreeting = null;
  isListening = false;
  heardText = '';
  lastUnclear = 1;
  noiseRetries = 0;
  isFollowUp = false;
  syncVoiceMode();
}

function finishListening({ silence }) {
  if (!isListening) return;
  const heard = heardText;
  const wasFollowUp = isFollowUp;
  if (!heard && !silence && lastUnclear < NOISE_CONFIDENCE && noiseRetries < MAX_NOISE_RETRIES) {
    noiseRetries += 1; // a noise blip ended the turn, not speech: keep listening
    lastUnclear = 1;
    voice.setMode('command');
    return;
  }
  endListening();
  if (heard) { respond(heard); return; }
  if (wasFollowUp) { send('state', { state: 'idle' }); return; } // no follow-up question: just go back to waiting
  const text = silence ? 'I didn’t hear anything' : 'Didn’t catch that';
  send('state', { state: 'idle', text });
  say(text + '.');
}

// Stops whatever he is doing: listening, waiting for Claude, or talking.
function cancelListen() {
  confirmation.clear(); // pressing cancel also drops an open "yes or no" question
  if (!isListening && !isAsking && !isSpeakingAnswer) return;
  askToken += 1; // an answer still on its way is dropped
  isAsking = false;
  isSpeakingAnswer = false;
  if (voice) voice.silence();
  if (isListening) endListening();
  send('state', { state: 'idle', text: 'Cancelled' });
}

function beginListening(followUp) {
  if (isListening) { cancelListen(); return; }
  if (!voice || !isVoiceReady) { send('state', { state: 'error', text: 'Voice is still starting' }); return; }
  if (isMicTesting) stopMicTest();
  askToken += 1; // starting to listen drops any answer he was still waiting for
  isAsking = false;
  isSpeakingAnswer = false;
  if (!followUp) voice.silence();
  isListening = true;
  isFollowUp = followUp;
  heardText = '';
  send('state', { state: 'listening' });
  voice.setMode('off'); // quiet the microphone while he says "Yes?"

  const beginHearing = () => {
    voice.setMode('command');
    listenTimer = setTimeout(() => finishListening({ silence: true }), followUp ? FOLLOW_UP_LIMIT_MS : LISTEN_LIMIT_MS);
  };
  if (settings.talkBack && !followUp) {
    afterGreeting = beginHearing;
    voice.say('Yes?');
  } else {
    beginHearing();
  }
}

// Pressing the hotkey or the face while he is busy cancels instead of starting again.
function listen() { beginListening(false); }
function listenForFollowUp() { beginListening(true); }

function startMicTest() {
  if (!voice || !isVoiceReady) { sendToSettings('mic-test', { kind: 'error', text: 'The voice engine is still starting. Try again in a few seconds.' }); return; }
  if (isListening) cancelListen();
  isMicTesting = true;
  voice.setMode('test');
  clearTimeout(micTestTimer);
  micTestTimer = setTimeout(stopMicTest, MIC_TEST_MS);
  sendToSettings('mic-test', { kind: 'started', seconds: MIC_TEST_MS / 1000 });
}

function stopMicTest() {
  if (!isMicTesting) return;
  clearTimeout(micTestTimer);
  isMicTesting = false;
  syncVoiceMode();
  sendToSettings('mic-test', { kind: 'stopped' });
}

function onVoiceEvent(event) {
  switch (event.e) {
    case 'ready':
      isVoiceReady = true;
      voiceRestarts = 0;
      syncVoiceMode();
      break;
    case 'wake':
      logVoice(event);
      if (isMicTesting) sendToSettings('mic-test', { kind: 'heard', text: event.text, confidence: event.confidence, wouldWake: true });
      else if (!isListening) listen();
      break;
    case 'wake-miss':
      if (event.confidence >= MIN_LOGGED_CONFIDENCE) logVoice(event);
      if (isMicTesting) sendToSettings('mic-test', { kind: 'heard', text: event.text, confidence: event.confidence, wouldWake: false });
      break;
    case 'heard':
      heardText = event.text;
      lastUnclear = 1;
      break;
    case 'unclear':
      lastUnclear = event.confidence;
      break;
    case 'completed':
      finishListening({ silence: event.silence });
      break;
    case 'spoken':
      if (event.cancelled) break;
      if (afterGreeting) {
        const next = afterGreeting;
        afterGreeting = null;
        next();
      } else if (isSpeakingAnswer) {
        isSpeakingAnswer = false;
        send('state', { state: 'idle' });
        listenForFollowUp();
      }
      break;
    case 'level':
      if (isMicTesting) sendToSettings('mic-test', { kind: 'level', level: event.v });
      else if (isListening) send('level', event.v);
      break;
    case 'error':
      send('state', { state: 'error', text: 'Voice: ' + String(event.message).slice(0, 40) });
      break;
    case 'exit':
      voice = null;
      isVoiceReady = false;
      if (isListening) endListening();
      if (isQuitting) break;
      if (voiceRestarts < VOICE_RESTARTS) {
        voiceRestarts += 1;
        setTimeout(launchVoice, 2000);
      } else {
        send('state', { state: 'error', text: 'Voice stopped: ' + (event.message || 'unknown').slice(0, 40) });
      }
      break;
    default:
      break;
  }
}

function launchVoice() {
  voice = startVoice({
    wakePhrases: WAKE_PHRASES,
    fixedCommands: VOICE_VOCAB.fixed,
    openTargets: VOICE_VOCAB.openTargets,
    minWake: wakeConfidence(),
    minCommand: MIN_COMMAND_CONFIDENCE,
    onEvent: onVoiceEvent,
  });
}

function registerHotkey(accelerator, handler = listen) {
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
    { label: 'Talk to Batman', click: listen },
    { label: 'Focus mode', type: 'checkbox', checked: focusMode.isOn(), click: (item) => focusMode.set(item.checked) },
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: settings.autostart, click: (item) => saveSettings({ ...settings, autostart: item.checked }) },
    { type: 'separator' },
    { label: 'Quit Notch', click: () => app.quit() },
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
  syncClaude();
  if (voice && isVoiceReady) {
    voice.setMinWake(wakeConfidence());
    syncVoiceMode();
  }
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
  if (new Set([next.voiceHotkey, next.panelHotkey, next.captureHotkey, next.commandHotkey]).size < 4) return { ok: false, error: 'The voice, panel, quick note and command hotkeys must all be different.' };
  const hotkeys = [
    { key: 'voiceHotkey', handler: listen },
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
    createWindow();
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
        say(message);
      },
    });
    panelService.start();
    live = startLive({ onEvent: onLiveEvent });
    panelService.syncActivity(); // if Screen Time was left on, tell the watcher to start looking again
    startEventServer();
    ipcMain.on('mouse-ignore', (_e, ignore) => win.setIgnoreMouseEvents(ignore, { forward: true }));
    ipcMain.on('listen', listen);
    ipcMain.on('cancel-listen', cancelListen);
    ipcMain.on('mic-test:start', startMicTest);
    ipcMain.on('mic-test:stop', stopMicTest);
    ipcMain.handle('settings:get', () => settings);
    ipcMain.handle('settings:meta', () => { const { packs, problems } = readPacks(); return { modules: MODULES, themes: [...THEME_INFO, ...packs], packProblems: problems }; });
    ipcMain.handle('packs:list', () => readPacks().packs);
    ipcMain.handle('packs:open', () => { fs.mkdirSync(packsDir(), { recursive: true }); return shell.openPath(packsDir()); });
    ipcMain.handle('media:control', (_e, command) => { if (live) live.media(String(command)); });
    ipcMain.handle('message:show', (_e, input) => showMessage(input));
    ipcMain.handle('message:clear', () => clearMessage());
    ipcMain.handle('settings:save', (_e, raw) => saveSettings(raw));
    ipcMain.on('settings:test-notify', () => send('notify', { title: 'Test message', body: 'Hello from your notch' }));
    ipcMain.on('settings:quit', () => app.quit());

    if (!registerHotkey(settings.voiceHotkey)) {
      send('state', { state: 'error', text: settings.voiceHotkey + ' is taken' });
    }
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
    launchVoice();
    watchNotifications({
      getFilter: () => settingsStore.keywordFilter(settings.notifyKeyword),
      onNotify: (n) => sendAlert('notify', n),
      onError: (err) => sendAlert('state', { state: 'error', text: 'Notifications: ' + err.message.slice(0, 40) }),
    });
    if (!process.argv.includes('--autostart')) openSettings();
  });
}

app.on('window-all-closed', () => {}); // keep running in the tray
app.on('will-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  if (live) live.stop();
  if (voice) voice.stop();
  if (claude) claude.stop();
  if (panelService) panelService.stop();
});
