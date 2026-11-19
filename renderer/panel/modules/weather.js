// Weather: now, the next 12 hours and the next 7 days for one chosen city.
registerModule({
  id: 'weather',
  title: 'Weather',
  mount(root) {
    const box = h('div', { class: 'grid-gap' });
    root.append(box);
    let isGone = false;

    const hourLabel = (time) => new Date(Number(time.slice(0, 4)), Number(time.slice(5, 7)) - 1, Number(time.slice(8, 10)), Number(time.slice(11, 13))).toLocaleTimeString(undefined, { hour: 'numeric' });
    const dayLabel = (date) => new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))).toLocaleDateString(undefined, { weekday: 'short' });
    const stat = (label, value) => h('div', { class: 'card' }, h('div', { class: 'tag' }, label), h('div', { class: 'mid' }, value));

    function drawSearch(note) {
      const input = h('input', { type: 'search', class: 'grow', placeholder: 'Search for a city', 'aria-label': 'City name' });
      const results = h('div', { class: 'list' });
      const status = h('div', { class: 'tag' }, note || '');
      const run = async () => {
        status.textContent = 'Searching…';
        try {
          const found = await window.panel.weather.search(input.value);
          status.textContent = found.length ? '' : 'No city found.';
          results.replaceChildren(...found.map((place) => h('button', { class: 'item clickable', onClick: async () => { await window.panel.weather.choose(place); load(false); } }, h('span', { class: 'grow' }, place.name, h('span', { class: 'muted' }, place.region ? `  ${place.region}` : '')))));
        } catch (err) {
          status.textContent = 'Could not search. Check your internet.';
        }
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
      box.replaceChildren(h('h2', null, 'Choose your city'), h('div', { class: 'row' }, input, h('button', { class: 'btn primary', onClick: run }, 'Search')), status, results,
        h('div', { class: 'tag' }, 'Only the city you pick is sent to the weather service (Open-Meteo).'));
      input.focus();
    }

    function draw(data) {
      const { now } = data;
      const unitButton = (unit, text) => h('button', { class: data.unit === unit ? 'active' : '', onClick: async () => { await window.panel.weather.setUnit(unit); load(false); } }, text);
      box.replaceChildren(...[
        h('div', { class: 'row' },
          h('div', { class: 'grow' }, h('h2', null, data.place.name), h('div', { class: 'tag' }, data.place.region)),
          h('div', { class: 'segment' }, unitButton('c', '°C'), unitButton('f', '°F')),
          h('button', { class: 'icon-btn', title: 'Refresh', 'aria-label': 'Refresh', onClick: () => load(true) }, icon('reset')),
          h('button', { class: 'icon-btn', title: 'Change city', 'aria-label': 'Change city', onClick: () => drawSearch() }, icon('x'))),
        data.stale ? h('div', { class: 'tag err' }, `Offline. Showing weather saved at ${new Date(data.updatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`) : null,
        h('div', { class: 'card wx-now' }, h('span', { class: 'wx-symbol', 'aria-hidden': 'true' }, icon(now.icon)), h('div', null, h('div', { class: 'big' }, `${now.temp}°`), h('div', { class: 'muted' }, now.label))),
        h('div', { class: 'cards' }, stat('Feels like', `${now.feels}°`), stat('Humidity', `${now.humidity}%`), stat('Wind', `${now.wind} ${now.windUnit}`), stat('UV index', String(now.uv))),
        h('h2', null, 'Next hours'),
        h('div', { class: 'wx-hours' }, data.hours.map((hour) => h('div', { class: 'wx-hour' }, h('span', { class: 'tag' }, hourLabel(hour.time)), h('span', { 'aria-hidden': 'true' }, icon(hour.icon)), h('span', null, `${hour.temp}°`)))),
        h('h2', null, 'Next 7 days'),
        h('div', { class: 'list' }, data.days.map((day, i) => h('div', { class: 'item' }, h('span', { class: 'wx-day' }, i === 0 ? 'Today' : dayLabel(day.date)), h('span', { 'aria-hidden': 'true' }, icon(day.icon)), h('span', { class: 'grow muted' }, day.label), h('span', null, `${day.max}° / `, h('span', { class: 'muted' }, `${day.min}°`)))))].filter(Boolean)); // the stale note is null when online
    }

    async function load(force) {
      const data = await window.panel.weather.get(force);
      if (isGone) return;
      if (!data.place) drawSearch();
      else if (data.error) { box.replaceChildren(h('div', { class: 'empty' }, 'Could not get the weather. Check your internet.'), h('button', { class: 'btn', onClick: () => load(true) }, 'Try again')); }
      else draw(data);
    }

    box.replaceChildren(h('div', { class: 'empty' }, 'Loading…'));
    load(false);
    return () => { isGone = true; };
  },
});
