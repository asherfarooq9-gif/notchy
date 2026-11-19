// "Shut down the computer? Say yes or no." Keeps one open question at a time, for a short while.
// A command only runs after a clear "yes". Anything else drops the question: "no", a different command, or waiting too long.
function createConfirmation({ ms, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let pending = null;

  const clear = () => {
    if (pending) clearTimer(pending.timer);
    pending = null;
  };

  return {
    // Opens a question for this command. A new question replaces an older one.
    ask(cmd) {
      clear();
      const entry = { cmd, timer: null };
      entry.timer = setTimer(() => { if (pending === entry) pending = null; }, ms);
      pending = entry;
    },
    // Looks at the next thing he heard (already turned into a command). Returns what to do:
    //   {action: 'run', cmd}  a clear yes: run the waiting command
    //   {action: 'cancel'}    a clear no
    //   {action: 'none'}      no question was open, or it was something else (the question is dropped)
    answer(heard) {
      if (!pending) return { action: 'none' };
      const waiting = pending;
      clear();
      if (heard && heard.type === 'reply') return heard.answer === 'yes' ? { action: 'run', cmd: waiting.cmd } : { action: 'cancel' };
      return { action: 'none' };
    },
    clear,
    isOpen: () => pending !== null,
  };
}

module.exports = { createConfirmation };
