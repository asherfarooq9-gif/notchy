// Small helpers shared by the panel and its tools. Tools register themselves with registerModule().
(function () {
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    timers: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
    notes: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 10h8M8 14h8M8 18h5"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/>',
    links: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    system: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M8 21h8M12 16v5"/>',
    units: '<path d="M4 17L17 4l3 3L7 20z"/><path d="M8 13l2 2M11 10l2 2M14 7l2 2"/>',
    weather: '<circle cx="9" cy="9" r="3.5"/><path d="M9 2.5v1.5M2.5 9H4M4.4 4.4l1 1M13.6 4.4l-1 1"/><path d="M8 20h9a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 14a3 3 0 0 0 0 6z"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    shelf: '<path d="M3 8l2-4h14l2 4v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 8h18M9 12h6"/>',
    converter: '<rect x="3" y="4" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 15l-5-4-8 7M12 21h0"/>',
    screentime: '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>',
    folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    partly: '<circle cx="9" cy="9" r="3.5"/><path d="M9 2.5v1.5M2.5 9H4M4.4 4.4l1 1M13.6 4.4l-1 1"/><path d="M8 20h9a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 14a3 3 0 0 0 0 6z"/>',
    cloud: '<path d="M7 19h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 12.5 3.3 3.3 0 0 0 7 19z"/>',
    fog: '<path d="M7 14h10a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 6.6 8.4 3 3 0 0 0 7 14z"/><path d="M5 18h14M8 21h8"/>',
    rain: '<path d="M7 14h10a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 6.6 8.4 3 3 0 0 0 7 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
    snow: '<path d="M7 14h10a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 6.6 8.4 3 3 0 0 0 7 14z"/><path d="M8 18h.01M12 18h.01M16 18h.01M10 21h.01M14 21h.01" stroke-width="2.4"/>',
    storm: '<path d="M7 14h10a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 6.6 8.4 3 3 0 0 0 7 14z"/><path d="M12.5 14l-2 3.5h3L11.5 21"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    pin: '<path d="M12 17v5M8 3h8l-1 7 3 3v2H6v-2l3-3z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
    reset: '<path d="M4 12a8 8 0 1 1 3 6.2M4 19v-5h5"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    prev: '<path d="M6 5v14M19 5L9 12l10 7z"/>',
    next: '<path d="M18 5v14M5 5l10 7-10 7z"/>',
    message: '<path d="M4 5h16v11H9l-5 4z"/>',
    assistant: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  };

  // h('div', {class: 'x', onClick: fn}, child, 'text') builds a DOM element. Text is always added as text, never as HTML.
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === false || value == null) continue;
      if (key === 'class') el.className = value;
      else if (key === 'value' || key === 'checked') el[key] = value;
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else el.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      el.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  // The icon shapes above are fixed text in this file (never user data); the browser's SVG parser turns them into elements.
  function icon(name) {
    const wrapper = document.createElement('span');
    wrapper.className = 'icon';
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
    const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
    wrapper.append(document.importNode(svg, true));
    return wrapper;
  }

  const listeners = new Map();
  const bus = {
    on(event, callback) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(callback);
      return () => listeners.get(event).delete(callback);
    },
    emit(event, payload) {
      (listeners.get(event) || []).forEach((callback) => callback(payload));
    },
  };

  function debounce(fn, ms) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  const modules = new Map();
  window.registerModule = (definition) => modules.set(definition.id, definition);
  window.getModule = (id) => modules.get(id);
  // The latest values pushed from the main program, so a tool that opens later can show them at once.
  window.panelState = { music: { playing: false, title: '' }, timer: null, stats: null };
  Object.assign(window, { h, icon, bus, debounce });
})();
