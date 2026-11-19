// File Shelf: a place to park files for a moment. It keeps links, never copies, so nothing moves or fills your disk.
registerModule({
  id: 'shelf',
  title: 'Shelf',
  mount(root) {
    let shelves = [];
    let shelfId = window.panelState.shelfId || null;
    let isGone = false;
    let isRenaming = false;

    const tabs = h('div', { class: 'row wrap' });
    const zone = h('div', { class: 'drop-zone', tabindex: '-1' });
    const status = h('div', { class: 'tag' });

    const current = () => shelves.find((s) => s.id === shelfId) || shelves[0];
    const say = (text) => { status.textContent = text; };
    const fail = (err) => say(String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    const extOf = (name) => (name.includes('.') ? name.split('.').pop().slice(0, 4).toUpperCase() : '•');

    async function refresh() {
      shelves = await window.panel.shelf.list();
      if (isGone) return;
      if (!shelves.some((s) => s.id === shelfId)) shelfId = shelves[0].id;
      window.panelState.shelfId = shelfId;
      drawTabs();
      drawZone();
    }

    function drawTabs() {
      const shelf = current();
      if (isRenaming) {
        const input = h('input', { class: 'grow', value: shelf.name, maxlength: '40', 'aria-label': 'Shelf name' });
        const save = async () => { isRenaming = false; await window.panel.shelf.rename(shelf.id, input.value).catch(fail); refresh(); };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { isRenaming = false; drawTabs(); } });
        tabs.replaceChildren(input, h('button', { class: 'btn small', onClick: save }, 'Save'));
        input.focus();
        return;
      }
      tabs.replaceChildren(...[
        h('div', { class: 'segment' }, shelves.map((s) => h('button', { class: s.id === shelf.id ? 'active' : '', onClick: () => { shelfId = s.id; window.panelState.shelfId = s.id; drawTabs(); drawZone(); } }, s.name))),
        h('button', { class: 'icon-btn', 'aria-label': 'New shelf', title: 'New shelf', onClick: async () => { shelfId = await window.panel.shelf.create('').catch(fail); refresh(); } }, icon('plus')),
        h('button', { class: 'btn small', onClick: () => { isRenaming = true; drawTabs(); } }, 'Rename'),
        shelves.length > 1 ? h('button', { class: 'icon-btn', 'aria-label': 'Delete this shelf', title: 'Delete this shelf (your files are not touched)', onClick: async () => { await window.panel.shelf.delete(shelf.id); refresh(); } }, icon('trash')) : null].filter(Boolean));
    }

    function drawZone() {
      const shelf = current();
      const rows = shelf.files.map((file) => {
        const row = h('div', { class: `item${file.missing ? ' missing' : ''}`, draggable: 'true', title: file.path },
          h('span', { class: 'letter ext' }, extOf(file.name)),
          h('button', { class: 'grow file-name', title: file.missing ? 'This file was moved or deleted' : 'Open', disabled: file.missing, onClick: () => window.panel.shelf.open(shelf.id, file.id).catch(fail) }, file.name, file.missing ? h('span', { class: 'tag err' }, '  missing') : null),
          h('button', { class: 'icon-btn', 'aria-label': `Show ${file.name} in its folder`, title: 'Show in folder', disabled: file.missing, onClick: () => window.panel.shelf.reveal(shelf.id, file.id) }, icon('folder')),
          h('button', { class: 'icon-btn', 'aria-label': `Remove ${file.name} from the shelf`, title: 'Remove from shelf', onClick: async () => { await window.panel.shelf.remove(shelf.id, file.id); refresh(); } }, icon('x')));
        // dragging a row out hands the real file to whatever you drop it on
        row.addEventListener('dragstart', (event) => { event.preventDefault(); if (!file.missing) window.panel.shelf.startDrag(shelf.id, file.id); });
        return row;
      });
      zone.replaceChildren(...(rows.length ? rows : [h('div', { class: 'empty' }, 'Drop files or folders here.', h('div', { class: 'tag' }, 'They stay where they are. The shelf only remembers them.'))]));
    }

    async function takeDrop(event) {
      event.preventDefault();
      zone.classList.remove('over');
      const paths = Array.from(event.dataTransfer.files).map((f) => window.panel.pathFor(f)).filter(Boolean);
      if (!paths.length) { say('Nothing to add. Drop files from a folder on this computer.'); return; }
      try {
        const added = await window.panel.shelf.add(current().id, paths);
        say(added ? `Added ${added} item${added === 1 ? '' : 's'}.` : 'Those are already on this shelf (or cannot be found).');
        refresh();
      } catch (err) { fail(err); }
    }
    root.addEventListener('dragover', (event) => { event.preventDefault(); zone.classList.add('over'); });
    root.addEventListener('dragleave', (event) => { if (!root.contains(event.relatedTarget)) zone.classList.remove('over'); });
    root.addEventListener('drop', takeDrop);

    root.append(
      tabs, zone,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: async () => { try { const n = await window.panel.shelf.copyAll(current().id); say(`Copied ${n} file${n === 1 ? '' : 's'}. Paste them anywhere.`); } catch (err) { fail(err); } } }, icon('copy'), 'Copy all'),
        h('button', { class: 'btn', onClick: async () => { await window.panel.shelf.clear(current().id); say('Shelf cleared. Your files are untouched.'); refresh(); } }, 'Clear shelf')),
      status);
    refresh();
    return () => { isGone = true; };
  },
});
