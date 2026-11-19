// Saves converted pictures next to the original, under a new name. The panel sends the picture bytes; this checks
// they are really the claimed type, builds icon / PDF files, and never overwrites anything.
const fs = require('fs');
const path = require('path');
const { buildIco, buildPdf, pngSize, jpegSize } = require('./image-files');
const { isNetworkPath, uniqueOutputPath } = require('./paths');

const MAX_PARTS = 60;
const MAX_PART_BYTES = 40 * 1024 * 1024;
const MAX_TOTAL_BYTES = 150 * 1024 * 1024;
const KINDS = new Set(['jpg', 'png', 'ico', 'pdf']);

function createConverterService({ fsImpl = fs } = {}) {
  const written = new Set(); // only files made here can be shown in their folder

  function build(kind, parts) {
    if (kind === 'jpg') { if (parts.length !== 1) throw new Error('Expected one picture'); jpegSize(parts[0]); return parts[0]; }
    if (kind === 'png') { if (parts.length !== 1) throw new Error('Expected one picture'); pngSize(parts[0]); return parts[0]; }
    return kind === 'ico' ? buildIco(parts) : buildPdf(parts);
  }

  return {
    // sourcePath: the original file's place, so the result lands in the same folder. Returns {path, name, size}.
    save({ kind, sourcePath, parts }) {
      if (!KINDS.has(kind)) throw new Error('Unknown file type');
      if (typeof sourcePath !== 'string' || !path.isAbsolute(sourcePath)) throw new Error('Could not tell where the original file is');
      if (isNetworkPath(sourcePath)) throw new Error('Pictures on a network share cannot be converted. Copy the picture to this computer first.');
      if (!Array.isArray(parts) || !parts.length || parts.length > MAX_PARTS) throw new Error('Wrong number of pictures');
      let total = 0;
      const buffers = parts.map((p) => {
        // size is checked on the data as it arrives, before any copy of it is made
        if (!(p instanceof Uint8Array) && !(p instanceof ArrayBuffer)) throw new Error('A picture is not valid data');
        if (!p.byteLength || p.byteLength > MAX_PART_BYTES || (total += p.byteLength) > MAX_TOTAL_BYTES) throw new Error('A picture is empty or too large');
        return Buffer.from(p);
      });
      const dir = path.dirname(path.resolve(sourcePath));
      if (!fsImpl.statSync(dir).isDirectory()) throw new Error('The original folder is missing');
      const output = build(kind, buffers);
      const target = uniqueOutputPath(dir, path.basename(sourcePath), kind, (p) => fsImpl.existsSync(p));
      fsImpl.writeFileSync(target, output, { flag: 'wx' }); // "wx": fails instead of replacing a file
      written.add(target);
      return { path: target, name: path.basename(target), size: output.length };
    },
    canReveal: (file) => written.has(file),
  };
}

module.exports = { createConverterService };
