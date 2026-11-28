const body = document.body;
const root = document.documentElement;
const pill = document.getElementById('pill');
const peng = document.getElementById('peng');
const textEl = document.getElementById('text');
const cardTitle = document.getElementById('cardTitle');
const cardBody = document.getElementById('cardBody');
const art = document.getElementById('art');
const vol = document.getElementById('vol');
const volFill = vol.firstElementChild;
const controls = document.getElementById('mediaControls');
const chips = document.getElementById('chips');
const clockEl = document.getElementById('clock');
const batteryEl = document.getElementById('battery');
const batteryText = document.getElementById('batteryText');

const LABELS = {
  idle: 'Ready',
  thinking: 'Thinking…',
  listening: 'Listening…',
  asking: 'Asking Claude',
  speaking: 'Speaking',
  working: 'Working…',
  needs: 'Needs you',
  done: 'Done',
  error: 'Something went wrong',
  dance: 'Music!',
  sleep: 'zzz',
};
const MS_PER_MINUTE = 60 * 1000;
const RESET_MS = { done: 4000, error: 5000 };
const CARD_MS = 6000;
const ACTIVITY_MS = 3000;
const MAX_CARD_CHARS = 320; // long enough for a spoken answer
const MAX_LINE_CHARS = 60;
const SLIDE_EVERY_MS = 60 * 1000;
const ART_SAMPLE_SIZE = 16;
const MEDIA_ICONS = {
  prev: '<path d="M6 5v14M19 5L9 12l10 7z"/>',
  playpause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  next: '<path d="M18 5v14M5 5l10 7-10 7z"/>',
};

let sleepTimer = 0;
let resetTimer = 0;
let cardTimer = 0;
let activityTimer = 0;
let isHovering = false;
let timerText = ''; // the running timer's countdown, shown while he is idle
let sleepAfterMs = 5 * MS_PER_MINUTE; // 0 = never; overwritten by saved settings
let isDanceEnabled = true;
let isFocus = false; // focus mode: only your timer shows, no music line, no dancing, no time or battery
let settingsNow = {};
let message = null; // your own line, shown until cleared
let override = null; // a short-lived activity: a new song, the volume bar, the copied tick
let music = { playing: false, title: '', artist: '', art: null, remaining: null, receivedAt: 0 };
let artColor = null;
let shownArt = null;

function flash(className, ms) {
  body.classList.add(className);
  setTimeout(() => body.classList.remove(className), ms);
}

