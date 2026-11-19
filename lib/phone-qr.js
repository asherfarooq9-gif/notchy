// The QR picture for the phone link, as plain SVG text. The text to encode is never put in the picture, only dots.
const qrcode = require('qrcode-generator');

const MAX_TEXT_CHARS = 200;
const QUIET_ZONE = 2; // blank border (in dots) so phone cameras can find the code

function qrSvg(text) {
  if (typeof text !== 'string' || !text || text.length > MAX_TEXT_CHARS) throw new Error('The link is too long for a QR code.');
  const code = qrcode(0, 'M');
  code.addData(text);
  code.make();
  const size = code.getModuleCount();
  let dots = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (code.isDark(y, x)) dots += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
  }
  const total = size + QUIET_ZONE * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR code for the phone link"><rect width="${total}" height="${total}" fill="#ffffff"/><path d="${dots}" fill="#000000"/></svg>`;
}

module.exports = { qrSvg };
