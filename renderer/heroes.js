// The hero faces, in one place. Used by the notch icon, the tray icon, the panel and the settings window.
// Every hero is a face picture that ships with the app (assets/faces, loaded by main.js). Your own file of the same name in the "faces" folder replaces it.
// Loads in the page (as window.Heroes) and in Node (require), so the tray icon can use the same pictures.
(function (root) {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Eyelids for your face pictures (cut-outs of the reference art, face only, filling the 24 by 24 box), measured on them.
  const PHOTO_LIDS = {
    ironman: { cx: [7.3, 15.7], y: 13, w: 3.8, h: 1.4, color: '#e8b630', tilt: 0 },
    captain: { cx: [8.2, 16.2], y: 12.5, w: 2.4, h: 1, color: '#e9a874', tilt: 0 },
    spiderman: { cx: [7.3, 15.8], y: 13.4, w: 5.2, h: 6.8, color: '#d81e1e', tilt: -40 },
    strange: { cx: [8.2, 14.3], y: 12.2, w: 2, h: 0.8, color: '#e5a36c', tilt: 0 },
    hulk: { cx: [7.6, 15.5], y: 13.3, w: 2.2, h: 0.9, color: '#4a8a1c', tilt: 0 },
    thor: { cx: [8.8, 14.6], y: 10.8, w: 2, h: 0.8, color: '#e6a265', tilt: 0 },
    blackpanther: { cx: [7.8, 15.4], y: 12.6, w: 2.4, h: 1, color: '#15141c', tilt: 10 },
    doom: { cx: [7.6, 16.4], y: 11.7, w: 3.6, h: 1.2, color: '#8a98aa', tilt: 0 },
    wolverine: { cx: [7.6, 15.4], y: 13.7, w: 2.2, h: 0.9, color: '#123a6b', tilt: 12 },
    batman: { cx: [8.4, 15.2], y: 13.8, w: 2.2, h: 0.8, color: '#121418', tilt: 12 },
    superman: { cx: [8.5, 14.75], y: 10.5, w: 2.2, h: 1, color: '#e9a46a', tilt: 0 },
    wonderwoman: { cx: [8.35, 14.6], y: 10.7, w: 2, h: 1, color: '#ebab78', tilt: 0 },
    flash: { cx: [7.6, 15.4], y: 13.3, w: 2.6, h: 1.1, color: '#b81414', tilt: 8 },
    aquaman: { cx: [8.8, 14.3], y: 9.3, w: 2, h: 0.8, color: '#d39158', tilt: 0 },
    greenlantern: { cx: [7.8, 14.2], y: 11.9, w: 2.4, h: 1, color: '#16a34a', tilt: 0 },
    joker: { cx: [8.2, 14.4], y: 12.8, w: 2.4, h: 1.2, color: '#e8eef0', tilt: 0 },
  };

  function lidsMarkup(id, table = LIDS) {
    const lid = table[id];
    if (!lid) return '';
    return lid.cx.map((cx, i) => {
      const turn = i === 0 ? lid.tilt : -lid.tilt;
      return `<ellipse class="lid" cx="${cx}" cy="${lid.y}" rx="${lid.w / 2 + 0.35}" ry="${lid.h / 2 + 0.35}" fill="${lid.color}" transform="rotate(${turn} ${cx} ${lid.y})"/>`;
    }).join('');
  }


  // The heroes. Character packs add drawings of their own at run time (setPacks), with their own eye spots.
  const ids = Object.keys(PHOTO_LIDS);
  const DRAWINGS = {};
  const EYES = {};
  const has = (id) => ids.includes(id) || Object.prototype.hasOwnProperty.call(DRAWINGS, id);
  const faceFor = (id) => (has(id) ? id : 'batman'); // which face a look shows
  let pictureCount = 0; // makes the gradient names in each pack picture unique

  // Face pictures (lib/faces.js checks the files). Only PNG data pictures are taken.
  const PHOTO = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
  let photos = {};
  function setPhotos(map) {
    photos = {};
    for (const [id, url] of Object.entries(map || {})) if (ids.includes(id) && typeof url === 'string' && PHOTO.test(url)) photos[id] = url;
  }
  const hasPhoto = (id) => Object.prototype.hasOwnProperty.call(photos, id);

  // A face picture: the cut-out (face only, no background) filling the face box. It has its own eyes.
  function photoMarkup(id, dimension, withLids) {
    return `<svg xmlns="${SVG_NS}" viewBox="-2 -2 28 28"${dimension} aria-hidden="true">`
      + `<image href="${photos[id]}" x="0" y="0" width="24" height="24" preserveAspectRatio="xMidYMid meet"/>`
      + `${withLids ? lidsMarkup(id, PHOTO_LIDS) : ''}</svg>`;
  }

  function packEyes(id) {
    const e = EYES[id];
    if (!e) return '';
    return e.cx.map((cx, i) => {
      const turn = i === 0 ? e.tilt : -e.tilt;
      return `<rect x="${cx - e.w / 2}" y="${e.y - e.h / 2}" width="${e.w}" height="${e.h}" rx="${Math.min(e.h / 2, 1.2)}" fill="${e.color}" transform="rotate(${turn} ${cx} ${e.y})"/>`;
    }).join('');
  }

  // The full picture as SVG text, or null for an unknown look. withLids: add eyelids so the notch can make the face blink.
  // A hero whose picture file is missing shows a plain round placeholder.
  function markup(id, { withEyes = true, size = 0, withLids = false } = {}) {
    if (!has(id)) return null;
    const dimension = size ? ` width="${size}" height="${size}"` : '';
    if (ids.includes(id)) {
      if (hasPhoto(id)) return photoMarkup(id, dimension, withLids);
      return `<svg xmlns="${SVG_NS}" viewBox="-2 -2 28 28"${dimension} aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#8a8f9a"/></svg>`;
    }
    pictureCount += 1;
    const body = DRAWINGS[id].split('__U__').join(String(pictureCount));
    return `<svg xmlns="${SVG_NS}" viewBox="-2 -2 28 28"${dimension} aria-hidden="true">${body}${withEyes ? packEyes(id) : ''}</svg>`;
  }

  // In a page: the picture as a ready SVG element (the text above is fixed code in this file, never user data).
  function element(id, options) {
    const text = markup(id, options);
    if (!text) return null;
    return document.importNode(new DOMParser().parseFromString(text, 'image/svg+xml').documentElement, true);
  }

  // Character packs add drawings at run time. Each call replaces the earlier packs. The drawing text was built by lib/packs.js from checked values.
  function setPacks(packs) {
    for (const id of Object.keys(DRAWINGS)) { delete DRAWINGS[id]; delete EYES[id]; }
    for (const pack of packs) { DRAWINGS[pack.id] = pack.drawing; if (pack.eyes) EYES[pack.id] = pack.eyes; }
  }

  const api = { ids, has, faceFor, markup, element, setPacks, setPhotos, hasPhoto, PHOTO_LIDS, DRAWINGS, EYES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Heroes = api;
})(typeof window !== 'undefined' ? window : globalThis);
