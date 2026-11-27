// The Timers & Focus logic: pomodoro, countdown, stopwatch and a water reminder.
// Plain logic with an injected clock, so tests can run it instantly.
const FOCUS_MINUTES = 25;
const SHORT_BREAK_MINUTES = 5;
const LONG_BREAK_MINUTES = 15;
const FOCUS_SESSIONS_BEFORE_LONG_BREAK = 4;
const MS_PER_MINUTE = 60000;
const MAX_COUNTDOWN_MINUTES = 24 * 60;

function createTimer({ now = Date.now } = {}) {
  // kind: null | 'pomodoro' | 'countdown' | 'stopwatch'; phase: 'focus' | 'break' | 'long-break' | 'countdown' | 'stopwatch'
  let state = { kind: null, phase: null, isRunning: false, endsAt: 0, remainingMs: 0, startedAt: 0, elapsedBeforePauseMs: 0, focusDone: 0 };

  function phaseLength(phase) {
    if (phase === 'focus') return FOCUS_MINUTES * MS_PER_MINUTE;
    if (phase === 'long-break') return LONG_BREAK_MINUTES * MS_PER_MINUTE;
    return SHORT_BREAK_MINUTES * MS_PER_MINUTE;
  }

  function begin(phase, lengthMs) {
    state = { ...state, phase, isRunning: true, endsAt: now() + lengthMs, remainingMs: lengthMs };
  }

  function snapshot() {
    const running = state.isRunning;
    if (state.kind === 'stopwatch') {
      const elapsedMs = state.elapsedBeforePauseMs + (running ? now() - state.startedAt : 0);
      return { kind: 'stopwatch', phase: 'stopwatch', isRunning: running, elapsedMs, remainingMs: 0, focusDone: 0 };
    }
    const remainingMs = state.kind === null ? 0 : running ? Math.max(0, state.endsAt - now()) : state.remainingMs;
    return { kind: state.kind, phase: state.phase, isRunning: running, elapsedMs: 0, remainingMs, focusDone: state.focusDone };
  }

  return {
    snapshot,
    start(kind, minutes) {
      if (kind === 'pomodoro') {
        state = { ...state, kind, focusDone: 0, elapsedBeforePauseMs: 0 };
        begin('focus', phaseLength('focus'));
      } else if (kind === 'countdown') {
        const length = Math.min(Math.max(Number(minutes) || 0, 0.1), MAX_COUNTDOWN_MINUTES) * MS_PER_MINUTE;
        state = { ...state, kind, focusDone: 0, elapsedBeforePauseMs: 0 };
        begin('countdown', length);
      } else if (kind === 'stopwatch') {
        state = { kind, phase: 'stopwatch', isRunning: true, endsAt: 0, remainingMs: 0, startedAt: now(), elapsedBeforePauseMs: 0, focusDone: 0 };
      } else {
        throw new Error('Unknown timer kind: ' + kind);
      }
    },
    pause() {
      if (!state.isRunning) return;
      if (state.kind === 'stopwatch') state = { ...state, isRunning: false, elapsedBeforePauseMs: state.elapsedBeforePauseMs + (now() - state.startedAt) };
      else state = { ...state, isRunning: false, remainingMs: Math.max(0, state.endsAt - now()) };
    },
    resume() {
      if (state.isRunning || state.kind === null) return;
      if (state.kind !== 'stopwatch' && state.remainingMs <= 0) return; // a finished timer has nothing left to run
      if (state.kind === 'stopwatch') state = { ...state, isRunning: true, startedAt: now() };
      else state = { ...state, isRunning: true, endsAt: now() + state.remainingMs };
    },
    reset() {
      state = { kind: null, phase: null, isRunning: false, endsAt: 0, remainingMs: 0, startedAt: 0, elapsedBeforePauseMs: 0, focusDone: 0 };
    },
    // Call about once a second. Returns what finished: [{type:'phase', from, to}] or [{type:'finished'}].
    tick() {
      if (!state.isRunning || state.kind === null || state.kind === 'stopwatch' || now() < state.endsAt) return [];
      if (state.kind === 'countdown') {
        state = { ...state, isRunning: false, remainingMs: 0 };
        return [{ type: 'finished' }];
      }
      const from = state.phase;
      const focusDone = from === 'focus' ? state.focusDone + 1 : state.focusDone;
      const to = from !== 'focus' ? 'focus' : focusDone % FOCUS_SESSIONS_BEFORE_LONG_BREAK === 0 ? 'long-break' : 'break';
      state = { ...state, focusDone };
      begin(to, phaseLength(to));
      return [{ type: 'phase', from, to }];
    },
  };
}

// Reminds you to drink water every so often while turned on.
function createReminder({ intervalMinutes = 45, now = Date.now } = {}) {
  let nextAt = 0;
  return {
    start() { nextAt = now() + intervalMinutes * MS_PER_MINUTE; },
    stop() { nextAt = 0; },
    isOn: () => nextAt !== 0,
    // True once each time the reminder is due.
    tick() {
      if (nextAt === 0 || now() < nextAt) return false;
      nextAt = now() + intervalMinutes * MS_PER_MINUTE;
      return true;
    },
  };
}

function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const two = (n) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

module.exports = { createTimer, createReminder, formatClock };
