// Music: what is playing, with big album art, a progress bar and the usual buttons. It follows the same feed as the notch.
registerModule({
  id: 'music',
  title: 'Music',
  mount(root) {
    const MAX_TITLE_CHARS = 120;
    let music = window.panelState.music || { playing: false };
    let receivedAt = Date.now();

    const art = h('img', { class: 'music-art', alt: 'Album art', hidden: true });
    const placeholder = h('div', { class: 'music-art music-art-empty', 'aria-hidden': 'true' }, icon('music'));
    const title = h('div', { class: 'music-title' });
    const artist = h('div', { class: 'muted' });
    const fill = h('div', { class: 'bar-fill' });
    const bar = h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Song progress' }, fill);
    const times = h('div', { class: 'row music-times' }, h('span', { class: 'tag' }), h('span', { class: 'grow' }), h('span', { class: 'tag' }));
    const press = (command) => () => window.panel.media(command);
    const playButton = h('button', { class: 'btn primary music-play', 'aria-label': 'Play or pause', onClick: press('playpause') }, icon('play'));

    const clock = (seconds) => { const whole = Math.round(Math.max(0, seconds)); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`; }; // round once, then split, so 119.6 s reads 2:00 and not 1:00

    // How far into the song we are, counted from when the last update arrived.
    function elapsed() {
      if (!music.playing || music.remaining === null || music.remaining === undefined || !music.duration) return null;
      const left = Math.max(0, music.remaining - (Date.now() - receivedAt) / 1000);
      return Math.min(music.duration, Math.max(0, music.duration - left));
    }

    function drawProgress() {
      const done = elapsed();
      bar.hidden = times.hidden = done === null;
      if (done === null) return;
      fill.style.width = Math.round((done / music.duration) * 100) + '%'; // set through the style object (allowed by the page's security rules)
      times.firstChild.textContent = clock(done);
      times.lastChild.textContent = clock(music.duration);
    }

    function draw() {
      const isPlaying = Boolean(music.playing);
      title.textContent = isPlaying ? String(music.title || 'Something is playing').slice(0, MAX_TITLE_CHARS) : 'Nothing playing';
      artist.textContent = isPlaying ? String(music.artist || '').slice(0, MAX_TITLE_CHARS) : 'Start a song in any music app.';
      const hasArt = isPlaying && Boolean(music.art);
      art.hidden = !hasArt;
      placeholder.hidden = hasArt;
      if (hasArt) art.src = music.art;
      playButton.replaceChildren(icon(isPlaying ? 'pause' : 'play'));
      drawProgress();
    }

    const off = bus.on('music', (next) => { music = next; receivedAt = Date.now(); draw(); });
    const ticker = setInterval(drawProgress, 1000);
    root.append(
      h('div', { class: 'music' },
        art, placeholder,
        h('div', { class: 'music-info' }, title, artist, bar, times,
          h('div', { class: 'row music-buttons' },
            h('button', { class: 'btn', 'aria-label': 'Previous song', onClick: press('prev') }, icon('prev')),
            playButton,
            h('button', { class: 'btn', 'aria-label': 'Next song', onClick: press('next') }, icon('next'))))));
    draw();
    return () => { off(); clearInterval(ticker); };
  },
});
