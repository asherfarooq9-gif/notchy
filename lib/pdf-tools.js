// Merge several PDFs into one, or keep only some pages of one. Results are new files next to the original; nothing is
// replaced and nothing is uploaded. Uses the small pdf-lib library (pure JavaScript).
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { isLocalAbsolute, uniqueOutputPath } = require('./paths');

const MAX_FILES = 30;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;
const MAX_TOTAL_PAGES = 2000;
const MAX_SPEC_CHARS = 100;
const MAX_SAVE_TRIES = 5;

// "1-3,5" (pages counted from 1) -> [0, 1, 2, 4]. Throws a plain sentence for anything else.
function parsePages(spec, pageCount) {
  const text = typeof spec === 'string' ? spec.trim() : '';
  const explain = 'Write pages like 1-3,5 (pages from 1 to ' + pageCount + ').';
  if (!text || text.length > MAX_SPEC_CHARS) throw new Error(explain);
  const picked = new Set();
  for (const part of text.split(',')) {
    const m = part.trim().match(/^(\d{1,6})(?:\s*-\s*(\d{1,6}))?$/);
    if (!m) throw new Error(explain);
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]);
    if (from < 1 || to < from || to > pageCount) throw new Error(explain);
    for (let n = from; n <= to; n++) picked.add(n - 1);
  }
  return [...picked].sort((a, b) => a - b);
}

function createPdfService({ fsImpl = fs } = {}) {
  const written = new Set(); // only files made here can be shown in their folder

  async function readPdfFile(file) {
    if (!isLocalAbsolute(file)) throw new Error('Files must be on this computer (not a network share).');
    if (path.extname(file).toLowerCase() !== '.pdf') throw new Error(path.basename(file) + ' is not a PDF.');
    let info;
    try { info = fsImpl.statSync(file); } catch { throw new Error(path.basename(file) + ' is no longer there.'); }
    if (!info.isFile()) throw new Error(path.basename(file) + ' is not a file.');
    if (info.size > MAX_FILE_BYTES) throw new Error(path.basename(file) + ' is too large (over 100 MB).');
    return { bytes: await fsImpl.promises.readFile(file), size: info.size }; // reading does not block the app; parsing a big PDF still takes a moment
  }

  async function openPdf(file) {
    const { bytes, size } = await readPdfFile(file);
    try { return { doc: await PDFDocument.load(bytes), size }; } catch {
      throw new Error(path.basename(file) + ' is damaged or password protected.');
    }
  }

  function saveNext(dir, sourceName, label, bytes) {
    for (let attempt = 0; attempt < MAX_SAVE_TRIES; attempt++) {
      const target = uniqueOutputPath(dir, sourceName, 'pdf', (p) => fsImpl.existsSync(p), label);
      try {
        fsImpl.writeFileSync(target, bytes, { flag: 'wx' }); // "wx": fails instead of replacing a file
        written.add(target);
        return target;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error; // someone made that name a moment ago: pick the next free one
      }
    }
    throw new Error('Could not find a free file name. Try again.');
  }

  return {
    // sourcePaths: 2 to 30 PDFs, joined in this order. The result lands next to the first one.
    async merge({ sourcePaths } = {}) {
      if (!Array.isArray(sourcePaths) || sourcePaths.length < 2) throw new Error('Choose at least two PDFs to join.');
      if (sourcePaths.length > MAX_FILES) throw new Error(`Join at most ${MAX_FILES} PDFs at a time.`);
      const merged = await PDFDocument.create();
      let totalBytes = 0;
      for (const file of sourcePaths) {
        const { doc, size } = await openPdf(String(file));
        totalBytes += size;
        if (totalBytes > MAX_TOTAL_BYTES) throw new Error('These PDFs are too large to join together (over 300 MB).');
        if (merged.getPageCount() + doc.getPageCount() > MAX_TOTAL_PAGES) throw new Error(`That would make more than ${MAX_TOTAL_PAGES} pages.`);
        for (const page of await merged.copyPages(doc, doc.getPageIndices())) merged.addPage(page);
      }
      const target = saveNext(path.dirname(sourcePaths[0]), path.basename(sourcePaths[0]), 'joined', await merged.save());
      return { path: target, name: path.basename(target), pages: merged.getPageCount() };
    },

    // pages: "1-3,5". Keeps only those pages, in page order.
    async split({ sourcePath, pages } = {}) {
      const { doc } = await openPdf(String(sourcePath || ''));
      const keep = parsePages(pages, doc.getPageCount());
      const result = await PDFDocument.create();
      for (const page of await result.copyPages(doc, keep)) result.addPage(page);
      const target = saveNext(path.dirname(sourcePath), path.basename(sourcePath), 'pages ' + pages.trim().replace(/\s+/g, ''), await result.save());
      return { path: target, name: path.basename(target), pages: keep.length };
    },
    canReveal: (file) => written.has(file),
  };
}

module.exports = { createPdfService, parsePages };
