// Runs a checked plan, one step at a time, and remembers how to undo each change.
// Every path is checked AGAIN here (a second lock after the plan checker). Nothing is ever overwritten: a name that is
// taken gets " (2)" added. Deleting only means "to the Recycle Bin", which this program cannot undo.
const nodeFs = require('fs');
const path = require('path');
const { isProgramFile } = require('./paths');

const MAX_UNIQUE_TRIES = 1000;

async function exists(fs, abs) {
  try { await fs.lstat(abs); return true; } catch { return false; }
}

// "report.pdf" -> "report (2).pdf" -> "report (3).pdf" ... the first name that is free.
async function uniquePath(fs, folder, name) {
  const { name: stem, ext } = path.parse(name);
  for (let n = 1; n < MAX_UNIQUE_TRIES; n++) {
    const candidate = path.join(folder, n === 1 ? name : `${stem} (${n})${ext}`);
    if (!(await exists(fs, candidate))) return candidate;
  }
  throw new Error('Too many files with that name.');
}

function friendlyError(error, what) {
  if (error && (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES')) return `Could not change ${what}. It may be open in another program.`;
  if (error && error.code === 'EXDEV') return `Could not move ${what} to another drive.`;
  if (error && error.code === 'ENOENT') return `${what} is no longer there.`;
  return `Could not change ${what}.`;
}

function createRunner({ resolver, trashItem, openPath, openExternal, fs = nodeFs.promises }) {
  const must = (abs) => { if (!resolver.within(abs)) throw new Error('That is outside the folders I am allowed to use.'); };
  const mustBeInside = (abs) => { if (!resolver.contains(abs)) throw new Error('That is outside the folders I am allowed to use.'); };

  // One step. Returns {text, undo?} or throws a sentence that says what went wrong.
  async function doStep(step) {
    switch (step.op) {
      case 'makeFolder': {
        mustBeInside(step.abs);
        if (await exists(fs, step.abs)) return { text: 'Already there' };
        await fs.mkdir(step.abs, { recursive: true });
        return { text: 'Made the folder', undo: { op: 'removeFolder', abs: step.abs } };
      }
      case 'move': {
        mustBeInside(step.fromAbs); must(step.toAbs);
        if (!(await exists(fs, step.fromAbs))) throw new Error(`${path.basename(step.fromAbs)} is no longer there.`);
        const folder = await fs.stat(step.toAbs).catch(() => null);
        if (!folder || !folder.isDirectory()) throw new Error(`The folder ${path.basename(step.toAbs)} does not exist.`);
        const landing = await uniquePath(fs, step.toAbs, path.basename(step.fromAbs));
        await fs.rename(step.fromAbs, landing);
        return { text: `Moved to ${path.basename(path.dirname(landing))}`, undo: { op: 'moveBack', from: landing, to: step.fromAbs } };
      }
      case 'rename': {
        mustBeInside(step.abs);
        const renamed = path.join(path.dirname(step.abs), step.newName);
        mustBeInside(renamed);
        if (!(await exists(fs, step.abs))) throw new Error(`${path.basename(step.abs)} is no longer there.`);
        if (await exists(fs, renamed)) throw new Error(`${step.newName} already exists there.`);
        await fs.rename(step.abs, renamed);
        return { text: 'Renamed', undo: { op: 'moveBack', from: renamed, to: step.abs } };
      }
      case 'copy': {
        mustBeInside(step.fromAbs); must(step.toAbs);
        if (!(await exists(fs, step.fromAbs))) throw new Error(`${path.basename(step.fromAbs)} is no longer there.`);
        const landing = await uniquePath(fs, step.toAbs, path.basename(step.fromAbs));
        await fs.cp(step.fromAbs, landing, { recursive: true, errorOnExist: true, force: false });
        return { text: 'Copied', undo: { op: 'trashCopy', abs: landing } };
      }
      case 'trash': {
        mustBeInside(step.abs);
        if (!(await exists(fs, step.abs))) throw new Error(`${path.basename(step.abs)} is no longer there.`);
        await trashItem(step.abs);
        return { text: 'Moved to the Recycle Bin' }; // no undo here: use the Recycle Bin to restore it
      }
      case 'open': {
        must(step.abs);
        if (isProgramFile(step.abs)) throw new Error('Programs and scripts are never opened.');
        const problem = await openPath(step.abs);
        if (problem) throw new Error(`Could not open ${path.basename(step.abs)}.`);
        return { text: 'Opened' };
      }
      case 'openUrl': {
        if (!/^https:\/\//i.test(step.url)) throw new Error('Only secure web addresses are opened.');
        await openExternal(step.url);
        return { text: 'Opened' };
      }
      default:
        throw new Error('That is not something I can do.');
    }
  }

  return {
    // Runs the steps in order. Stops at the first problem, or when isStopped() says so.
    // Returns {results: [{ok, text, step}], undo: [...], stopped}. Steps that did not run have ok: null.
    async run(steps, { onProgress = () => {}, isStopped = () => false } = {}) {
      const results = steps.map((step) => ({ ok: null, text: 'Not done', step: step.text }));
      const undo = [];
      let stopped = false;
      for (let i = 0; i < steps.length; i++) {
        if (isStopped()) { stopped = true; results.slice(i).forEach((r) => { r.text = 'Stopped before this step'; }); break; }
        try {
          const done = await doStep(steps[i]);
          results[i] = { ok: true, text: done.text, step: steps[i].text };
          if (done.undo) undo.push(done.undo);
        } catch (error) {
          const reason = error && error.code ? friendlyError(error, path.basename(String(steps[i].fromAbs || steps[i].abs || 'the item'))) : String((error && error.message) || 'That did not work.');
          results[i] = { ok: false, text: reason, step: steps[i].text };
          results.slice(i + 1).forEach((r) => { r.text = 'Skipped because an earlier step failed'; });
          onProgress(i + 1, steps.length, results);
          break;
        }
        onProgress(i + 1, steps.length, results);
      }
      return { results, undo, stopped };
    },

    // Puts things back, newest change first. A step is skipped (never forced) if something got in the way.
    async undo(undoList) {
      const outcome = { undone: 0, skipped: [] };
      for (const item of [...undoList].reverse()) {
        try {
          if (item.op === 'moveBack') {
            mustBeInside(item.from); mustBeInside(item.to);
            if (!(await exists(fs, item.from))) throw new Error(`${path.basename(item.from)} is not there any more`);
            if (await exists(fs, item.to)) throw new Error(`${path.basename(item.to)} already exists in the old place`);
            await fs.rename(item.from, item.to);
          } else if (item.op === 'removeFolder') {
            mustBeInside(item.abs);
            const entries = await fs.readdir(item.abs).catch(() => null);
            if (entries === null) continue; // already gone
            if (entries.length > 0) throw new Error(`${path.basename(item.abs)} is not empty now`);
            await fs.rmdir(item.abs);
          } else if (item.op === 'trashCopy') {
            mustBeInside(item.abs);
            if (await exists(fs, item.abs)) await trashItem(item.abs);
          } else {
            continue;
          }
          outcome.undone += 1;
        } catch (error) {
          outcome.skipped.push(String((error && error.message) || 'Could not undo one step'));
        }
      }
      return outcome;
    },
  };
}

module.exports = { createRunner, uniquePath };
