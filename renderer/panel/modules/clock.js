// Clock: your time, plus the time in cities you pick.
registerModule({
  id: 'clock',
  title: 'Clock',
  mount(root) {
    const CITIES = [
      ['London', 'Europe/London'], ['Dublin', 'Europe/Dublin'], ['Paris', 'Europe/Paris'], ['Berlin', 'Europe/Berlin'], ['Madrid', 'Europe/Madrid'],
      ['Rome', 'Europe/Rome'], ['Amsterdam', 'Europe/Amsterdam'], ['Stockholm', 'Europe/Stockholm'], ['Istanbul', 'Europe/Istanbul'], ['Moscow', 'Europe/Moscow'],
      ['Cairo', 'Africa/Cairo'], ['Lagos', 'Africa/Lagos'], ['Nairobi', 'Africa/Nairobi'], ['Johannesburg', 'Africa/Johannesburg'],
      ['Dubai', 'Asia/Dubai'], ['Riyadh', 'Asia/Riyadh'], ['Tehran', 'Asia/Tehran'], ['Karachi', 'Asia/Karachi'], ['Mumbai', 'Asia/Kolkata'],
      ['Kathmandu', 'Asia/Kathmandu'], ['Dhaka', 'Asia/Dhaka'], ['Bangkok', 'Asia/Bangkok'], ['Singapore', 'Asia/Singapore'], ['Hong Kong', 'Asia/Hong_Kong'],
      ['Shanghai', 'Asia/Shanghai'], ['Tokyo', 'Asia/Tokyo'], ['Seoul', 'Asia/Seoul'], ['Sydney', 'Australia/Sydney'], ['Auckland', 'Pacific/Auckland'],
      ['Honolulu', 'Pacific/Honolulu'], ['Anchorage', 'America/Anchorage'], ['Los Angeles', 'America/Los_Angeles'], ['Vancouver', 'America/Vancouver'],
      ['Chicago', 'America/Chicago'], ['Mexico City', 'America/Mexico_City'], ['New York', 'America/New_York'], ['Toronto', 'America/Toronto'],
      ['Bogota', 'America/Bogota'], ['Sao Paulo', 'America/Sao_Paulo'], ['Buenos Aires', 'America/Argentina/Buenos_Aires'],
    ];
    const DEFAULT_CLOCKS = [{ name: 'New York', tz: 'America/New_York' }, { name: 'London', tz: 'Europe/London' }, { name: 'Tokyo', tz: 'Asia/Tokyo' }];
    const MAX_CLOCKS = 20;
    let clocks = [];

    // The date's own locale methods follow your Windows time format (12 or 24 hour).
    const timeOf = (date, timeZone) => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone });
    const dayOf = (date, timeZone) => date.toLocaleDateString('en-CA', { timeZone }); // yyyy-mm-dd, easy to compare
    function dayWord(date, timeZone) {
      const local = dayOf(date);
      const there = dayOf(date, timeZone);
      if (there === local) return 'Today';
      return there > local ? 'Tomorrow' : 'Yesterday';
    }

    const localTime = h('div', { class: 'big' });
    const localDate = h('div', { class: 'muted' });
    const list = h('div', { class: 'list' });
    const picker = h('select', { 'aria-label': 'Add a city' }, h('option', { value: '' }, 'Add a city…'), CITIES.map(([name, tz]) => h('option', { value: tz }, name)));

    function drawList() {
      const now = new Date();
      if (clocks.length === 0) { list.replaceChildren(h('div', { class: 'empty' }, 'No cities yet. Add one below.')); return; }
      list.replaceChildren(...clocks.map((c, index) => h('div', { class: 'item' },
        h('div', { class: 'grow' }, h('div', null, c.name), h('div', { class: 'tag' }, dayWord(now, c.tz))),
        h('div', { class: 'mid' }, timeOf(now, c.tz)),
        h('button', { class: 'icon-btn', 'aria-label': 'Remove ' + c.name, onClick: () => remove(index) }, icon('x')))));
    }

    function update() {
      const now = new Date();
      localTime.textContent = timeOf(now);
      localDate.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      drawList();
    }

    const save = () => window.panel.data.set('clocks', clocks);
    function remove(index) { clocks = clocks.filter((_, i) => i !== index); save(); update(); }
    picker.addEventListener('change', () => {
      const tz = picker.value;
      const city = CITIES.find(([, zone]) => zone === tz);
      if (city && !clocks.some((c) => c.tz === tz) && clocks.length < MAX_CLOCKS) { clocks = [...clocks, { name: city[0], tz }]; save(); }
      picker.value = '';
      update();
    });

    root.append(h('h2', null, 'Your time'), h('div', { class: 'card' }, localTime, localDate), h('h2', null, 'Cities'), list, picker);
    window.panel.data.get('clocks', null).then((saved) => { clocks = Array.isArray(saved) ? saved : DEFAULT_CLOCKS; update(); });
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  },
});
