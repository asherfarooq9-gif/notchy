// Timers & Focus: pomodoro, countdown, stopwatch, and a water reminder. The timing itself runs in the main program.
registerModule({
  id: 'timers',
  title: 'Timers',
  mount(root) {
    const KINDS = [['pomodoro', 'Focus'], ['countdown', 'Countdown'], ['stopwatch', 'Stopwatch']];
    const PRESETS = [5, 10, 15, 30, 60];
    const PREVIEW = { pomodoro: '25:00', stopwatch: '00:00' };
    let kind = 'pomodoro';
    let minutes = 10;
    let shownKey = '';
    let latest = window.panelState.timer; // the newest timer snapshot, to redraw from when a choice changes

    const readout = h('div', { class: 'big' });
    const caption = h('div', { class: 'muted' });
    const setup = h('div', { class: 'grid-gap' });
    const controls = h('div', { class: 'row' });
    const waterBox = h('input', { type: 'checkbox', id: 'water-on', 'aria-label': 'Water reminder' });
    const waterMinutes = h('input', { type: 'number', min: '5', max: '240', value: '45', class: 'narrow', 'aria-label': 'Minutes between water reminders' });
    const saveWater = () => window.panel.timer.act('water', { isOn: waterBox.checked, minutes: Number(waterMinutes.value) });
    waterBox.addEventListener('change', saveWater);
    waterMinutes.addEventListener('change', saveWater);

    const act = (action, args) => window.panel.timer.act(action, args);
    const button = (label, className, onClick, iconName) => h('button', { class: 'btn ' + className, onClick }, iconName ? icon(iconName) : null, label);

    function drawSetup(isActive) {
      const segment = h('div', { class: 'segment' }, KINDS.map(([id, label]) => h('button', {
        class: id === kind ? 'active' : '',
        disabled: isActive,
        onClick: () => { kind = id; shownKey = ''; render(latest); },
      }, label)));
      const parts = [segment];
      if (kind === 'countdown' && !isActive) {
        parts.push(h('div', { class: 'row' },
          PRESETS.map((m) => h('button', { class: 'btn small' + (m === minutes ? ' primary' : ''), onClick: () => { minutes = m; shownKey = ''; render(latest); } }, m + ' min')),
          h('input', { type: 'number', min: '1', max: '1440', value: String(minutes), class: 'narrow', 'aria-label': 'Custom minutes', onChange: (e) => { minutes = Math.max(1, Number(e.target.value) || 1); shownKey = ''; render(latest); } })));
      }
      setup.replaceChildren(...parts);
    }

    function drawControls(snapshot) {
      const isActive = Boolean(snapshot && snapshot.kind);
      if (!isActive) controls.replaceChildren(button('Start', 'primary', () => act('start', { kind, minutes }), 'play'));
      else controls.replaceChildren(
        snapshot.isRunning ? button('Pause', '', () => act('pause'), 'pause') : button('Resume', 'primary', () => act('resume'), 'play'),
        button('Reset', '', () => act('reset'), 'reset'));
    }

    function render(snapshot) {
      const s = snapshot || {};
      const isActive = Boolean(s.kind);
      if (isActive) kind = s.kind;
      const key = [isActive, s.isRunning, kind, minutes].join();
      if (key !== shownKey) { shownKey = key; drawSetup(isActive); drawControls(s); }
      readout.textContent = isActive ? s.text : (kind === 'countdown' ? `${String(minutes).padStart(2, '0')}:00` : PREVIEW[kind]);
      if (kind === 'pomodoro' && isActive) caption.textContent = `${s.phase === 'focus' ? 'Focus' : 'Break'} · ${s.focusDone} done today`;
      else caption.textContent = isActive ? (s.isRunning ? 'Running' : 'Paused') : 'Ready';
      if (s.water) { waterBox.checked = s.water.isOn; if (document.activeElement !== waterMinutes) waterMinutes.value = String(s.water.minutes); }
    }

    root.append(
      h('h2', null, 'Timers & focus'),
      h('div', { class: 'card timer-card' }, readout, caption),
      setup,
      controls,
      h('h2', null, 'Water reminder'),
      h('label', { class: 'row', for: 'water-on' }, waterBox, h('span', { class: 'grow' }, 'Remind me to drink water every'), waterMinutes, h('span', { class: 'muted' }, 'min')));

    const off = bus.on('timer', (snapshot) => { latest = snapshot; render(snapshot); });
    window.panel.timer.get().then((snapshot) => { latest = snapshot; render(snapshot); });
    return off;
  },
});
