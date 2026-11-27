const CHOICES = ['autostart', 'autoUpdate', 'askClaude', 'assistantTasks'];
const finishButton = document.getElementById('finish');
const errorLine = document.getElementById('error');

async function start() {
  const settings = await window.welcomeApi.get();
  for (const id of CHOICES) document.getElementById(id).checked = settings[id] === true;
  document.getElementById('panelKey').textContent = settings.panelHotkey;
}

async function finish() {
  finishButton.disabled = true;
  errorLine.hidden = true;
  const choices = {};
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
