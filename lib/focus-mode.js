// Focus mode: a quiet switch. While it is on, alerts from outside stay away and the notch shows only your timer.
// It turns itself off after a few hours, so it can never be left on by accident.
const HOUR_MS = 60 * 60 * 1000;
const FOCUS_MAX_MS = 2 * HOUR_MS;

function createFocusMode({ maxMs = FOCUS_MAX_MS, onChange = () => {}, timers = { set: setTimeout, clear: clearTimeout } } = {}) {
  let isOn = false;
  let timer = null;

  function set(next) {
    timers.clear(timer);
    timer = null;
    const wasOn = isOn;
    isOn = Boolean(next);
    if (isOn) timer = timers.set(() => set(false), maxMs); // pressing "on" again starts the limit over
    if (isOn !== wasOn) onChange(isOn);
    return isOn;
  }

  return { isOn: () => isOn, set, toggle: () => set(!isOn) };
}

module.exports = { createFocusMode, FOCUS_MAX_MS };
