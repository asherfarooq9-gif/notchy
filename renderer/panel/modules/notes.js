// Notes: quick notes and checklists that save as you type. Pin the ones you keep coming back to.
registerModule({
  id: 'notes',
  title: 'Notes',
  mount(root) {
    const MAX_NOTES = 300;
    const MAX_NOTE_CHARS = 5000;
    let notes = [];
    let isLoaded = false; // nothing is saved or added until your saved notes have loaded, so an early save can never wipe them
    const list = h('div', { class: 'list' });
    const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const save = debounce(() => { if (isLoaded) window.panel.data.set('notes', notes); }, 400);
    const sorted = () => [...notes.filter((n) => n.pinned), ...notes.filter((n) => !n.pinned)];

    function add(kind) {
      if (!isLoaded || notes.length >= MAX_NOTES) return;
      notes = [{ id: newId(), kind, text: '', items: [], pinned: false }, ...notes];
      save();
      draw(notes[0].id);
    }
    const remove = (id) => { notes = notes.filter((n) => n.id !== id); save(); draw(); };
    const togglePin = (id) => { notes = notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)); save(); draw(); };
    const change = (id, patch) => { notes = notes.map((n) => (n.id === id ? { ...n, ...patch } : n)); save(); };

    function checklist(note) {
      const itemsBox = h('div', { class: 'list' });
      const setItems = (items) => change(note.id, { items });
      const drawItems = (focusLast) => {
        itemsBox.replaceChildren(...note.items.map((item, i) => {
          const text = h('input', { type: 'text', value: item.text, class: 'grow' + (item.done ? ' done' : ''), 'aria-label': 'Item ' + (i + 1), maxlength: '200' });
          text.addEventListener('input', () => { note.items[i].text = text.value; setItems(note.items); });
          const box = h('input', { type: 'checkbox', checked: item.done, 'aria-label': 'Done' });
          box.addEventListener('change', () => { note.items[i].done = box.checked; text.classList.toggle('done', box.checked); setItems(note.items); });
          return h('div', { class: 'row' }, box, text, h('button', { class: 'icon-btn', 'aria-label': 'Remove item', onClick: () => { note.items.splice(i, 1); setItems(note.items); drawItems(false); } }, icon('x')));
        }));
        if (focusLast) { const inputs = itemsBox.querySelectorAll('input[type="text"]'); if (inputs.length) inputs[inputs.length - 1].focus(); }
      };
      const addInput = h('input', { type: 'text', placeholder: 'Add an item and press Enter', class: 'grow', maxlength: '200' });
      addInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !addInput.value.trim() || note.items.length >= 100) return;
        note.items.push({ id: newId(), text: addInput.value.trim(), done: false });
        addInput.value = '';
        setItems(note.items);
        drawItems(false);
      });
      drawItems(false);
      return [itemsBox, addInput];
    }

    function card(note) {
      const body = note.kind === 'list'
        ? checklist(note)
        : [(() => {
          const area = h('textarea', { 'aria-label': 'Note', placeholder: 'Write something…', maxlength: String(MAX_NOTE_CHARS), value: note.text });
          area.addEventListener('input', () => change(note.id, { text: area.value }));
          return area;
        })()];
      return h('div', { class: 'card', 'data-id': note.id },
        h('div', { class: 'row' }, h('span', { class: 'tag grow' }, note.kind === 'list' ? 'Checklist' : 'Note'),
          h('button', { class: 'icon-btn' + (note.pinned ? ' on' : ''), 'aria-label': note.pinned ? 'Unpin' : 'Pin', onClick: () => togglePin(note.id) }, icon('pin')),
          h('button', { class: 'icon-btn', 'aria-label': 'Delete', onClick: () => remove(note.id) }, icon('trash'))),
        body);
    }

    function draw(focusId) {
      list.replaceChildren(...sorted().map(card));
      if (notes.length === 0) list.replaceChildren(h('div', { class: 'empty' }, 'Nothing here yet. Start a note or a checklist.'));
      if (!focusId) return;
      const wanted = [...list.children].find((card) => card.dataset.id === focusId); // the new note, even when pinned notes sit above it
      const field = wanted && wanted.querySelector('textarea, input[type="text"]');
      if (field) field.focus();
    }

    root.append(
      h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Notes'),
        h('button', { class: 'btn small', onClick: () => add('note') }, icon('plus'), 'Note'),
        h('button', { class: 'btn small', onClick: () => add('list') }, icon('plus'), 'Checklist')),
      list);
    const loaded = window.panel.data.get('notes', []).then((saved) => { notes = Array.isArray(saved) ? saved : []; isLoaded = true; draw(); });
    const stopListening = bus.on('capture', () => loaded.then(() => (notes[0] && notes[0].kind === 'note' && !notes[0].text ? draw(notes[0].id) : add('note')))); // quick capture waits for the saved notes, so nothing is overwritten
    return () => { stopListening(); return isLoaded ? window.panel.data.set('notes', notes) : undefined; }; // save whatever was typed last
  },
});
