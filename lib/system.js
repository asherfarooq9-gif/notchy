// Numbers for the System tool: CPU, memory, disk and Wi-Fi, sampled once a second while the panel is open.
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

const HISTORY_LENGTH = 60; // the last minute
const DISK_EVERY_TICKS = 10;
const WIFI_EVERY_TICKS = 20;
const WIFI_TIMEOUT_MS = 5000;
const BYTES_PER_GB = 1024 ** 3;

const cpuTimes = () => os.cpus().map((core) => core.times);

// How busy the CPU was between two snapshots, as a whole percent.
function cpuPercent(previous, current) {
  let idle = 0;
  let total = 0;
  current.forEach((now, i) => {
    const before = previous[i] || now;
    const busyTime = now.user - before.user + (now.nice - before.nice) + (now.sys - before.sys) + (now.irq - before.irq);
    const idleTime = now.idle - before.idle;
    idle += idleTime;
    total += busyTime + idleTime;
  });
  return total <= 0 ? 0 : Math.round(((total - idle) / total) * 100);
}

// Reads "netsh wlan show interfaces" text. Returns null when not connected to Wi-Fi.
function parseWifi(text) {
  const ssid = /^\s*SSID\s*:\s*(.+)$/m.exec(text);
  const signal = /^\s*Signal\s*:\s*(\d+)\s*%/m.exec(text);
  return ssid ? { ssid: ssid[1].trim(), signal: signal ? Number(signal[1]) : null } : null;
}

// Runs netsh with a fixed argument list (no shell) and calls back with its text, or null on any failure.
function readNetsh(done) {
  const child = spawn('netsh', ['wlan', 'show', 'interfaces'], { windowsHide: true });
  let output = '';
  const timer = setTimeout(() => child.kill(), WIFI_TIMEOUT_MS);
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.on('error', () => { clearTimeout(timer); done(null); });
  child.on('close', (code) => { clearTimeout(timer); done(code === 0 ? output : null); });
}

const push = (list, value) => [...list, value].slice(-HISTORY_LENGTH);

function createSampler({ onSample }) {
  let timer = null;
  let ticks = 0;
  let lastTimes = cpuTimes();
  let history = { cpu: [], mem: [] };
  let disk = null;
  let wifi = null;

  function readDisk() {
    const drive = process.env.SystemDrive ? process.env.SystemDrive + '\\' : 'C:\\';
    fs.promises.statfs(drive)
      .then((s) => {
        const total = s.blocks * s.bsize;
        const free = s.bavail * s.bsize;
        disk = { usedPercent: total ? Math.round(((total - free) / total) * 100) : 0, freeGb: Math.round((free / BYTES_PER_GB) * 10) / 10 };
      })
      .catch(() => { disk = null; }); // no disk reading: the tool shows a dash
  }

  function tick() {
    const now = cpuTimes();
    const cpu = ticks === 0 ? 0 : cpuPercent(lastTimes, now); // the very first reading has nothing to compare with
    lastTimes = now;
    const mem = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
    history = { cpu: push(history.cpu, cpu), mem: push(history.mem, mem) };
    if (ticks % DISK_EVERY_TICKS === 0) readDisk();
    if (ticks % WIFI_EVERY_TICKS === 0) readNetsh((text) => { wifi = text ? parseWifi(text) : null; });
    ticks += 1;
    onSample({ cpu, mem, disk, wifi, history });
  }

  return {
    start() {
      if (timer) return;
      lastTimes = cpuTimes();
      ticks = 0;
      timer = setInterval(tick, 1000);
      tick();
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}

module.exports = { createSampler, cpuPercent, parseWifi };
