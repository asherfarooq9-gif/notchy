// Home: your day on one small panel. Each card opens its tool.
registerModule({
  id: 'home',
  title: 'Home',
  mount(root, ctx) {
    const open = (id) => () => ctx.go(id);
    const bar = () => { const fill = h('div', { class: 'bar-fill' }); return { element: h('div', { class: 'bar' }, fill), set: (p) => { fill.style.width = p + '%'; } }; };

    const timeEl = h('div', { class: 'mid' });
    const dateEl = h('div', { class: 'muted' });
    const timerEl = h('div', { class: 'mid' });
    const timerNote = h('div', { class: 'muted' });
    const cpuBar = bar();
    const memBar = bar();
    const cpuText = h('span', { class: 'muted' }, '-');
    const memText = h('span', { class: 'muted' }, '-');
    const clipBox = h('div', { class: 'clip-text muted' }, 'Nothing copied yet');
    const lifeFace = h('span', { class: 'life-face', 'aria-hidden': 'true' });
    const lifeLine = h('div', { class: 'grow' }, 'Your character is waking up...');
    const lifeNote = h('div', { class: 'muted' });
    const musicEl = h('div', { class: 'grow clip-text' }, 'Nothing playing');
    const artEl = h('img', { class: 'np-art', alt: 'Album art', hidden: true });
    const play = (command) => () => window.panel.media(command);
    const controlsEl = h('div', { class: 'row', hidden: true },
      h('button', { class: 'icon-btn', 'aria-label': 'Previous song', onClick: play('prev') }, icon('prev')),
      h('button', { class: 'icon-btn', 'aria-label': 'Play or pause', onClick: play('playpause') }, icon('pause')),
      h('button', { class: 'icon-btn', 'aria-label': 'Next song', onClick: play('next') }, icon('next')));

    const tickTime = () => {
      const now = new Date();
      timeEl.textContent = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    };
    function showTimer(snapshot) {
      const active = snapshot && snapshot.kind;
      timerEl.textContent = active ? snapshot.text : 'No timer';
      timerNote.textContent = active ? (snapshot.isRunning ? 'Running' : 'Paused') : 'Start a focus session';
    }
    function showStats(stats) {
      if (!stats) return;
      cpuBar.set(stats.cpu); memBar.set(stats.mem);
      cpuText.textContent = stats.cpu + '%'; memText.textContent = stats.mem + '%';
    }
    function showMusic(music) {
      const isPlaying = Boolean(music && music.playing);
      musicEl.textContent = isPlaying ? [music.title || 'Something is playing', music.artist].filter(Boolean).join(' - ') : 'Nothing playing';
      artEl.hidden = !(isPlaying && music.art);
      if (!artEl.hidden) artEl.src = music.art;
      controlsEl.hidden = !isPlaying;
    }
    // Your character's day: what it feels like, and how many days in a row you have finished a focus session.
    async function showLife() {
      try {
        const life = await window.panel.life();
        lifeFace.replaceChildren(window.Heroes.element(window.Heroes.faceFor(document.body.dataset.theme)));
        lifeLine.textContent = life.line;
        lifeNote.textContent = life.streak > 0
          ? `${life.streak}-day streak` + (life.next ? ` · next goal: ${life.next} days` : ' · the highest goal')
          : 'Finish a focus session to start a streak.';
      } catch {
        lifeLine.textContent = 'Your character could not load its day.';
      }
    }
    async function showClipboard() {
      const items = await window.panel.clipboard.list('');
      const latest = items.find((i) => i.type === 'text');
      clipBox.textContent = latest ? latest.text : 'Nothing copied yet';
    }

    // Type what you would have said ("open downloads", "volume up", "task sort my downloads"). Same safety rules as voice.
    const command = h('input', { type: 'text', class: 'grow', maxlength: '300', placeholder: 'Type a command, like "open downloads"', 'aria-label': 'Type a command' });
    const send = () => {
      const text = command.value.trim();
      if (!text) return;
      window.panel.runCommand(text);
      command.value = '';
      window.panel.hide(); // the answer shows on the notch
    };
    command.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

    root.append(
      h('div', { class: 'row' }, command, h('button', { class: 'btn small primary', onClick: send }, 'Go')),
      h('div', { class: 'cards' },
        h('button', { class: 'card', onClick: open('clock') }, h('span', { class: 'tag' }, 'Time'), timeEl, dateEl),
        h('button', { class: 'card', onClick: open('timers') }, h('span', { class: 'tag' }, 'Focus'), timerEl, timerNote),
        h('button', { class: 'card', onClick: open('system') }, h('span', { class: 'tag' }, 'System'),
          h('div', { class: 'row' }, h('span', { class: 'grow' }, 'CPU'), cpuText), cpuBar.element,
          h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Memory'), memText), memBar.element),
        h('button', { class: 'card', onClick: open('clipboard') }, h('span', { class: 'tag' }, 'Last copied'), clipBox),
        h('button', { class: 'card wide', onClick: open('timers') }, h('div', { class: 'row' }, lifeFace, h('span', { class: 'tag' }, 'Your character')), h('div', { class: 'row' }, lifeLine), lifeNote),
        h('div', { class: 'card wide' }, h('div', { class: 'row' }, icon('music'), h('span', { class: 'tag' }, 'Now playing')),
          h('div', { class: 'row' }, artEl, musicEl, controlsEl))));

    tickTime(); showTimer(window.panelState.timer); showStats(window.panelState.stats); showMusic(window.panelState.music); showClipboard(); showLife();
    const timeTimer = setInterval(tickTime, 1000);
    const offs = [bus.on('command', () => command.focus()), bus.on('timer', showTimer), bus.on('stats', showStats), bus.on('music', showMusic), bus.on('clipboard', showClipboard)];
    return () => { clearInterval(timeTimer); offs.forEach((off) => off()); };
  },
});
