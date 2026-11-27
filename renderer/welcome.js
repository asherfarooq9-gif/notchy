const CHOICES = ['autostart', 'autoUpdate', 'askClaude', 'assistantTasks'];
const finishButton = document.getElementById('finish');
const errorLine = document.getElementById('error');
const looksBox = document.getElementById('looks');
let chosenLook = '';

function chooseLook(id) {
  chosenLook = id;
  for (const card of looksBox.children) card.setAttribute('aria-checked', String(card.dataset.look === id));
}

function buildLooks(looks) {
  looksBox.replaceChildren(...looks.map((look) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'look';
    card.dataset.look = look.id;
    card.setAttribute('role', 'radio');
    const face = document.createElement('span');
    face.className = 'look-face';
    face.append(window.Heroes.element(look.id));
    card.append(face, look.label);
    card.addEventListener('click', () => chooseLook(look.id));
    return card;
  }));
}

async function start() {
  const [settings, meta, faces] = await Promise.all([window.welcomeApi.get(), window.welcomeApi.meta(), window.welcomeApi.faces().catch(() => ({}))]);
  window.Heroes.setPhotos(faces); // your own face pictures, when you have them
  for (const id of CHOICES) document.getElementById(id).checked = settings[id] === true;
  document.getElementById('panelKey').textContent = settings.panelHotkey;
  buildLooks(meta.themes.filter((look) => !look.isPack));
  chooseLook(settings.theme);
}

async function finish() {
  finishButton.disabled = true;
  errorLine.hidden = true;
  const choices = { theme: chosenLook };
  for (const id of CHOICES) choices[id] = document.getElementById(id).checked;
  const result = await window.welcomeApi.finish(choices);
  if (result && result.ok === false) {
    errorLine.textContent = result.error || 'Could not save. Please try again.';
    errorLine.hidden = false;
    finishButton.disabled = false;
  }
}

finishButton.addEventListener('click', finish);
start().catch((err) => {
  errorLine.textContent = 'Could not load your settings: ' + err.message;
  errorLine.hidden = false;
});
