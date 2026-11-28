const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { sanitize } = require('../lib/settings');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Settings lets you choose how the panel opens: by hovering or by clicking', () => {
  const html = read('renderer/settings.html');
  const select = html.match(/<select id="hoverOpen"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(select, 'a choice (not a tick box) with the id hoverOpen');
  assert.match(select[1], /<option value="hover">/);
  assert.match(select[1], /<option value="click">/);
  assert.ok(!/<input type="checkbox" id="hoverOpen">/.test(html), 'the old tick box is gone');
});

test('the choice is saved in the same hoverOpen setting, so everyone who already chose keeps their choice', () => {
  const js = read('renderer/settings.js');
  assert.match(js, /fields\.hoverOpen\.value\s*=\s*settings\.hoverOpen\s*\?\s*'hover'\s*:\s*'click'/);
  assert.match(js, /hoverOpen:\s*fields\.hoverOpen\.value\s*===\s*'hover'/);
  assert.strictEqual(sanitize({ hoverOpen: true }).hoverOpen, true, 'hover');
  assert.strictEqual(sanitize({ hoverOpen: false }).hoverOpen, false, 'click');
});

test('the text explains both ways', () => {
  const html = read('renderer/settings.html');
  assert.match(html, /By hovering/);
  assert.match(html, /By clicking/);
});
