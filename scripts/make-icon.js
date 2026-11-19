// Draws assets/icon.png (512 x 512) from the Batman face in renderer/heroes.js, for the installer and the app's icon.
// Run it when the face changes:  node_modules\.bin\electron.cmd scripts\make-icon.js
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');
const Heroes = require('../renderer/heroes.js');

const SIZE = 512;
const FACE = 360;
const OUT = path.join(__dirname, '..', 'assets', 'icon.png');

app.whenReady().then(async () => {
  const face = Heroes.markup('batman', { size: FACE });
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}
    .tile{width:${SIZE}px;height:${SIZE}px;border-radius:112px;background:#14141a;display:flex;align-items:center;justify-content:center}</style>
    <div class="tile">${face}</div>`;
  const win = new BrowserWindow({ show: false, width: SIZE, height: SIZE, useContentSize: true, transparent: true, frame: false, webPreferences: { offscreen: true, javascript: false } });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const shot = (await win.webContents.capturePage()).resize({ width: SIZE, height: SIZE, quality: 'best' }); // the screen's scaling can make the capture larger
  fs.writeFileSync(OUT, shot.toPNG());
  console.log('wrote', OUT, SIZE + 'x' + SIZE);
  app.quit();
});
