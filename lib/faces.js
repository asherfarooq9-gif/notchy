// Your own face pictures: <hero id>.png files in the "faces" folder of the app's data (never part of the code on GitHub).
// Each one is checked to really be a PNG and not too big, then handed to the pages as a data: picture.
// A hero without a good file keeps its drawing from renderer/heroes.js.
const fs = require('fs');
const path = require('path');

const MAX_FACE_BYTES = 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readFace(file, fsImpl) {
  if (fsImpl.statSync(file).size > MAX_FACE_BYTES) throw new Error('is larger than 1 MB.');
  const bytes = fsImpl.readFileSync(file);
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) throw new Error('is not a PNG picture.');
  return 'data:image/png;base64,' + bytes.toString('base64');
}

// dir: the faces folder. ids: the heroes that may have a picture. A missing folder or file is not a problem.
function loadFaces(dir, ids, fsImpl = fs) {
  const faces = {};
  const problems = [];
  for (const id of ids) {
    const file = path.join(dir, `${id}.png`);
    if (!fsImpl.existsSync(file)) continue;
    try {
      faces[id] = readFace(file, fsImpl);
    } catch (error) {
      problems.push(`${id}.png ${error.message}`);
    }
  }
  return { faces, problems };
}

// Traced faces: <hero id>.svg files made from your pictures by a tracing tool (vtracer). An SVG file could carry code,
// so nothing from the file is passed on as it is: only plain shapes (a path, one color, a shift) are accepted and rebuilt.
const MAX_TRACED_BYTES = 400 * 1024;
const FACE_BOX = 24; // the drawings' face box in renderer/heroes.js
const SVG_OPEN = /^\s*(<\?xml[^>]*\?>\s*)?(<!--[^-]*-->\s*)?<svg version="1\.1" xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="(\d{1,4})" height="(\d{1,4})">/;
const SHAPE = /<path d="([MLCQZmlcqz0-9 .\-]*)" fill="(#[0-9A-Fa-f]{6})" transform="translate\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)"\/>/g;

function checkTracedSvg(text) {
  const open = String(text).match(SVG_OPEN);
  if (!open) throw new Error('is not a traced face drawing.');
  const width = Number(open[3]);
  if (width < 1 || Number(open[4]) < 1) throw new Error('has no size.');
  const shapes = [];
  const leftover = text.slice(open[0].length).replace(SHAPE, (_whole, d, fill, x, y) => {
    if (d.trim()) shapes.push(`<path d="${d.trim()}" fill="${fill}" transform="translate(${x},${y})"/>`); // the tracer leaves some empty shapes
    return '';
  });
  if (!/^\s*<\/svg>\s*$/.test(leftover)) throw new Error('has something other than plain shapes in it.');
  if (shapes.length === 0) throw new Error('has no shapes.');
  // A nested picture box rather than a <g>: the notch's style sheet hides <g> inside the face (style.css ".hero g").
  return `<svg x="0" y="0" width="${FACE_BOX}" height="${FACE_BOX}" viewBox="0 0 ${width} ${Number(open[4])}">${shapes.join('')}</svg>`;
}

function loadTracedFaces(dir, ids, fsImpl = fs) {
  const faces = {};
  const problems = [];
  for (const id of ids) {
    const file = path.join(dir, `${id}.svg`);
    if (!fsImpl.existsSync(file)) continue;
    try {
      if (fsImpl.statSync(file).size > MAX_TRACED_BYTES) throw new Error('is larger than 400 KB.');
      faces[id] = checkTracedSvg(fsImpl.readFileSync(file, 'utf8'));
    } catch (error) {
      problems.push(`${id}.svg ${error.message}`);
    }
  }
  return { faces, problems };
}

module.exports = { loadFaces, MAX_FACE_BYTES, checkTracedSvg, loadTracedFaces, MAX_TRACED_BYTES };
