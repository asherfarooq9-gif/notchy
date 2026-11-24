// Routines: a named list of ordinary commands ("good morning" = date, battery, open Chrome).
// A routine can only hold commands that are safe without asking: nothing that shuts down, types, locks, or asks yes/no.
// Every step is checked when it is saved AND again right before it runs.
const { parseCommand } = require('./commands');

const MAX_ROUTINES = 8;
const MAX_STEPS = 10;
const MAX_NAME = 30;
const MAX_STEP_CHARS = 80;
const ALLOWED_TYPES = new Set(['app', 'url', 'folder', 'key', 'pc', 'panel', 'say']);
const WHY_NOT = {
  power: 'shutting down, restarting and sleeping are never allowed in a routine',
  typing: 'typing is never allowed in a routine',
  assistant: 'tasks are never allowed in a routine',
  lock: 'locking the screen is not allowed in a routine',
  reply: 'yes and no are not commands',
  routine: 'a routine cannot start another routine',
};

const normalizeName = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);

// {ok:true, cmd} when this phrase may be a step, else {ok:false, reason}.
function checkStep(phrase) {
  const text = typeof phrase === 'string' ? phrase.trim() : '';
  if (!text || text.length > MAX_STEP_CHARS) return { ok: false, reason: `a step is empty or longer than ${MAX_STEP_CHARS} letters` };
  const cmd = parseCommand(text);
  if (!cmd || cmd.type === 'unknown') return { ok: false, reason: `"${text}" is not a command I know` };
  if (cmd.confirm) return { ok: false, reason: `"${text}" asks yes or no first, so it is not allowed in a routine` };
  if (!ALLOWED_TYPES.has(cmd.type)) return { ok: false, reason: `"${text}": ${WHY_NOT[cmd.type] || 'not allowed in a routine'}` };
  return { ok: true, cmd };
}

// Returns {routines, errors}. A routine with any problem is dropped whole, and each problem is explained.
function checkRoutines(list) {
  const routines = [];
  const errors = [];
  if (!Array.isArray(list)) return { routines, errors };
  if (list.length > MAX_ROUTINES) errors.push(`At most ${MAX_ROUTINES} routines are kept.`);
  for (const item of list.slice(0, MAX_ROUTINES)) {
    const name = normalizeName(item && item.name);
    if (!name) { errors.push('A routine has no name.'); continue; }
    if (routines.some((r) => r.name === name)) continue; // same name twice: the first one wins
    const steps = item && Array.isArray(item.steps) ? item.steps.map((s) => (typeof s === 'string' ? s.trim() : '')) : [];
    if (steps.length === 0 || steps.length > MAX_STEPS) { errors.push(`Routine "${name}" needs 1 to ${MAX_STEPS} steps.`); continue; }
    const problem = steps.map(checkStep).find((r) => !r.ok);
    if (problem) { errors.push(`Routine "${name}": ${problem.reason}.`); continue; }
    routines.push({ name, steps });
  }
  return { routines, errors };
}

const findRoutine = (routines, spokenName) => (routines || []).find((r) => r.name === normalizeName(spokenName)) || null;

// perform(cmd) does one command and resolves with a sentence (or rejects). Stops at the first problem.
async function runRoutine(steps, perform) {
  let done = 0;
  for (const phrase of steps) {
    const step = checkStep(phrase);
    if (!step.ok) return { done, failed: step.reason };
    try { await perform(step.cmd); } catch (error) { return { done, failed: String((error && error.message) || 'A step did not work.') }; }
    done += 1;
  }
  return { done, failed: null };
}

module.exports = { checkRoutines, findRoutine, runRoutine, checkStep, normalizeName };
