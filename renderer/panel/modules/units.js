// Units: length, weight, temperature, data, volume, speed and time. The maths runs in the main program.
registerModule({
  id: 'units',
  title: 'Units',
  mount(root) {
    const MAX_RECENT = 10;
    let categories = [];
    let category = 'length';
    let recent = [];

    const categorySelect = h('select', { 'aria-label': 'What to convert' });
    const fromSelect = h('select', { 'aria-label': 'From unit' });
    const toSelect = h('select', { 'aria-label': 'To unit' });
    const valueInput = h('input', { type: 'number', value: '1', step: 'any', class: 'grow', 'aria-label': 'Amount' });
    const result = h('div', { class: 'big' }, '-');
    const error = h('div', { class: 'tag err' });
    const note = h('div', { class: 'tag' });
    let currencyNote = '';
    const recentBox = h('div', { class: 'list' });

    const unitsOf = () => (categories.find((c) => c.name === category) || { units: [] }).units;
    const fill = (select, units, chosen) => { select.replaceChildren(...units.map((u) => h('option', { value: u }, u))); select.value = chosen; };
    const clean = (n) => String(parseFloat(n.toPrecision(8)));

    function setCategory(name) {
      category = name;
      note.textContent = name === 'currency' && currencyNote ? currencyNote : '';
      const units = unitsOf();
      const isMoney = name === 'currency';
      fill(fromSelect, units, isMoney ? 'USD' : units[0]);
      fill(toSelect, units, isMoney ? 'EUR' : units[1] || units[0]);
      calculate(false);
    }

    async function calculate(remember) {
      error.textContent = '';
      const amount = Number(valueInput.value);
      if (valueInput.value === '' || !Number.isFinite(amount)) { result.textContent = '-'; return; }
      try {
        const run = category === 'currency' ? window.panel.currency.convert(amount, fromSelect.value, toSelect.value) : window.panel.units.convert(category, amount, fromSelect.value, toSelect.value);
        const out = clean(await run);
        result.textContent = `${out} ${toSelect.value}`;
        if (remember) remember_(`${clean(amount)} ${fromSelect.value} = ${out} ${toSelect.value}`);
      } catch (err) {
        error.textContent = 'Could not convert that.';
      }
    }

    function remember_(line) {
      recent = [line, ...recent.filter((r) => r !== line)].slice(0, MAX_RECENT);
      window.panel.data.set('unitsRecent', recent);
      drawRecent();
    }

    function drawRecent() {
      recentBox.replaceChildren(...recent.map((line) => h('div', { class: 'item clickable', role: 'button', tabindex: '0', title: 'Click to copy', onClick: () => window.panel.copyText(line) }, h('span', { class: 'grow' }, line), icon('copy'))));
    }

    categorySelect.addEventListener('change', () => setCategory(categorySelect.value));
    valueInput.addEventListener('input', () => calculate(false));
    valueInput.addEventListener('change', () => calculate(true));
    fromSelect.addEventListener('change', () => calculate(true));
    toSelect.addEventListener('change', () => calculate(true));
    const swap = h('button', { class: 'icon-btn', 'aria-label': 'Swap units', onClick: () => { const a = fromSelect.value; fromSelect.value = toSelect.value; toSelect.value = a; calculate(true); } }, icon('swap'));

    root.append(
      h('h2', null, 'Convert'),
      categorySelect,
      h('div', { class: 'row' }, valueInput, fromSelect, swap, toSelect),
      h('div', { class: 'card' }, result, error, note),
      h('h2', null, 'Recent'),
      recentBox);

    window.panel.units.meta().then(async (meta) => {
      categories = meta.categories;
      categorySelect.replaceChildren(...categories.map((c) => h('option', { value: c.name }, c.name[0].toUpperCase() + c.name.slice(1))));
      recent = await window.panel.data.get('unitsRecent', []);
      drawRecent();
      setCategory('length');
      // Money is added when the exchange rates can be had (online, or saved from before); without them the other units still work.
      window.panel.currency.meta().then((money) => {
        categories = [...categories, { name: 'currency', units: money.codes }];
        categorySelect.append(h('option', { value: 'currency' }, 'Currency'));
        currencyNote = `Rates from ${money.date}${money.stale ? ' (saved copy, offline)' : ''}. Updated on working days.`;
      }).catch(() => {});
    });
  },
});
