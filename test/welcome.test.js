const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULTS, sanitize, load, save } = require('../lib/settings');
const { applyWelcomeChoices, CHOICES } = require('../lib/welcome');

const tempFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'notchy-welcome-')), 'settings.json');
const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'renderer', name), 'utf8');

test('a new install starts careful: nothing starts with Windows or talks to Claude until the person says so', () => {
  assert.strictEqual(DEFAULTS.autostart, false);
  assert.strictEqual(DEFAULTS.askClaude, false);
  assert.strictEqual(DEFAULTS.assistantTasks, false);
  assert.strictEqual(DEFAULTS.autoUpdate, true);
  assert.strictEqual(DEFAULTS.setupDone, false);
});

test('no settings file means a fresh install, so the welcome screen is shown', () => {
  assert.strictEqual(load(tempFile()).setupDone, false);
});

test('a settings file saved before the welcome screen existed is not asked again', () => {
  const file = tempFile();
  fs.writeFileSync(file, JSON.stringify({ autostart: true, askClaude: true }));
  const s = load(file);
  assert.strictEqual(s.setupDone, true);
  assert.strictEqual(s.autostart, true, 'their own choices stay');
});

test('the welcome screen is remembered once it has been finished, and kept if it has not', () => {
  const file = tempFile();
  save(file, sanitize({ setupDone: true }));
  assert.strictEqual(load(file).setupDone, true);
  save(file, sanitize({ setupDone: false }));
  assert.strictEqual(load(file).setupDone, false);
  assert.strictEqual(sanitize({ setupDone: 'yes' }).setupDone, false);
});

test('finishing the welcome screen saves the four choices and marks setup as done', () => {
  const next = applyWelcomeChoices(sanitize({ theme: 'classic' }), { autostart: true, autoUpdate: false, askClaude: true, assistantTasks: false });
  assert.deepStrictEqual(CHOICES, ['autostart', 'autoUpdate', 'askClaude', 'assistantTasks']);
  assert.strictEqual(next.autostart, true);
  assert.strictEqual(next.autoUpdate, false);
  assert.strictEqual(next.askClaude, true);
  assert.strictEqual(next.assistantTasks, false);
  assert.strictEqual(next.setupDone, true);
  assert.strictEqual(next.theme, 'classic', 'other settings are untouched');
});

test('anything that is not exactly true counts as no, and unknown fields are ignored', () => {
  const next = applyWelcomeChoices(sanitize(), { autostart: 'yes', autoUpdate: 1, askClaude: null, assistantTasks: undefined, pcControl: true });
  for (const key of CHOICES) assert.strictEqual(next[key], false, key);
  assert.strictEqual(next.pcControl, false, 'computer control can never be switched on from here');
  assert.strictEqual(applyWelcomeChoices(sanitize(), undefined).setupDone, true);
});

// A packaged app that forgot this file would open a welcome window whose buttons do nothing.
test('the installer ships the welcome window script', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.ok(pkg.build.files.includes('welcome-preload.js'));
});

test('the welcome page has one switch for each choice, a finish button, and a strict security policy', () => {
  const html = read('welcome.html');
  assert.match(html, /default-src 'none'; script-src 'self'; style-src 'self'/);
  for (const id of CHOICES) assert.match(html, new RegExp(`<input type="checkbox" id="${id}"`), id);
  assert.match(html, /<button[^>]*id="finish"/);
  assert.ok(!/\bchecked\b/.test(html), 'switches start unticked in the page; the script sets them from the saved settings');
});
