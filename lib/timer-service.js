// Runs the timer and the water reminder once a second and reports what happens (see timers.js for the rules).
const { createTimer, createReminder, formatClock } = require('./timers');

const KINDS = new Set(['pomodoro', 'countdown', 'stopwatch']);
const DEFAULT_WATER_MINUTES = 45;
const MIN_WATER_MINUTES = 5;
const MAX_WATER_MINUTES = 240;

const clampWholeMinutes = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

function createTimerService({ store, onTick, onEvent }) {
  const timer = createTimer();
  const saved = store.get('timerSettings', {});
  let water = {
    isOn: saved.waterOn === true,
    minutes: clampWholeMinutes(saved.waterMinutes, MIN_WATER_MINUTES, MAX_WATER_MINUTES, DEFAULT_WATER_MINUTES),
  };
  let reminder = createReminder({ intervalMinutes: water.minutes });
  if (water.isOn) reminder.start();
  let interval = null;

  const saveWater = () => store.set('timerSettings', { waterOn: water.isOn, waterMinutes: water.minutes });

  function snapshot() {
    const s = timer.snapshot();
    const ms = s.kind === 'stopwatch' ? s.elapsedMs : s.remainingMs;
    return { ...s, text: s.kind ? formatClock(ms) : '', water: { ...water } };
  }

  function tick() {
    for (const event of timer.tick()) onEvent(event);
    if (reminder.tick()) onEvent({ type: 'water' });
    if (timer.snapshot().isRunning) onTick(snapshot());
  }

  return {
    start() {
      if (!interval) interval = setInterval(tick, 1000);
    },
    stop() {
      clearInterval(interval);
      interval = null;
    },
    snapshot,
    // action: start {kind, minutes} | pause | resume | reset | water {isOn, minutes}
    act(action, args = {}) {
      if (action === 'start') {
        if (!KINDS.has(args.kind)) throw new Error('Unknown timer kind');
        timer.start(args.kind, args.minutes);
      } else if (action === 'pause') timer.pause();
      else if (action === 'resume') timer.resume();
      else if (action === 'reset') timer.reset();
      else if (action === 'water') {
        water = { isOn: args.isOn === true, minutes: clampWholeMinutes(args.minutes, MIN_WATER_MINUTES, MAX_WATER_MINUTES, water.minutes) };
        reminder = createReminder({ intervalMinutes: water.minutes });
        if (water.isOn) reminder.start();
        saveWater();
      } else throw new Error('Unknown timer action: ' + action);
      onTick(snapshot());
    },
  };
}

module.exports = { createTimerService };
