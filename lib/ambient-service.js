// Ambient glow: a see-through window over the screen edges, lit with colors taken from what is on screen.
// The window watches the screen as a small live video (cheap, on the graphics chip) and sends a tiny 32 by 18 picture back
// here about ten times a second. Taking a full screenshot each time was far too slow on a 4K screen (over a second each).
const { edgeColors, createSmoother, toCss, strengthOf, shouldRun } = require('./ambient');

const SAMPLE_W = 32; // the picture the window sends back
const SAMPLE_H = 18;
const SAMPLE_BYTES = SAMPLE_W * SAMPLE_H * 4;

// The window's pixels come as Red, Green, Blue, Alpha; edgeColors wants Blue, Green, Red, Alpha.
function rgbaToBgra(rgba) {
  const bgra = new Uint8Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    bgra[i] = rgba[i + 2];
    bgra[i + 1] = rgba[i + 1];
    bgra[i + 2] = rgba[i];
    bgra[i + 3] = rgba[i + 3];
  }
  return bgra;
}

function createAmbientService({ desktopCapturer, screen, BrowserWindow, ipcMain, preload, page, getSettings, isFullscreen, onError = () => {} }) {
  let win = null;
  let running = false;
  let token = 0; // bumped on every start and stop, so a late start is dropped
  let smoother = null;

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
      webPreferences: { preload, contextIsolation: true, sandbox: true, backgroundThrottling: false },
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

  async function findScreenId() {
    const display = screen.getPrimaryDisplay();
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } }); // no pictures wanted, only the id
    const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
    if (!source) throw new Error('no screen found');
    return source.id;
  }

  // A picture from the window. Only the glow window may send one, and only the exact size.
  function onPixels(event, bytes) {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return;
    if (!ArrayBuffer.isView(bytes) || bytes.byteLength !== SAMPLE_BYTES) return;
    const frame = smoother.next(edgeColors(rgbaToBgra(bytes), SAMPLE_W, SAMPLE_H));
    win.webContents.send('ambient:frame', { frame: toCss(frame), strength: strengthOf(getSettings().ambientIntensity) });
  }

  function onFail(event, message) {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return;
    onError(String(message).slice(0, 80));
  }

  async function start() {
    running = true;
    token += 1;
    const mine = token;
    smoother = createSmoother();
    openWindow();
    const loaded = new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
    try {
      const [sourceId] = await Promise.all([findScreenId(), loaded]);
      if (mine !== token || !win || win.isDestroyed()) return; // stopped while waiting
      win.webContents.send('ambient:start', { sourceId, width: SAMPLE_W, height: SAMPLE_H });
    } catch (error) {
      if (mine === token) onError(error.message);
    }
  }

  function stop() {
    running = false;
    token += 1;
    closeWindow();
  }

  ipcMain.on('ambient:pixels', onPixels);
  ipcMain.on('ambient:fail', onFail);

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

module.exports = { createAmbientService, rgbaToBgra, SAMPLE_BYTES };
