const test = require('node:test');
const assert = require('node:assert');
const { buildTrayHtml, createTrayIcons } = require('../lib/tray-icon');
const Heroes = require('../renderer/heroes.js');
const { THEMES } = require('../lib/themes');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
Heroes.setPhotos(Object.fromEntries(Heroes.ids.map((id) => [id, 'data:image/png;base64,' + PNG.toString('base64')])));

test('every hero look makes a tray picture from the shared face picture', () => {
  assert.strictEqual(Heroes.ids.length, 16); // 9 Marvel looks and 7 DC looks
  for (const id of Heroes.ids) {
    assert.ok(THEMES.includes(id), `${id} is not a look`);
    const html = buildTrayHtml(id);
    assert.ok(html && html.includes('<svg') && html.includes('viewBox="-2 -2 28 28"'), id);
    assert.ok(html.includes('<image'), `${id} shows its face picture`);
  }
});
test('plain looks and unknown looks have no tray picture, so they keep the Batman icon', () => {
  for (const id of ['classic', 'ember', 'vivid', 'marvel', 'nobody', '__proto__']) assert.strictEqual(buildTrayHtml(id), null, id);
});
test('a look without a drawing gets the Batman icon, and a failure to paint also falls back to it', async () => {
  const fallback = { name: 'batman' };
  let windows = 0;
  const Broken = function () { windows++; throw new Error('no graphics'); };
  const icons = createTrayIcons({ BrowserWindow: Broken, fallback });
  assert.strictEqual(await icons.imageFor('ember'), fallback);
  assert.strictEqual(windows, 0, 'no window is made for a plain look');
  assert.strictEqual(await icons.imageFor('thor'), fallback);
  assert.strictEqual(windows, 1);
});
test('a painted picture is kept, not painted again', async () => {
  const fallback = { name: 'batman' };
  const painted = { isEmpty: () => false, resize: () => ({ name: 'thor-32' }) };
  let made = 0;
  const FakeWindow = function () {
    made++;
    this.loadURL = async () => {};
    this.destroy = () => {};
    this.webContents = { capturePage: async () => painted };
  };
  const icons = createTrayIcons({ BrowserWindow: FakeWindow, fallback });
  assert.deepStrictEqual(await icons.imageFor('thor'), { name: 'thor-32' });
  assert.deepStrictEqual(await icons.imageFor('thor'), { name: 'thor-32' });
  assert.strictEqual(made, 1);
});
test('a painting that never finishes is given up on, the window is closed, and the Batman icon is used', async () => {
  const fallback = { name: 'batman' };
  let destroyed = 0;
  const StuckWindow = function () {
    this.loadURL = async () => {};
    this.destroy = () => { destroyed++; };
    this.webContents = { capturePage: () => new Promise(() => {}) };
  };
  const icons = createTrayIcons({ BrowserWindow: StuckWindow, fallback, paintTimeoutMs: 20 });
  assert.strictEqual(await icons.imageFor('hulk'), fallback);
  assert.strictEqual(destroyed, 1);
});
test('every hero has a face picture file shipped with the app', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  for (const id of Heroes.ids) assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'faces', id + '.png')), id + '.png is shipped');
  assert.deepStrictEqual(Object.keys(Heroes.EYES), [], 'only character packs bring separate eye spots');
  assert.strictEqual(Heroes.markup('nobody'), null);
});
