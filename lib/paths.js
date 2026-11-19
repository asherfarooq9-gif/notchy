// Small path checks shared by the shelf, the converters and the assistant.
const path = require('path');

// "\\computer\share\file" and "\\?\..." point at other computers or special areas. Touching them can leak your
// Windows sign-in to that computer, so the shelf and converter never use them.
const isNetworkPath = (file) => typeof file === 'string' && (file.startsWith('\\\\') || file.startsWith('//'));

// Programs and scripts: the shelf will list them, but never launch them.
const PROGRAM_EXTENSIONS = new Set([
  '.exe', '.com', '.bat', '.cmd', '.ps1', '.psm1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.msi', '.msp',
  '.scr', '.lnk', '.hta', '.cpl', '.reg', '.jar', '.dll', '.appx', '.msix', '.url', '.pif', '.gadget',
  // documents with macros, disk images and Windows settings or shortcut files that can run things
  '.docm', '.xlsm', '.pptm', '.dotm', '.xlam', '.iso', '.chm', '.scf', '.rdp', '.inf', '.msc', '.theme', '.sct', '.wsc',
  '.application', '.appref-ms', '.library-ms', '.settingcontent-ms',
]);
const isProgramFile = (file) => PROGRAM_EXTENSIONS.has(path.extname(String(file)).toLowerCase());

// A full path on this computer (not relative, not on another computer).
const isLocalAbsolute = (file) => typeof file === 'string' && path.isAbsolute(file) && !isNetworkPath(file);

function uniqueOutputPath(dir, sourceName, extension, exists, label = 'converted') {
  const base = path.parse(sourceName).name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80) || 'file';
  for (let n = 1; n < 1000; n++) {
    const candidate = path.join(dir, `${base} (${label}${n === 1 ? '' : ' ' + n}).${extension}`);
    if (!exists(candidate)) return candidate;
  }
  throw new Error('Too many converted copies already exist in that folder');
}

module.exports = { isNetworkPath, isProgramFile, isLocalAbsolute, uniqueOutputPath };
