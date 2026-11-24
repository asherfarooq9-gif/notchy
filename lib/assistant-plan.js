// Reads Claude's reply and checks every step of a plan before anything is shown to you or run.
// Claude can only name steps from a short fixed menu. Anything else, or any step that breaks a rule, makes the whole plan invalid.
const path = require('path');
const { checkSegment } = require('./assistant-paths');
const { isProgramFile } = require('./paths');
const { isPrivateHost } = require('./web');

const MAX_STEPS = 300;
const MAX_SUMMARY = 200;
const MAX_URL = 500;
const MAX_LIST_FOLDERS = 3;
const SMALL_PLAN_STEPS = 3; // a plan this small can be approved with a quick "yes"

// The JSON object in Claude's reply (it may add a sentence or a ```json fence around it).
function extractJson(text) {
  const clean = String(text || '').replace(/```(?:json)?/gi, '');
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(clean.slice(start, end + 1)); } catch { return null; }
}

// What Claude is asking for: to see folders, a plan, or "I can't do that".
function parseReply(text) {
  const reply = extractJson(text);
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) return { kind: 'bad', error: 'Claude did not answer in the expected form.' };
  if (typeof reply.cannot === 'string') return { kind: 'cannot', reason: reply.cannot.replace(/\s+/g, ' ').trim().slice(0, 200) };
  if (Array.isArray(reply.list)) {
    const folders = [...new Set(reply.list.filter((f) => typeof f === 'string'))].slice(0, MAX_LIST_FOLDERS);
    return folders.length ? { kind: 'list', folders } : { kind: 'bad', error: 'Claude asked to see nothing.' };
  }
  if (Array.isArray(reply.steps)) return { kind: 'plan', plan: { summary: reply.summary, steps: reply.steps } };
  return { kind: 'bad', error: 'Claude did not answer in the expected form.' };
}

const isText = (value) => typeof value === 'string' && value.length > 0;

// plan: {summary, steps}. kindOf(realPath) says 'file', 'dir' or null for what exists right now.
// Returns {ok, errors, steps, summary, warnings}. Steps carry real paths and a sentence that says what they do.
function validatePlan(plan, { resolver, kindOf }) {
  const errors = [];
  const warnings = [];
  const steps = [];
  const raw = plan && Array.isArray(plan.steps) ? plan.steps : [];
  if (raw.length === 0) errors.push('The plan has no steps.');
  if (raw.length > MAX_STEPS) errors.push(`The plan has too many steps (more than ${MAX_STEPS}).`);

  // What the folders will look like as the steps run, so a later step can use a folder an earlier step makes.
  const virtual = new Map();
  const keyOf = (abs) => abs.toLowerCase();
  const kind = (abs) => (virtual.has(keyOf(abs)) ? virtual.get(keyOf(abs)) : kindOf(abs));
  const remember = (abs, what) => virtual.set(keyOf(abs), what);
  const show = (abs) => resolver.display(abs);

  raw.slice(0, MAX_STEPS).forEach((step, index) => {
    const n = index + 1;
    const fail = (message) => errors.push(`Step ${n}: ${message}`);
    const place = (spec) => { const r = resolver.resolve(spec); if (!r.ok) { fail(r.error); return null; } return r; };
    if (!step || typeof step !== 'object') { fail('is not a step.'); return; }

    switch (step.op) {
      case 'makeFolder': {
        const target = place(step.path);
        if (!target) return;
        if (target.isRoot) { fail('that folder already exists.'); return; }
        if (kind(target.abs) === 'file') { fail(`a file called ${show(target.abs)} already exists.`); return; }
        if (kind(target.abs) === 'dir') { warnings.push(`${show(target.abs)} already exists, so it is left as it is.`); return; }
        for (let up = target.abs; resolver.contains(up); up = path.dirname(up)) remember(up, 'dir'); // the folders above it are made too
        steps.push({ op: 'makeFolder', abs: target.abs, text: `Make the folder ${show(target.abs)}` });
        return;
      }
      case 'move':
      case 'copy': {
        const from = place(step.from);
        const to = place(step.to);
        if (!from || !to) return;
        if (from.isRoot) { fail('a whole main folder cannot be moved or copied.'); return; }
        const what = kind(from.abs);
        if (!what) { fail(`${show(from.abs)} does not exist.`); return; }
        if (kind(to.abs) !== 'dir') { fail(`the destination ${show(to.abs)} is not a folder that exists (make it in an earlier step).`); return; }
        if (what === 'dir' && (keyOf(to.abs) === keyOf(from.abs) || keyOf(to.abs).startsWith(keyOf(from.abs) + path.sep))) { fail('a folder cannot go inside itself.'); return; }
        const landing = path.join(to.abs, path.basename(from.abs));
        if (step.op === 'move' && keyOf(landing) === keyOf(from.abs)) { warnings.push(`${show(from.abs)} is already in ${show(to.abs)}.`); return; }
        if (step.op === 'move') { remember(from.abs, null); remember(landing, what); } else remember(landing, what);
        const verb = step.op === 'move' ? 'Move' : 'Copy';
        steps.push({ op: step.op, fromAbs: from.abs, toAbs: to.abs, text: `${verb} ${path.basename(from.abs)} ${step.op === 'move' ? 'to' : 'into'} ${show(to.abs)}` });
        return;
      }
      case 'rename': {
        const target = place(step.path);
        if (!target) return;
        if (target.isRoot) { fail('a main folder cannot be renamed.'); return; }
        if (!isText(step.newName)) { fail('the new name is missing.'); return; }
        const problem = checkSegment(step.newName) || (/[\\/]/.test(step.newName) ? 'A new name cannot contain a slash.' : null);
        if (problem) { fail(problem); return; }
        if (!kind(target.abs)) { fail(`${show(target.abs)} does not exist.`); return; }
        const renamed = path.join(path.dirname(target.abs), step.newName);
        if (kind(renamed) && keyOf(renamed) !== keyOf(target.abs)) { fail(`${step.newName} already exists there.`); return; }
        const what = kind(target.abs);
        remember(target.abs, null); remember(renamed, what);
        steps.push({ op: 'rename', abs: target.abs, newName: step.newName, text: `Rename ${path.basename(target.abs)} to ${step.newName}` });
        return;
      }
      case 'trash': {
        const target = place(step.path);
        if (!target) return;
        if (target.isRoot) { fail('a whole main folder cannot be deleted.'); return; }
        if (!kind(target.abs)) { fail(`${show(target.abs)} does not exist.`); return; }
        remember(target.abs, null);
        steps.push({ op: 'trash', abs: target.abs, danger: 'trash', text: `Move ${show(target.abs)} to the Recycle Bin` });
        return;
      }
      case 'open': {
        const target = place(step.path);
        if (!target) return;
        if (!kind(target.abs)) { fail(`${show(target.abs)} does not exist.`); return; }
        if (isProgramFile(target.abs)) { fail('programs and scripts are never opened.'); return; }
        steps.push({ op: 'open', abs: target.abs, text: `Open ${show(target.abs)}` });
        return;
      }
      case 'openUrl': {
        let url;
        try { url = new URL(String(step.url)); } catch { fail('that is not a web address.'); return; }
        if (url.protocol !== 'https:' || isPrivateHost(url.hostname) || String(step.url).length > MAX_URL) { fail('only secure public web addresses can be opened.'); return; }
        steps.push({ op: 'openUrl', url: url.toString(), text: `Open the web page ${url.hostname}` });
        return;
      }
      default:
        fail(`"${String(step.op).slice(0, 30)}" is not something I can do.`);
    }
  });

  const summary = isText(plan && plan.summary) ? plan.summary.replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY) : 'Do the task';
  if (errors.length === 0 && steps.length === 0) errors.push('Everything in the plan is already done.');
  return { ok: errors.length === 0, errors, steps, summary, warnings };
}

// Facts that decide how a plan may be approved.
function planFacts(steps) {
  const hasTrash = steps.some((s) => s.op === 'trash');
  return { count: steps.length, hasTrash, canQuickApprove: steps.length > 0 && steps.length <= SMALL_PLAN_STEPS && !hasTrash };
}

module.exports = { parseReply, validatePlan, planFacts, extractJson, MAX_STEPS };
