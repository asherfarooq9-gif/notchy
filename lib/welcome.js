// The first-run welcome screen: the four things the app asks about before it does them.
// Anything that is not exactly true counts as "no", so a wrong value can never switch a feature on.
const CHOICES = ['autostart', 'autoUpdate', 'askClaude', 'assistantTasks'];

function applyWelcomeChoices(settings, choices) {
  const picked = {};
  for (const key of CHOICES) picked[key] = Boolean(choices) && choices[key] === true;
  return { ...settings, ...picked, setupDone: true };
}

module.exports = { CHOICES, applyWelcomeChoices };
