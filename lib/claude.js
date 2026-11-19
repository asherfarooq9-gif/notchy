// Connects the notch to Claude through the Claude Code program already on this PC (your own sign-in).
// One session stays running in the background, so questions skip the slow start-up and he remembers
// the conversation. All tools are switched off: he can only talk, never touch files or run anything.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const SYSTEM_PROMPT =
  "You are an AI assistant in the style of Jarvis, living in a small Batman-shaped notch at the top of the user's Windows screen. The user calls you Batman. " +
  'Your answers are spoken aloud, so reply in one to three short, plain sentences. ' +
  'No markdown, no lists, no emoji, no code, no asterisks. Be calm, warm, quick, and a little dry-witted. ' +
  'If you do not know something or need live information such as news or weather, say so briefly.';
const ASK_TIMEOUT_MS = 60000;
const MAX_QUESTION_CHARS = 500;
const MAX_SPOKEN_CHARS = 600;

function buildArgs(model) {
  return [
    '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
    '--model', model,
    '--tools', '', // no tools at all: he can only talk
    '--system-prompt', SYSTEM_PROMPT,
    '--setting-sources', 'project', // skip your personal hooks, rules and plugins: faster, and no side effects
    '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence',
  ];
}

// Claude sometimes adds markdown even when told not to. Strip it so it can be spoken.
function cleanForSpeech(text) {
  return String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SPOKEN_CHARS);
}

// Turns one line of Claude's output into {text, isError} when it is a final answer, else null.
function parseResultLine(line) {
  let event;
  try { event = JSON.parse(line); } catch { return null; }
  if (event.type !== 'result') return null;
  return { text: typeof event.result === 'string' ? event.result : '', isError: event.is_error === true };
}

function friendlyError(text) {
  if (/login|api key|authenticat/i.test(text)) return 'Claude is not signed in. Open Claude Code once and sign in.';
  return 'Claude had a problem: ' + text.slice(0, 80);
}

function findClaude() {
  const local = path.join(process.env.USERPROFILE || '', '.local', 'bin', 'claude.exe');
  return fs.existsSync(local) ? local : 'claude'; // otherwise rely on PATH
}

function createClaude({ model = 'haiku' } = {}) {
  const workDir = path.join(os.tmpdir(), 'windows-notch-claude'); // empty folder: nothing to auto-load
  let child = null;
  let pending = null; // {resolve, reject, timer} for the question being answered
  const waiting = []; // questions queued behind it

  function fail(error) {
    if (!pending) return;
    clearTimeout(pending.timer);
    const { reject } = pending;
    pending = null;
    reject(error);
  }

  function start() {
    if (child) return;
    fs.mkdirSync(workDir, { recursive: true });
    const proc = spawn(findClaude(), buildArgs(model), {
      cwd: workDir,
      env: { ...process.env, NOTCH_CHILD: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    child = proc;
    readline.createInterface({ input: proc.stdout }).on('line', (line) => {
      const result = parseResultLine(line);
      if (!result || !pending) return;
      clearTimeout(pending.timer);
      const { resolve, reject } = pending;
      pending = null;
      if (result.isError) reject(new Error(friendlyError(result.text)));
      else resolve(cleanForSpeech(result.text));
      next();
    });
    let errorText = '';
    proc.stderr.on('data', (chunk) => { errorText += chunk; });
    proc.stdin.on('error', () => {}); // a closed pipe is reported by the exit event below
    proc.on('error', (err) => {
      child = null;
      fail(new Error('Could not start Claude: ' + err.message));
    });
    proc.on('exit', () => {
      if (child === proc) child = null;
      fail(new Error(errorText.trim().split('\n')[0] || 'Claude stopped unexpectedly'));
      next();
    });
  }

  function next() {
    if (pending || waiting.length === 0) return;
    start();
    const job = waiting.shift();
    job.timer = setTimeout(() => {
      fail(new Error('Claude took too long to answer'));
      if (child) child.kill(); // a stuck session is replaced by a fresh one on the next question
    }, ASK_TIMEOUT_MS);
    pending = job;
    child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: job.question } }) + '\n');
  }

  return {
    // Starts the background session and sends it a tiny hello, so the first real question is not slow.
    warm() {
      // If this fails, the first real question tries again and reports the problem then.
      this.ask('Reply with the single word: ready').catch(() => {});
    },
    ask(question) {
      return new Promise((resolve, reject) => {
        waiting.push({ question: String(question).slice(0, MAX_QUESTION_CHARS), resolve, reject, timer: null });
        next();
      });
    },
    stop() {
      waiting.splice(0).forEach((job) => job.reject(new Error('Stopped')));
      fail(new Error('Stopped'));
      if (child) child.kill();
      child = null;
    },
  };
}

module.exports = { createClaude, buildArgs, cleanForSpeech, parseResultLine, friendlyError, findClaude };
