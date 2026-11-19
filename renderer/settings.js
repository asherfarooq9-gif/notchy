const form = document.getElementById('form');
const statusEl = document.getElementById('status');
const fields = {
  autostart: document.getElementById('autostart'),
  hideUntilCalled: document.getElementById('hideUntilCalled'),
  reactiveHero: document.getElementById('reactiveHero'),
  routines: document.getElementById('routines'),
  alertsWhileHidden: document.getElementById('alertsWhileHidden'),
  danceOnMusic: document.getElementById('danceOnMusic'),
  wakeWord: document.getElementById('wakeWord'),
  talkBack: document.getElementById('talkBack'),
  askClaude: document.getElementById('askClaude'),
  pcControl: document.getElementById('pcControl'),
  assistantTasks: document.getElementById('assistantTasks'),
  showTimeInNotch: document.getElementById('showTimeInNotch'),
  showBatteryInNotch: document.getElementById('showBatteryInNotch'),
  stepAside: document.getElementById('stepAside'),
  showMusicActivity: document.getElementById('showMusicActivity'),
  showVolumeBar: document.getElementById('showVolumeBar'),
  showCopiedTick: document.getElementById('showCopiedTick'),
  edgeLight: document.getElementById('edgeLight'),
  edgeColor: document.getElementById('edgeColor'),
  theme: document.getElementById('theme'),
  colorMode: document.getElementById('colorMode'),
  hoverOpen: document.getElementById('hoverOpen'),
  showTimerInNotch: document.getElementById('showTimerInNotch'),
  panelHotkey: document.getElementById('panelHotkey'),
  captureHotkey: document.getElementById('captureHotkey'),
  commandHotkey: document.getElementById('commandHotkey'),
  wakeSensitivity: document.getElementById('wakeSensitivity'),
  notifyKeyword: document.getElementById('notifyKeyword'),
  sleepMinutes: document.getElementById('sleepMinutes'),
  voiceHotkey: document.getElementById('voiceHotkey'),
};

function fill(settings) {
  fields.autostart.checked = settings.autostart;
  fields.hideUntilCalled.checked = settings.hideUntilCalled;
  fields.reactiveHero.checked = settings.reactiveHero;
  fields.routines.value = settings.routines.map((r) => `${r.name}: ${r.steps.join('; ')}`).join('\n');
  fields.alertsWhileHidden.checked = settings.alertsWhileHidden;
  fields.danceOnMusic.checked = settings.danceOnMusic;
  fields.wakeWord.checked = settings.wakeWord;
  fields.talkBack.checked = settings.talkBack;
  fields.askClaude.checked = settings.askClaude;
  fields.pcControl.checked = settings.pcControl;
  fields.assistantTasks.checked = settings.assistantTasks;
  fields.wakeSensitivity.value = settings.wakeSensitivity;
  fields.notifyKeyword.value = settings.notifyKeyword;
  fields.sleepMinutes.value = settings.sleepMinutes;
  fields.voiceHotkey.value = settings.voiceHotkey;
  fields.showTimeInNotch.checked = settings.showTimeInNotch;
  fields.showBatteryInNotch.checked = settings.showBatteryInNotch;
  fields.stepAside.checked = settings.stepAside;
  fields.showMusicActivity.checked = settings.showMusicActivity;
  fields.showVolumeBar.checked = settings.showVolumeBar;
  fields.showCopiedTick.checked = settings.showCopiedTick;
  fields.edgeLight.value = settings.edgeLight;
  fields.edgeColor.value = settings.edgeColor;
  fields.theme.value = settings.theme;
  previewLook(settings.theme);
  fields.colorMode.value = settings.colorMode;
  previewMode(settings.colorMode);
  fields.hoverOpen.checked = settings.hoverOpen;
  fields.showTimerInNotch.checked = settings.showTimerInNotch;
  fields.panelHotkey.value = settings.panelHotkey;
  fields.captureHotkey.value = settings.captureHotkey;
  fields.commandHotkey.value = settings.commandHotkey;
  moduleOrder = [...settings.modules];
  drawModules();
}

// The panel's tools: tick to show, arrows to reorder. Unticked tools are listed at the end.
let allModules = [];
let moduleOrder = [];
const modulesBox = document.getElementById('modules');

function moveModule(id, step) {
  const index = moduleOrder.indexOf(id);
  const target = index + step;
  if (index < 0 || target < 0 || target >= moduleOrder.length) return;
  [moduleOrder[index], moduleOrder[target]] = [moduleOrder[target], moduleOrder[index]];
  drawModules();
}

function toggleModule(id, isOn) {
  if (isOn && !moduleOrder.includes(id)) moduleOrder = [...moduleOrder, id];
  if (!isOn && moduleOrder.length > 1) moduleOrder = moduleOrder.filter((m) => m !== id); // at least one tool stays
  drawModules();
}

