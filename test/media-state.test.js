const test = require('node:test');
const assert = require('node:assert');
const { createMedia, formatTime, musicLine } = require('../lib/media-state');

function clock(start = 0) {
  const c = { time: start };
  c.now = () => c.time;
  return c;
}
const song = (extra = {}) => ({ e: 'media', none: false, playing: true, title: 'Blinding Lights', artist: 'The Weeknd', position: 10, duration: 200, ...extra });

test('a new song is announced once, and the same song again is not', () => {
  const media = createMedia({ now: clock().now });
  assert.strictEqual(media.update(song({ art: 'data:image/png;base64,AAA' })).isNewTrack, true);
  assert.strictEqual(media.update(song({ position: 30 })).isNewTrack, false);
  assert.strictEqual(media.update(song({ title: 'Another one' })).isNewTrack, true);
});
test('the album art is kept for the whole song, and cleared when the song changes', () => {
  const media = createMedia({ now: clock().now });
  media.update(song({ art: 'data:image/png;base64,AAA' }));
  media.update(song({ position: 50 })); // a later report without art
  assert.strictEqual(media.snapshot().art, 'data:image/png;base64,AAA');
  media.update(song({ title: 'Next' }));
  assert.strictEqual(media.snapshot().art, null);
});
test('time left ticks down while playing and holds while paused', () => {
  const c = clock(1000);
  const media = createMedia({ now: c.now });
  media.update(song({ position: 10, duration: 200 }));
  c.time += 30000;
  assert.strictEqual(Math.round(media.snapshot().remaining), 160);
  media.update(song({ playing: false, position: 40, duration: 200 }));
  c.time += 60000;
  assert.strictEqual(Math.round(media.snapshot().remaining), 160, 'paused: no change');
});
test('time left never goes below zero, and is unknown when the player gives no length', () => {
  const c = clock();
  const media = createMedia({ now: c.now });
  media.update(song({ position: 195, duration: 200 }));
  c.time += 60000;
  assert.strictEqual(media.snapshot().remaining, 0);
  media.update(song({ title: 'Live stream', duration: 0 }));
  assert.strictEqual(media.snapshot().remaining, null);
});
test('"nothing playing" clears the playing flag', () => {
  const media = createMedia({ now: clock().now });
  media.update(song());
  media.update({ e: 'media', none: true });
  assert.strictEqual(media.snapshot().playing, false);
  assert.strictEqual(media.snapshot().hasMedia, false);
});
test('times and lines are formatted for the notch', () => {
  assert.strictEqual(formatTime(151), '2:31');
  assert.strictEqual(formatTime(5), '0:05');
  assert.strictEqual(formatTime(-3), '0:00');
  assert.strictEqual(musicLine({ title: 'Song', artist: 'Band' }), 'Song - Band');
  assert.strictEqual(musicLine({ title: 'Song', artist: '' }), 'Song');
  assert.ok(musicLine({ title: 'x'.repeat(200), artist: '' }).length <= 60);
});
