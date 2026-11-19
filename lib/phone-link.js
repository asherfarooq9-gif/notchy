// Phone link: for a few minutes, a small web page on your home network lets one phone send files to a folder on this PC.
// Safe by design: off until you start it, a random code in the address, one phone only, size and count limits,
// programs refused, nothing ever overwritten or opened, and it stops by itself.
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { isProgramFile } = require('./paths');
const page = require('./phone-page');

const TEN_MINUTES_MS = 10 * 60 * 1000;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 20;
const MAX_NAME_CHARS = 100;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

// Only devices on your own network may connect: private IPv4 ranges, loopback and link-local IPv6.
function isPrivateAddress(address) {
  if (typeof address !== 'string') return false;
  const ip = address.replace(/^::ffff:/i, '');
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = v4.slice(1).map(Number);
    if (v4.slice(1).some((p) => Number(p) > 255)) return false;
    return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
  }
  return ip === '::1' || /^fe[89ab][0-9a-f]:/i.test(ip);
}

// The first private network address of this PC (Wi-Fi or cable), or null when there is none.
function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) if (item.family === 'IPv4' && !item.internal && isPrivateAddress(item.address)) return item.address;
  }
  return null;
}

// A name from the phone becomes a plain file name: no folders, no odd characters, not too long.
function cleanFileName(raw) {
  const last = String(raw || '').split(/[\\/]/).pop();
  let name = last.replace(/[<>:"|?*\x00-\x1f]/g, '_').replace(/^[\s.]+|[\s.]+$/g, '');
  if (!name) return 'file';
  if (RESERVED.test(name)) name = '_' + name;
  if (name.length > MAX_NAME_CHARS) {
    const ext = path.extname(name).slice(0, 10);
    name = name.slice(0, MAX_NAME_CHARS - ext.length) + ext;
  }
  return name;
}

function sameText(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Creates the file under a name nobody has used ("photo.jpg", then "photo (2).jpg"). "wx" means it can never replace one.
function openNewFile(dir, name, fsImpl) {
  const { name: stem, ext } = path.parse(name);
  for (let n = 1; n < 1000; n++) {
    const file = path.join(dir, n === 1 ? name : `${stem} (${n})${ext}`);
    try { return { file, fd: fsImpl.openSync(file, 'wx') }; } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  throw new Error('Too many files with this name already exist');
}

function createPhoneLink({ getAddress = lanAddress, saveDir, ttlMs = TEN_MINUTES_MS, maxFileBytes = MAX_FILE_BYTES, maxFiles = MAX_FILES, onChange = () => {}, fsImpl = fs } = {}) {
  let server = null;
  let isStarting = false;
  let timer = null;
  let state = { running: false, url: null, expiresAt: null, phone: false, received: [] };
  let token = '';
  let host = '';
  let phoneIp = null;
  let accepted = 0; // started uploads, so several at once cannot pass the limit

  const change = (patch) => { state = { ...state, ...patch }; onChange(status()); };
  const status = () => ({ ...state, received: [...state.received], saveDir });

  function reply(res, code, text, type = 'text/plain; charset=utf-8') {
    res.writeHead(code, {
      'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'",
    });
    res.end(text);
  }
  const refuse = (req, res, code, text) => { // answer, then drop the connection so a big body is never read
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', Connection: 'close' });
    res.end(text, () => req.destroy());
  };

  function receive(req, res, name) {
    accepted += 1;
    let target;
    try { target = openNewFile(saveDir, name, fsImpl); } catch { accepted -= 1; return reply(res, 500, 'The PC could not save the file.'); }
    const out = fsImpl.createWriteStream(target.file, { fd: target.fd });
    let bytes = 0;
    let isDone = false;
    // Stop, remove the half-written file once its handle is closed (Windows will not delete an open file), then answer.
    const abandon = (code, text) => {
      if (isDone) return;
      isDone = true;
      accepted -= 1;
      const finish = () => {
        try { fsImpl.unlinkSync(target.file); } catch { /* already gone */ }
        if (code) refuse(req, res, code, text);
      };
      if (out.closed) finish(); else { out.once('close', finish); out.destroy(); }
    };
    out.on('error', () => abandon(500, 'The PC could not save the file.')); // disk full, file locked...
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxFileBytes) return abandon(413, 'That file is too large.');
      if (!isDone && !out.write(chunk)) { req.pause(); out.once('drain', () => req.resume()); } // a fast phone must not fill memory
    });
    req.on('aborted', () => abandon());
    req.on('error', () => abandon());
    req.on('end', () => {
      if (isDone) return;
      out.end((error) => {
        if (error || isDone) return;
        isDone = true;
        // Mark it as coming from outside, like a browser download. Best effort: only NTFS drives have this tag.
        try { fsImpl.writeFileSync(`${target.file}:Zone.Identifier`, '[ZoneTransfer]\r\nZoneId=3\r\n'); } catch { /* not NTFS */ }
        change({ received: [...state.received, { name: path.basename(target.file), bytes }] });
        reply(res, 200, 'ok');
      });
    });
  }

  function handle(req, res) {
    if (!isPrivateAddress(req.socket.remoteAddress)) return req.destroy();
    if (req.headers.host !== host) return reply(res, 404, 'Not found');
    if (req.method !== 'GET' && req.method !== 'POST') return reply(res, 405, 'Not allowed');
    let url;
    try { url = new URL(req.url, 'http://phone'); } catch { return reply(res, 400, 'Bad request'); }
    if (req.method === 'GET' && url.pathname === '/app.js') return reply(res, 200, page.JS, 'text/javascript; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/app.css') return reply(res, 200, page.CSS, 'text/css; charset=utf-8');
    if (!sameText(url.searchParams.get('t') || '', token)) return reply(res, 404, 'Not found');
    const remote = req.socket.remoteAddress;
    if (!phoneIp) { phoneIp = remote; change({ phone: true }); } // the first phone to use the code keeps it
    if (remote !== phoneIp) return reply(res, 404, 'Not found');
    if (req.method === 'GET' && url.pathname === '/') return reply(res, 200, page.HTML, 'text/html; charset=utf-8');
    if (req.method !== 'POST' || url.pathname !== '/up') return reply(res, 404, 'Not found');
    const name = cleanFileName(url.searchParams.get('name'));
    if (isProgramFile(name)) return refuse(req, res, 400, 'Programs and scripts are not accepted.');
    if (accepted >= maxFiles) return refuse(req, res, 429, `At most ${maxFiles} files per link.`);
    const length = Number(req.headers['content-length']);
    if (!Number.isFinite(length) || length < 0) return refuse(req, res, 411, 'The file size is missing.');
    if (length > maxFileBytes) return refuse(req, res, 413, 'That file is too large.');
    return receive(req, res, name);
  }

  function stop() {
    clearTimeout(timer);
    timer = null;
    if (!server) return;
    const closing = server;
    server = null;
    closing.close();
    closing.closeAllConnections();
    change({ running: false, url: null, expiresAt: null, phone: false });
  }

  async function start() {
    if (server || isStarting) throw new Error('The phone link is already running.');
    const address = getAddress();
    if (!address) throw new Error('No home network found. Connect this PC to Wi-Fi first.');
    isStarting = true; // a second press while the first is still starting must not make a second server
    const created = http.createServer(handle);
    try {
      fsImpl.mkdirSync(saveDir, { recursive: true });
      await new Promise((resolve, reject) => { created.once('error', reject); created.listen(0, address, resolve); });
    } finally { isStarting = false; }
    token = crypto.randomBytes(24).toString('hex');
    phoneIp = null;
    accepted = 0;
    server = created;
    host = `${address}:${created.address().port}`;
    const url = `http://${host}/`;
    const expiresAt = Date.now() + ttlMs;
    timer = setTimeout(stop, ttlMs);
    change({ running: true, url, expiresAt, phone: false, received: [] });
    return { url, token, expiresAt, link: `${url}?t=${token}` };
  }

  return { start, stop, status };
}

module.exports = { createPhoneLink, isPrivateAddress, cleanFileName, lanAddress };
