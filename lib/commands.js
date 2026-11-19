// Turns spoken text into one safe action. Anything not on this list is refused.
const APPS = {
  chrome: 'chrome',
  edge: 'msedge',
  notepad: 'notepad',
  calculator: 'calc',
  explorer: 'explorer',
  files: 'explorer',
  settings: 'ms-settings:',
  terminal: 'wt',
  code: 'code',
  paint: 'mspaint',
  spotify: 'spotify',
};

const SITES = {
  whatsapp: 'https://web.whatsapp.com',
  youtube: 'https://www.youtube.com',
  gmail: 'https://mail.google.com',
  github: 'https://github.com',
};

// Folders that can be opened by name. The value is a Windows "shell:" folder, never a path from speech.
const FOLDERS = {
  downloads: { target: 'shell:Downloads', label: 'Downloads folder' },
  documents: { target: 'shell:Personal', label: 'Documents folder' },
  desktop: { target: 'shell:Desktop', label: 'Desktop folder' },
  pictures: { target: 'shell:My Pictures', label: 'Pictures folder' },
  music: { target: 'shell:My Music', label: 'Music folder' },
  videos: { target: 'shell:My Video', label: 'Videos folder' },
};

const MAX_TYPED_CHARS = 300;
const POWER_DELAY_SECONDS = 30; // shutdown and restart wait this long, so "cancel shutdown" has time to work

// Commands the "let voice control the computer" switch covers. (Opening apps, volume and media are always allowed.)
const NEEDS_PC_CONTROL = new Set(['pc', 'power', 'typing']);

const MEDIA = {
  pause: 'playpause', play: 'playpause', resume: 'playpause',
  next: 'next', skip: 'next', previous: 'prev', back: 'prev',
};

