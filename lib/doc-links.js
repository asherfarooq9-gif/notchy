// Looks inside a Word document (.docx is a zip file) for links to other places, WITHOUT opening it in Word.
// Word follows some of these links by itself while it opens a file (a remote template, a linked picture), which tells
// the other computer you opened it and can hand over your Windows sign-in. Plain clickable web links are fine.
// Anything this cannot read with certainty is reported as "unreadable", never as "clean".
const zlib = require('zlib');

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const END_SIZE = 22;
const MAX_COMMENT = 0xffff;
const MAX_ENTRIES = 20000;
const MAX_REL_PARTS = 500;
const MAX_PART_BYTES = 1024 * 1024;
const STORED = 0;
const DEFLATED = 8;
const HYPERLINK_TYPE = /\/relationships\/hyperlink$/;

// Every spot where a valid end-of-zip record could sit. More than one means two readers could disagree about the file.
function endRecords(buf) {
  const found = [];
  const first = Math.max(0, buf.length - END_SIZE - MAX_COMMENT);
  for (let at = buf.length - END_SIZE; at >= first; at--) {
    if (buf.readUInt32LE(at) === SIG_END && at + END_SIZE + buf.readUInt16LE(at + 20) === buf.length) found.push(at);
  }
  return found;
}

// [{ name, method, flags, size, offset }] for every part, or null if the directory cannot be trusted.
function readDirectory(buf, end) {
  const count = buf.readUInt16LE(end + 10);
  const start = buf.readUInt32LE(end + 16);
  const length = buf.readUInt32LE(end + 12);
  if (count > MAX_ENTRIES || count === 0xffff || start === 0xffffffff || start + length > end) return null;
  const entries = [];
  let at = start;
  for (let n = 0; n < count; n++) {
    if (at + 46 > buf.length || buf.readUInt32LE(at) !== SIG_CENTRAL) return null;
    const nameLength = buf.readUInt16LE(at + 28);
    const next = at + 46 + nameLength + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
    if (next > buf.length) return null;
    entries.push({ name: buf.toString('utf8', at + 46, at + 46 + nameLength), flags: buf.readUInt16LE(at + 8), method: buf.readUInt16LE(at + 10), size: buf.readUInt32LE(at + 20), offset: buf.readUInt32LE(at + 42) });
    at = next;
  }
  return entries;
}

// The text of one relationship part, or null if it cannot be read with certainty.
function readPart(buf, entry) {
  const at = entry.offset;
  if (entry.flags & 1 || at + 30 > buf.length || buf.readUInt32LE(at) !== SIG_LOCAL) return null; // encrypted, or the directory points at nothing
  const nameLength = buf.readUInt16LE(at + 26);
  if (buf.toString('utf8', at + 30, at + 30 + nameLength) !== entry.name) return null; // the two copies of the name must agree
  const from = at + 30 + nameLength + buf.readUInt16LE(at + 28);
  if (from + entry.size > buf.length) return null;
  const packed = buf.subarray(from, from + entry.size);
  let data;
  try {
    if (entry.method === STORED) data = packed;
    else if (entry.method === DEFLATED) data = zlib.inflateRawSync(packed, { maxOutputLength: MAX_PART_BYTES });
    else return null;
  } catch { return null; }
  return data.length <= MAX_PART_BYTES && !data.includes(0) ? data.toString('utf8') : null; // a zero byte means a text format we do not read
}

function attributesOf(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3];
  return out;
}

// Relationships that reach outside the file. Only an unmarked or plainly "Internal" one counts as inside; anything odd counts as outside.
function outsideRelationships(xml) {
  const links = [];
  for (const [tag] of xml.matchAll(/<(?:[\w.-]+:)?Relationship\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const a = attributesOf(tag);
    const isInside = a.targetmode === undefined || a.targetmode.toLowerCase() === 'internal';
    if (!isInside && !HYPERLINK_TYPE.test(a.type || '')) links.push({ type: a.type || '', target: a.target || '' });
  }
  return links;
}

// -> { isZip, unreadable, links: [{type, target}] }
function inspectPackage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf.readUInt32LE(0) !== SIG_LOCAL) return { isZip: false, unreadable: false, links: [] };
  const unreadable = { isZip: true, unreadable: true, links: [] };
  const ends = endRecords(buf);
  if (ends.length !== 1) return unreadable;
  const entries = readDirectory(buf, ends[0]);
  if (!entries) return unreadable;
  const parts = entries.filter((e) => /\.rels$/i.test(e.name));
  if (parts.length > MAX_REL_PARTS) return unreadable;
  const links = [];
  for (const part of parts) {
    const xml = readPart(buf, part);
    if (xml === null) return unreadable;
    links.push(...outsideRelationships(xml));
  }
  return { isZip: true, unreadable: false, links };
}

