// Watches the system clipboard and keeps the history (see clipboard-history.js for the rules).
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

  function readCurrent() {
    const text = clipboard.readText();
    if (text && text.trim()) return { signature: 't:' + text, entry: { type: 'text', text } };
    const image = clipboard.readImage();
    if (image.isEmpty()) return null;
    const small = image.getSize().width > MAX_IMAGE_WIDTH ? image.resize({ width: MAX_IMAGE_WIDTH }) : image;
    const imageDataUrl = small.toDataURL();
    if (imageDataUrl.length > MAX_IMAGE_DATA_URL_CHARS) return null; // too big to keep
    return { signature: `i:${imageDataUrl.length}:${imageDataUrl.slice(-64)}`, entry: { type: 'image', imageDataUrl } };
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
      items = history.addEntry(items, current.entry);
      persist();
      onChange();
      onCopy(); // only a real new copy, not a pin, delete or clear
    } catch {
      // another program is holding the clipboard right now; the next poll tries again
    }
  }

  return {
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
