// Sorts copied text into a kind (link, colour, email, phone, plain text) and offers small clean-ups.
// Runs in the panel and is also loaded by the tests, so it has no outside dependencies.
(function (root) {
  const URL_PATTERN = /^https?:\/\/\S+$/i;
  const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  const RGB_PATTERN = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_PATTERN = /^\+?[\d\s().-]+$/;
  const MIN_PHONE_DIGITS = 7;
  // Dates (2024-01-15, 15/01/2024) and decimals (3.14159265) are made of digits and separators too, but are not phone numbers.
  const DATE_OR_DECIMAL = /^(?:\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{2,4}|\d+\.\d+)$/;

  // [r, g, b] for "#abc", "#aabbcc" or "rgb(1, 2, 3)", else null.
  function channels(text) {
    const t = String(text == null ? '' : text).trim();
    if (HEX_PATTERN.test(t)) {
      const full = t.length === 4 ? '#' + [...t.slice(1)].map((c) => c + c).join('') : t;
      return [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16));
    }
    const m = t.match(RGB_PATTERN);
    if (!m) return null;
    const rgb = [m[1], m[2], m[3]].map(Number);
    return rgb.every((n) => n <= 255) ? rgb : null;
  }

  function classify(text) {
    const t = String(text == null ? '' : text).trim();
    if (URL_PATTERN.test(t)) return 'url';
    if (channels(t)) return 'color';
    if (EMAIL_PATTERN.test(t)) return 'email';
    if (PHONE_PATTERN.test(t) && !DATE_OR_DECIMAL.test(t) && t.replace(/\D/g, '').length >= MIN_PHONE_DIGITS && /[+()\s.-]/.test(t)) return 'phone';
    return 'text';
  }

  function colorForms(text) {
    const rgb = channels(text);
    if (!rgb) return null;
    return { hex: '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join(''), rgb: `rgb(${rgb.join(', ')})` };
  }

  function tidy(text) {
    return String(text || '').replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const api = { classify, colorForms, tidy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClipKind = api;
})(typeof window !== 'undefined' ? window : globalThis);
