// Ambient glow: a see-through window over the screen edges, lit with colors taken from what is on screen.
const { edgeColors, createSmoother, toCss, strengthOf, shouldRun } = require('./ambient');

const SAMPLE_W = 32; // the screenshot is shrunk to this size, so the work stays tiny
const SAMPLE_H = 18;
const FRAME_MS = 100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createAmbientService({ desktopCapturer, screen, BrowserWindow, preload, page, getSettings, isFullscreen }) {
  let win = null;
  let running = false;
  let token = 0; // bumped on every start and stop, so an old loop ends

  function openWindow() {
    const { x, y, width, height } = screen.getPrimaryDisplay().bounds;
    win = new BrowserWindow({
      x, y, width, height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      focusable: false,
      show: false,
      webPreferences: { preload, contextIsolation: true, sandbox: true },
    });
    win.setBounds({ x, y, width, height }); // Windows can shrink a new window to the work area, which would hide the bottom edge
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setIgnoreMouseEvents(true);
    win.setContentProtection(true); // screen capture skips this window, so the glow never lights itself
    win.loadFile(page);
    win.once('ready-to-show', () => { if (win && !win.isDestroyed()) win.showInactive(); });
  }

  function closeWindow() {
    if (win && !win.isDestroyed()) win.destroy();
    win = null;
  }

  async function grab(smoother) {
    const display = screen.getPrimaryDisplay();
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: SAMPLE_W, height: SAMPLE_H } });
    const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
    if (!source || !win || win.isDestroyed()) return;
    const { width, height } = source.thumbnail.getSize();
    const frame = smoother.next(edgeColors(source.thumbnail.toBitmap(), width, height));
    win.webContents.send('ambient:frame', { frame: toCss(frame), strength: strengthOf(getSettings().ambientIntensity) });
  }

  async function loop(mine) {
    const smoother = createSmoother();
    while (running && mine === token) {
      const started = Date.now();
      try { await grab(smoother); } catch { /* skip this frame */ }
      await sleep(Math.max(0, FRAME_MS - (Date.now() - started)));
    }
  }

  function start() {
    running = true;
    token += 1;
    openWindow();
    loop(token);
  }

  function stop() {
    running = false;
    token += 1;
    closeWindow();
  }

  return {
    // Call whenever a setting or the full-screen state changes.
    sync() {
      const want = shouldRun(getSettings(), isFullscreen());
      if (want && !running) start();
      else if (!want && running) stop();
    },
    stop,
  };
}

module.exports = { createAmbientService };
