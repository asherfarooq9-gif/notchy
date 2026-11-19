const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sanitize, keywordFilter, load, save, DEFAULTS } = require('../lib/settings');
const { MODULE_IDS } = require('../lib/modules');

test('look and light settings accept only known values', () => {
  const s = sanitize({ edgeLight: 'disco', edgeColor: 'red', theme: 'neon' });
  assert.strictEqual(s.edgeLight, DEFAULTS.edgeLight);
  assert.strictEqual(s.edgeColor, DEFAULTS.edgeColor);
  assert.strictEqual(s.theme, DEFAULTS.theme);
  assert.strictEqual(sanitize({ theme: 'pack-sunny' }).theme, 'pack-sunny', 'a character pack look is kept');
  for (const bad of ['pack-', 'pack-A', 'pack-../x', 'pack-' + 'a'.repeat(25), 5, null]) assert.strictEqual(sanitize({ theme: bad }).theme, DEFAULTS.theme, String(bad));
});
test('a tool added in a new version appears for an old saved list, but a hidden tool stays hidden', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'notch-settings-')), 'settings.json');
  const oldModules = MODULE_IDS.filter((id) => id !== 'message'); // an older version had no Message tool
  fs.writeFileSync(file, JSON.stringify({ modules: oldModules }));
  const first = load(file);
  assert.ok(first.modules.includes('message'), 'the new tool is offered once');
  const withoutUnits = { ...first, modules: first.modules.filter((id) => id !== 'units') }; // the user switches Units off
  save(file, withoutUnits);
  const again = load(file);
  assert.ok(!again.modules.includes('units'), 'a tool the user switched off stays off');
  assert.ok(again.modules.includes('message'));
});

test('empty or junk input gives defaults', () => {
  assert.deepStrictEqual(sanitize(undefined), DEFAULTS);
  assert.deepStrictEqual(sanitize('nope'), DEFAULTS);
});
test('valid values are kept', () => {
  const s = sanitize({ showTimeInNotch: false, showBatteryInNotch: false, stepAside: false, showMusicActivity: false, showVolumeBar: false, showCopiedTick: true, edgeLight: 'pulse', edgeColor: '#AABBCC', theme: 'thor', colorMode: 'dark', panelHotkey: 'Alt+Shift+P', hoverOpen: false, showTimerInNotch: false, modules: ['notes', 'home'], autostart: false, hideUntilCalled: false, alertsWhileHidden: true, danceOnMusic: false, wakeWord: false, talkBack: false, askClaude: false, pcControl: false, assistantTasks: false, reactiveHero: false, routines: [], captureHotkey: 'Control+Alt+K', commandHotkey: 'Control+Alt+L', wakeSensitivity: 5, notifyKeyword: ' discord ', sleepMinutes: 10, voiceHotkey: 'Alt+Shift+M' });
  assert.deepStrictEqual(s, { showTimeInNotch: false, showBatteryInNotch: false, stepAside: false, showMusicActivity: false, showVolumeBar: false, showCopiedTick: true, edgeLight: 'pulse', edgeColor: '#aabbcc', theme: 'thor', colorMode: 'dark', panelHotkey: 'Alt+Shift+P', hoverOpen: false, showTimerInNotch: false, modules: ['notes', 'home'], autostart: false, hideUntilCalled: false, alertsWhileHidden: true, danceOnMusic: false, wakeWord: false, talkBack: false, askClaude: false, pcControl: false, assistantTasks: false, reactiveHero: false, routines: [], captureHotkey: 'Control+Alt+K', commandHotkey: 'Control+Alt+L', wakeSensitivity: 5, notifyKeyword: 'discord', sleepMinutes: 10, voiceHotkey: 'Alt+Shift+M' });
});
test('bad values fall back to defaults', () => {
  const s = sanitize({ autostart: 'yes', sleepMinutes: -3, voiceHotkey: 'banana' });
  assert.strictEqual(s.autostart, DEFAULTS.autostart);
  assert.strictEqual(s.sleepMinutes, DEFAULTS.sleepMinutes);
  assert.strictEqual(s.voiceHotkey, DEFAULTS.voiceHotkey);
});
test('wake sensitivity must be a whole number from 1 to 5', () => {
  assert.strictEqual(sanitize({ wakeSensitivity: 0 }).wakeSensitivity, DEFAULTS.wakeSensitivity);
  assert.strictEqual(sanitize({ wakeSensitivity: 6 }).wakeSensitivity, DEFAULTS.wakeSensitivity);
  assert.strictEqual(sanitize({ wakeSensitivity: 2.5 }).wakeSensitivity, DEFAULTS.wakeSensitivity);
  assert.strictEqual(sanitize({ wakeSensitivity: 4 }).wakeSensitivity, 4);
});
test('the module list keeps known tools once each, in order, and falls back to all', () => {
  assert.deepStrictEqual(sanitize({ modules: ['units', 'bogus', 'home', 'units'] }).modules, ['units', 'home']);
  assert.deepStrictEqual(sanitize({ modules: [] }).modules, DEFAULTS.modules);
  assert.deepStrictEqual(sanitize({ modules: 'home' }).modules, DEFAULTS.modules);
});
test('sleepMinutes 0 means never and is allowed', () => {
  assert.strictEqual(sanitize({ sleepMinutes: 0 }).sleepMinutes, 0);
});
test('keyword filter is case-insensitive and treats text literally', () => {
  assert.ok(keywordFilter('whatsapp').test('From WhatsApp Web'));
  assert.ok(keywordFilter('a.b').test('a.b'));
  assert.ok(!keywordFilter('a.b').test('axb'));
});
test('blank keyword means show everything', () => {
  assert.strictEqual(keywordFilter('  '), null);
});

test('the command hotkey has a default and refuses odd values', () => {
  assert.strictEqual(DEFAULTS.commandHotkey, 'Control+Alt+J');
  assert.strictEqual(sanitize({ commandHotkey: 'Control+Alt+L' }).commandHotkey, 'Control+Alt+L');
  for (const bad of ['', 'L', 'Control+Alt+', 'Control+Alt+LL', 5, null, undefined]) assert.strictEqual(sanitize({ commandHotkey: bad }).commandHotkey, DEFAULTS.commandHotkey, String(bad));
});

test('computer control from voice is off until you turn it on', () => {
  assert.strictEqual(DEFAULTS.pcControl, false);
  assert.strictEqual(sanitize({}).pcControl, false);
  assert.strictEqual(sanitize({ pcControl: true }).pcControl, true, 'a person who turned it on keeps it on');
});
