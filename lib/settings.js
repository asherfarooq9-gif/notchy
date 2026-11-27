const fs = require('fs');
const path = require('path');
const { MODULE_IDS } = require('./modules');
const { checkRoutines } = require('./routines');

const DEFAULTS = Object.freeze({
  setupDone: false, // false until the person finishes the welcome screen (an old settings file counts as finished, see load)
  autostart: false, // off until the person says yes on the welcome screen
  autoUpdate: true, // check GitHub for a new version now and then (installed app only) and download it for you
  reactiveHero: true, // the notch character cheers when a timer ends and looks worried when the battery is low
  heroMoves: true, // every minute the notch character does its special move and shows its line
  heroVoice: true, // and a Windows voice says the line
  hideUntilCalled: true, // the notch stays out of sight until he is called (hotkey, tray)
  alertsWhileHidden: false, // when hidden, still pop up for WhatsApp messages and Claude Code alerts
  danceOnMusic: true,
  askClaude: false, // send questions to Claude: off until the person says yes on the welcome screen
  pcControl: false, // off until you turn it on: a typed or pasted command could otherwise "type..." or "shut down" (Wi-Fi, typing, sleep ...). Risky ones always ask first.
  routines: [], // routines: [{name, steps: ["battery", "open chrome"]}], run by typing "run <name>"
  assistantTasks: false, // Claude may plan file tasks (move, rename, tidy). Off until the person says yes. Nothing runs until you press Run.
  notifyKeyword: 'whatsapp', // blank = show popups from every app
  sleepMinutes: 5, // 0 = never sleep
  panelHotkey: 'Control+Alt+N', // opens the panel of tools
  captureHotkey: 'Control+Alt+K', // opens the panel on a fresh note, ready to type
  commandHotkey: 'Control+Alt+J', // opens the panel on a box where you type a command instead of saying it
  hoverOpen: true, // resting the mouse at the top-center edge of the screen opens the panel
  showTimerInNotch: true, // a running timer keeps its countdown in the notch
  modules: MODULE_IDS, // the panel's tools, in the order shown (hidden ones are left out)
  stepAside: true, // hide completely while a full-screen app or game is running
  showMusicActivity: true, // announce a new song in the notch, with album art
  showVolumeBar: true, // a level bar when the volume changes
  showCopiedTick: false, // a small tick when you copy something
  showTimeInNotch: true, // the time, on the right of the notch
  showBatteryInNotch: true, // the battery level, next to the time
  edgeLight: 'off', // a thin line of light around the notch: off | solid | pulse | music (album art color)
  edgeColor: '#facc15',
  ambientLight: 'off', // glow around the screen edges that follows the picture: off | movies (full-screen apps only) | always
  ambientIntensity: 3, // 1 = faint and thin, 5 = strong and wide
  theme: 'batman', // panel look: one of the ids in lib/themes.js
  colorMode: 'light', // light or dark glass, for the panel and this window
});

const EDGE_LIGHTS = ['off', 'solid', 'pulse', 'music'];
const { AMBIENT_MODES } = require('./ambient');
const { THEMES, COLOR_MODES } = require('./themes');
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const PACK_ID = /^pack-[a-z0-9-]{1,24}$/; // a character pack (see lib/packs.js)

const MAX_SLEEP_MINUTES = 120;
const MAX_KEYWORD_LENGTH = 40;
const HOTKEY_PATTERN = /^((Control|Ctrl|Alt|Shift|Super)\+)+(Space|F([1-9]|1[0-2])|[A-Z0-9])$/;

// Keeps only known tools, once each, in the given order. An empty or missing list means "all of them".
function pickModules(value) {
  if (!Array.isArray(value)) return [...MODULE_IDS];
  const picked = [...new Set(value.filter((id) => MODULE_IDS.includes(id)))];
  return picked.length > 0 ? picked : [...MODULE_IDS];
}

function pickBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

