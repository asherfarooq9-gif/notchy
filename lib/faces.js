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

module.exports = { loadFaces, MAX_FACE_BYTES };
