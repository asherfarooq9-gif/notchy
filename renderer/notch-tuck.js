// Step out of the way: when your cursor rests on the notch (to click a browser tab behind it, say), the notch slides up
// so the click goes to what is underneath. It comes back when the cursor leaves the place where the notch was.
// Loads in the page (as window.NotchTuck) and in Node (require), so the tests can check it.
(function (root) {
  const TUCK_AFTER_MS = 600; // the cursor must rest this long: passing over the notch, or aiming to click it, does not make it jump
  const TUCK_AFTER_CLICK_MODE_MS = 1800; // when the panel opens by clicking the notch, you need time to aim and click before it moves away
  const TUCK_MAX_MS = 6000; // a safety net: if no mouse movement ever arrives to bring it back, it returns by itself after this long
  const RETURN_MARGIN_PX = 16; // the cursor must go this far past the notch's old edge before it comes back

  const tuckDelay = ({ isClickMode }) => (isClickMode === true ? TUCK_AFTER_CLICK_MODE_MS : TUCK_AFTER_MS);

  // Only when the setting is on, the notch is quiet, and nothing is being asked of it.
  const canTuck = ({ isOn, state, isFocus, isDormant, hasCard }) => isOn === true && state === 'idle' && !isFocus && !isDormant && !hasCard;

  // point is { x, y } and rect is { left, top, right, bottom }, in the same coordinates.
  const isOutside = (point, rect, margin = RETURN_MARGIN_PX) => point.x < rect.left - margin || point.x > rect.right + margin
    || point.y < rect.top - margin || point.y > rect.bottom + margin;

  const api = { TUCK_AFTER_MS, TUCK_AFTER_CLICK_MODE_MS, tuckDelay, TUCK_MAX_MS, RETURN_MARGIN_PX, canTuck, isOutside };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NotchTuck = api;
})(typeof window !== 'undefined' ? window : globalThis);