const formatTime = (seconds) => { const whole = Math.round(Math.max(0, seconds)); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`; }; // round once, then split, so 119.6 s reads 2:00 and not 1:00

function musicLine(track) {
  const line = track.artist ? `${track.title} - ${track.artist}` : track.title;
  return line.length > MAX_LINE_CHARS ? line.slice(0, MAX_LINE_CHARS - 1) + '…' : line;
}

function musicText() {
  const left = music.remaining === null ? null : music.remaining - (Date.now() - music.receivedAt) / 1000;
  return '♪ ' + musicLine(music) + (left !== null ? ` · ${formatTime(left)} left` : '');
}

// What the notch says when nothing is pulling attention: your message, then a timer, then the song, then the usual line.
function baseText(state) {
  if (state !== 'idle' && state !== 'dance') return LABELS[state] || '';
  if (message) return message.text;
  if (timerText) return timerText;
  if (isFocus) return 'Focus mode';
  if (music.playing && (state === 'dance' || settingsNow.showMusicActivity)) return musicText();
  return LABELS[state] || '';
}

function styleMessage(state) {
  const isShowing = message !== null && (state === 'idle' || state === 'dance');
  body.classList.toggle('has-message', isShowing);
  textEl.style.color = isShowing ? message.color : '';
  textEl.classList.toggle('pulse', isShowing && message.motion === 'pulse');
  textEl.classList.toggle('scroll', isShowing && message.motion === 'scroll');
}

function render(explicitText) {
  const state = body.dataset.state;
  if (override) return;
  textEl.textContent = explicitText || baseText(state);
  styleMessage(state);
  updateArt(music.playing ? music.art : null);
}

function updateArt(source) {
  art.hidden = !source;
  if (source && source !== shownArt) {
    shownArt = source;
    art.src = source;
  }
  if (!source) { shownArt = null; artColor = null; applyEdge(); }
}

// Average color of the album art, favoring the colorful parts, for the edge light.
function colorFromImage(image) {
  const canvas = document.createElement('canvas');
  canvas.width = ART_SAMPLE_SIZE;
  canvas.height = ART_SAMPLE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, ART_SAMPLE_SIZE, ART_SAMPLE_SIZE);
  const { data } = context.getImageData(0, 0, ART_SAMPLE_SIZE, ART_SAMPLE_SIZE);
  let r = 0; let g = 0; let b = 0; let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const saturation = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
    const w = saturation + 1;
    r += data[i] * w; g += data[i + 1] * w; b += data[i + 2] * w; weight += w;
  }
  const lift = (v) => Math.min(255, Math.round(v / weight) + 40); // keep it bright enough to glow on black
  return `rgb(${lift(r)}, ${lift(g)}, ${lift(b)})`;
}
art.addEventListener('load', () => {
  try {
    artColor = colorFromImage(art);
  } catch {
    artColor = null; // an unreadable picture just means the usual edge color
  }
  applyEdge();
});

function applyEdge() {
  const mode = settingsNow.edgeLight || 'off';
  body.dataset.edge = mode;
  root.style.setProperty('--edge', mode === 'music' && artColor ? artColor : settingsNow.edgeColor || '#facc15');
}

function endActivity() {
  clearTimeout(activityTimer);
  override = null;
  delete body.dataset.activity;
  render();
}

// A short-lived thing to show: a new song, the volume bar, a copied tick. Your message and the edge light are separate.
function showActivity(activity) {
  if (activity.kind === 'message') { message = activity; render(); return; }
  if (activity.kind === 'message-clear') { message = null; render(); return; }
  clearTimeout(activityTimer);
  override = activity;
  body.dataset.activity = activity.kind;
  if (activity.kind === 'volume') {
    textEl.textContent = activity.muted ? 'Muted' : `Volume ${activity.level}%`;
    volFill.style.width = (activity.muted ? 0 : activity.level) + '%';
  } else if (activity.kind === 'copied') {
    textEl.textContent = '✓ Copied';
  } else if (activity.kind === 'music') {
    textEl.textContent = 'Now playing · ' + musicLine(activity);
  } else if (activity.kind === 'hero') {
    textEl.textContent = activity.text; // the hero's line, during its special move
  }
  textEl.style.color = '';
  textEl.classList.remove('pulse', 'scroll');
  activityTimer = setTimeout(endActivity, activity.ms || ACTIVITY_MS);
}

function setState(state, text) {
  clearTimeout(resetTimer);
  if (state !== 'idle') endMove(); // something more important: the special move stops
  if (override) endActivity(); // a Claude state matters more than a song announcement
  body.dataset.state = state;
  if (state !== 'listening') root.style.setProperty('--level', '0');
  render(text);
  if (RESET_MS[state]) resetTimer = setTimeout(() => setState('idle'), RESET_MS[state]);
  clearTimeout(sleepTimer);
  if (sleepAfterMs > 0) {
    sleepTimer = setTimeout(() => {
      if (body.dataset.state === 'idle') setState('sleep');
    }, sleepAfterMs);
  }
  if (state === 'idle') applyMusic();
}

// Dance while music plays, but never interrupt a Claude state like working or needs-you.
function applyMusic() {
  const state = body.dataset.state;
  const shouldDance = isDanceEnabled && music.playing && !isFocus;
  if (shouldDance && (state === 'idle' || state === 'sleep' || state === 'dance')) {
    setState('dance');
  } else if (!shouldDance && state === 'dance') {
    setState('idle');
  }
}

function hideCard() {
  if (isHovering) return;
  body.classList.remove('card');
}

function showCard({ title, body: text, ms = CARD_MS }) {
  clearTimeout(cardTimer);
  cardTitle.textContent = String(title).slice(0, 40);
  cardBody.textContent = String(text).slice(0, MAX_CARD_CHARS);
  body.classList.add('card');
  if (body.dataset.state === 'sleep') setState('idle');
  flash('hop', 700);
  cardTimer = setTimeout(hideCard, ms);
}

// Play/pause, previous and next appear when you hover over the notch while a song plays.
function svgIcon(markup) {
  const svg = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${markup}</svg>`, 'image/svg+xml').documentElement;
  return document.importNode(svg, true); // the shapes above are fixed text in this file
}
for (const [command, label] of [['prev', 'Previous song'], ['playpause', 'Play or pause'], ['next', 'Next song']]) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'media-btn';
  button.setAttribute('aria-label', label);
  button.append(svgIcon(MEDIA_ICONS[command]));
  button.addEventListener('click', () => window.notch.media(command));
  controls.append(button);
}

pill.addEventListener('mouseenter', () => {
  isHovering = true;
  window.notch.setMouseIgnore(false);
  body.classList.add('wave');
});
pill.addEventListener('mouseleave', () => {
  isHovering = false;
  window.notch.setMouseIgnore(true);
  body.classList.remove('wave');
  if (body.classList.contains('card')) cardTimer = setTimeout(hideCard, 1500);
});
// Clicking the face opens the panel, or cancels while he waits for an answer.
peng.addEventListener('click', () => {
  if (body.dataset.state === 'asking') {
    window.notch.cancelAsk();
    return;
  }
  flash('hop', 700);
  window.notch.openPanel();
});
document.getElementById('cancel').addEventListener('click', () => window.notch.cancelAsk());

