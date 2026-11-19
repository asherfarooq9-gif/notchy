// The assistant's one-task-at-a-time state machine: idle -> planning -> review -> running -> done.
// Nothing runs until run() is called on a plan that is in "review". State is kept in memory only.
const { planFacts } = require('./assistant-plan');

function createAssistantService({ planner, runner, onUpdate = () => {}, isEnabled = () => true }) {
  let phase = 'idle';
  let task = '';
  let plan = null; // {summary, steps (with real paths), warnings}
  let progress = { done: 0, total: 0 };
  let results = [];
  let undoList = [];
  let note = '';
  let error = '';
  let stopRequested = false;

  // What the panel may see: sentences and counts, never real paths.
  function state() {
    const facts = plan ? planFacts(plan.steps) : { count: 0, hasTrash: false, canApproveByVoice: false };
    return {
      phase, task, error, note, progress, results,
      summary: plan ? plan.summary : '',
      warnings: plan ? plan.warnings : [],
      steps: plan ? plan.steps.map((s) => ({ text: s.text, danger: s.danger || '' })) : [],
      hasTrash: facts.hasTrash,
      canApproveByVoice: facts.canApproveByVoice,
      canUndo: undoList.length > 0 && phase === 'done',
    };
  }
  const publish = () => { const s = state(); onUpdate(s); return s; };

  return {
    state,
    async plan(text) {
      if (!isEnabled()) throw new Error('Tasks are turned off in Settings.');
      if (phase === 'planning' || phase === 'running') throw new Error('The assistant is busy. Wait for it to finish.');
      phase = 'planning'; task = String(text || '').slice(0, 400); plan = null; results = []; undoList = []; note = ''; error = '';
      progress = { done: 0, total: 0 };
      publish();
      const answer = await planner.plan(task);
      if (!answer.ok) { phase = 'idle'; error = answer.error; return publish(); }
      plan = { summary: answer.summary, steps: answer.steps, warnings: answer.warnings || [] };
      phase = 'review';
      return publish();
    },
    async run() {
      if (phase !== 'review' || !plan) throw new Error('There is nothing to run.');
      phase = 'running'; stopRequested = false; note = '';
      progress = { done: 0, total: plan.steps.length };
      publish();
      const outcome = await runner.run(plan.steps, {
        isStopped: () => stopRequested,
        onProgress: (done, total, partial) => { progress = { done, total }; results = partial; publish(); },
      });
      results = outcome.results; undoList = outcome.undo;
      const failed = results.find((r) => r.ok === false);
      note = outcome.stopped ? 'Stopped. The steps already done stay done.' : failed ? `Stopped at a problem: ${failed.text}` : 'All done.';
      phase = 'done';
      return publish();
    },
    stop() { stopRequested = true; },
    cancel() {
      if (phase === 'running' || phase === 'planning') return state();
      phase = 'idle'; plan = null; results = []; undoList = []; note = ''; error = '';
      return publish();
    },
    async undo() {
      if (phase !== 'done' || undoList.length === 0) throw new Error('There is nothing to undo.');
      const outcome = await runner.undo(undoList);
      undoList = [];
      note = `Put back ${outcome.undone} change${outcome.undone === 1 ? '' : 's'}.` + (outcome.skipped.length ? ` Left alone: ${outcome.skipped.slice(0, 3).join('; ')}.` : '');
      return publish();
    },
  };
}

module.exports = { createAssistantService };
