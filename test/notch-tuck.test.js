const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Tuck = require('../renderer/notch-tuck.js');
const { sanitize, DEFAULTS } = require('../lib/settings');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('the notch tucks away only when it is on, quiet and nothing is being asked of it', () => {
  const base = { isOn: true, state: 'idle', isFocus: false, isDormant: false, hasCard: false };
  assert.strictEqual(Tuck.canTuck(base), true);
  assert.strictEqual(Tuck.canTuck({ ...base, isOn: false }), false, 'switched off in Settings');
  assert.strictEqual(Tuck.canTuck({ ...base, state: 'asking' }), false, 'he is waiting for your answer');
  assert.strictEqual(Tuck.canTuck({ ...base, state: 'working' }), false, 'Claude is working');
  assert.strictEqual(Tuck.canTuck({ ...base, hasCard: true }), false, 'a message card is open');
  assert.strictEqual(Tuck.canTuck({ ...base, isDormant: true }), false, 'already out of sight');
});

test('it waits a moment before tucking, so passing over the notch does not make it jump', () => {
  assert.ok(Tuck.TUCK_AFTER_MS >= 250 && Tuck.TUCK_AFTER_MS <= 600);
});

test('it comes back only when the pointer leaves the place where the notch was, with a small margin', () => {
  const rect = { left: 100, top: 0, right: 300, bottom: 40 };
  assert.strictEqual(Tuck.isOutside({ x: 200, y: 20 }, rect), false, 'inside');
  assert.strictEqual(Tuck.isOutside({ x: 305, y: 20 }, rect), false, 'just outside is still inside the margin');
  assert.strictEqual(Tuck.isOutside({ x: 100 + 200 + Tuck.RETURN_MARGIN_PX + 1, y: 20 }, rect), true, 'beyond the margin on the right');
  assert.strictEqual(Tuck.isOutside({ x: 200, y: 40 + Tuck.RETURN_MARGIN_PX + 1 }, rect), true, 'beyond the margin below');
  assert.strictEqual(Tuck.isOutside({ x: 50, y: 20 }, rect), true, 'far to the left');
});

test('the setting is on by default, can be switched off, and ignores junk', () => {
  assert.strictEqual(DEFAULTS.tuckOnHover, true);
  assert.strictEqual(sanitize({ tuckOnHover: false }).tuckOnHover, false);
  assert.strictEqual(sanitize({ tuckOnHover: 'yes' }).tuckOnHover, true);
});

test('the notch page loads the tuck rules, the style hides the tucked notch, and Settings has the switch', () => {
  assert.ok(read('renderer/index.html').includes('notch-tuck.js'));
  const app = read('renderer/app.js');
  for (const piece of ['NotchTuck', 'tucked', 'TUCK_AFTER_MS', 'isOutside']) assert.ok(app.includes(piece), `app.js uses ${piece}`);
  assert.match(read('renderer/style.css'), /body\.tucked \.pill\s*\{[^}]*translateY\(-1\d\d%\)/);
  assert.ok(read('renderer/settings.html').includes('id="tuckOnHover"'));
  assert.ok(read('renderer/settings.js').includes('tuckOnHover'));
});