function parseCommand(raw, now = new Date()) {
  const text = String(raw || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  let m;
  if ((m = String(raw).trim().match(/^type\s+([\s\S]+)$/i))) {
    const typed = m[1].replace(/\s+/g, ' ').trim().slice(0, MAX_TYPED_CHARS); // a line break never presses Enter
    if (typed) return { type: 'typing', text: typed, label: 'typing' };
  }
  if ((m = text.match(/^task (.+)$/))) return { type: 'assistant', text: m[1], label: 'task' }; // Claude plans it; nothing runs until you approve
  if ((m = text.match(/^run (.+)$/))) return { type: 'routine', name: m[1], label: 'run ' + m[1] }; // a saved list of safe commands
  if ((m = text.match(/^(?:(?:turn|switch) (on|off) |(start|stop|end) )focus mode$|^focus mode (on|off)$/))) {
    const on = (m[1] || m[3]) === 'on' || m[2] === 'start';
    return { type: 'focus', on, label: 'focus mode ' + (on ? 'on' : 'off') }; // a quiet switch: no outside alerts, only your timer
  }
  if ((m = text.match(/^(?:open|launch|start) (.+)$/))) {
    const name = m[1].replace(/^the /, '').replace(/ app$/, '').replace(/ folder$/, '');
    if (name === 'panel') return { type: 'panel', label: 'panel' };
    if (FOLDERS[name]) return { type: 'folder', ...FOLDERS[name] };
    if (SITES[name]) return { type: 'url', url: SITES[name], label: name };
    if (APPS[name]) return { type: 'app', target: APPS[name], label: name };
    return { type: 'unknown', label: name };
  }
  if ((m = text.match(/^(?:search|google|look up)(?: for)? (.+)$/))) {
    return { type: 'url', url: 'https://www.google.com/search?q=' + encodeURIComponent(m[1]), label: 'search ' + m[1] };
  }
  if (/^show (?:the )?panel$/.test(text)) return { type: 'panel', label: 'panel' };
  if (/^(?:volume up|louder|turn it up)$/.test(text)) return { type: 'key', key: 'volup', label: 'volume up' };
  if (/^(?:volume down|quieter|turn it down)$/.test(text)) return { type: 'key', key: 'voldown', label: 'volume down' };
  if (/^(?:mute|unmute|toggle mute)$/.test(text)) return { type: 'key', key: 'mute', label: 'mute' };
  if (MEDIA[text] || (m = text.match(/^(?:music|song) (pause|play|next|previous)$/)) ) {
    const word = MEDIA[text] ? text : m[1];
    return { type: 'key', key: MEDIA[word], label: word };
  }
  if (/^lock(?: the)?(?: computer| laptop| screen| pc)?$/.test(text)) return { type: 'lock', label: 'lock screen' };

  // Controls for the computer itself. Each one is a fixed action; nothing spoken is ever run as a command.
  const pcAction = (action, label, confirm) => ({ type: 'pc', action, label, ...(confirm ? { confirm } : {}) });
  if (/^(?:brightness up|brighter|increase brightness)$/.test(text)) return pcAction('brightnessup', 'brightness up');
  if (/^(?:brightness down|dimmer|dim the screen|decrease brightness)$/.test(text)) return pcAction('brightnessdown', 'brightness down');
  if ((m = text.match(/^(?:turn )?(?:the )?wi ?fi (on|off)$/))) return pcAction('wifi' + m[1], 'Wi-Fi ' + m[1], m[1] === 'off' ? 'Turn off Wi-Fi? You will lose the internet.' : undefined);
  if ((m = text.match(/^(?:turn )?(?:the )?bluetooth (on|off)$/))) return pcAction('bluetooth' + m[1], 'Bluetooth ' + m[1]);
  if (/^(?:take (?:a )?)?screenshot$/.test(text)) return pcAction('screenshot', 'screenshot');
  if (text === 'snap left') return pcAction('snapleft', 'snap left');
  if (text === 'snap right') return pcAction('snapright', 'snap right');
  if (/^maximi[sz]e(?: (?:the )?window)?$/.test(text)) return pcAction('maximize', 'maximize');
  if (/^minimi[sz]e(?: (?:the )?window)?$/.test(text)) return pcAction('minimize', 'minimize');
  if (text === 'show desktop') return pcAction('desktop', 'show desktop');
  if (/^(?:switch|next) window$/.test(text)) return pcAction('switchwindow', 'switch window');
  if (/^(?:battery|(?:what s|what is) my battery(?: level)?|how much battery(?: is left| do i have)?)$/.test(text)) return pcAction('battery', 'battery');

  // Power. These always ask first, and shutdown and restart wait 30 seconds so they can be cancelled.
  const power = (action, label, confirm) => ({ type: 'power', action, label, confirm });
  if (/^(?:go to sleep|sleep|put (?:the )?(?:computer|laptop|pc) to sleep)$/.test(text)) return power('sleep', 'sleep', 'Put the computer to sleep?');
  if (/^(?:restart|reboot)(?: the)?(?: computer| laptop| pc)?$/.test(text)) return power('restart', 'restart', `Restart the computer in ${POWER_DELAY_SECONDS} seconds?`);
  if (/^(?:shut ?down(?: the)?(?: computer| laptop| pc)?|turn off the (?:computer|laptop|pc))$/.test(text)) return power('shutdown', 'shut down', `Shut down the computer in ${POWER_DELAY_SECONDS} seconds?`);
  if (/^(?:cancel|abort|stop) (?:the )?(?:shut ?down|restart)$/.test(text)) return { type: 'power', action: 'abort', label: 'cancel shutdown' };

  // Answers to a question he just asked ("Shut down the computer?").
  if (/^(?:yes|yeah|yep|yup|confirm|do it|go ahead|sure|ok|okay)$/.test(text)) return { type: 'reply', answer: 'yes', label: 'yes' };
  if (/^(?:no|nope|cancel|never mind|nevermind|stop)$/.test(text)) return { type: 'reply', answer: 'no', label: 'no' };

  // Things he simply answers out loud.
  if (/^(?:what time is it|what s the time|what is the time|tell me the time|time)$/.test(text)) {
    return { type: 'say', speech: 'It is ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), label: 'time' };
  }
  if (/^(?:what s the date|what is the date|what day is it|what s today s date|today s date|date)$/.test(text)) {
    return { type: 'say', speech: 'Today is ' + now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), label: 'date' };
  }
  if (/^(?:hello|hi|hey)$/.test(text)) return { type: 'say', speech: 'Hello. I am listening.', label: 'hello' };
  if (/^(?:thanks|thank you)$/.test(text)) return { type: 'say', speech: 'Anytime.', label: 'thanks' };
  if (text === 'who are you') return { type: 'say', speech: 'I am Batman. Your notch.', label: 'who are you' };
  return { type: 'unknown', label: text };
}

// What the speech engine is allowed to hear. Every entry must also parse above (tests check this),
// so a command he can hear is always a command he can run.
const VOICE_VOCAB = {
  fixed: [
    'volume up', 'volume down', 'louder', 'quieter', 'mute', 'unmute', 'pause', 'play', 'resume', 'next', 'skip', 'previous',
    'lock the screen', 'show panel', 'focus mode on', 'focus mode off',
    'brightness up', 'brightness down', 'brighter', 'dimmer', 'wifi on', 'wifi off', 'bluetooth on', 'bluetooth off',
    'take a screenshot', 'screenshot', 'snap left', 'snap right', 'maximize', 'minimize', 'show desktop', 'switch window', 'battery',
    'sleep', 'restart the computer', 'shut down', 'cancel shutdown', 'yes', 'no', 'what time is it', 'what is the date', 'what day is it', 'hello', 'thank you', 'thanks', 'who are you',
  ],
  openTargets: [...Object.keys(APPS), ...Object.keys(SITES), ...Object.keys(FOLDERS), 'panel'],
};

module.exports = { parseCommand, VOICE_VOCAB, NEEDS_PC_CONTROL, POWER_DELAY_SECONDS };
