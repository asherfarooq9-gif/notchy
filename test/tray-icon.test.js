const test = require('node:test');
const assert = require('node:assert');
const { buildTrayHtml, createTrayIcons } = require('../lib/tray-icon');
const Heroes = require('../renderer/heroes.js');
const { THEMES } = require('../lib/themes');

test('every hero look makes a tray picture from the shared drawing, with two eyes', () => {
  assert.strictEqual(Heroes.ids.length, 9);
  for (const id of Heroes.ids) {
    assert.ok(THEMES.includes(id), `${id} is not a look`);
    const html = buildTrayHtml(id);
    assert.ok(html && html.includes('<svg') && html.includes('viewBox="-2 -2 28 28"'), id);
    assert.ok((html.match(/<rect /g) || []).length >= 2, `${id} eyes`);
  }
});
test('the picture really contains that hero (a color unique to its drawing)', () => {
  assert.ok(buildTrayHtml('ironman').includes('#b3121a'));
  assert.ok(buildTrayHtml('hulk').includes('#7bbf2a'));
  assert.ok(buildTrayHtml('doom').includes('#166534'));
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
test('the shared drawings file gives every hero a drawing and eyes, and nothing else', () => {
  assert.deepStrictEqual(Object.keys(Heroes.DRAWINGS).sort(), Object.keys(Heroes.EYES).sort());
  for (const id of Heroes.ids) {
    assert.ok(Heroes.DRAWINGS[id].includes('<path'), id);
    const e = Heroes.EYES[id];
    assert.strictEqual(e.cx.length, 2, `${id} has two eyes`);
    assert.ok(e.w > 0 && e.h > 0 && /^#[0-9a-f]{6}$/i.test(e.color), id);
  }
  assert.strictEqual(Heroes.markup('nobody'), null);
  assert.ok(!Heroes.markup('thor', { withEyes: false }).includes('<rect x="'), 'eyes left out on request');
});
