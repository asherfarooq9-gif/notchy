// The hero reacts to real life: a comic burst when a timer ends, a worried line when the battery runs low,
// a happy one when you plug in, and a break nudge after a long stretch. The notch (app.js) plays them with the same
// move machinery as the minute-by-minute special moves, in the chosen hero's own voice.
// Loads in the page (as window.HeroReactions) and in Node (require), so the tests can check it.
(function (root) {
  const LOW_PERCENT = 20; // the same limit the worried look uses (app.js LOW_BATTERY_PERCENT)
  const BREAK_EVERY_MS = 50 * 60 * 1000;
  const REACTION_MS = 3200;

  const REACTIONS = {
    timerDone: { line: 'POW! Time is up!', fx: 'pow' },
    lowBattery: { line: 'Battery low! Plug me in!', fx: 'low' },
    plugged: { line: 'Ahh, power!', fx: 'spark' },
    breakTime: { line: 'Stretch time! Take a break.', fx: 'stretch' },
  };

  // Fixed drawings in a 24 by 24 box (shown on the notch like the special-move drawings; never visitor input).
  const FX = {
    pow: '<path d="M12 1l2.4 6.2L21 5l-3 6.6L23 14l-6.6 1.4L18 22l-6-3.6L6 22l1.6-6.6L1 14l5-2.4L3 5l6.6 2.2z" fill="#facc15" stroke="#dc2626" stroke-width="1" stroke-linejoin="round"/><text x="12" y="14.5" text-anchor="middle" font-size="6.5" font-weight="800" font-family="Segoe UI, sans-serif" fill="#dc2626">POW</text>',
    low: '<rect x="3" y="7" width="15" height="10" rx="2.5" fill="none" stroke="#f87171" stroke-width="1.6"/><rect x="5" y="9" width="3" height="6" rx="1" fill="#f87171"/><rect x="19" y="10" width="2" height="4" rx="1" fill="#f87171"/>',
    spark: '<path d="M13 1L5 13h6l-2 10 10-13h-6z" fill="#4ade80" stroke="#065f46" stroke-width=".9" stroke-linejoin="round"/>',
    stretch: '<circle cx="12" cy="5" r="2.6" fill="#fde68a" stroke="#92400e" stroke-width=".8"/><path d="M12 8v7M5 6l7 4 7-4M9 22l3-7 3 7" fill="none" stroke="#fde68a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  };

  // previous and next are { percent, charging }. Returns the reaction name, or null.
  function batteryReaction(previous, next) {
    if (!previous || !next) return null; // the first reading is not news
    if (!previous.charging && next.charging) return 'plugged';
    const wasLow = previous.percent <= LOW_PERCENT && !previous.charging;
    const isLow = next.percent <= LOW_PERCENT && !next.charging;
    return isLow && !wasLow ? 'lowBattery' : null;
  }

  // Only when you can see the notch, nothing more important is on it, and long enough has passed since the last nudge.
  function shouldNudge({ now, lastNudge, everyMs = BREAK_EVERY_MS, isFocus, isDormant, isOn, state }) {
    return isOn === true && !isFocus && !isDormant && state === 'idle' && now - lastNudge >= everyMs;
  }

  const api = { LOW_PERCENT, BREAK_EVERY_MS, REACTION_MS, REACTIONS, FX, batteryReaction, shouldNudge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HeroReactions = api;
})(typeof window !== 'undefined' ? window : globalThis);