// Takes anything (file contents, form data) and returns a clean settings object.
function sanitize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const isMinutes = Number.isInteger(r.sleepMinutes) && r.sleepMinutes >= 0 && r.sleepMinutes <= MAX_SLEEP_MINUTES;
  return {
    setupDone: pickBoolean(r.setupDone, DEFAULTS.setupDone),
    autostart: pickBoolean(r.autostart, DEFAULTS.autostart),
    autoUpdate: pickBoolean(r.autoUpdate, DEFAULTS.autoUpdate),
    reactiveHero: pickBoolean(r.reactiveHero, DEFAULTS.reactiveHero),
    heroMoves: pickBoolean(r.heroMoves, DEFAULTS.heroMoves),
    heroVoice: pickBoolean(r.heroVoice, DEFAULTS.heroVoice),
    hideUntilCalled: pickBoolean(r.hideUntilCalled, DEFAULTS.hideUntilCalled),
    alertsWhileHidden: pickBoolean(r.alertsWhileHidden, DEFAULTS.alertsWhileHidden),
    danceOnMusic: pickBoolean(r.danceOnMusic, DEFAULTS.danceOnMusic),
    askClaude: pickBoolean(r.askClaude, DEFAULTS.askClaude),
    pcControl: pickBoolean(r.pcControl, DEFAULTS.pcControl),
    assistantTasks: pickBoolean(r.assistantTasks, DEFAULTS.assistantTasks),
    routines: checkRoutines(r.routines).routines,
    notifyKeyword: typeof r.notifyKeyword === 'string' ? r.notifyKeyword.trim().slice(0, MAX_KEYWORD_LENGTH) : DEFAULTS.notifyKeyword,
    sleepMinutes: isMinutes ? r.sleepMinutes : DEFAULTS.sleepMinutes,
    captureHotkey: typeof r.captureHotkey === 'string' && HOTKEY_PATTERN.test(r.captureHotkey) ? r.captureHotkey : DEFAULTS.captureHotkey,
    commandHotkey: typeof r.commandHotkey === 'string' && HOTKEY_PATTERN.test(r.commandHotkey) ? r.commandHotkey : DEFAULTS.commandHotkey,
    panelHotkey: typeof r.panelHotkey === 'string' && HOTKEY_PATTERN.test(r.panelHotkey) ? r.panelHotkey : DEFAULTS.panelHotkey,
    hoverOpen: pickBoolean(r.hoverOpen, DEFAULTS.hoverOpen),
    showTimerInNotch: pickBoolean(r.showTimerInNotch, DEFAULTS.showTimerInNotch),
    modules: pickModules(r.modules),
    stepAside: pickBoolean(r.stepAside, DEFAULTS.stepAside),
    showMusicActivity: pickBoolean(r.showMusicActivity, DEFAULTS.showMusicActivity),
    showVolumeBar: pickBoolean(r.showVolumeBar, DEFAULTS.showVolumeBar),
    showCopiedTick: pickBoolean(r.showCopiedTick, DEFAULTS.showCopiedTick),
    showTimeInNotch: pickBoolean(r.showTimeInNotch, DEFAULTS.showTimeInNotch),
    showBatteryInNotch: pickBoolean(r.showBatteryInNotch, DEFAULTS.showBatteryInNotch),
    edgeLight: EDGE_LIGHTS.includes(r.edgeLight) ? r.edgeLight : DEFAULTS.edgeLight,
    edgeColor: typeof r.edgeColor === 'string' && COLOR_PATTERN.test(r.edgeColor) ? r.edgeColor.toLowerCase() : DEFAULTS.edgeColor,
    ambientLight: AMBIENT_MODES.includes(r.ambientLight) ? r.ambientLight : DEFAULTS.ambientLight,
    ambientIntensity: Number.isInteger(r.ambientIntensity) && r.ambientIntensity >= 1 && r.ambientIntensity <= 5 ? r.ambientIntensity : DEFAULTS.ambientIntensity,
    theme: THEMES.includes(r.theme) || PACK_ID.test(r.theme) ? r.theme : DEFAULTS.theme, // a missing pack falls back to the plain colors in the page
    colorMode: COLOR_MODES.includes(r.colorMode) ? r.colorMode : DEFAULTS.colorMode,
  };
}

function keywordFilter(keyword) {
  const word = String(keyword || '').trim();
  if (!word) return null;
  return new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

// A tool added in a newer version shows up for people who already have a saved list, but a tool they
// switched off themselves stays off: "knownModules" remembers which tools they have already been offered.
function withNewModules(raw) {
  if (!raw || !Array.isArray(raw.modules)) return raw;
  const known = Array.isArray(raw.knownModules) ? raw.knownModules : [];
  const fresh = MODULE_IDS.filter((id) => !known.includes(id) && !raw.modules.includes(id));
  return { ...raw, modules: [...raw.modules, ...fresh] };
}

// A missing or corrupt file just means "use the defaults".
function load(file) {
  try {
    // A file saved before the welcome screen existed belongs to someone who already set things up: do not ask again.
    return sanitize(withNewModules({ setupDone: true, ...JSON.parse(fs.readFileSync(file, 'utf8')) }));
  } catch {
    return { ...DEFAULTS };
  }
}

function save(file, settings) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...settings, knownModules: MODULE_IDS }, null, 2));
}

module.exports = { DEFAULTS, sanitize, keywordFilter, load, save, THEMES };