function drawModules() {
  const ids = [...moduleOrder, ...allModules.map((m) => m.id).filter((id) => !moduleOrder.includes(id))];
  modulesBox.replaceChildren(...ids.map((id) => {
    const info = allModules.find((m) => m.id === id);
    const isOn = moduleOrder.includes(id);
    const row = document.createElement('div');
    row.className = 'mod' + (isOn ? '' : ' off');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = isOn;
    box.setAttribute('aria-label', 'Show ' + (info ? info.title : id));
    box.addEventListener('change', () => toggleModule(id, box.checked));
    const name = document.createElement('span');
    name.textContent = info ? info.title : id;
    row.append(box, name);
    if (isOn) {
      for (const [label, step, text] of [['Move up', -1, '↑'], ['Move down', 1, '↓']]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.setAttribute('aria-label', `${label}: ${info ? info.title : id}`);
        button.addEventListener('click', () => moveModule(id, step));
        row.append(button);
      }
    }
    return row;
  }));
}

function show(message, kind) {
  statusEl.textContent = message;
  statusEl.className = kind;
}

// "good morning: battery; open chrome" -> {name, steps}. The program checks every step when saving and explains any problem.
function parseRoutineLines(text) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const colon = line.indexOf(':');
    return colon < 0 ? { name: line, steps: [] } : { name: line.slice(0, colon), steps: line.slice(colon + 1).split(';').map((s) => s.trim()).filter(Boolean) };
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const result = await window.settingsApi.save({
    autostart: fields.autostart.checked,
    hideUntilCalled: fields.hideUntilCalled.checked,
    reactiveHero: fields.reactiveHero.checked,
    routines: parseRoutineLines(fields.routines.value),
    alertsWhileHidden: fields.alertsWhileHidden.checked,
    danceOnMusic: fields.danceOnMusic.checked,
    wakeWord: fields.wakeWord.checked,
    talkBack: fields.talkBack.checked,
    askClaude: fields.askClaude.checked,
    pcControl: fields.pcControl.checked,
    assistantTasks: fields.assistantTasks.checked,
    showTimeInNotch: fields.showTimeInNotch.checked,
    showBatteryInNotch: fields.showBatteryInNotch.checked,
    stepAside: fields.stepAside.checked,
    showMusicActivity: fields.showMusicActivity.checked,
    showVolumeBar: fields.showVolumeBar.checked,
    showCopiedTick: fields.showCopiedTick.checked,
    edgeLight: fields.edgeLight.value,
    edgeColor: fields.edgeColor.value,
    theme: fields.theme.value,
    colorMode: fields.colorMode.value,
    hoverOpen: fields.hoverOpen.checked,
    showTimerInNotch: fields.showTimerInNotch.checked,
    panelHotkey: fields.panelHotkey.value.trim(),
    captureHotkey: fields.captureHotkey.value.trim(),
    commandHotkey: fields.commandHotkey.value.trim(),
    modules: moduleOrder,
    wakeSensitivity: Number(fields.wakeSensitivity.value),
    notifyKeyword: fields.notifyKeyword.value,
    sleepMinutes: Number(fields.sleepMinutes.value),
    voiceHotkey: fields.voiceHotkey.value.trim(),
  });
  if (result.ok) {
    fill(result.settings);
    if (window.settingsUi) window.settingsUi.markClean();
    show('Saved.', 'ok');
  } else {
    show(result.error, 'error');
  }
});

document.getElementById('test').addEventListener('click', () => window.settingsApi.testNotify());
document.getElementById('quit').addEventListener('click', () => window.settingsApi.quit());

const micButton = document.getElementById('micTest');
const micLevel = document.getElementById('micLevel');
const micHeard = document.getElementById('micHeard');
const QUIET_LEVEL = 20; // out of 100: below this the microphone is too quiet for good recognition
let isTesting = false;
let peakLevel = 0;
let heardCount = 0;

// Explains what the test found when it ends without hearing the phrase.
function explainMicResult() {
  if (heardCount > 0) return;
  if (peakLevel === 0) {
    micHeard.textContent = 'No sound reached the microphone. Check that the right microphone is the default one and is not muted in Windows Sound settings.';
  } else if (peakLevel < QUIET_LEVEL) {
    micHeard.textContent = `Your microphone is very quiet (the loudest was ${peakLevel} out of 100). Raise its Input volume in Windows Sound settings, or speak closer to it.`;
  } else {
    micHeard.textContent = `The microphone works (the loudest was ${peakLevel} out of 100), but I did not hear “Hey Batman”. Try a higher sensitivity.`;
  }
}

