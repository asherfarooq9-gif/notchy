// Calendar: a month view, your own events with reminders, and calendars you follow (holidays and so on).
registerModule({
  id: 'calendar',
  title: 'Calendar',
  mount(root) {
    const pad = (n) => String(n).padStart(2, '0');
    const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = keyOf(new Date());
    let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    let selected = today;
    let items = [];
    let isGone = false;

    const title = h('h2', { class: 'grow' });
    const grid = h('div', { class: 'cal-grid' });
    const dayBox = h('div', { class: 'list' });
    const feedBox = h('div', { class: 'grid-gap' });
    const error = h('div', { class: 'tag err' });

    const gridStart = () => { const d = new Date(month); d.setDate(1 - ((d.getDay() + 6) % 7)); return d; }; // weeks start on Monday
    const gridDays = () => Array.from({ length: 42 }, (_, i) => { const d = gridStart(); d.setDate(d.getDate() + i); return d; });
    const clockText = (time) => new Date(`2000-01-01T${time}`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    async function loadMonth() {
      const days = gridDays();
      title.textContent = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      items = await window.panel.calendar.list(keyOf(days[0]), keyOf(days[41]));
      if (isGone) return;
      drawGrid();
      drawDay();
    }

    function drawGrid() {
      const names = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((n) => h('span', { class: 'tag cal-head' }, n));
      const cells = gridDays().map((d) => {
        const key = keyOf(d);
        const has = items.some((i) => i.date === key);
        return h('button', {
          class: `cal-day${d.getMonth() !== month.getMonth() ? ' other' : ''}${key === today ? ' today' : ''}${key === selected ? ' selected' : ''}`,
          'aria-label': d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + (has ? ', has events' : ''),
          onClick: () => { selected = key; drawGrid(); drawDay(); },
        }, String(d.getDate()), has ? h('span', { class: 'cal-dot' }) : null);
      });
      grid.replaceChildren(...names, ...cells);
    }

    function drawDay() {
      const list = items.filter((i) => i.date === selected);
      const label = new Date(`${selected}T00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      dayBox.replaceChildren(h('h2', null, label), ...(list.length ? list.map((e) => h('div', { class: 'item' },
        h('span', { class: 'cal-time muted' }, e.time ? clockText(e.time) : 'All day'),
        h('span', { class: 'grow' }, e.title, e.source !== 'me' ? h('span', { class: 'tag' }, `  ${e.source}`) : null),
        e.remind != null ? h('span', { class: 'muted', title: 'Reminder set', role: 'img', 'aria-label': 'Reminder set' }, icon('bell')) : null,
        e.source === 'me' ? h('button', { class: 'icon-btn', 'aria-label': `Delete ${e.title}`, onClick: async () => { await window.panel.calendar.remove(e.id); loadMonth(); } }, icon('trash')) : null))
        : [h('div', { class: 'muted' }, 'Nothing planned.')]));
    }

    // adding an event
    const nameInput = h('input', { class: 'grow', placeholder: 'New event', 'aria-label': 'Event name', maxlength: '120' });
    const timeInput = h('input', { type: 'time', 'aria-label': 'Time (leave empty for all day)' });
    const remindSelect = h('select', { 'aria-label': 'Reminder' }, ...[['', 'No reminder'], ['0', 'At the time'], ['5', '5 min before'], ['10', '10 min before'], ['30', '30 min before'], ['60', '1 hour before']].map(([v, t]) => h('option', { value: v }, t)));
    async function addEvent() {
      error.textContent = '';
      try {
        await window.panel.calendar.add({ title: nameInput.value, date: selected, time: timeInput.value, remind: remindSelect.value === '' ? null : Number(remindSelect.value) });
        nameInput.value = ''; timeInput.value = '';
        loadMonth();
      } catch (err) {
        error.textContent = err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      }
    }
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addEvent(); });
    timeInput.addEventListener('input', () => { if (!timeInput.value) remindSelect.value = ''; });

    // followed calendars
    async function drawFeeds() {
      const { feeds, presets } = await window.panel.calendar.feeds();
      if (isGone) return;
      const preset = h('select', { 'aria-label': 'Add a holiday calendar' }, h('option', { value: '' }, 'Add holidays…'), ...presets.map((p) => h('option', { value: p.url }, p.name)));
      const linkInput = h('input', { class: 'grow', placeholder: 'Or paste a calendar link (https)', 'aria-label': 'Calendar link' });
      const feedError = h('div', { class: 'tag err' });
      const follow = async (name, url) => {
        feedError.textContent = 'Checking…';
        try { await window.panel.calendar.addFeed({ name, url }); drawFeeds(); loadMonth(); } catch (err) { feedError.textContent = err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); }
      };
      preset.addEventListener('change', () => { if (preset.value) follow(preset.options[preset.selectedIndex].text, preset.value); });
      linkInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && linkInput.value.trim()) follow('', linkInput.value); });
      feedBox.replaceChildren(
        h('h2', null, 'Followed calendars'),
        ...feeds.map((f) => h('div', { class: 'item' }, h('span', { class: 'grow' }, f.name, h('span', { class: f.error ? 'tag err' : 'tag' }, f.error ? `  could not refresh: ${f.error}` : `  ${f.count} event${f.count === 1 ? '' : 's'}`)),
          h('button', { class: 'icon-btn', 'aria-label': `Stop following ${f.name}`, onClick: async () => { await window.panel.calendar.removeFeed(f.id); drawFeeds(); loadMonth(); } }, icon('x')))),
        preset, h('div', { class: 'row' }, linkInput), feedError,
        h('div', { class: 'tag' }, 'Calendars are only read, never changed. Repeating events and holidays show up automatically.'));
    }

    const shift = (months) => { month = new Date(month.getFullYear(), month.getMonth() + months, 1); loadMonth(); };
    root.append(
      h('div', { class: 'row' }, title,
        h('button', { class: 'icon-btn', 'aria-label': 'Previous month', onClick: () => shift(-1) }, icon('prev')),
        h('button', { class: 'btn small', onClick: () => { month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); selected = today; loadMonth(); } }, 'Today'),
        h('button', { class: 'icon-btn', 'aria-label': 'Next month', onClick: () => shift(1) }, icon('next'))),
      grid, dayBox,
      h('div', { class: 'row wrap' }, nameInput, timeInput, remindSelect, h('button', { class: 'btn primary', onClick: addEvent }, icon('plus'), 'Add')),
      error, feedBox);
    loadMonth();
    drawFeeds();
    return () => { isGone = true; };
  },
});
