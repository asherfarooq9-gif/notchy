const test = require('node:test');
const assert = require('node:assert');
const { createAmbientService, rgbaToBgra, SAMPLE_BYTES } = require('../lib/ambient-service');

function setup(settings = { ambientLight: 'always', ambientIntensity: 3 }) {
  const handlers = {};
  const sent = [];
  const errors = [];
  const webContents = {
    id: 'glow',
    once: (name, cb) => { if (name === 'did-finish-load') setImmediate(cb); },
    send: (channel, payload) => sent.push({ channel, payload }),
  };
  let destroyed = false;
  class FakeWindow {
    constructor() { this.webContents = webContents; }
    setBounds() {} setAlwaysOnTop() {} setIgnoreMouseEvents() {} setContentProtection() {} loadFile() {} showInactive() {}
    once() {}
    isDestroyed() { return destroyed; }
    destroy() { destroyed = true; }
  }
  const service = createAmbientService({
    desktopCapturer: { getSources: async () => [{ id: 'screen:0:0', display_id: '7' }] },
    screen: { getPrimaryDisplay: () => ({ id: 7, bounds: { x: 0, y: 0, width: 100, height: 60 } }) },
    BrowserWindow: FakeWindow,
    ipcMain: { on: (channel, fn) => { handlers[channel] = fn; } },
    preload: 'p', page: 'q',
    getSettings: () => settings,
    isFullscreen: () => false,
    onError: (m) => errors.push(m),
  });
  return { service, handlers, sent, errors, webContents };
}

const picture = (r, g, b) => {
  const bytes = new Uint8Array(SAMPLE_BYTES);
  for (let i = 0; i < bytes.length; i += 4) { bytes[i] = r; bytes[i + 1] = g; bytes[i + 2] = b; bytes[i + 3] = 255; }
  return bytes;
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 40));

test('red and blue bytes are swapped for the color code', () => {
  assert.deepStrictEqual([...rgbaToBgra(Uint8Array.of(10, 20, 30, 255))], [30, 20, 10, 255]);
});

test('turning the glow on opens the window and tells it which screen to watch', async () => {
  const { service, sent } = setup();
  service.sync();
  await tick();
  const start = sent.find((m) => m.channel === 'ambient:start');
  assert.ok(start, 'start message');
  assert.strictEqual(start.payload.sourceId, 'screen:0:0');
});

test('a picture from the window becomes colors sent back; a wrong size or another sender is ignored', async () => {
  const { service, handlers, sent, webContents } = setup();
  service.sync();
  await tick();
  sent.length = 0;
  handlers['ambient:pixels']({ sender: webContents }, picture(200, 30, 30));
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].channel, 'ambient:frame');
  assert.match(sent[0].payload.frame.top[0], /^rgb\(/);
  handlers['ambient:pixels']({ sender: webContents }, new Uint8Array(10)); // wrong size
  handlers['ambient:pixels']({ sender: {} }, picture(1, 2, 3)); // not the glow window
  handlers['ambient:pixels']({ sender: webContents }, 'text'); // not bytes
  assert.strictEqual(sent.length, 1);
});

test('a dark picture fades the glow out', async () => {
  const { service, handlers, sent, webContents } = setup();
  service.sync();
  await tick();
  sent.length = 0;
  handlers['ambient:pixels']({ sender: webContents }, picture(0, 0, 0));
  assert.strictEqual(sent[0].payload.frame, null);
});

test('a failure inside the window is reported, and a stopped glow ignores late pictures', async () => {
  const { service, handlers, sent, errors, webContents } = setup();
  service.sync();
  await tick();
  handlers['ambient:fail']({ sender: webContents }, 'Permission denied');
  assert.deepStrictEqual(errors, ['Permission denied']);
  service.stop();
  sent.length = 0;
  handlers['ambient:pixels']({ sender: webContents }, picture(200, 30, 30));
  assert.strictEqual(sent.length, 0);
});

test('the glow stays off when the setting is off', async () => {
  const { service, sent } = setup({ ambientLight: 'off', ambientIntensity: 3 });
  service.sync();
  await tick();
  assert.strictEqual(sent.length, 0);
});
