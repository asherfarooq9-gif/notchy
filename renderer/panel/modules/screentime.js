// Screen Time: today's total, the programs you used most, and the last 7 days. Off until you turn it on.
registerModule({
  id: 'screentime',
  title: 'Screen Time',
  mount(root) {
    const REFRESH_MS = 5000;
    const box = h('div', { class: 'grid-gap' });
    root.append(box);

    const span = (seconds) => {
      const minutes = Math.round(seconds / 60);
      if (minutes < 1) return seconds > 0 ? '<1m' : '0m';
      return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
    };
    const pretty = (name) => name.charAt(0).toUpperCase() + name.slice(1);
    const dayName = (date) => new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))).toLocaleDateString(undefined, { weekday: 'short' });

    function drawOff() {
      box.replaceChildren(
        h('div', { class: 'card' },
          h('h2', null, 'Screen Time is off'),
          h('div', null, 'Turn it on to see how long you use each program.'),
          h('div', { class: 'tag' }, 'It saves only program names (like "chrome") and seconds, on this computer. Never window titles, never what you type.'),
          h('button', { class: 'btn primary', onClick: async () => draw(await window.panel.screenTime.set({ enabled: true, limitMinutes: 0 })) }, 'Turn on')));
    }

    function draw(data) {
      if (!data.enabled) { drawOff(); return; }
      const top = Math.max(1, ...data.today.apps.map((a) => a.seconds));
      const weekTop = Math.max(1, ...data.week.map((d) => d.seconds));
      const limit = h('input', { type: 'number', min: '0', step: '15', class: 'narrow', value: data.limitMinutes || '', placeholder: 'off', 'aria-label': 'Daily limit in minutes (empty for none)' });
      limit.addEventListener('change', async () => { await window.panel.screenTime.set({ enabled: true, limitMinutes: limit.value }); });
      box.replaceChildren(
        h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Today'), h('button', { class: 'btn small', onClick: async () => draw(await window.panel.screenTime.set({ enabled: false, limitMinutes: data.limitMinutes })) }, 'Turn off')),
        h('div', { class: 'big' }, span(data.today.seconds)),
        data.today.apps.length ? h('div', { class: 'list' }, data.today.apps.map((a) => h('div', { class: 'st-row' },
          h('div', { class: 'row' }, h('span', { class: 'grow' }, pretty(a.name)), h('span', { class: 'muted' }, span(a.seconds))),
          h('div', { class: 'bar' }, h('div', { class: 'bar-fill', 'data-width': String(Math.round((a.seconds / top) * 100)) }))))) : h('div', { class: 'muted' }, 'Nothing counted yet. Use your computer for a few seconds.'),
        h('h2', null, 'Last 7 days'),
        h('div', { class: 'st-week' }, data.week.map((d, i) => h('div', { class: 'st-day' },
          h('span', { class: 'tag' }, span(d.seconds)),
          h('div', { class: 'st-column' }, h('div', { class: `st-fill${i === 6 ? ' today' : ''}`, 'data-height': String(Math.round((d.seconds / weekTop) * 100)) })),
          h('span', { class: 'tag' }, i === 6 ? 'Today' : dayName(d.date))))),
        h('label', { class: 'row' }, h('span', { class: 'grow' }, 'Remind me after this many minutes a day'), limit),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onClick: async () => draw(await window.panel.screenTime.clear()) }, 'Erase all Screen Time data'), h('span', { class: 'tag' }, 'Time while you are away is not counted.')));
      sizeBars();
    }

    // The widths and heights come in as data and are applied here, because the page does not allow inline styles.
    function sizeBars() {
      for (const el of box.querySelectorAll('[data-width]')) el.style.width = `${el.dataset.width}%`;
      for (const el of box.querySelectorAll('[data-height]')) el.style.height = `${Math.max(2, Number(el.dataset.height))}%`;
    }

    const load = async () => draw(await window.panel.screenTime.get());
    const isEditing = () => root.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
    const timer = setInterval(() => { if (!isEditing()) load(); }, REFRESH_MS);
    load();
    return () => clearInterval(timer);
  },
});
