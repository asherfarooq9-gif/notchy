// The settings window's moving parts: the left rail with its gliding marker, switching sections, and the saved/unsaved note.
(function () {
  const nav = document.getElementById('nav');
  const buttons = [...nav.querySelectorAll('button[data-pane]')];
  const panes = [...document.querySelectorAll('.pane')];
  const form = document.getElementById('form');
  const statusEl = document.getElementById('status');
  const title = document.getElementById('stage-title');
  const sub = document.getElementById('stage-sub');
  const SAVED_TEXT = 'All changes are saved.';

  // The slanted marker sits beside the open section. A CSS transition moves it, so a quick second click redirects it from wherever it is.
  function moveInk(button) {
    nav.style.setProperty('--ink-y', `${button.offsetTop}px`);
    nav.style.setProperty('--ink-h', `${button.offsetHeight}px`);
  }

  function open(id) {
    for (const pane of panes) pane.hidden = pane.id !== `pane-${id}`;
    for (const button of buttons) {
      const isThis = button.dataset.pane === id;
      if (isThis) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
      if (isThis) moveInk(button);
    }
    const pane = document.getElementById(`pane-${id}`);
    document.querySelector('.panes').scrollTop = 0;
    for (const el of [title, sub]) { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); } // replays the heading entrance
    title.textContent = pane.dataset.title;
    sub.textContent = pane.dataset.sub;
  }

  for (const button of buttons) button.addEventListener('click', () => open(button.dataset.pane));
  nav.addEventListener('keydown', (event) => { // up and down arrows walk the rail
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = buttons.findIndex((b) => b === document.activeElement);
    const next = buttons[(index + step + buttons.length) % buttons.length];
    next.focus();
    open(next.dataset.pane);
  });

  // Tells you when something changed and has not been saved yet.
  let isDirty = false;
  function markDirty() {
    if (isDirty) return;
    isDirty = true;
    form.dataset.dirty = 'true';
    statusEl.className = 'dirty';
    statusEl.textContent = 'You have unsaved changes.';
  }
  form.addEventListener('input', markDirty);
  form.addEventListener('change', markDirty);

  window.settingsUi = {
    markClean() {
      isDirty = false;
      delete form.dataset.dirty;
    },
  };

  statusEl.textContent = SAVED_TEXT;
  open('general');
  // the marker should not glide in from nowhere on first paint, so it is placed before transitions are switched on
  requestAnimationFrame(() => document.body.classList.add('ready'));
})();
