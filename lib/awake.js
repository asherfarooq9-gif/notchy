// Decides when the notch is visible. Plain logic with an injected clock, so tests can run it instantly.
// In "hidden" mode he appears when something wakes him and slips away again a few seconds after he is done.
const DEFAULT_LINGER_MS = 5000;
const SETTLE_MS = 1500; // how long he stays after hidden mode is switched on
const RECHECK_MS = 1000; // while busy, how often to check whether he can go

function createAwake({ onChange, isHiding, isBusy, lingerMs = DEFAULT_LINGER_MS, now = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
  let isAwake = !isHiding();
  let until = 0; // he stays visible at least until this time
  let timer = null;
  let isSuppressed = false; // a full-screen app or game is running: he steps aside completely

  function set(next) {
    if (isAwake === next) return;
    isAwake = next;
    onChange(next);
  }

  function check() {
    timer = null;
    if (!isHiding()) return;
    if (isBusy()) { timer = schedule(check, RECHECK_MS); return; }
    if (now() < until) { timer = schedule(check, until - now()); return; }
    set(false);
  }

  function arm() {
    if (timer) cancel(timer);
    timer = schedule(check, Math.max(0, until - now()));
  }

  return {
    isAwake: () => isAwake,
    isSuppressed: () => isSuppressed,
    // Something happened that should be seen. He stays at least ms longer (never less than before).
    wake(ms = lingerMs) {
      if (isSuppressed) return; // nothing shows over a full-screen app
      until = Math.max(until, now() + ms);
      set(true);
      arm();
    },
    // On while a full-screen app runs: he hides at once and ignores every wake until it ends.
    suppress(on) {
      isSuppressed = on === true;
      if (isSuppressed) {
        until = 0;
        if (timer) { cancel(timer); timer = null; }
        set(false);
      } else if (!isHiding()) {
        set(true);
      }
    },
    // Call after the hidden-mode setting changes.
    sync() {
      if (isSuppressed) { set(false); return; }
      if (!isHiding()) { set(true); return; }
      if (isAwake) {
        until = now() + SETTLE_MS;
        arm();
      }
    },
  };
}

// Alerts from outside (Claude Code, WhatsApp) may show unless he is hidden and alerts-while-hidden is off.
function allowsAlert({ hideUntilCalled, alertsWhileHidden }, isAwake) {
  return !hideUntilCalled || alertsWhileHidden || isAwake;
}

module.exports = { createAwake, allowsAlert };
