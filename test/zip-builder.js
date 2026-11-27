// Test helper (not a test): builds small zip files and Word documents in memory, so the link checks can be tried on real bytes.
const zlib = require('node:zlib');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

// entries: [{ name, data }]. deflate: compress the parts. comment: text placed after the end record.
function buildZip(entries, { deflate = false, comment = '' } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const raw = Buffer.from(data);
    const stored = deflate ? zlib.deflateRawSync(raw) : raw;
    const method = deflate ? 8 : 0;
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(raw), 14); local.writeUInt32LE(stored.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc32(raw), 16); central.writeUInt32LE(stored.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, stored);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + stored.length;
  }
  const directory = Buffer.concat(centrals);
  const note = Buffer.isBuffer(comment) ? comment : Buffer.from(comment);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(note.length, 20);
  return Buffer.concat([...locals, directory, end, note]);
}

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const relsFile = (...tags) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tags.join('')}</Relationships>`;
const inside = (id, kind, target) => `<Relationship Id="${id}" Type="${REL}/${kind}" Target="${target}"/>`;
const outside = (id, kind, target) => `<Relationship Id="${id}" Type="${REL}/${kind}" Target="${target}" TargetMode="External"/>`;

// A minimal Word document whose settings part carries the given relationship tags.
function buildDocx(settingsTags = [], options = {}) {
  return buildZip([
    { name: '[Content_Types].xml', data: '<Types/>' },
    { name: '_rels/.rels', data: relsFile(inside('rId1', 'officeDocument', 'word/document.xml')) },
    { name: 'word/document.xml', data: '<w:document/>' },
    { name: 'word/_rels/settings.xml.rels', data: relsFile(...settingsTags) },
  ], options);
}

module.exports = { buildZip, buildDocx, relsFile, inside, outside, REL };
