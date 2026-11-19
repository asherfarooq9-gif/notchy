// The Clipboard history logic: newest first, dedupe, pins, a size limit, search, and skipping secrets.
// Every function returns a new list and never changes the one it was given.
const crypto = require('crypto');

const MAX_UNPINNED = 100;
const MAX_TEXT_CHARS = 20000;

const hashOf = (text) => crypto.createHash('sha1').update(text).digest('hex');

// Password managers mark what they copy so clipboard tools skip it. Respect that.
function isExcluded(formats, readFormat) {
  if (formats.some((f) => /ExcludeClipboardContentFromMonitorProcessing/i.test(f))) return true;
  const canInclude = formats.find((f) => /CanIncludeInClipboardHistory/i.test(f));
  if (!canInclude) return false;
  const bytes = readFormat(canInclude);
  return Boolean(bytes) && bytes.length >= 1 && bytes.every((b) => b === 0);
}

function makeEntry({ type, text, imageDataUrl }) {
  if (type === 'image') return imageDataUrl ? { type, imageDataUrl, hash: hashOf(imageDataUrl) } : null;
  const clean = String(text || '').slice(0, MAX_TEXT_CHARS);
  return clean.trim() ? { type: 'text', text: clean, hash: hashOf(clean) } : null;
}

function trimUnpinned(items) {
  let unpinnedSeen = 0;
  return items.filter((item) => item.pinned || ++unpinnedSeen <= MAX_UNPINNED);
}

function addEntry(items, input, at = Date.now()) {
  const entry = makeEntry(input);
  if (!entry) return items;
  const existing = items.find((item) => item.type === entry.type && item.hash === entry.hash);
  if (existing) {
    // copied again: move it to the top, keeping its pin
    return [{ ...existing, at }, ...items.filter((item) => item !== existing)];
  }
  const id = `${at}-${entry.hash.slice(0, 8)}`;
  return trimUnpinned([{ id, ...entry, pinned: false, at }, ...items]);
}

const togglePin = (items, id) => items.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item));
const removeEntry = (items, id) => items.filter((item) => item.id !== id);
const clearUnpinned = (items) => items.filter((item) => item.pinned);

// Pinned items first, then newest first. Images match only when the search is empty.
function view(items, query = '') {
  const q = String(query).trim().toLowerCase();
  const matches = items.filter((item) => !q || (item.type === 'text' && item.text.toLowerCase().includes(q)));
  return [...matches.filter((i) => i.pinned), ...matches.filter((i) => !i.pinned)];
}

module.exports = { addEntry, togglePin, removeEntry, clearUnpinned, view, isExcluded, MAX_UNPINNED, MAX_TEXT_CHARS };
