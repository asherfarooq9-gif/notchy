// Phone: send files from your phone to this PC over your home Wi-Fi. Off until you press Start, and it stops by itself.
registerModule({
  id: 'phone',
  title: 'Phone',
  mount(root) {
    let view = { running: false, received: [] };
    let error = '';
    const area = h('div', { class: 'phone' });

    const clock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    const size = (bytes) => (bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB');
    const qrPicture = (svgText) => document.importNode(new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement, true); // the text comes from our own QR code maker

    async function call(action) {
      error = '';
      try { view = await window.panel.phone[action](); } catch (err) {
        error = String(err && err.message ? err.message : 'That did not work.').replace(/^Error invoking remote method '[^']*': (Error: )?/, '');
      }
      draw();
    }

    function drawIdle() {
      return [
        h('h2', null, 'Send files from your phone'),
        h('ul', { class: 'phone-steps' },
          h('li', null, 'Your phone and this PC must be on the same Wi-Fi.'),
          h('li', null, 'Press Start, then scan the code with your phone camera.'),
          h('li', null, 'Files land in Downloads, in a folder called "From phone".')),
        h('p', { class: 'muted' }, 'The link works for 10 minutes, for one phone, and you can stop it any time.'),
        h('button', { class: 'btn primary', onClick: () => call('start') }, 'Start phone link'),
      ];
    }

    const countdown = () => 'Stops in ' + clock(view.expiresAt - Date.now());
    const timeLabel = h('p', { class: 'tag phone-time' });

    function drawRunning() {
      timeLabel.textContent = countdown();
      return [
        h('div', { class: 'phone-qr' }, view.qr ? qrPicture(view.qr) : null),
        h('div', { class: 'phone-info' },
          h('h2', null, view.phone ? 'Phone connected' : 'Scan with your phone camera'),
          h('p', { class: 'muted' }, 'Same Wi-Fi as this PC. Mobile data off. Address: ' + view.url),
          timeLabel,
          view.received.length
            ? h('ul', { class: 'phone-files' }, view.received.map((f) => h('li', null, f.name + ' (' + size(f.bytes) + ')')))
            : h('p', { class: 'muted' }, 'No files yet.'),
          h('p', { class: 'muted' }, 'This page is not encrypted. Use it on your home Wi-Fi only.'),
          h('div', { class: 'row' },
            h('button', { class: 'btn', onClick: () => call('open') }, 'Open folder'),
            h('button', { class: 'btn primary', onClick: () => call('stop') }, 'Stop'))),
      ];
    }

    function draw() {
      area.replaceChildren(...(view.running ? drawRunning() : drawIdle()), ...(error ? [h('p', { class: 'tag err' }, error)] : []));
    }

    const off = bus.on('phone', (next) => { view = next; draw(); });
    // Only the countdown text changes each second, so a click on Stop is never lost to a redraw.
    const ticker = setInterval(() => { if (view.running) timeLabel.textContent = countdown(); }, 1000);
    root.append(area);
    window.panel.phone.get().then((next) => { view = next; draw(); }).catch(() => draw());
    return () => { off(); clearInterval(ticker); };
  },
});