micButton.addEventListener('click', () => (isTesting ? window.settingsApi.stopMicTest() : window.settingsApi.startMicTest()));
window.settingsApi.onMicTest((message) => {
  switch (message.kind) {
    case 'started':
      isTesting = true;
      peakLevel = 0;
      heardCount = 0;
      micLevel.value = 0;
      micButton.textContent = 'Stop test';
      micHeard.textContent = `Listening for ${message.seconds} seconds. Say “Hey Batman”…`;
      break;
    case 'stopped':
      isTesting = false;
      micLevel.value = 0;
      micButton.textContent = 'Test microphone';
      explainMicResult();
      break;
    case 'level':
      micLevel.value = message.level;
      peakLevel = Math.max(peakLevel, message.level);
      break;
    case 'heard':
      heardCount += 1;
      micHeard.textContent = `Heard “${message.text}”, ${Math.round(message.confidence * 100)}% sure. ` +
        (message.wouldWake ? 'That would wake him. ✓' : 'Not sure enough to wake him. Try a higher sensitivity.');
      break;
    case 'error':
      isTesting = false;
      micHeard.textContent = message.text;
      break;
    default:
      break;
  }
});

// The look list comes from the main program. Picking a look previews it in this window and also offers its color for the notch's edge light.
let themeInfo = [];
const looksBox = document.getElementById('looks');

// This window wears the look too (before Save): its colors, the portrait, the big faint face, and the matching card.
function previewLook(id) {
  document.body.dataset.theme = id;
  window.Packs.paint(document.body, themeInfo.find((t) => t.id === id && t.isPack) || null);
  for (const card of looksBox.children) {
    const isThis = card.dataset.theme === id;
    card.setAttribute('aria-checked', String(isThis));
    card.tabIndex = isThis ? 0 : -1;
  }
  const face = window.Heroes.faceFor(id);
  document.getElementById('portrait').replaceChildren(window.Heroes.element(face));
  document.getElementById('heroMark').replaceChildren(window.Heroes.element(face));
  const info = themeInfo.find((t) => t.id === id);
  document.getElementById('lookName').textContent = info ? `${info.label} look` : '';
}

// Light or dark: the thumb slides and the whole window changes at once.
function previewMode(mode) {
  document.body.dataset.mode = mode;
  for (const button of document.querySelectorAll('.mode button')) button.setAttribute('aria-checked', String(button.dataset.mode === mode));
}
for (const button of document.querySelectorAll('.mode button')) {
  button.addEventListener('click', () => {
    if (fields.colorMode.value === button.dataset.mode) return;
    fields.colorMode.value = button.dataset.mode;
    previewMode(button.dataset.mode);
    form.requestSubmit(); // light and dark apply to the whole app straight away
  });
}

function chooseLook(id) {
  fields.theme.value = id;
  fields.theme.dispatchEvent(new Event('change', { bubbles: true })); // updates the edge light color and marks the form as changed
  previewLook(id);
}

function buildLooks() {
  looksBox.replaceChildren(...themeInfo.map((t) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'look';
    card.dataset.theme = t.id; // the card wears its own look, so its colors are the real ones
    if (t.isPack) window.Packs.paint(card, t);
    card.setAttribute('role', 'radio');
    const swatch = document.createElement('span');
    swatch.className = 'look-face';
    swatch.append(window.Heroes.element(window.Heroes.faceFor(t.id)));
    const name = document.createElement('span');
    name.className = 'look-name';
    name.textContent = t.label;
    card.append(swatch, name);
    card.addEventListener('click', () => chooseLook(t.id));
    card.addEventListener('keydown', (event) => { // arrow keys move through the looks, like a radio group
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = themeInfo[(themeInfo.findIndex((x) => x.id === t.id) + step + themeInfo.length) % themeInfo.length];
      chooseLook(next.id);
      looksBox.querySelector(`[data-theme="${next.id}"]`).focus();
    });
    return card;
  }));
}

document.getElementById('openPacks').addEventListener('click', () => window.settingsApi.openPacks());
fields.theme.addEventListener('change', () => {
  const chosen = themeInfo.find((t) => t.id === fields.theme.value);
  if (chosen) fields.edgeColor.value = chosen.accent;
});

Promise.all([window.settingsApi.meta(), window.settingsApi.get()]).then(([meta, settings]) => {
  allModules = meta.modules;
  themeInfo = meta.themes;
  window.Heroes.setPacks(themeInfo.filter((t) => t.isPack));
  if (meta.packProblems.length) document.getElementById('packsNote').textContent = 'Skipped: ' + meta.packProblems.join(' ');
  fields.theme.replaceChildren(...themeInfo.map((t) => {
    const option = document.createElement('option');
    option.value = t.id;
    option.textContent = t.label;
    return option;
  }));
  buildLooks();
  fill(settings);
});
