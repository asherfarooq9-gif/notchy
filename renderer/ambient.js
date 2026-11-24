const glow = document.getElementById('glow');
const SIDES = ['top', 'right', 'bottom', 'left'];

window.ambient.onFrame(({ frame, strength }) => {
  if (!frame) { glow.style.opacity = '0'; return; } // dark scene or protected video: let the light fade out
  for (const side of SIDES) frame[side].forEach((color, i) => glow.style.setProperty(`--${side}${i}`, color));
  const size = Math.round(Math.min(window.innerWidth, window.innerHeight) * (0.04 + 0.1 * strength)); // bigger glow at higher strength
  glow.style.setProperty('--size', `${size}px`);
  glow.style.opacity = String(0.4 + 0.6 * strength);
});
