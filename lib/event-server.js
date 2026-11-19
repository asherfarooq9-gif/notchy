// The small local web server that the Claude Code hook posts to ("Claude is working", "done").
// Only a program on this PC may use it. A web page in your browser is refused (it always sends an Origin header),
// and so is a request for any other host name (the "DNS rebinding" trick).
const MAX_TEXT_CHARS = 80;
const MAX_BODY_BYTES = 4096;

function makeEventHandler({ port, states, onEvent, maxBytes = MAX_BODY_BYTES }) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

  return function handle(req, res) {
    if (req.headers.origin !== undefined || !allowedHosts.has(req.headers.host)) { res.writeHead(403).end(); return; }
    if (req.method !== 'POST' || req.url !== '/event') { res.writeHead(404).end(); return; }
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) req.destroy();
    });
    req.on('end', () => {
      try {
        const { state, text } = JSON.parse(raw);
        if (!states.has(state)) { res.writeHead(400).end(); return; }
        onEvent({ state, text: typeof text === 'string' ? text.slice(0, MAX_TEXT_CHARS) : undefined });
        res.writeHead(204).end();
      } catch {
        res.writeHead(400).end();
      }
    });
  };
}

module.exports = { makeEventHandler };
