// Clipboard: everything you copied, searchable. Pin what you reuse. Copies from password managers are never kept.
registerModule({
  id: 'clipboard',
  title: 'Clipboard',
  mount(root) {
    let query = '';
    const list = h('div', { class: 'list' });
    const search = h('input', { type: 'text', class: 'grow', placeholder: 'Search what you copied', 'aria-label': 'Search clipboard' });

    const act = (action, id) => window.panel.clipboard.act(action, id);
    let latest = 0;
    const refresh = async () => { // an older search that answers late must not replace a newer one
      const mine = ++latest;
      const items = await window.panel.clipboard.list(query);
      if (mine === latest) draw(items);
    };

    function row(item) {
      const content = item.type === 'image'
        ? h('img', { class: 'clip-image', src: item.imageDataUrl, alt: 'Copied image' })
        : h('div', { class: 'clip-text', title: 'Click to copy. Drag it into your work.' }, item.text);
      const tick = h('span', { class: 'tag ok' });
      const { classify, colorForms, tidy } = window.ClipKind;
      const kind = item.type === 'text' ? classify(item.text) : 'image';
      const forms = kind === 'color' ? colorForms(item.text) : null;
      const quick = (label, run) => h('button', { class: 'btn small', onClick: (e) => { e.stopPropagation(); run(); } }, label);
      const extras = [];
      if (kind === 'url') extras.push(h('span', { class: 'tag' }, 'Link'), quick('Open', () => window.panel.openUrl(item.text.trim())));
      if (kind === 'email' || kind === 'phone') extras.push(h('span', { class: 'tag' }, kind === 'email' ? 'Email' : 'Phone'));
      if (forms) {
        const swatch = h('span', { class: 'clip-swatch', 'aria-hidden': 'true' });
        swatch.style.background = forms.hex; // a colour read from your own copied text, set through the style object (allowed by the page's security rules)
        const isHex = item.text.trim().startsWith('#');
        extras.push(swatch, quick(isHex ? 'Copy RGB' : 'Copy HEX', () => window.panel.copyText(isHex ? forms.rgb : forms.hex)));
      }
      if (kind === 'text' && tidy(item.text) !== item.text) extras.push(quick('Tidy', () => window.panel.copyText(tidy(item.text))));
      const element = h('div', { class: 'item clickable', draggable: item.type === 'text' ? 'true' : false, role: 'button', tabindex: '0', 'aria-label': 'Copy this again' },
        h('div', { class: 'grow' }, content),
        ...extras,
        tick,
        h('button', { class: 'icon-btn' + (item.pinned ? ' on' : ''), 'aria-label': item.pinned ? 'Unpin' : 'Pin', onClick: (e) => { e.stopPropagation(); act('pin', item.id); } }, icon('pin')),
        h('button', { class: 'icon-btn', 'aria-label': 'Delete', onClick: (e) => { e.stopPropagation(); act('delete', item.id); } }, icon('trash')));
      const copy = async () => { await act('copy', item.id); tick.textContent = 'Copied'; setTimeout(() => { tick.textContent = ''; }, 1200); };
      element.addEventListener('click', copy);
      element.addEventListener('keydown', (e) => { if (e.target === element && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); copy(); } }); // keys pressed on the inner buttons stay theirs
      element.addEventListener('dragstart', (e) => { if (item.type === 'text') e.dataTransfer.setData('text/plain', item.text); });
      return element;
    }

    function draw(items) {
      if (items.length === 0) { list.replaceChildren(h('div', { class: 'empty' }, query ? 'Nothing matches.' : 'Copy something and it will show up here.')); return; }
      list.replaceChildren(...items.map(row));
    }

    search.addEventListener('input', debounce(() => { query = search.value; refresh(); }, 150));
    root.append(
      h('div', { class: 'row' }, search, h('button', { class: 'btn small', onClick: () => act('clear') }, 'Clear')),
      list,
      h('div', { class: 'tag' }, 'Stays on this PC. Pinned items are kept when you clear.'));
    refresh();
    return bus.on('clipboard', refresh);
  },
});
