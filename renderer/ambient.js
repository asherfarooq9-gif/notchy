const canvas = document.getElementById('glow');
const context = canvas.getContext('2d');
const strip = document.createElement('canvas'); // one edge is drawn here first, then placed on the glow canvas
const stripContext = strip.getContext('2d');

const CANVAS_W = 192; // tiny on purpose: the screen stretches it, which also makes the edges soft
const CANVAS_H = 108;
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

const SIDES = ['top', 'right', 'bottom', 'left'];
const MIN_FRAME_MS = 16; // take every picture the screen video delivers (about 14 a second when the picture moves)
const STREAM_W = 160; // the live screen video is asked for at this tiny size, so it costs almost nothing
const STREAM_H = 90;
const FOLLOW_MS = 25; // how fast the shown colors chase the new ones (smaller = snappier)
const SETTLED = 0.5; // closer than this (out of 255) counts as arrived

let target = null; // 12 colors [r, g, b]: three per side, in the order of SIDES
let shown = null;
let depthFraction = 0.1; // glow depth as a share of the shorter screen side
let animating = false;
let lastTime = 0;

const parseColor = (text) => text.match(/\d+/g).slice(0, 3).map(Number);

window.ambient.onFrame(({ frame, strength }) => {
  if (!frame) { // dark scene or protected video: let the light fade out
    canvas.style.opacity = '0';
    target = null;
    shown = null;
    return;
  }
  target = SIDES.flatMap((side) => frame[side].map(parseColor));
  if (!shown) shown = target.map((color) => color.slice()); // coming back from dark: no sliding from old colors
  depthFraction = 0.04 + 0.1 * strength;
  canvas.style.opacity = String(0.4 + 0.6 * strength);
  if (!animating) { animating = true; lastTime = 0; requestAnimationFrame(step); }
});

// One edge as a soft band: the three colors run along it, and it fades out going into the screen.
function paintStrip(colors, length, depth) {
  strip.width = Math.max(1, Math.round(length));
  strip.height = Math.max(1, Math.round(depth));
  const along = stripContext.createLinearGradient(0, 0, strip.width, 0);
  colors.forEach((color, i) => along.addColorStop(i / (colors.length - 1), `rgb(${color.map(Math.round).join(',')})`));
  stripContext.fillStyle = along;
  stripContext.fillRect(0, 0, strip.width, strip.height);
  const fade = stripContext.createLinearGradient(0, 0, 0, strip.height);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.35, 'rgba(0,0,0,0.55)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  stripContext.globalCompositeOperation = 'destination-in';
  stripContext.fillStyle = fade;
  stripContext.fillRect(0, 0, strip.width, strip.height);
  stripContext.globalCompositeOperation = 'source-over';
}

function draw() {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const across = depthFraction * Math.min(window.innerWidth, window.innerHeight);
  const depthV = (across * CANVAS_H) / window.innerHeight;
  const depthH = (across * CANVAS_W) / window.innerWidth;
  const edge = (i) => shown.slice(i * 3, i * 3 + 3);
  paintStrip(edge(0), CANVAS_W, depthV); // top
  context.drawImage(strip, 0, 0);
  paintStrip(edge(2), CANVAS_W, depthV); // bottom, drawn upside down
  context.setTransform(1, 0, 0, -1, 0, CANVAS_H);
  context.drawImage(strip, 0, 0);
  paintStrip(edge(3), CANVAS_H, depthH); // left, turned on its side
  context.setTransform(0, 1, 1, 0, 0, 0);
  context.drawImage(strip, 0, 0);
  paintStrip(edge(1), CANVAS_H, depthH); // right
  context.setTransform(0, 1, -1, 0, CANVAS_W, 0);
  context.drawImage(strip, 0, 0);
}

function step(time) {
  if (!target || !shown) { animating = false; return; }
  const dt = lastTime ? Math.min(time - lastTime, 100) : 16;
  lastTime = time;
  const k = 1 - Math.exp(-dt / FOLLOW_MS);
  let farthest = 0;
  shown = shown.map((color, i) => color.map((value, c) => {
    const next = value + (target[i][c] - value) * k;
    farthest = Math.max(farthest, Math.abs(target[i][c] - next));
    return next;
  }));
  draw();
  if (farthest > SETTLED) requestAnimationFrame(step);
  else animating = false;
}

// Watches the screen as a small live video and sends a width by height picture of it back (Red, Green, Blue, Alpha bytes).
async function watchScreen({ sourceId, width, height }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId, maxWidth: STREAM_W, maxHeight: STREAM_H, minFrameRate: 30, maxFrameRate: 60 } },
  });
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  await video.play();
  const small = document.createElement('canvas');
  small.width = width;
  small.height = height;
  const smallContext = small.getContext('2d', { willReadFrequently: true });
  let last = 0;
  const onFrame = (now) => {
    if (now - last >= MIN_FRAME_MS) {
      last = now;
      smallContext.drawImage(video, 0, 0, width, height);
      window.ambient.sendPixels(smallContext.getImageData(0, 0, width, height).data);
    }
    video.requestVideoFrameCallback(onFrame);
  };
  video.requestVideoFrameCallback(onFrame);
}

window.ambient.onStart((info) => {
  watchScreen(info).catch((error) => window.ambient.fail(error && error.message ? error.message : 'could not watch the screen'));
});
