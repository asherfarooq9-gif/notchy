// Finds the best picture that fits under a size limit: highest quality first, and shrinking the picture only if it must.
// encode(quality, scale) must return a Promise of bytes (anything with a .length). The same file also loads in tests.
(function () {
  const MIN_QUALITY = 0.3;
  const MAX_QUALITY = 0.95;
  const SCALE_STEP = 0.8;
  const MAX_SHRINKS = 10;
  const QUALITY_STEPS = 6;

  // usesQuality is false for PNG, where only shrinking helps. Returns {bytes, quality, scale}, or null if nothing fits.
  async function squeezeToSize(encode, maxBytes, { usesQuality = true } = {}) {
    let scale = 1;
    for (let shrink = 0; shrink < MAX_SHRINKS; shrink++, scale *= SCALE_STEP) {
      const best = await encode(MAX_QUALITY, scale);
      if (best.length <= maxBytes) return { bytes: best, quality: MAX_QUALITY, scale };
      if (!usesQuality) continue;
      const worst = await encode(MIN_QUALITY, scale);
      if (worst.length > maxBytes) continue; // even the lowest quality is too big at this size: shrink and retry
      let [low, high, found] = [MIN_QUALITY, MAX_QUALITY, { bytes: worst, quality: MIN_QUALITY, scale }];
      for (let i = 0; i < QUALITY_STEPS; i++) {
        const middle = (low + high) / 2;
        const bytes = await encode(middle, scale);
        if (bytes.length <= maxBytes) { found = { bytes, quality: middle, scale }; low = middle; } else high = middle;
      }
      return found;
    }
    return null;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { squeezeToSize };
  else window.squeezeToSize = squeezeToSize;
})();
