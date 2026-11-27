const test = require('node:test');
const assert = require('node:assert');
const HeroMoves = require('../renderer/hero-moves.js');
const Heroes = require('../renderer/heroes.js');
const { DEFAULTS, sanitize } = require('../lib/settings');

const LINES = {
  ironman: 'I am Iron Man.',
  captain: 'I can do this all day.',
  spiderman: 'Your friendly neighborhood Spider-Man!',
  strange: "Dormammu, I've come to bargain.",
  hulk: 'HULK SMASH!',
  thor: 'Bring me Thanos!',
  blackpanther: 'Wakanda forever!',
  doom: 'Doom does not bargain.',
  wolverine: "SNIKT! Let's go, bub.",
  batman: "I'm Batman.",
  superman: 'Up, up and away!',
  wonderwoman: 'For Themyscira!',
  flash: 'Fastest man alive!',
  aquaman: 'Permission to come aboard.',
  greenlantern: 'In brightest day...',
  joker: 'HA HA HA HA HA!',
};

test('every hero has its own line, exactly as agreed, and its own move', () => {
  assert.deepStrictEqual(Object.keys(HeroMoves.MOVES).sort(), [...Heroes.ids].sort());
  for (const [id, line] of Object.entries(LINES)) assert.strictEqual(HeroMoves.moveFor(id).line, line, id);
  const moves = Object.values(HeroMoves.MOVES).map((m) => m.move);
  assert.strictEqual(new Set(moves).size, moves.length, 'no two heroes share a move');
  for (const move of moves) if (move !== 'fly') assert.match(HeroMoves.FX[move], /^<(rect|circle|path|ellipse|text) /, `${move} has an effect`);
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'renderer', 'style.css'), 'utf8');
  for (const move of moves) assert.ok(css.includes(`body[data-move="${move}"]`), `${move} has its animation in style.css`);
  assert.strictEqual(HeroMoves.moveFor('nobody'), null);
  assert.strictEqual(HeroMoves.moveFor('__proto__'), null);
});

test('voices: Wonder Woman speaks with a female voice, Hulk low, Joker high and fast', () => {
  assert.strictEqual(HeroMoves.moveFor('wonderwoman').voice.female, true);
  assert.strictEqual(HeroMoves.moveFor('batman').voice.female, false);
  assert.ok(HeroMoves.moveFor('hulk').voice.pitch < 0.6);
  assert.ok(HeroMoves.moveFor('joker').voice.pitch > 1.3 && HeroMoves.moveFor('joker').voice.rate > 1.1);
  for (const m of Object.values(HeroMoves.MOVES)) {
    assert.ok(m.voice.pitch >= 0 && m.voice.pitch <= 2 && m.voice.rate >= 0.1 && m.voice.rate <= 10, m.move);
  }
});

test('a move plays every minute, only when the notch is awake, idle, not in focus, and the switch is on', () => {
  assert.strictEqual(HeroMoves.MOVE_EVERY_MS, 60 * 1000);
  assert.ok(HeroMoves.MOVE_MS >= 2500 && HeroMoves.MOVE_MS <= 4000, 'the line shows for about 3 seconds');
  const ok = { state: 'idle', isFocus: false, isDormant: false, isOn: true };
  assert.strictEqual(HeroMoves.shouldPlay(ok), true);
  for (const state of ['sleep', 'dance', 'working', 'needs', 'asking', 'speaking', 'listening', 'done', 'error']) {
    assert.strictEqual(HeroMoves.shouldPlay({ ...ok, state }), false, state);
  }
  assert.strictEqual(HeroMoves.shouldPlay({ ...ok, isFocus: true }), false, 'focus mode');
  assert.strictEqual(HeroMoves.shouldPlay({ ...ok, isDormant: true }), false, 'hidden notch: no voice from nowhere');
  assert.strictEqual(HeroMoves.shouldPlay({ ...ok, isOn: false }), false, 'switch off');
});

test('the moves and the voice are on by default and can be switched off', () => {
  assert.strictEqual(DEFAULTS.heroMoves, true);
  assert.strictEqual(DEFAULTS.heroVoice, true);
  assert.strictEqual(sanitize({ heroMoves: false, heroVoice: false }).heroMoves, false);
  assert.strictEqual(sanitize({ heroMoves: false, heroVoice: false }).heroVoice, false);
  assert.strictEqual(sanitize({ heroMoves: 'no' }).heroMoves, true, 'only a real true/false counts');
});

test('the voice picks a female or male Windows voice, and copes with none', () => {
  const voices = [{ name: 'Microsoft David - English (United States)' }, { name: 'Microsoft Zira - English (United States)' }];
  assert.strictEqual(HeroMoves.pickVoice(voices, true).name, voices[1].name);
  assert.strictEqual(HeroMoves.pickVoice(voices, false).name, voices[0].name);
  assert.strictEqual(HeroMoves.pickVoice([], false), null);
});