window.notch.onState(({ state, text }) => {
  setState(state, text);
  if (state === 'done' && text === 'Timer done') setTimeout(() => react('timerDone'), 300); // after the cheer starts, a comic burst
});
window.notch.onNotify(showCard);
window.notch.onActivity(showActivity);
// A running timer's countdown replaces the idle text ("Focus 24:10"). An empty text clears it.
window.notch.onTimer(({ text }) => {
  timerText = text;
  render();
});
window.notch.onAwake((isAwake) => body.classList.toggle('dormant', !isAwake));
window.notch.onMusic((next) => {
  music = { ...next, receivedAt: Date.now() };
  body.dataset.music = music.playing ? 'playing' : '';
  applyMusic();
  render();
});
// A look with its own drawing in heroes.js replaces the Batman face. The notch keeps its own animated eyes.
function applyHero(theme) {
  const hero = document.querySelector('.hero');
  // The bots draw their own eyes (pupils look around, lids blink); a character pack's eyes come from its own eye spots.
  const picture = window.Heroes.element(theme, { withEyes: theme.startsWith('pack-'), withLids: true });
  hero.replaceChildren(...(picture ? [...picture.childNodes] : []));
  body.classList.toggle('has-hero', Boolean(picture));
  document.getElementById('peng').setAttribute('aria-label', picture ? 'Click to talk' : 'Batman: click to talk');
}
// The notch wears the chosen look. A character pack's colors and drawing come from the main program.
let lookCall = 0;
// The notch shows your face cut-out when you have one (it blinks, bobs and does its moves), else the built-in bot.
const photosReady = window.Packs.loadPhotos(window.notch.faces);
async function wearLook(theme) {
  const mine = ++lookCall;
  body.dataset.theme = theme;
  const packs = theme.startsWith('pack-') ? await window.Packs.refresh(window.notch.packs) : [];
  await photosReady;
  if (mine !== lookCall) return; // a newer look was chosen while this one loaded
  window.Packs.paint(body, packs.find((p) => p.id === theme) || null, { glow: true });
  applyHero(theme);
}
function fallBackToDefaultLook() { // the pack could not be loaded: colors and face both go back to the default look
  body.dataset.theme = 'batman';
  window.Packs.paint(body, null, { glow: true });
  applyHero('batman');
}
window.notch.onSettings((settings) => {
  settingsNow = settings;
  wearLook(settings.theme || 'pure-black').catch(fallBackToDefaultLook);
  sleepAfterMs = settings.sleepMinutes * MS_PER_MINUTE;
  isDanceEnabled = settings.danceOnMusic;
  applyEdge();
  applyChips();
  drawBattery(); // the worried look follows the "Character reacts" switch
  if (body.dataset.state === 'idle') setState('idle'); // re-arm the sleep timer and re-check music
  else { applyMusic(); render(); }
});

setInterval(() => { // the old slide trick, only when the special moves are switched off
  if (body.dataset.state === 'idle' && !isFocus && !settingsNow.heroMoves && Math.random() > 0.5) flash('slide', 2500);
}, SLIDE_EVERY_MS);

// ---- the hero's special move and line, every minute (renderer/hero-moves.js, style.css) ----
const fxEl = document.getElementById('fx');
let moveTimer = 0;

function endMove() {
  clearTimeout(moveTimer);
  delete body.dataset.move;
  fxEl.replaceChildren();
}

// A Windows voice says the line. A PC with no voices still shows the words.
function speakLine(entry) {
  if (!settingsNow.heroVoice || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(entry.line);
    const voice = window.HeroMoves.pickVoice(window.speechSynthesis.getVoices(), entry.voice.female);
    if (voice) utterance.voice = voice;
    utterance.pitch = entry.voice.pitch;
    utterance.rate = entry.voice.rate;
    window.speechSynthesis.speak(utterance);
  } catch {
    // speaking is a bonus: the line is already on the notch
  }
}

// Plays one move: its drawing, its animation, its line on the notch, and the line spoken. move is the animation name (style.css).
function perform({ move, effect, line, voice }) {
  endMove();
  if (effect) fxEl.append(svgIcon(effect)); // fixed drawings from hero-moves.js and hero-reactions.js
  void fxEl.offsetWidth; // restart the animations even when the same move plays twice in a row
  body.dataset.move = move;
  showActivity({ kind: 'hero', text: line, ms: window.HeroMoves.MOVE_MS });
  speakLine({ line, voice });
  moveTimer = setTimeout(endMove, window.HeroMoves.MOVE_MS);
}

