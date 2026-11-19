// The panel of tools: its window, and opening it by resting the mouse at the top-center edge of the screen.
const { BrowserWindow, screen } = require('electron');

const PANEL_WIDTH = 520;
const PANEL_HEIGHT = 440;
const HIDE_ANIMATION_MS = 180;
const HOVER_POLL_MS = 150;
const EDGE_ZONE_HALF_WIDTH = 150; // how far either side of the center the hot zone reaches
const HOVER_POLLS_TO_OPEN = 3; // about half a second of resting the mouse there
const LEAVE_POLLS_TO_CLOSE = 5; // about three quarters of a second away from the panel
const LEAVE_MARGIN = 30;

function createPanel({ preload, page, getSettings, onShown, onHidden }) {
  let win = null;
  let isEditing = false; // typing in a note: do not close on mouse leave
  let isHoverSuppressed = false; // a full-screen app is running: the hot zone is switched off
  let hasMouseEntered = false; // "mouse left" only counts after it was over the panel, so a hotkey-opened panel stays put
  let hoverPolls = 0;
  let leavePolls = 0;
  let hoverTimer = null;
  let hideTimer = null;

  function ensureWindow() {
    if (win && !win.isDestroyed()) return win;
    win = new BrowserWindow({
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      show: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      webPreferences: { preload, contextIsolation: true, sandbox: true },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.loadFile(page);
    win.on('blur', hide); // clicking anywhere else puts it away
    return win;
  }

  const isVisible = () => Boolean(win && !win.isDestroyed() && win.isVisible());
  const send = (channel, payload) => {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  function show() {
    clearTimeout(hideTimer);
    hasMouseEntered = false;
    leavePolls = 0;
    const panelWindow = ensureWindow();
    const { bounds } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    panelWindow.setBounds({ x: bounds.x + Math.round((bounds.width - PANEL_WIDTH) / 2), y: bounds.y, width: PANEL_WIDTH, height: PANEL_HEIGHT });
    panelWindow.show();
    panelWindow.focus();
    send('panel:shown', null);
    onShown();
  }

  function hide() {
    if (!isVisible()) return;
    isEditing = false;
    send('panel:hiding', null);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (win && !win.isDestroyed()) win.hide();
      onHidden();
    }, HIDE_ANIMATION_MS);
  }

  function pollHover() {
    const cursor = screen.getCursorScreenPoint();
    const { bounds } = screen.getDisplayNearestPoint(cursor);
    if (!isVisible()) {
      leavePolls = 0;
      const isAtEdge = cursor.y <= bounds.y + 1 && Math.abs(cursor.x - (bounds.x + bounds.width / 2)) <= EDGE_ZONE_HALF_WIDTH;
      hoverPolls = isAtEdge && !isHoverSuppressed ? hoverPolls + 1 : 0;
      if (hoverPolls >= HOVER_POLLS_TO_OPEN) { hoverPolls = 0; show(); }
      return;
    }
    hoverPolls = 0;
    const panelBounds = win.getBounds();
    const isNear = cursor.x >= panelBounds.x - LEAVE_MARGIN && cursor.x <= panelBounds.x + panelBounds.width + LEAVE_MARGIN &&
      cursor.y >= panelBounds.y - LEAVE_MARGIN && cursor.y <= panelBounds.y + panelBounds.height + LEAVE_MARGIN;
    if (isNear) hasMouseEntered = true;
    leavePolls = !hasMouseEntered || isNear || isEditing ? 0 : leavePolls + 1;
    if (leavePolls >= LEAVE_POLLS_TO_CLOSE) { leavePolls = 0; hide(); }
  }

  return {
    // Builds the window now (hidden), so the first open is instant.
    prepare: ensureWindow,
    show,
    hide,
    toggle: () => (isVisible() ? hide() : show()),
    isVisible,
    send,
    setEditing: (value) => { isEditing = value === true; },
    setHoverSuppressed(value) {
      isHoverSuppressed = value === true;
      if (isHoverSuppressed) hide();
    },
    // Call after settings change: the hover check only runs when it is turned on.
    syncHover() {
      const shouldRun = getSettings().hoverOpen;
      if (shouldRun && !hoverTimer) hoverTimer = setInterval(pollHover, HOVER_POLL_MS);
      else if (!shouldRun && hoverTimer) { clearInterval(hoverTimer); hoverTimer = null; hoverPolls = 0; }
    },
    destroy() {
      clearInterval(hoverTimer);
      if (win && !win.isDestroyed()) win.destroy();
    },
  };
}

module.exports = { createPanel };
