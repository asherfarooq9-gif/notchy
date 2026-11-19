const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../lib/store');

const freshStore = () => createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'notch-store-')));

test('saved data comes back, and missing data gives the fallback', () => {
  const store = freshStore();
  assert.deepStrictEqual(store.get('notes', []), []);
  store.set('notes', [{ id: 1, text: 'hello' }]);
  assert.deepStrictEqual(store.get('notes', []), [{ id: 1, text: 'hello' }]);
});
test('unknown names are refused, so nothing can write arbitrary files', () => {
  const store = freshStore();
  assert.throws(() => store.set('../evil', []), /Unknown data name/);
  assert.throws(() => store.get('settings', null), /Unknown data name/);
});
test('the wrong shape is refused', () => {
  const store = freshStore();
  assert.throws(() => store.set('notes', 'not a list'), /Invalid data/);
  assert.throws(() => store.set('timerSettings', []), /Invalid data/);
  assert.throws(() => store.set('links', new Array(101).fill({})), /Invalid data/);
});
test('oversized data is refused', () => {
  const store = freshStore();
  assert.throws(() => store.set('notes', [{ text: 'x'.repeat(3 * 1024 * 1024) }]), /too large/);
});
test('a damaged file gives the fallback instead of crashing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-store-'));
  fs.writeFileSync(path.join(dir, 'notes.json'), '{not json');
  assert.deepStrictEqual(createStore(dir).get('notes', ['fallback']), ['fallback']);
});
