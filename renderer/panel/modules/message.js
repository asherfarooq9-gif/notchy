// Message: put a few words on the notch ("On a call", "Back in 10"), pick a color and a motion, clear it when done.
registerModule({
  id: 'message',
  title: 'Message',
  mount(root) {
    const COLORS = ['#facc15', '#fb923c', '#f87171', '#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#e5e7eb'];
    const MOTIONS = [['none', 'Still'], ['pulse', 'Pulse'], ['scroll', 'Scroll']];
    let color = COLORS[0];
    let motion = 'none';

    const input = h('input', { type: 'text', class: 'grow', maxlength: '80', placeholder: 'On a call · Back in 10 minutes', 'aria-label': 'Message' });
    const status = h('div', { class: 'tag' });
    const swatches = h('div', { class: 'row wrap' });
    const motionBar = h('div', { class: 'segment' });
    const preview = h('div', { class: 'msg-preview' }, 'Your message');

    function drawChoices() {
      swatches.replaceChildren(...COLORS.map((c) => {
        const button = h('button', { class: 'swatch' + (c === color ? ' active' : ''), 'aria-label': 'Color ' + c, onClick: () => { color = c; drawChoices(); } });
        button.style.background = c; // a color the code picked itself, set through the style object (allowed by the page's security rules)
        return button;
      }));
      motionBar.replaceChildren(...MOTIONS.map(([id, label]) => h('button', { class: id === motion ? 'active' : '', onClick: () => { motion = id; drawChoices(); } }, label)));
      preview.style.color = color;
      preview.textContent = input.value.trim() || 'Your message';
    }

    async function show() {
      status.className = 'tag';
      try {
        await window.panel.message.show({ text: input.value, color, motion });
        await window.panel.data.set('message', { text: input.value.trim(), color, motion });
        status.textContent = 'Showing on the notch.';
        status.classList.add('ok');
      } catch (err) {
        status.textContent = 'Type a message first.';
        status.classList.add('err');
      }
    }

    async function clear() {
      await window.panel.message.clear();
      status.className = 'tag';
      status.textContent = 'Cleared.';
    }

    input.addEventListener('input', drawChoices);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') show(); });
    root.append(
      h('h2', null, 'Message on the notch'),
      h('div', { class: 'row' }, input, h('button', { class: 'btn primary', onClick: show }, icon('message'), 'Show'), h('button', { class: 'btn', onClick: clear }, 'Clear')),
      status,
      h('h2', null, 'Color'),
      swatches,
      h('h2', null, 'Motion'),
      motionBar,
      h('div', { class: 'card' }, h('span', { class: 'tag' }, 'Preview'), preview));

    window.panel.data.get('message', null).then((saved) => {
      if (saved && typeof saved.text === 'string') {
        input.value = saved.text;
        if (COLORS.includes(saved.color)) color = saved.color;
        if (MOTIONS.some(([id]) => id === saved.motion)) motion = saved.motion;
      }
      drawChoices();
    });
  },
});