// ---- RTF files: Word follows an attached template named in an RTF file just as it does in a .docx (checked with real Word) ----
const RTF_MARK = '{\\rtf';
const RTF_SNIFF_BYTES = 1024;
const RTF_TEMPLATE = /\\template\b([^}]*)\}/g;
const RTF_LINKED_OBJECT = /\\obj(?:aut)?link\b/;
const LOCAL_DRIVE = /^[A-Za-z]:[\\/]/;

// -> { isRtf, links: [{type, target}] }. A template on a drive of this computer is normal (Word saves one in every RTF);
// anything else (a web address, a network share) and any linked object counts as pointing outside.
function inspectRtf(buf) {
  if (!Buffer.isBuffer(buf) || !buf.toString('latin1', 0, RTF_SNIFF_BYTES).includes(RTF_MARK)) return { isRtf: false, links: [] };
  const text = buf.toString('latin1');
  const links = [];
  for (const [, raw] of text.matchAll(RTF_TEMPLATE)) {
    const target = raw.replace(/\\\\/g, '\\').replace(/\\'[0-9a-f]{2}/gi, '?').trim(); // RTF writes one backslash as two
    if (target && !LOCAL_DRIVE.test(target)) links.push({ type: 'template', target });
  }
  if (RTF_LINKED_OBJECT.test(text)) links.push({ type: 'linked object', target: '' });
  return { isRtf: true, links };
}

// ---- The old binary Word format (.doc): an attached template is stored inside as plain or UTF-16 text (checked with real Word) ----
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const OLE_WINDOW_BYTES = 8 * 1024 * 1024; // the file is looked at in pieces, so a big file does not need a lot of memory
const OLE_OVERLAP_BYTES = 1024; // pieces overlap by more than the longest address looked at, so none is cut in two
const MAX_ADDRESSES_LISTED = 5;
const ADDRESS = /(?:(?:https?|ftps?|file|smb|davs?|ldaps?|wss?):\/\/[\x21-\x7e]{1,200}|\\\\[\w.$@-][\x21-\x7e]{0,200})/gi; // a web address or a network share
// Every Word file carries a few of these, so they say nothing. Each ends in a slash, so "schemas.microsoft.com.evil.example" does not match.
const HARMLESS_ADDRESSES = ['http://schemas.openxmlformats.org/', 'http://schemas.microsoft.com/', 'http://www.w3.org/', 'http://purl.org/', 'http://ns.adobe.com/'];

function collectAddresses(text, found) {
  for (const [address] of text.matchAll(ADDRESS)) {
    const lower = address.toLowerCase();
    if (!HARMLESS_ADDRESSES.some((prefix) => lower.startsWith(prefix))) found.add(address.slice(0, 120));
  }
}

// -> { isOle, links: [{type, target}] }. The file is not taken apart: every address in it, in plain or UTF-16 text, is looked for.
// A hyperlink in the text counts too (it cannot be told from a template here), which is why the answer for such a file is
// "save it as .docx first" rather than "unsafe".
function inspectOle(buf, { windowBytes = OLE_WINDOW_BYTES, overlapBytes = OLE_OVERLAP_BYTES } = {}) {
  if (!Buffer.isBuffer(buf) || buf.length < OLE_MAGIC.length || !buf.subarray(0, OLE_MAGIC.length).equals(OLE_MAGIC)) return { isOle: false, links: [] };
  const found = new Set();
  for (let start = 0; start < buf.length && found.size < MAX_ADDRESSES_LISTED; start += windowBytes) {
    const piece = buf.subarray(start, Math.min(buf.length, start + windowBytes + overlapBytes));
    for (const text of [piece.toString('latin1'), piece.toString('utf16le'), piece.subarray(1).toString('utf16le')]) collectAddresses(text, found); // UTF-16 text can start on an odd or an even byte
  }
  return { isOle: true, links: [...found].map((target) => ({ type: 'address', target })) };
}

// Sorts a file by what it really is, not by its name. -> { kind: 'zip' | 'rtf' | 'ole' | 'other', unreadable, links }
function inspectDocument(buf) {
  const zip = inspectPackage(buf);
  if (zip.isZip) return { kind: 'zip', unreadable: zip.unreadable, links: zip.links };
  const rtf = inspectRtf(buf);
  if (rtf.isRtf) return { kind: 'rtf', unreadable: false, links: rtf.links };
  const ole = inspectOle(buf);
  if (ole.isOle) return { kind: 'ole', unreadable: false, links: ole.links };
  return { kind: 'other', unreadable: false, links: [] };
}

module.exports = { inspectPackage, inspectRtf, inspectOle, inspectDocument };
