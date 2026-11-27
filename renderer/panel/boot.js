// Builds the tab row, switches between tools, and passes the main program's updates on to them.
(function () {
  const tabsEl = document.getElementById('tabs');
  const contentEl = document.getElementById('content');
  let enabled = [];
  let activeId = null;
  let cleanup = null;

  function select(id) {
    if (cleanup) cleanup();
    cleanup = null;
    contentEl.replaceChildren();
    const definition = window.getModule(id);
    if (!definition) return;
    activeId = id;
    for (const tab of tabsEl.querySelectorAll('.tab')) tab.classList.toggle('active', tab.dataset.id === id);
    moveInk();
    const root = h('div', { class: 'module', 'data-module': id });
    contentEl.append(root);
    cleanup = definition.mount(root, { go: select, copy: window.panel.copyText, openUrl: window.panel.openUrl }) || null;
  }

  // The slanted marker under the open tab glides there on a spring (CSS transitions retarget from where they are, so it is interruptible).
  function moveInk() {
    const tab = tabsEl.querySelector('.tab.active');
    if (!tab) return;
    tabsEl.style.setProperty('--ink-x', `${tab.offsetLeft}px`);
    tabsEl.style.setProperty('--ink-w', `${tab.offsetWidth}px`);
  }

  // The chosen character's face: small in the dock, large and faint in the corner (Batman for the plain looks).
  let currentLook = 'batman';
  function faceBadge() {
    return h('span', { class: 'tab-face', 'aria-hidden': 'true' }, window.Heroes.element(window.Heroes.faceFor(currentLook)));
  }

  function buildTabs(modules) {
    enabled = modules.filter((m) => window.getModule(m.id));
    tabsEl.replaceChildren(...enabled.map((m) => h('button', { class: 'tab', 'data-id': m.id, title: m.title, 'aria-label': m.title, onClick: () => select(m.id) }, icon(m.id), h('span', { class: 'tab-label' }, m.title))), h('span', { class: 'tab-ink', 'aria-hidden': 'true' }));
    tabsEl.prepend(faceBadge());
    const stillThere = enabled.some((m) => m.id === activeId);
    select(stillThere ? activeId : (enabled[0] || {}).id);
  }

  let settingsCall = 0;
  const photosReady = Promise.all([window.Packs.loadPhotos(window.panel.faces), window.Packs.loadTraced(window.panel.traced)]); // your own faces, fetched once
  const applySettings = async (s) => {
    const mine = ++settingsCall;
    await photosReady;
    if (mine !== settingsCall) return;
    document.body.dataset.mode = s.colorMode || 'light';
    let theme = s.theme;
    let packs = [];
    if (theme.startsWith('pack-')) {
      try { packs = await window.Packs.refresh(window.panel.packs); } catch { theme = 'batman'; } // the pack could not be loaded: default look
      if (mine !== settingsCall) return; // newer settings arrived while this one loaded
    }
    document.body.dataset.theme = theme;
    currentLook = theme;
    window.Packs.paint(document.body, packs.find((p) => p.id === theme) || null);
    document.getElementById('heroMark').replaceChildren(window.Heroes.element(window.Heroes.faceFor(theme)));
    buildTabs(s.modules);
  };
  window.panel.settings().then(applySettings);
  window.panel.onSettings(applySettings);
  window.panel.onTimer((snapshot) => { window.panelState.timer = snapshot; bus.emit('timer', snapshot); });
  window.panel.onStats((stats) => { window.panelState.stats = stats; bus.emit('stats', stats); });
  window.panel.onClipboard(() => bus.emit('clipboard'));
  window.panel.onCapture(() => { select('notes'); bus.emit('capture'); }); // quick capture: a fresh note, ready to type
  window.panel.onCommand(() => { select('home'); bus.emit('command'); }); // the command hotkey: Home, with the box ready to type in
  window.panel.onPhone((view) => bus.emit('phone', view));
  window.panel.onMusic((music) => { window.panelState.music = music; bus.emit('music', music); });
  window.panel.timer.get().then((snapshot) => { window.panelState.timer = snapshot; });

  window.panel.onShown(() => {
    document.body.classList.add('shown');
    window.panel.timer.get().then((snapshot) => { window.panelState.timer = snapshot; bus.emit('timer', snapshot); });
    if (activeId) select(activeId); // freshest view each time it opens
  });
  window.panel.onHiding(() => document.body.classList.remove('shown'));

  // A dropped file must never make the panel navigate to it, wherever it lands.
  const isFileDrag = (event) => Array.from((event.dataTransfer || {}).types || []).includes('Files');
  document.addEventListener('dragover', (event) => { if (isFileDrag(event)) event.preventDefault(); });
  document.addEventListener('drop', (event) => { if (isFileDrag(event)) event.preventDefault(); });
  // Holding a file over a file-friendly tab for half a second opens it, so you can drop without clicking first.
  const SPRING_TABS = new Set(['shelf', 'converter']);
  let springTimer = null;
  tabsEl.addEventListener('dragenter', (event) => {
    const tab = event.target.closest && event.target.closest('.tab');
    clearTimeout(springTimer);
    if (tab && SPRING_TABS.has(tab.dataset.id) && tab.dataset.id !== activeId && isFileDrag(event)) springTimer = setTimeout(() => select(tab.dataset.id), 500);
  });
  tabsEl.addEventListener('dragleave', () => clearTimeout(springTimer));
  document.addEventListener('drop', () => clearTimeout(springTimer));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') window.panel.hide();
  });

  // While a text box has focus the panel stays open even if the mouse wanders off.
  const isTextField = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'range'));
  document.addEventListener('focusin', (event) => window.panel.setEditing(isTextField(event.target)));
  document.addEventListener('focusout', () => window.panel.setEditing(false));
})();
