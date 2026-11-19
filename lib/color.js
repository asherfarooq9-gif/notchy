// Small color maths, used to keep every look readable in both light and dark mode.
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
const channel = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };

function luminance(hex) {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// WCAG contrast ratio, 1 to 21.
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Same as CSS color-mix(in srgb, a share%, b): share is 0 to 1 of the first color.
function mix(a, b, share) {
  const [ra, rb] = [toRgb(a), toRgb(b)];
  return toHex(ra.map((c, i) => c * share + rb[i] * (1 - share)));
}

// Moves a color toward `toward` (black or white) in small steps until it reads at `min` contrast on every background given.
function readableOn(color, backgrounds, toward, min = 4.6) {
  for (let share = 1; share >= 0; share -= 0.02) {
    const candidate = mix(color, toward, share);
    if (backgrounds.every((bg) => contrast(candidate, bg) >= min)) return candidate;
  }
  return toward;
}

module.exports = { contrast, mix, readableOn };
