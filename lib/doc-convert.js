// Word to PDF and PDF to Word, done by Microsoft Word itself (it must be installed). The result is saved next to the
// original under a new name; nothing is ever replaced. Word runs hidden, one file at a time, and nothing is uploaded.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { isNetworkPath, uniqueOutputPath } = require('./paths');
const { runPs } = require('./ps');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'doc.ps1');
const TIMEOUT_MS = 120000;
const MAX_BYTES = 100 * 1024 * 1024;
const FROM = { pdf: ['.doc', '.docx', '.rtf', '.odt'], docx: ['.pdf', '.doc', '.rtf', '.odt'] };

// Is turning this file into that kind allowed? (FROM never lists the target's own extension, so nothing is converted to what it already is.)
function routeFor(sourcePath, to) {
  const ext = path.extname(String(sourcePath)).toLowerCase();
  return Object.prototype.hasOwnProperty.call(FROM, to) && FROM[to].includes(ext);
}

function createDocConverter({ execFileImpl = execFile, fsImpl = fs } = {}) {
  const written = new Set(); // only files made here can be shown in their folder
  let queue = Promise.resolve();

  const runWord = (source, target, to) => runPs(SCRIPT, ['-In', source, '-Out', target, '-To', to], { sta: true, timeout: TIMEOUT_MS, fallback: 'Word could not convert this file.', timeoutMessage: 'Word took more than 2 minutes and was stopped. Try a smaller file.', execFileImpl });

  async function convertNow({ sourcePath, to }) {
    if (typeof sourcePath !== 'string' || !path.isAbsolute(sourcePath)) throw new Error('Could not tell where the file is');
    if (isNetworkPath(sourcePath)) throw new Error('Files on a network share cannot be converted. Copy the file to this computer first.');
    const name = path.basename(sourcePath);
    if (name.startsWith('~$')) throw new Error('That is a temporary Word file, not a document.');
    if (!routeFor(sourcePath, to)) throw new Error('That file cannot be converted that way.');
    let info;
    try { info = fsImpl.statSync(sourcePath); } catch { throw new Error('That file is no longer there.'); }
    if (!info.isFile()) throw new Error('That is not a file.');
    if (info.size > MAX_BYTES) throw new Error('That file is too large (over 100 MB).');
    const target = uniqueOutputPath(path.dirname(sourcePath), name, to, (p) => fsImpl.existsSync(p));
    await runWord(sourcePath, target, to);
    let made;
    try { made = fsImpl.statSync(target); } catch { made = null; }
    if (!made || made.size === 0) throw new Error('Word did not make a file. Try opening it in Word first.');
    written.add(target);
    return { path: target, name: path.basename(target), size: made.size };
  }

  return {
    // Word cannot be driven twice at once, so requests wait their turn.
    convert(request) {
      const result = queue.then(() => convertNow(request || {}));
      queue = result.catch(() => {});
      return result;
    },
    canReveal: (file) => written.has(file),
  };
}

module.exports = { createDocConverter, routeFor };
