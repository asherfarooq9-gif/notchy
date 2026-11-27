// Word to PDF and PDF to Word, done by Microsoft Word itself (it must be installed). The result is saved next to the
// original under a new name; nothing is ever replaced. Word runs hidden, one file at a time, and nothing is uploaded.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { inspectDocument } = require('./doc-links');
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

// Word follows some links inside a document by itself when it opens it (a remote template, a linked picture), which tells that
// address you opened the file and can hand over your Windows sign-in. So a document that has such links is never opened.
// This is judged from the file's real contents, not its name. Checked: .docx (a zip), .rtf and the old binary .doc. Not checked:
// .odt (a linked picture in one was not followed by Word when tested) and PDF (it cannot name a Word template).
function linkProblem(doc, extension) {
  if (doc.kind === 'other') return extension.toLowerCase() === '.docx' ? 'That file is not a real Word document, so it was not converted.' : null;
  if (doc.unreadable) return 'This document could not be checked for links to other places, so it was not converted.';
  // An old .doc cannot tell a template address from an ordinary link in the text, so any address means "save it as .docx first".
  if (doc.kind === 'ole' && doc.links.length) return 'This older .doc file contains a web or network address and cannot be checked safely. Open it in Word, save it as a .docx, then convert that.';
  if (doc.links.length) return 'This document pulls in something from another address (such as a linked template or picture). Word would contact that address, so it was not converted.';
  return null;
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
    const problem = linkProblem(inspectDocument(await fsImpl.promises.readFile(sourcePath)), path.extname(name));
    if (problem) throw new Error(problem);
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
