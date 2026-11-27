// Watches the system clipboard and keeps the history (see clipboard-history.js for the rules).
const crypto = require('crypto');
const history = require('./clipboard-history');

const POLL_MS = 800;
const MAX_IMAGE_WIDTH = 640;
const MAX_IMAGE_DATA_URL_CHARS = 500000;

function createClipboardWatcher({ clipboard, nativeImage, store, onChange, onCopy = () => {} }) {
  let items = store.get('clipboard', []);
  let lastSignature = null;
  let timer = null;

  // The store has a size limit. If images make the list too big, the oldest unpinned image goes first.
  function persist() {
    let list = items;
    for (;;) {
      try {
        store.set('clipboard', list);
        items = list;
        return;
      } catch (err) {
        const oldestImage = [...list].reverse().find((item) => item.type === 'image' && !item.pinned);
        if (!oldestImage) throw err;
        list = history.removeEntry(list, oldestImage.id);
      }
    }
  }

  // The picture kept in the history: shrunk, as picture text. Null when it is still too big to keep.
  function imageEntry(image) {
    const small = image.getSize().width > MAX_IMAGE_WIDTH ? image.resize({ width: MAX_IMAGE_WIDTH }) : image;
    const imageDataUrl = small.toDataURL();
    return imageDataUrl.length > MAX_IMAGE_DATA_URL_CHARS ? null : { type: 'image', imageDataUrl };
  }

  // What is on the clipboard now: a signature that changes when the content changes, and entry() to build the history entry.
  // Looking happens about once a second, so the signature must be cheap: a picture is judged by a hash of its exact pixels
  // (about 8 times cheaper than shrinking and re-encoding it every time), and only turned into picture text when it is new.
  function readCurrent() {
    const text = clipboard.readText();
    if (text && text.trim()) return { signature: 't:' + text, entry: () => ({ type: 'text', text }) };
    const image = clipboard.readImage();
    if (image.isEmpty()) return null;
    const { width, height } = image.getSize();
    const pixels = crypto.createHash('sha1').update(image.toBitmap()).digest('hex'); // only used to notice a change, not for security
    return { signature: `i:${width}x${height}:${pixels}`, entry: () => imageEntry(image) };
  }

  function poll() {
    try {
      const current = readCurrent();
      if (!current || current.signature === lastSignature) return;
      lastSignature = current.signature;
      const readFormat = (format) => {
        try { return [...clipboard.readBuffer(format)]; } catch { return null; }
      };
      if (history.isExcluded(clipboard.availableFormats(), readFormat)) return; // a password manager copied this
      const entry = current.entry();
      if (!entry) return; // a picture too big to keep: noted once, so it is not worked on again at every look
      items = history.addEntry(items, entry);
      persist();
      onChange();
      onCopy(); // only a real new copy, not a pin, delete or clear
    } catch {
      // another program is holding the clipboard right now; the next poll tries again
    }
  }

  return {
    poll, // one look at the clipboard (the timer calls this; tests call it directly)
    start() {
      if (!timer) timer = setInterval(poll, POLL_MS);
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
    list: (query) => history.view(items, query),
    currentText: () => clipboard.readText(),
    // action: copy | pin | delete | clear
    act(action, id) {
      const item = items.find((candidate) => candidate.id === id);
      if (action === 'clear') items = history.clearUnpinned(items);
      else if (action === 'pin') items = history.togglePin(items, id);
      else if (action === 'delete') items = history.removeEntry(items, id);
      else if (action === 'copy' && item) {
        if (item.type === 'text') clipboard.writeText(item.text);
        else clipboard.writeImage(nativeImage.createFromDataURL(item.imageDataUrl));
        lastSignature = null; // the next poll files it as a fresh copy, which moves it to the top
      } else {
        throw new Error('Unknown clipboard action: ' + action);
      }
      persist();
      onChange();
    },
  };
}

module.exports = { createClipboardWatcher };
