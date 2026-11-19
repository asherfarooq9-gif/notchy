const test = require('node:test');
const assert = require('node:assert');
const { addEntry, togglePin, removeEntry, clearUnpinned, view, isExcluded, MAX_UNPINNED, MAX_TEXT_CHARS } = require('../lib/clipboard-history');

const text = (value) => ({ type: 'text', text: value });

test('new copies go on top and empty ones are ignored', () => {
  let items = addEntry([], text('one'), 1);
  items = addEntry(items, text('two'), 2);
  items = addEntry(items, text('   '), 3);
  assert.deepStrictEqual(items.map((i) => i.text), ['two', 'one']);
});
test('copying the same thing again moves it up and keeps its pin', () => {
  let items = addEntry([], text('keep'), 1);
  items = togglePin(items, items[0].id);
  items = addEntry(items, text('other'), 2);
  items = addEntry(items, text('keep'), 3);
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].text, 'keep');
  assert.strictEqual(items[0].pinned, true);
});
test('only the newest 100 unpinned items are kept, and pinned ones never drop', () => {
  let items = addEntry([], text('pinned forever'), 0);
  items = togglePin(items, items[0].id);
  for (let i = 1; i <= MAX_UNPINNED + 20; i++) items = addEntry(items, text('item ' + i), i);
  assert.strictEqual(items.filter((i) => !i.pinned).length, MAX_UNPINNED);
  assert.ok(items.some((i) => i.text === 'pinned forever'));
  assert.ok(!items.some((i) => i.text === 'item 1'), 'oldest dropped');
});
test('huge text is cut to a safe length', () => {
  const items = addEntry([], text('x'.repeat(MAX_TEXT_CHARS + 500)), 1);
  assert.strictEqual(items[0].text.length, MAX_TEXT_CHARS);
});
test('the list is never changed in place', () => {
  const before = addEntry([], text('a'), 1);
  const frozen = Object.freeze([...before]);
  assert.doesNotThrow(() => addEntry(frozen, text('b'), 2));
  assert.strictEqual(before.length, 1);
});
test('search is case-insensitive, pinned items come first', () => {
  let items = addEntry([], text('Tracking 123'), 1);
  items = addEntry(items, text('studio hours'), 2);
  items = togglePin(items, items[1].id);
  assert.deepStrictEqual(view(items, 'TRACK').map((i) => i.text), ['Tracking 123']);
  assert.deepStrictEqual(view(items).map((i) => i.text), ['Tracking 123', 'studio hours']);
});
test('remove and clear keep pins', () => {
  let items = addEntry([], text('a'), 1);
  items = addEntry(items, text('b'), 2);
  items = togglePin(items, items[1].id);
  assert.deepStrictEqual(clearUnpinned(items).map((i) => i.text), ['a']);
  assert.strictEqual(removeEntry(items, items[0].id).length, 1);
});
test('anything a password manager marked is skipped', () => {
  const none = () => null;
  assert.strictEqual(isExcluded(['text/plain', 'ExcludeClipboardContentFromMonitorProcessing'], none), true);
  assert.strictEqual(isExcluded(['text/plain', 'CanIncludeInClipboardHistory'], () => [0, 0, 0, 0]), true);
  assert.strictEqual(isExcluded(['text/plain', 'CanIncludeInClipboardHistory'], () => [1, 0, 0, 0]), false);
  assert.strictEqual(isExcluded(['text/plain'], none), false);
});
