// The first-run welcome screen: the four things the app asks about before it does them, plus which look to wear.
// Anything that is not exactly true counts as "no", so a wrong value can never switch a feature on.
const { THEMES } = require('./themes');

const CHOICES = ['autostart', 'autoUpdate', 'askClaude', 'assistantTasks'];

function applyWelcomeChoices(settings, choices) {
  const picked = {};
  for (const key of CHOICES) picked[key] = Boolean(choices) && choices[key] === true;
  // An unknown look is ignored, so the look they already have (the default on a fresh install) stays.
  if (choices && THEMES.includes(choices.theme)) picked.theme = choices.theme;
  return { ...settings, ...picked, setupDone: true };
}

module.exports = { CHOICES, applyWelcomeChoices };
