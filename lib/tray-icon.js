// The tray icon (bottom right of Windows) wears the same hero drawing as the notch, so the two always match.
// The drawings live once, in renderer/heroes.js. This takes the one for the chosen look, paints it in an off-screen window
// and keeps the picture. Looks without a drawing keep the Batman icon.
const Heroes = require('../renderer/heroes.js');

const ICON_SIZE = 32; // the picture handed to Windows; it scales it for your screen
const PAINT_SIZE = 96; // painted larger, then scaled down, for a smoother edge
const SETTLE_MS = 150; // a short wait so the window has painted
const PAINT_TIMEOUT_MS = 4000; // painting that takes longer than this is given up on, and the Batman icon stays

// The page to paint, or null when this look has no drawing (plain looks keep the Batman icon).
function buildTrayHtml(id) {
  const picture = Heroes.markup(id, { withEyes: true, size: PAINT_SIZE });
  if (!picture) return null;
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block}</style>${picture}`;
}

function withTimeout(promise, ms) {
  let timer;
  const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Painting the tray icon took too long')), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

function createTrayIcons({ BrowserWindow, fallback, paintTimeoutMs = PAINT_TIMEOUT_MS }) {
  const cache = new Map();

  async function paint(html) {
    const win = new BrowserWindow({
      show: false, width: PAINT_SIZE, height: PAINT_SIZE, useContentSize: true, transparent: true, frame: false, skipTaskbar: true,
      webPreferences: { sandbox: true, contextIsolation: true, javascript: false, offscreen: true }, // off-screen windows paint reliably even though nobody sees them
    });
    try {
      await withTimeout(win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`), paintTimeoutMs);
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
      const shot = await withTimeout(win.webContents.capturePage(), paintTimeoutMs);
      return shot.isEmpty() ? null : shot.resize({ width: ICON_SIZE, height: ICON_SIZE, quality: 'best' });
    } finally {
      win.destroy();
    }
  }

  return {
    // The icon for a look. Never throws: if painting fails, the Batman icon is used.
    async imageFor(id) {
      const html = buildTrayHtml(id);
      if (!html) return fallback;
      if (!cache.has(id)) {
        try { cache.set(id, (await paint(html)) || fallback); } catch { return fallback; }
      }
      return cache.get(id);
    },
  };
}

module.exports = { createTrayIcons, buildTrayHtml };
