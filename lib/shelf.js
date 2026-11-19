// The File Shelf: named shelves that hold links to files and folders (never copies, never moves them).
// A shelf only remembers where each file is. If a file is moved or deleted later, it is shown as missing.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isLocalAbsolute, isProgramFile } = require('./paths');

const MAX_SHELVES = 20;
const MAX_FILES_PER_SHELF = 100;
const MAX_NAME = 40;

const cleanName = (text, fallback) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || fallback;

function createShelfService({ store, statImpl = fs.statSync }) {
  // Whatever is on disk is re-checked when read: odd shelves are dropped, and so are network paths.
  const read = () => store.get('shelves', [])
    .filter((s) => s && typeof s.id === 'string' && Array.isArray(s.files))
    .map((s) => ({ ...s, name: cleanName(s.name, 'Shelf'), files: s.files.filter((f) => f && typeof f.id === 'string' && isLocalAbsolute(f.path)) }));
  const write = (shelves) => store.set('shelves', shelves);
  const edit = (shelfId, change) => {
    const shelves = read();
    if (!shelves.some((s) => s.id === shelfId)) throw new Error('That shelf no longer exists');
    write(shelves.map((s) => (s.id === shelfId ? change(s) : s)));
  };
  const find = (shelfId, fileId) => {
    const shelf = read().find((s) => s.id === shelfId);
    const file = shelf && shelf.files.find((f) => f.id === fileId);
    if (!file) throw new Error('That file is not on the shelf');
    return file;
  };

  return {
    // The shelves with a live "missing" flag for each file. A first-time user gets one empty shelf.
    list() {
      const shelves = read();
      if (!shelves.length) { write([{ id: crypto.randomUUID(), name: 'Shelf 1', files: [] }]); return this.list(); }
      return shelves.map((s) => ({ ...s, files: s.files.map((f) => ({ ...f, missing: !exists(f.path, statImpl) })) }));
    },
    create(name) {
      const shelves = read();
      if (shelves.length >= MAX_SHELVES) throw new Error(`You can have up to ${MAX_SHELVES} shelves`);
      const shelf = { id: crypto.randomUUID(), name: cleanName(name, `Shelf ${shelves.length + 1}`), files: [] };
      write([...shelves, shelf]);
      return shelf.id;
    },
    rename: (shelfId, name) => edit(shelfId, (s) => ({ ...s, name: cleanName(name, s.name) })),
    delete(shelfId) { write(read().filter((s) => s.id !== shelfId)); },
    // Only real, absolute paths are kept; the same path is never added twice. Returns how many were added.
    add(shelfId, paths) {
      let added = 0;
      edit(shelfId, (s) => {
        const files = [...s.files];
        for (const raw of Array.isArray(paths) ? paths : []) {
          const full = isLocalAbsolute(raw) ? path.resolve(raw) : null;
          if (!full || !exists(full, statImpl) || files.some((f) => f.path.toLowerCase() === full.toLowerCase()) || files.length >= MAX_FILES_PER_SHELF) continue;
          files.push({ id: crypto.randomUUID(), path: full, name: path.basename(full) || full });
          added++;
        }
        return { ...s, files };
      });
      return added;
    },
    removeFile: (shelfId, fileId) => edit(shelfId, (s) => ({ ...s, files: s.files.filter((f) => f.id !== fileId) })),
    clear: (shelfId) => edit(shelfId, (s) => ({ ...s, files: [] })),
    // The renderer only ever names a file by id; the real path is looked up here, so it can only act on shelf files.
    pathOf: (shelfId, fileId) => find(shelfId, fileId).path,
    // For opening: programs and scripts are refused, so the shelf can never launch something by accident.
    openablePath(shelfId, fileId) {
      const file = find(shelfId, fileId).path;
      if (isProgramFile(file)) throw new Error('For safety, programs cannot be opened from the shelf. Use "Show in folder" instead.');
      return file;
    },
    existingPaths: (shelfId) => {
      const shelf = read().find((s) => s.id === shelfId);
      if (!shelf) throw new Error('That shelf no longer exists');
      return shelf.files.map((f) => f.path).filter((p) => exists(p, statImpl));
    },
  };
}

function exists(file, statImpl) {
  try { statImpl(file); return true; } catch { return false; }
}

module.exports = { createShelfService, MAX_FILES_PER_SHELF };
