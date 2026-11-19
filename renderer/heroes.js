// The hero drawings, in one place. Used by the notch icon, the tray icon, the panel and the settings window.
// They are my own simple cartoons in each hero's colors, not official artwork.
// Loads in the page (as window.Heroes) and in Node (require), so the tray icon can use the same drawings.
(function (root) {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Each drawing fits a 24 by 24 face box; the picture window is -2 -2 28 28, so ears and fins can stick out.
  const DRAWINGS = {
  ironman: `
      <path d="M12 -1.6C6.4 -1.6 3.4 2 3.2 7.5L3 15C3 19.8 6 23 9 24.6L12 25.6 15 24.6C18 23 21 19.8 21 15L20.8 7.5C20.6 2 17.6 -1.6 12 -1.6Z" fill="#b3121a" stroke="#3b0a0c" stroke-width=".6"/>
      <path d="M5.4 5.4C5.4 2.8 8 .8 12 .8S18.6 2.8 18.6 5.4L19 13.5C19 17.8 17 20.8 14.8 22.4L12 23.6 9.2 22.4C7 20.8 5 17.8 5 13.5Z" fill="#eab93a" stroke="#3b0a0c" stroke-width=".5"/>
      <path d="M9.6 .8H14.4V7.2C14.4 7.9 13.9 8.4 13.2 8.4H10.8C10.1 8.4 9.6 7.9 9.6 7.2Z" fill="#b3121a" stroke="#3b0a0c" stroke-width=".4"/>
      <path d="M5.8 10.6C9 9.4 15 9.4 18.2 10.6M6.4 15.6L9.4 21.6M17.6 15.6L14.6 21.6" stroke="#b88a1c" stroke-width=".55" fill="none"/>
      <rect x="5.2" y="11.1" width="6.4" height="2.6" rx="1.3" transform="rotate(14 8.4 12.4)" fill="#5b6574"/>
      <rect x="12.4" y="11.1" width="6.4" height="2.6" rx="1.3" transform="rotate(-14 15.6 12.4)" fill="#5b6574"/>
      <path d="M7.6 19.2H16.4L14.6 21.2H9.4Z" fill="none" stroke="#7a5410" stroke-width=".6"/>
      <path d="M9.4 23.2L12 24.8 14.6 23.2 12 22.6Z" fill="#b3121a"/>
    `,
  captain: `
      <path d="M2.5 11C2.5 3 6.5 -1 12 -1S21.5 3 21.5 11V15C21.5 20.5 17.5 24.5 12 24.5S2.5 20.5 2.5 15Z" fill="#1d4ed8"/>
      <path d="M5 12.8C7 10.8 17 10.8 19 12.8V15.2C19 20 16 23 12 23S5 20 5 15.2Z" fill="#e8c39e"/>
      <path d="M2.5 7.5L-2 4.5 -.5 10 2.5 11.5Z M21.5 7.5L26 4.5 24.5 10 21.5 11.5Z" fill="#f1f5f9" stroke="#94a3b8" stroke-width=".45" stroke-linejoin="round"/>
      <path d="M12 .6L13 3.2 15.7 3.3 13.6 5 14.3 7.6 12 6.1 9.7 7.6 10.4 5 8.3 3.3 11 3.2Z" fill="#ffffff"/>
      <path d="M9.5 18.6Q12 20 14.5 18.6" stroke="#8a5a3a" stroke-width=".8" fill="none"/>
    `,
  spiderman: `
      <path d="M12 -1.8C6.6 -1.8 3.2 2.8 3.2 9.6 3.2 16.6 7.2 24.4 12 24.4S20.8 16.6 20.8 9.6C20.8 2.8 17.4 -1.8 12 -1.8Z" fill="#dc2626"/>
      <path d="M12 -1.8V12 M12 .6L5.8 6.4 M12 .6L18.2 6.4 M5 3.6Q12 7 19 3.6 M12 13.5V24.4 M12 13.5L7.2 22 M12 13.5L16.8 22 M12 13.5L4.2 16.6 M12 13.5L19.8 16.6 M7.2 17.2Q12 19.8 16.8 17.2 M8.6 20.8Q12 22.6 15.4 20.8" stroke="#2a0606" stroke-width=".55" fill="none"/>
      <ellipse cx="7.6" cy="10.4" rx="4.7" ry="3.2" transform="rotate(30 7.6 10.4)" fill="#0a0a0a"/>
      <ellipse cx="16.4" cy="10.4" rx="4.7" ry="3.2" transform="rotate(-30 16.4 10.4)" fill="#0a0a0a"/>
    `,
  strange: `
      <path d="M1 25L-.8 10 1.4 1 7.8 10.5 7.6 25Z M23 25L24.8 10 22.6 1 16.2 10.5 16.4 25Z" fill="#b91c1c"/>
      <path d="M1.4 1L7.8 10.5 7.6 25 6.2 25 6 13Z M22.6 1L16.2 10.5 16.4 25 17.8 25 18 13Z" fill="#7f1d1d"/>
      <path d="M8 25L12 19.6 16 25Z" fill="#0e7490"/>
      <path d="M7.4 8C7.4 4.5 9.4 3 12 3S16.6 4.5 16.6 8V14C16.6 18.6 14.6 21.8 12 22.2S7.4 18.6 7.4 14Z" fill="#e8c39e"/>
      <path d="M6.6 10C5.8 3 9 -1.2 14 -1.2 18 -1.2 19.2 2 18.4 7.5 17.6 5 15.2 3.4 12 3.6S8.2 5.5 7.6 9.5Z" fill="#4a2f1f"/>
      <path d="M17.4 4.2C18.4 5.6 18.5 7.8 17.6 10.4L16.9 6.4Z" fill="#d1d5db"/>
      <path d="M9 9.4L11 9.8M15 9.4L13 9.8" stroke="#3b2417" stroke-width=".8" stroke-linecap="round" fill="none"/>
      <path d="M9.4 16.8Q12 15.6 14.6 16.8Q12 17.6 9.4 16.8Z M9.6 17.6C10.6 19.6 13.4 19.6 14.4 17.6 14.2 20.4 9.8 20.4 9.6 17.6Z" fill="#2a1a12"/>
    `,
  doom: `
      <path d="M12 -1.8C6 -1.8 1.4 3.4 1.4 11V19C1.4 23 5.6 25.4 12 25.4S22.6 23 22.6 19V11C22.6 3.4 18 -1.8 12 -1.8Z" fill="#166534"/>
      <path d="M3.6 18Q3 10 6.6 4 M20.4 18Q21 10 17.4 4" stroke="#2a9a4a" stroke-width=".6" fill="none"/>
      <path d="M5 8C5.4 4 8.4 2.4 12 2.4S18.6 4 19 8V16.4C19 21.4 16 24 12 24S5 21.4 5 16.4Z" fill="#0d3a20"/>
      <path d="M5.8 7C7.2 5.6 16.8 5.6 18.2 7V15.4C18.2 20 15.6 23 12 23.4S5.8 20 5.8 15.4Z" fill="#a8b2c0"/>
      <path d="M6 8.4L11.2 7.4 11 10.4 6.2 10.6Z M18 8.4L12.8 7.4 13 10.4 17.8 10.6Z" fill="#7b8696"/>
      <path d="M6.8 9.8H10.8L10.4 12H7.4Z M17.2 9.8H13.2L13.6 12H16.6Z" fill="#101a24"/>
      <path d="M11.2 12L12.8 12 13.4 17 12 17.6 10.6 17Z" fill="#8f99a8"/>
      <path d="M12 5.8V8.2 M8.6 19.4H15.4 M9 20.8H15 M9.6 22.1H14.4" stroke="#566070" stroke-width=".8" fill="none"/>
      <circle cx="7.2" cy="13.2" r=".45" fill="#5b6574"/><circle cx="16.8" cy="13.2" r=".45" fill="#5b6574"/><circle cx="7.4" cy="8.3" r=".4" fill="#5b6574"/><circle cx="16.6" cy="8.3" r=".4" fill="#5b6574"/>
    `,
  blackpanther: `
      <path d="M4.2 7.5L2.2 -2 9.2 2.5Z M19.8 7.5L21.8 -2 14.8 2.5Z" fill="#1c1030"/>
      <path d="M4 10C4 4 7.5 1.5 12 1.5S20 4 20 10V15C20 20 16.5 23.5 12 23.5S4 20 4 15Z" fill="#1c1030"/>
      <path d="M7 4.2L8.6 7M17 4.2L15.4 7M12 2V6.5M8 19.6Q12 22 16 19.6M10.4 14.5H13.6" stroke="#c4b5fd" stroke-width=".8" fill="none"/>
    `,
  hulk: `
      <path d="M3.8 9L1.2 6.2 2.4 12.6 4 13.2Z M20.2 9L22.8 6.2 21.6 12.6 20 13.2Z" fill="#5e9a24"/>
      <path d="M3.4 8.5C4.4 5 8 4 12 4S19.6 5 20.6 8.5V15C20.6 21.6 17 24.4 12 24.4S3.4 21.6 3.4 15Z" fill="#7bbf2a"/>
      <path d="M3.4 9L2.4 2.6 5 4 5.8 -.8 8.2 2 9.8 -2.4 12 1 14.2 -2.6 15.8 1.6 18.2 -1 18.8 3.8 21.6 2.6 20.6 9C19.6 6.4 18.4 5.8 17 6 16.6 4.6 15.4 3.8 14 4.4 13 3.2 11 3.2 10 4.4 8.6 3.8 7.4 4.6 7 6 5.6 5.8 4.4 6.4 3.4 9Z" fill="#3d4433"/>
      <path d="M4.8 7.4L10.6 10.2 M19.2 7.4L13.4 10.2" stroke="#26331a" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M12 10.8L10.4 14.6Q12 15.8 13.6 14.6Z" fill="#5e9a24"/>
      <path d="M5 14L6.5 19 M19 14L17.5 19" stroke="#4a7a1c" stroke-width=".6" fill="none"/>
      <path d="M6.6 17.6Q12 15.6 17.4 17.6 16.4 21.2 12 21.4 7.6 21.2 6.6 17.6Z" fill="#3a1a1a"/>
      <path d="M7.6 18Q12 16.6 16.4 18 15.8 19.6 12 19.8 8.2 19.6 7.6 18Z" fill="#f5f5dc"/>
      <path d="M9.6 17.4V19.6 M12 17.1V19.8 M14.4 17.4V19.6" stroke="#3a1a1a" stroke-width=".35" fill="none"/>
    `,
  thor: `
      <path d="M5 13L1 -4.6 1.6 .4 -.6 -.6 .4 4 -2 3.4 -.4 8 -2.6 8 -.4 12 -2 13.4 2.8 17Z M19 13L23 -4.6 22.4 .4 24.6 -.6 23.6 4 26 3.4 24.4 8 26.6 8 24.4 12 26 13.4 21.2 17Z" fill="#e5e7eb" stroke="#94a3b8" stroke-width=".45" stroke-linejoin="round"/>
      <path d="M4.2 12L1.2 -2M19.8 12L22.8 -2" stroke="#94a3b8" stroke-width=".5" fill="none"/>
      <path d="M5.2 9.5L5.8 19 8 15.5 8 9.5Z M18.8 9.5L18.2 19 16 15.5 16 9.5Z" fill="#facc15"/>
      <path d="M8 9.6H16V15.5C16 20 14.4 22.6 12 23.4S8 20 8 15.5Z" fill="#e8c39e"/>
      <path d="M5.2 9.5C5.2 2.6 8 -1 12 -1S18.8 2.6 18.8 9.5Z" fill="#94a3b8"/>
      <path d="M5.2 7.2L12 9 18.8 7.2V10H5.2Z" fill="#f1f5f9"/>
      <path d="M5.6 8.3L12 10.1 18.4 8.3" stroke="#64748b" stroke-width=".6" fill="none"/>
      <path d="M8.4 11.1L11 11.6M15.6 11.1L13 11.6" stroke="#6b4a1a" stroke-width=".9" stroke-linecap="round" fill="none"/>
      <path d="M7.6 14C7.8 22 10 24.6 12 24.8S16.2 22 16.4 14C15.4 17.6 13.8 18.4 12 18.4S8.6 17.6 7.6 14Z" fill="#b8860b"/>
      <path d="M10.6 19.6H13.4" stroke="#5a3d12" stroke-width=".8" fill="none"/>
    `,
  wolverine: `
      <path d="M4.6 23V8.5C4.6 3 7.6 .2 12 .2S19.4 3 19.4 8.5V23Z" fill="#facc15"/>
      <path d="M4.6 5.5L-1.2 -4.8 8.5 8.8 11 12.2 4.6 14.5Z M19.4 5.5L25.2 -4.8 15.5 8.8 13 12.2 19.4 14.5Z" fill="#26262b"/>
      <path d="M4.8 11L11.4 12 11.4 14.2 4.8 14.8Z M19.2 11L12.6 12 12.6 14.2 19.2 14.8Z" fill="#26262b"/>
      <path d="M4.6 14.5L8.2 17 8.8 23.6 4.6 23Z M19.4 14.5L15.8 17 15.2 23.6 19.4 23Z" fill="#26262b"/>
      <path d="M8 16.8C10 15.4 14 15.4 16 16.8V19.6C16 22.2 14.4 23.6 12 23.6S8 22.2 8 19.6Z" fill="#e8c39e"/>
      <path d="M11 7.4H13L12.5 14.6 12 15.6 11.5 14.6Z" fill="#facc15"/>
      <path d="M9.4 18.4Q12 17.6 14.6 18.4M9.6 20.8Q12 22 14.4 20.8" stroke="#8a6a50" stroke-width=".7" fill="none"/>
    `,
  };

  // Where the two eyes go: centers (cx), height of the centers (y), size, color and tilt in degrees.
  // The notch draws its own animated eyes with the same numbers (see style.css).
  const EYES = {
  ironman: {cx: [8.4, 15.6], y: 12.4, w: 5, h: 1.8, color: '#ffffff', tilt: 14 },
  captain: {cx: [7, 17], y: 9, w: 5, h: 3, color: '#ffffff', tilt: 0 },
  spiderman: {cx: [7.5, 16.5], y: 10.4, w: 5.4, h: 3.2, color: '#ffffff', tilt: 30 },
  strange: {cx: [9.1, 14.9], y: 10, w: 2.4, h: 1.4, color: '#2563eb', tilt: 0 },
  doom: {cx: [8.9, 15.1], y: 10.9, w: 2.6, h: 1.4, color: '#67e8f9', tilt: 0 },
  blackpanther: {cx: [7, 17], y: 9, w: 5, h: 2.2, color: '#ffffff', tilt: 14 },
  hulk: {cx: [8.1, 15.9], y: 10.6, w: 2.8, h: 1.6, color: '#ecfccb', tilt: 0 },
  thor: {cx: [9.1, 14.9], y: 11.8, w: 2.4, h: 1.5, color: '#2563eb', tilt: 0 },
  wolverine: {cx: [8.2, 15.8], y: 12.6, w: 3.4, h: 1.4, color: '#ffffff', tilt: 18 },
  };

  // Batman is not a hero look, but the plain looks (Classic, Ember, Vivid) show his face in the app, same as on the notch.
  const BATMAN = `
      <path d="M4.4 9.2L3.2 1.2 9 4.6Z M19.6 9.2L20.8 1.2 15 4.6Z" fill="#475569"/>
      <path d="M12 3C6.8 3 3.6 6.4 3.6 11.2c0 5.4 3.6 9.6 8.4 9.6s8.4-4.2 8.4-9.6C20.4 6.4 17.2 3 12 3Z" fill="#475569"/>
      <path d="M6.8 15.4C8.6 14 15.4 14 17.2 15.4 16.6 18.6 14.6 20.8 12 20.8S7.4 18.6 6.8 15.4Z" fill="#e8c39e"/>
    `;
  const BATMAN_EYES = { cx: [8.2, 15.8], y: 10.4, w: 4.2, h: 2.2, color: '#f8fafc', tilt: 10 };

  const ids = Object.keys(DRAWINGS); // the heroes only
  const has = (id) => Object.prototype.hasOwnProperty.call(DRAWINGS, id);
  const faceFor = (id) => (has(id) ? id : 'batman'); // which face a look shows
  const drawingOf = (id) => (id === 'batman' ? BATMAN : DRAWINGS[id]);
  const eyesOf = (id) => (id === 'batman' ? BATMAN_EYES : EYES[id]);

  function eyesMarkup(id) {
    const e = eyesOf(id);
    if (!e) return '';
    return e.cx.map((cx, i) => {
      const turn = i === 0 ? e.tilt : -e.tilt;
      return `<rect x="${cx - e.w / 2}" y="${e.y - e.h / 2}" width="${e.w}" height="${e.h}" rx="${Math.min(e.h / 2, 1.2)}" fill="${e.color}" transform="rotate(${turn} ${cx} ${e.y})"/>`;
    }).join('');
  }

  // The full picture as SVG text, or null for a look with no drawing. withEyes: false leaves the eyes out (the notch adds its own).
  function markup(id, { withEyes = true, size = 0 } = {}) {
    if (!has(id) && id !== 'batman') return null;
    const dimension = size ? ` width="${size}" height="${size}"` : '';
    return `<svg xmlns="${SVG_NS}" viewBox="-2 -2 28 28"${dimension} aria-hidden="true">${drawingOf(id)}${withEyes ? eyesMarkup(id) : ''}</svg>`;
  }

  // In a page: the picture as a ready SVG element (the text above is fixed code in this file, never user data).
  function element(id, options) {
    const text = markup(id, options);
    if (!text) return null;
    return document.importNode(new DOMParser().parseFromString(text, 'image/svg+xml').documentElement, true);
  }

  // Character packs add drawings at run time. Each call replaces the earlier packs. The drawing text was built by lib/packs.js from checked values.
  function setPacks(packs) {
    for (const id of Object.keys(DRAWINGS)) if (id.startsWith('pack-')) { delete DRAWINGS[id]; delete EYES[id]; }
    for (const pack of packs) { DRAWINGS[pack.id] = pack.drawing; if (pack.eyes) EYES[pack.id] = pack.eyes; }
  }

  const api = { ids, has, faceFor, markup, element, setPacks, DRAWINGS, EYES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Heroes = api;
})(typeof window !== 'undefined' ? window : globalThis);
