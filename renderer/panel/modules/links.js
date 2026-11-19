// Links: the sites you open every day, plus search shortcuts.
registerModule({
  id: 'links',
  title: 'Links',
  mount(root, ctx) {
    const DEFAULT_LINKS = [
      { title: 'Google', url: 'https://www.google.com' },
      { title: 'YouTube', url: 'https://www.youtube.com' },
      { title: 'GitHub', url: 'https://github.com' },
      { title: 'Stack Overflow', url: 'https://stackoverflow.com' },
    ];
    const ENGINES = [
      ['Google', 'https://www.google.com/search?q='],
      ['YouTube', 'https://www.youtube.com/results?search_query='],
      ['GitHub', 'https://github.com/search?q='],
      ['Stack Overflow', 'https://stackoverflow.com/search?q='],
    ];
    const MAX_LINKS = 100;
    let links = [];

    const grid = h('div', { class: 'cards' });
    const copiedSlot = h('div');
    const message = h('div', { class: 'tag err' });
    const search = h('input', { type: 'text', class: 'grow', placeholder: 'Search the web', 'aria-label': 'Search the web' });
    const titleInput = h('input', { type: 'text', placeholder: 'Name', class: 'grow', maxlength: '40', 'aria-label': 'Link name' });
    const urlInput = h('input', { type: 'text', placeholder: 'https://…', class: 'grow', maxlength: '500', 'aria-label': 'Link address' });

    const save = () => window.panel.data.set('links', links);
    const searchWith = (base) => { if (search.value.trim()) ctx.openUrl(base + encodeURIComponent(search.value.trim())); };

    function parseWebUrl(text) {
      try {
        const url = new URL(String(text).trim());
        return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
      } catch {
        return null;
      }
    }

    function addLink(title, rawUrl) {
      const url = parseWebUrl(rawUrl);
      if (!url) { message.textContent = 'That is not a web address. It should start with https://'; return false; }
      if (links.length >= MAX_LINKS) { message.textContent = 'You have reached the limit of links.'; return false; }
      message.textContent = '';
      links = [...links, { title: (title || url.hostname).trim().slice(0, 40), url: url.toString() }];
      save();
      draw();
      return true;
    }

    function draw() {
      if (links.length === 0) { grid.replaceChildren(h('div', { class: 'empty wide' }, 'No links yet.')); return; }
      grid.replaceChildren(...links.map((link, index) => h('div', { class: 'item clickable', role: 'link', tabindex: '0', title: link.url, onClick: () => ctx.openUrl(link.url) },
        h('span', { class: 'letter' }, (link.title[0] || '?').toUpperCase()),
        h('span', { class: 'grow clip-text' }, link.title),
        h('button', { class: 'icon-btn', 'aria-label': 'Remove ' + link.title, onClick: (e) => { e.stopPropagation(); links = links.filter((_, i) => i !== index); save(); draw(); } }, icon('x')))));
      grid.querySelectorAll('[role="link"]').forEach((el, i) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') ctx.openUrl(links[i].url); }));
    }

    async function checkCopied() {
      const text = (await window.panel.clipboard.currentText()).trim();
      const url = text && !/\s/.test(text) ? parseWebUrl(text) : null;
      const alreadySaved = url && links.some((l) => l.url === url.toString());
      copiedSlot.replaceChildren(url && !alreadySaved
        ? h('button', { class: 'btn small', onClick: () => { if (addLink('', text)) checkCopied(); } }, icon('plus'), 'Save copied link: ' + url.hostname)
        : '');
    }

    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchWith(ENGINES[0][1]); });
    root.append(
      h('h2', null, 'Search'),
      h('div', { class: 'row' }, search),
      h('div', { class: 'row wrap' }, ENGINES.map(([name, base]) => h('button', { class: 'btn small', onClick: () => searchWith(base) }, name))),
      h('h2', null, 'Your links'),
      grid,
      copiedSlot,
      h('div', { class: 'row' }, titleInput, urlInput, h('button', { class: 'btn small', onClick: () => { if (addLink(titleInput.value, urlInput.value)) { titleInput.value = ''; urlInput.value = ''; } } }, 'Add')),
      message);
    window.panel.data.get('links', null).then((saved) => { links = Array.isArray(saved) ? saved : DEFAULT_LINKS; draw(); checkCopied(); });
    return bus.on('clipboard', checkCopied);
  },
});