function playMove() {
  const entry = window.HeroMoves.moveFor(body.dataset.theme);
  const isPlaying = window.HeroMoves.shouldPlay({ state: body.dataset.state, isFocus, isDormant: body.classList.contains('dormant'), isOn: settingsNow.heroMoves === true });
  if (!entry || !isPlaying) return;
  perform({ move: entry.move, effect: window.HeroMoves.FX[entry.move], line: entry.line, voice: entry.voice });
}
setInterval(playMove, window.HeroMoves.MOVE_EVERY_MS);

// ---- the hero reacts to real life: timer ends, battery low, plugged in, time for a break (renderer/hero-reactions.js) ----
let lastNudge = Date.now();
function react(name) {
  const reaction = window.HeroReactions.REACTIONS[name];
  const entry = window.HeroMoves.moveFor(body.dataset.theme);
  if (!reaction || !entry || settingsNow.reactiveHero === false || isFocus || body.classList.contains('dormant')) return;
  perform({ move: reaction.fx, effect: window.HeroReactions.FX[reaction.fx], line: reaction.line, voice: entry.voice });
}
setInterval(() => {
  const isDue = window.HeroReactions.shouldNudge({ now: Date.now(), lastNudge, isFocus, isDormant: body.classList.contains('dormant'), isOn: settingsNow.reactiveHero !== false, state: body.dataset.state });
  if (!isDue) return;
  lastNudge = Date.now();
  react('breakTime');
}, 60 * 1000);

// The time left on the song counts down while it shows.
setInterval(() => {
  if (!body.classList.contains('dormant') && music.playing && (body.dataset.state === 'idle' || body.dataset.state === 'dance')) render();
}, 1000);

// ---- the time and the battery, on the right of the notch ----
const BATTERY_ICON = '<rect x="2" y="7" width="17" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect class="battery-fill" x="4" y="9" width="13" height="6" rx="1" fill="currentColor"/><rect x="20" y="10" width="2" height="4" rx="1" fill="currentColor"/><path class="battery-bolt" d="M12.5 4L8 12h3.5l-1 8L16 11h-3.5z" fill="#facc15" stroke="#000" stroke-width="0.6" stroke-linejoin="round"/>';
const BATTERY_FILL_WIDTH = 13; // the width of the full bar inside the icon
const LOW_BATTERY_PERCENT = 20;
const batteryIcon = svgIcon(BATTERY_ICON);
batteryIcon.classList.add('battery-icon');
document.getElementById('batteryIcon').append(batteryIcon);
const batteryFill = batteryIcon.querySelector('.battery-fill');
let battery = null; // stays null on a PC with no battery
let lastReading = null; // the battery level and charging state last time, to notice a change
let lastClock = '';

function updateClock() {
  // the date's own locale method follows your Windows 12 or 24 hour setting
  const text = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (text === lastClock) return;
  lastClock = text;
  clockEl.textContent = text;
}

function drawBattery() {
  if (!battery) return;
  const percent = Math.round(battery.level * 100);
  batteryFill.setAttribute('width', String(Math.max(1, Math.round((percent / 100) * BATTERY_FILL_WIDTH))));
  batteryText.textContent = percent + '%';
  const isLow = percent <= LOW_BATTERY_PERCENT && !battery.charging;
  batteryEl.classList.toggle('low', isLow);
  body.classList.toggle('worried', isLow && settingsNow.reactiveHero !== false); // the character looks worried while idle
  batteryEl.classList.toggle('charging', battery.charging);
  const reading = { percent, charging: battery.charging };
  const reaction = window.HeroReactions.batteryReaction(lastReading, reading);
  lastReading = reading;
  if (reaction) react(reaction); // low on battery, or just plugged in
}

function applyChips() {
  clockEl.hidden = settingsNow.showTimeInNotch === false;
  batteryEl.hidden = !battery || settingsNow.showBatteryInNotch === false;
  chips.hidden = isFocus || (clockEl.hidden && batteryEl.hidden);
}
window.notch.onFocus((isOn) => {
  isFocus = isOn;
  body.classList.toggle('focus', isOn);
  applyChips();
  applyMusic(); // leave or stop dancing at once
  render();
});

if (navigator.getBattery) {
  navigator.getBattery().then((found) => {
    battery = found;
    for (const name of ['levelchange', 'chargingchange']) found.addEventListener(name, drawBattery);
    drawBattery();
    applyChips();
  }).catch(() => { battery = null; }); // no battery information: the battery chip simply stays hidden
}
updateClock();
applyChips();
setInterval(() => { if (!body.classList.contains('dormant')) updateClock(); }, 1000);

setState('idle');
