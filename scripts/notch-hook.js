// Claude Code hook: tells the notch what Claude is doing. Never blocks or fails Claude.
const http = require('http');

const STATE_BY_EVENT = {
  SessionStart: 'idle',
  UserPromptSubmit: 'thinking',
  PreToolUse: 'working',
  PostToolUseFailure: 'error',
  Notification: 'needs',
  Stop: 'done',
};

// The notch's own questions to Claude run with this set; they must not show up as coding activity.
if (process.env.NOTCH_CHILD) process.exit(0);

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw); } catch { /* no stdin: still exit cleanly */ }
  const state = STATE_BY_EVENT[input.hook_event_name];
  if (!state) return process.exit(0);

  const text = state === 'working' && input.tool_name ? input.tool_name : undefined;
  const req = http.request(
    { host: '127.0.0.1', port: 47800, path: '/event', method: 'POST', timeout: 500 },
    () => process.exit(0)
  );
  req.on('error', () => process.exit(0)); // notch not running
  req.on('timeout', () => process.exit(0));
  req.end(JSON.stringify({ state, text }));
});
