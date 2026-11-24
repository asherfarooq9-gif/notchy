// The looks. A look is a pair of colors (a, b) that tints the whole app, plus the notch icon for hero looks.
// renderer/looks.css is generated from this file by scripts/make-looks.js (a test checks they match).
// The hero looks use only color palettes inspired by each character. No logos or artwork are copied.
const { readableOn } = require('./color');

// Neutral surfaces behind text, used to work out colors that stay readable. They match renderer/looks.css.
const SURFACES = {
  light: { bg: '#f2f2f7', solid: '#ffffff' },
  dark: { bg: '#0b0b0e', solid: '#1c1c22' },
};

// group: the heading it sits under in the picker. a: main color (buttons, selected things). b: second color for the soft background glow. ink: text on a.
// isHero: gets its own drawing (renderer/heroes.js) on the notch, in the tray and in the app.
const LOOKS = [
  { id: 'classic', label: 'Classic', group: 'Classic', a: '#0b66e4', b: '#6e56e8', ink: '#ffffff', isHero: false },
  { id: 'ember', label: 'Ember', group: 'Classic', a: '#c2410c', b: '#e5302c', ink: '#ffffff', isHero: false },
  { id: 'vivid', label: 'Vivid', group: 'Classic', a: '#7c4ddb', b: '#d6409f', ink: '#ffffff', isHero: false },
  { id: 'ironman', label: 'Iron Man', group: 'Avengers', a: '#c4161c', b: '#f5b301', ink: '#ffffff', isHero: true },
  { id: 'captain', label: 'Captain America', group: 'Avengers', a: '#1d5fd6', b: '#e0252f', ink: '#ffffff', isHero: true },
  { id: 'spiderman', label: 'Spider-Man', group: 'Avengers', a: '#d91c2b', b: '#1d4ed8', ink: '#ffffff', isHero: true },
  { id: 'strange', label: 'Doctor Strange', group: 'Avengers', a: '#f08a24', b: '#b91c1c', ink: '#1f1000', isHero: true },
  { id: 'hulk', label: 'Hulk', group: 'Avengers', a: '#5fcf2a', b: '#7a52c4', ink: '#0c1a03', isHero: true },
  { id: 'thor', label: 'Thor', group: 'Avengers', a: '#2bb3f2', b: '#f3c63f', ink: '#00131c', isHero: true },
  { id: 'blackpanther', label: 'Black Panther', group: 'Avengers', a: '#7c3aed', b: '#b7c0d0', ink: '#ffffff', isHero: true },
  { id: 'doom', label: 'Doctor Doom', group: 'More Marvel', a: '#1f7a4a', b: '#8e99a8', ink: '#ffffff', isHero: true },
  { id: 'wolverine', label: 'Wolverine', group: 'More Marvel', a: '#f5c400', b: '#1d4ed8', ink: '#1c1500', isHero: true },
  { id: 'batman', label: 'Batman', group: 'DC', a: '#3f4f69', b: '#facc15', ink: '#ffffff', isHero: true },
  { id: 'superman', label: 'Superman', group: 'DC', a: '#2563eb', b: '#dc2626', ink: '#ffffff', isHero: true },
  { id: 'wonderwoman', label: 'Wonder Woman', group: 'DC', a: '#c81e1e', b: '#d4a017', ink: '#ffffff', isHero: true },
  { id: 'flash', label: 'The Flash', group: 'DC', a: '#dc2626', b: '#facc15', ink: '#ffffff', isHero: true },
  { id: 'aquaman', label: 'Aquaman', group: 'DC', a: '#0e7490', b: '#f59e0b', ink: '#ffffff', isHero: true },
  { id: 'greenlantern', label: 'Green Lantern', group: 'DC', a: '#22c55e', b: '#065f46', ink: '#04130a', isHero: true },
  { id: 'joker', label: 'Joker', group: 'DC', a: '#7e22ce', b: '#22c55e', ink: '#ffffff', isHero: true },
];

// Every look also gets its own text color for each mode: the main color pushed darker (light mode) or lighter (dark mode) until it reads well.
const THEME_INFO = LOOKS.map((look) => ({
  ...look,
  accent: look.a, // the color offered for the notch's edge light
  textLight: readableOn(look.a, [SURFACES.light.bg, SURFACES.light.solid], '#000000'),
  textDark: readableOn(look.a, [SURFACES.dark.bg, SURFACES.dark.solid], '#ffffff'),
}));

const THEMES = THEME_INFO.map((t) => t.id);
const COLOR_MODES = ['light', 'dark'];

module.exports = { THEME_INFO, THEMES, COLOR_MODES, SURFACES };
