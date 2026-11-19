// Saves each tool's data (notes, links, clipboard, ...) as one JSON file in the app's data folder.
// Only known names are allowed, and every value is checked before it is written.
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 2 * 1024 * 1024;

const isList = (max) => (value) => Array.isArray(value) && value.length <= max;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const SHAPES = {
  notes: isList(300),
  links: isList(100),
  clocks: isList(20),
  clipboard: isList(400),
  unitsRecent: isList(30),
  timerSettings: isObject,
  message: isObject,
  weather: isObject,
  calendar: isObject,
  calendarFeeds: isObject,
  shelves: isList(50),
  screentime: isObject,
  currencyRates: isObject,
  life: isObject,
};

function createStore(dir) {
  const fileFor = (name) => path.join(dir, `${name}.json`);
  const assertKnown = (name) => {
    if (!Object.prototype.hasOwnProperty.call(SHAPES, name)) throw new Error('Unknown data name: ' + name);
  };

  return {
    names: Object.keys(SHAPES),
    // A missing or damaged file just means "nothing saved yet".
    get(name, fallback) {
      assertKnown(name);
      try {
        const value = JSON.parse(fs.readFileSync(fileFor(name), 'utf8'));
        return SHAPES[name](value) ? value : fallback;
      } catch {
        return fallback;
      }
    },
    set(name, value) {
      assertKnown(name);
      if (!SHAPES[name](value)) throw new Error(`Invalid data for ${name}`);
      const json = JSON.stringify(value);
      if (json.length > MAX_BYTES) throw new Error(`${name} is too large to save`);
      fs.mkdirSync(dir, { recursive: true });
      const temp = fileFor(name) + '.tmp';
      fs.writeFileSync(temp, json);
      fs.renameSync(temp, fileFor(name)); // write then rename, so a crash never leaves half a file
    },
  };
}

module.exports = { createStore };
