// What is playing, kept up to date from the desktop watcher's media events.
// Position is worked out from the last report and the clock, so the time left ticks down smoothly between reports.
const MAX_LINE_CHARS = 60;

function createMedia({ now = Date.now } = {}) {
  let state = { hasMedia: false, playing: false, title: '', artist: '', art: null, position: 0, duration: 0, reportedAt: 0 };

  return {
    // Returns {isNewTrack} so the notch knows when to announce a song.
    update(event) {
      if (event.none) {
        state = { ...state, hasMedia: false, playing: false };
        return { isNewTrack: false };
      }
      const isNewTrack = !state.hasMedia || event.title !== state.title || event.artist !== state.artist;
      state = {
        hasMedia: true,
        playing: event.playing === true,
        title: String(event.title || ''),
        artist: String(event.artist || ''),
        art: event.art !== undefined ? event.art : (isNewTrack ? null : state.art), // art arrives only with a new track
        position: Number(event.position) || 0,
        duration: Number(event.duration) || 0,
        reportedAt: now(),
      };
      return { isNewTrack };
    },
    snapshot() {
      const elapsed = state.playing ? (now() - state.reportedAt) / 1000 : 0;
      const position = state.duration > 0 ? Math.min(state.position + elapsed, state.duration) : state.position + elapsed;
      return {
        hasMedia: state.hasMedia,
        playing: state.playing,
        title: state.title,
        artist: state.artist,
        art: state.art,
        position,
        duration: state.duration,
        remaining: state.duration > 0 ? Math.max(0, state.duration - position) : null,
      };
    },
  };
}

// 151 -> "2:31"
function formatTime(seconds) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// "Title - Artist", cut to fit the notch.
function musicLine({ title, artist }) {
  const line = artist ? `${title} - ${artist}` : title;
  return line.length > MAX_LINE_CHARS ? line.slice(0, MAX_LINE_CHARS - 1) + '…' : line;
}

module.exports = { createMedia, formatTime, musicLine };
