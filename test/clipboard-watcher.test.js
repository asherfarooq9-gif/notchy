const test = require('node:test');
const assert = require('node:assert');
const { createClipboardWatcher } = require('../lib/clipboard-watcher');

// A pretend picture: the same pixels give the same bytes. Counts how often it is turned into picture text, the costly step.
function pictureMaker() {
  const counts = { encoded: 0 };
  const make = (pixels) => {
    const picture = {
      isEmpty: () => false,
      getSize: () => ({ width: 2, height: 2 }),
      toBitmap: () => Buffer.from(pixels),
      resize: () => picture,
      toDataURL: () => { counts.encoded += 1; return 'data:image/png;base64,' + Buffer.from(pixels).toString('base64'); },
    };
    return picture;
  };
  return { make, counts };
}

function setup() {
  const state = { text: '', image: null, formats: ['text/plain'] };
  const clipboard = {
    readText: () => state.text,
    readImage: () => state.image || { isEmpty: () => true },
    availableFormats: () => state.formats,
    readBuffer: () => Buffer.alloc(0),
  };
  const saved = {};
  const store = { get: (name, fallback) => (name in saved ? saved[name] : fallback), set: (name, value) => { saved[name] = value; } };
  const copies = { count: 0 };
  const watcher = createClipboardWatcher({ clipboard, nativeImage: {}, store, onChange() {}, onCopy: () => { copies.count += 1; } });
  return { state, watcher, copies };
}

test('copied text is kept once, however many times the clipboard is looked at', () => {
  const { state, watcher, copies } = setup();
  state.text = 'hello';
  for (let i = 0; i < 5; i++) watcher.poll();
  assert.strictEqual(watcher.list('').length, 1);
  assert.strictEqual(copies.count, 1);
});

test('a picture left on the clipboard is turned into picture text once, not on every look', () => {
  const { state, watcher } = setup();
  const pictures = pictureMaker();
  state.image = pictures.make([1, 2, 3, 4]);
  for (let i = 0; i < 20; i++) watcher.poll();
  assert.strictEqual(pictures.counts.encoded, 1, 'the costly step ran once');
  assert.strictEqual(watcher.list('').length, 1);
});

test('a picture that differs by a single pixel is a new copy', () => {
  const { state, watcher, copies } = setup();
  const pictures = pictureMaker();
  state.image = pictures.make([1, 2, 3, 4, 5, 6, 7, 8]);
  watcher.poll();
  state.image = pictures.make([1, 2, 3, 4, 5, 6, 7, 9]); // one value changed
  watcher.poll();
  assert.strictEqual(watcher.list('').length, 2);
  assert.strictEqual(copies.count, 2);
});

test('a picture too big to keep is skipped once and not worked on again at every look', () => {
  const { state, watcher } = setup();
  const pictures = pictureMaker();
  const huge = pictures.make([1, 2, 3, 4]);
  huge.toDataURL = () => { pictures.counts.encoded += 1; return 'data:image/png;base64,' + 'A'.repeat(600000); };
  state.image = huge;
  for (let i = 0; i < 10; i++) watcher.poll();
  assert.strictEqual(pictures.counts.encoded, 1);
  assert.strictEqual(watcher.list('').length, 0);
});

test('a copy from a password manager is still never kept', () => {
  const { state, watcher } = setup();
  state.text = 'secret-password';
  state.formats = ['text/plain', 'ExcludeClipboardContentFromMonitorProcessing'];
  watcher.poll();
  assert.strictEqual(watcher.list('').length, 0);
});
