// System: CPU, memory, disk, Wi-Fi and battery, with the last minute of history.
registerModule({
  id: 'system',
  title: 'System',
  mount(root) {
    const HOT_PERCENT = 85;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    function sparkline() {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 60 40');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('class', 'spark');
      const line = document.createElementNS(SVG_NS, 'polyline');
      svg.append(line);
      svg.update = (values) => line.setAttribute('points', values.map((v, i) => `${(i / 59) * 60},${40 - (v / 100) * 38}`).join(' '));
      return svg;
    }

    function gauge(label) {
      const value = h('div', { class: 'mid' }, '-');
      const fill = h('div', { class: 'bar-fill' });
      const chart = sparkline();
      const element = h('div', { class: 'card' }, h('div', { class: 'row' }, h('span', { class: 'tag grow' }, label), value), h('div', { class: 'bar' }, fill), chart);
      return { element, set(percent, history) { value.textContent = percent + '%'; fill.style.width = percent + '%'; fill.classList.toggle('hot', percent >= HOT_PERCENT); if (history) chart.update(history); } };
    }

    const cpu = gauge('CPU');
    const memory = gauge('Memory');
    const diskText = h('div', { class: 'mid' }, '-');
    const diskFill = h('div', { class: 'bar-fill' });
    const wifiText = h('div', null, '-');
    const batteryText = h('div', null, '-');
    const disk = h('div', { class: 'card' }, h('div', { class: 'row' }, h('span', { class: 'tag grow' }, 'Disk'), diskText), h('div', { class: 'bar' }, diskFill));
    const others = h('div', { class: 'cards' },
      h('div', { class: 'card' }, h('span', { class: 'tag' }, 'Wi-Fi'), wifiText),
      h('div', { class: 'card' }, h('span', { class: 'tag' }, 'Battery'), batteryText));

    function show(stats) {
      if (!stats) return;
      cpu.set(stats.cpu, stats.history.cpu);
      memory.set(stats.mem, stats.history.mem);
      if (stats.disk) { diskText.textContent = `${stats.disk.usedPercent}% used · ${stats.disk.freeGb} GB free`; diskFill.style.width = stats.disk.usedPercent + '%'; }
      wifiText.textContent = stats.wifi ? `${stats.wifi.ssid}${stats.wifi.signal === null ? '' : ' · ' + stats.wifi.signal + '%'}` : 'Not on Wi-Fi';
    }

    function showBattery(battery) {
      batteryText.textContent = `${Math.round(battery.level * 100)}%${battery.charging ? ' · charging' : ''}`;
    }

    root.append(h('h2', null, 'This PC'), cpu.element, memory.element, disk, others);
    show(window.panelState.stats);
    const off = bus.on('stats', show);
    if (navigator.getBattery) {
      navigator.getBattery().then((battery) => { showBattery(battery); battery.addEventListener('levelchange', () => showBattery(battery)); }).catch(() => { batteryText.textContent = 'No battery'; });
    } else batteryText.textContent = 'No battery';
    return off;
  },
});
