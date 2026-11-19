// Builders for the File Converter: an icon file (.ico) from PNG pictures, and a PDF from JPEG pictures.
// The panel draws and compresses the pictures; this file only wraps them, and checks they really are what they claim to be.
const path = require('path');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PX_TO_POINTS = 0.75; // a PDF page is measured in points: 96 screen pixels = 72 points

function pngSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('That is not a PNG picture');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// Walks the JPEG's blocks until the one that states the picture size.
function jpegSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error('That is not a JPEG picture');
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) { i++; continue; }
    const marker = buffer[i + 1];
    if (marker === 0xff) { i++; continue; }
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
    i += 2 + buffer.readUInt16BE(i + 2);
  }
  throw new Error('Could not read the size of that JPEG picture');
}

// pngs: array of PNG buffers, each up to 256 x 256.
function buildIco(pngs) {
  if (!Array.isArray(pngs) || !pngs.length) throw new Error('There are no pictures for the icon');
  const sizes = pngs.map(pngSize);
  sizes.forEach(({ width, height }) => { if (width > 256 || height > 256) throw new Error('Icon pictures can be 256 pixels at most'); });
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach((png, i) => {
    const entry = 6 + 16 * i;
    header[entry] = sizes[i].width === 256 ? 0 : sizes[i].width; // 0 means 256
    header[entry + 1] = sizes[i].height === 256 ? 0 : sizes[i].height;
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...pngs]);
}

// pages: array of JPEG buffers. One picture per page, the page exactly the size of the picture.
function buildPdf(pages) {
  if (!Array.isArray(pages) || !pages.length) throw new Error('There are no pictures for the PDF');
  const sized = pages.map((jpeg) => ({ jpeg, ...jpegSize(jpeg) }));
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (part) => { const buf = Buffer.isBuffer(part) ? part : Buffer.from(part, 'latin1'); chunks.push(buf); length += buf.length; };
  const object = (number, ...parts) => { offsets[number] = length; push(`${number} 0 obj\n`); parts.forEach(push); push('\nendobj\n'); };
  const points = (px) => Math.round(px * PX_TO_POINTS * 100) / 100;

  push('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Count ${sized.length} /Kids [${sized.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] >>`);
  sized.forEach(({ jpeg, width, height }, i) => {
    const [page, image, content] = [3 + 3 * i, 4 + 3 * i, 5 + 3 * i];
    const [w, h] = [points(width), points(height)];
    const draw = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    object(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`);
    object(image, `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream');
    object(content, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  });
  const count = 3 * sized.length + 2;
  const xrefAt = length;
  push(`xref\n0 ${count + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= count; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  return Buffer.concat(chunks);
}

// "Photo.png" + "jpg" -> "Photo (converted).jpg", or "Photo (converted 2).jpg" if that is taken. Never overwrites.
module.exports = { buildIco, buildPdf, pngSize, jpegSize };
