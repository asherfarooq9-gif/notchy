// Assistant: tell Claude a file task. It shows a plan in plain sentences. Nothing happens until you press Run.
registerModule({
  id: 'assistant',
  title: 'Assistant',
  mount(root) {
    const input = h('input', { type: 'text', class: 'grow', maxlength: '400', placeholder: 'Sort my Downloads into folders by type', 'aria-label': 'What should Claude do?' });
    const area = h('div', { class: 'as-area' });
    let state = { phase: 'idle', steps: [], warnings: [], results: [], progress: { done: 0, total: 0 }, error: '', note: '' };

    const say = (cls, text) => h('p', { class: 'tag ' + cls }, text);

    async function call(action) {
      try {
        state = await window.panel.assistant[action](input.value);
        draw();
      } catch (err) {
        state = { ...state, error: String(err && err.message ? err.message : 'That did not work.').replace(/^Error invoking remote method '[^']*': (Error: )?/, '') };
        draw();
      }
    }

    function stepRow(step, index) {
      const result = state.results[index];
      const mark = result ? (result.ok === true ? 'done' : result.ok === false ? 'failed' : 'skipped') : '';
      return h('li', { class: 'as-step ' + mark + (step.danger ? ' danger' : '') },
        h('span', { class: 'as-text' }, step.text),
        result ? h('span', { class: 'as-result' }, result.text) : null);
    }

    function drawReview() {
      return [
        h('h2', null, state.summary),
        state.hasTrash ? say('err', 'This plan moves things to the Recycle Bin. Check the red steps.') : null,
        ...state.warnings.map((w) => say('', w)),
        h('ol', { class: 'as-steps' }, state.steps.map(stepRow)),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onClick: () => call('run') }, 'Run ' + state.steps.length + (state.steps.length === 1 ? ' step' : ' steps')),
          h('button', { class: 'btn', onClick: () => call('cancel') }, 'Cancel')),
      ];
    }

    function drawRunning() {
      const { done, total } = state.progress;
      return [
        h('h2', null, state.summary),
        h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: null })),
        say('', `Step ${Math.min(done + 1, total)} of ${total}`),
        h('ol', { class: 'as-steps' }, state.steps.map(stepRow)),
        h('button', { class: 'btn', onClick: () => window.panel.assistant.stop() }, icon('stop'), 'Stop'),
      ];
    }

    function drawDone() {
      return [
        h('h2', null, state.summary),
        say(state.results.some((r) => r.ok === false) ? 'err' : 'ok', state.note),
        h('ol', { class: 'as-steps' }, state.steps.map(stepRow)),
        h('div', { class: 'row' },
          state.canUndo ? h('button', { class: 'btn', onClick: () => call('undo') }, icon('undo'), 'Undo') : null,
          h('button', { class: 'btn', onClick: () => call('cancel') }, 'New task')),
        state.hasTrash ? say('', 'Deleted files are in the Recycle Bin. Restore them from there.') : null,
      ];
    }

    function draw() {
      let body;
      if (state.phase === 'planning') body = [say('', 'Claude is making a plan…')];
      else if (state.phase === 'review') body = drawReview();
      else if (state.phase === 'running') body = drawRunning();
      else if (state.phase === 'done') body = drawDone();
      else body = [state.error ? say('err', state.error) : say('', 'Claude only sees file and folder names, never what is inside files. Nothing runs until you press Run.')];
      area.replaceChildren(...body.filter(Boolean));
      if (state.phase === 'running') {
        const fill = area.querySelector('.bar-fill');
        if (fill) fill.style.width = (state.progress.total ? Math.round((state.progress.done / state.progress.total) * 100) : 0) + '%'; // set through the style object (allowed by the page's security rules)
      }
      const isBusy = state.phase === 'planning' || state.phase === 'running';
      input.disabled = isBusy || state.phase === 'review';
      go.disabled = isBusy || state.phase === 'review';
    }

    const go = h('button', { class: 'btn primary', onClick: () => { if (input.value.trim()) call('plan'); } }, icon('assistant'), 'Plan it');
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim() && !go.disabled) call('plan'); });
    root.append(
      h('h2', null, 'Ask Claude to do a task'),
      h('div', { class: 'row' }, input, go),
      area);

    window.panel.onAssistant((next) => { state = next; if (next.phase === 'idle' && !next.error) input.value = ''; draw(); });
    window.panel.assistant.get().then((initial) => { state = initial; draw(); });
    draw();
  },
});
