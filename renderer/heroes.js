// The hero drawings, in one place. Used by the notch icon, the tray icon, the panel and the settings window.
// They are my own simple cartoons in each hero's colors, not official artwork.
// Loads in the page (as window.Heroes) and in Node (require), so the tray icon can use the same drawings.
(function (root) {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Shared look: a dark outline on every shape, plus a soft shade (bottom right) and gloss (top left) laid over the big shapes.
  // "__U__" is swapped for a number in markup(), so two pictures on one page never share a gradient name.
  const O = ' stroke="#14141c" stroke-width=".55" stroke-linejoin="round" stroke-linecap="round"';
  const vol = (d) => `<path d="${d}" fill="url(#hs__U__)"/><path d="${d}" fill="url(#hg__U__)"/>`;
  const defs = (u) => `<defs><linearGradient id="hs${u}" x1="0" y1="0" x2="1" y2="1"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient><linearGradient id="hg${u}" x1="0" y1="0" x2=".7" y2=".9"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;
  const shine = (d) => `<path d="${d}" stroke="#fff" stroke-opacity=".5" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
  const SKIN = '#efc29a';
  const SKIN_DARK = '#d29c74';
  const HEAD = 'M12 2.6C8.4 2.6 6.4 5.4 6.4 9.2V14.2C6.4 19.2 8.8 22.8 12 23.2 15.2 22.8 17.6 19.2 17.6 14.2V9.2C17.6 5.4 15.6 2.6 12 2.6Z';
  const ears = (fill = SKIN, y = 12.8) => `<ellipse cx="6.1" cy="${y}" rx="1.1" ry="1.8" fill="${fill}"${O}/><ellipse cx="17.9" cy="${y}" rx="1.1" ry="1.8" fill="${fill}"${O}/>`;
  const nose = (y1 = 10.8, y2 = 14.6) => `<path d="M12 ${y1}V${y2}Q11.2 ${y2 + 0.8} 10.4 ${y2 + 0.4}" stroke="#b9855f" stroke-width=".6" fill="none" stroke-linecap="round"/>`;

  const IRON_HELM = 'M12 -1.6C6.4 -1.6 3.4 2 3.2 7.5L3 15C3 19.8 6 23 9 24.6L12 25.6 15 24.6C18 23 21 19.8 21 15L20.8 7.5C20.6 2 17.6 -1.6 12 -1.6Z';
  const IRON_PLATE = 'M5.4 5.4C5.4 2.8 8 .8 12 .8S18.6 2.8 18.6 5.4L19 13.5C19 17.8 17 20.8 14.8 22.4L12 23.6 9.2 22.4C7 20.8 5 17.8 5 13.5Z';
  const SPIDER_HEAD = 'M12 -1.8C6.6 -1.8 3.2 2.8 3.2 9.6 3.2 16.6 7.2 24.4 12 24.4S20.8 16.6 20.8 9.6C20.8 2.8 17.4 -1.8 12 -1.8Z';
  const DOOM_HOOD = 'M12 -1.8C6 -1.8 1.4 3.4 1.4 11V19C1.4 23 5.6 25.4 12 25.4S22.6 23 22.6 19V11C22.6 3.4 18 -1.8 12 -1.8Z';
  const DOOM_MASK = 'M5.8 7C7.2 5.6 16.8 5.6 18.2 7V15.4C18.2 20 15.6 23 12 23.4S5.8 20 5.8 15.4Z';
  const STRANGE_FACE = 'M7.4 8.2C7.4 4.6 9.4 3 12 3S16.6 4.6 16.6 8.2V14C16.6 18.6 14.6 21.8 12 22.2S7.4 18.6 7.4 14Z';
  const HULK_FACE = 'M3 10.4C3 4.8 7 2.8 12 2.8S21 4.8 21 10.4V15.8C21 21.6 17.2 25 12 25S3 21.6 3 15.8Z';
  const JOKER_FACE = 'M7 8.6C7 5 9.2 3.6 12 3.6S17 5 17 8.6V14.4C17 19 14.8 22 12 22.6S7 19 7 14.4Z';
  const CAP_COWL = 'M12 -1.2C6.6 -1.2 3 2.6 3 8.6V14C3 19.6 6.6 24 12 24S21 19.6 21 14V8.6C21 2.6 17.4 -1.2 12 -1.2Z';
  const CAP_FACE = 'M5.2 12.4C7.4 10.4 16.6 10.4 18.8 12.4V15.2C18.8 19.6 16 22.6 12 22.6S5.2 19.6 5.2 15.2Z';
  const PANTHER_HEAD = 'M3.6 9.6C3.6 4.4 7.2 1.6 12 1.6S20.4 4.4 20.4 9.6V13.4C20.4 19 17.2 23.4 12 24.2 6.8 23.4 3.6 19 3.6 13.4Z';
  const BAT_COWL = 'M12 1.8C6.6 1.8 3.6 5.6 3.6 11.2 3.6 17.4 6.8 22.8 12 25 17.2 22.8 20.4 17.4 20.4 11.2 20.4 5.6 17.4 1.8 12 1.8Z';
  const WOLF_COWL = 'M12 1.4C7.2 1.4 4.6 5 4.6 10V13.6C4.6 19.6 7.6 24 12 24S19.4 19.6 19.4 13.6V10C19.4 5 16.8 1.4 12 1.4Z';
  const FLASH_COWL = 'M12 -1.4C6.4 -1.4 3.2 3 3.2 9.6V15C3.2 20.4 6.8 24.6 12 24.6S20.8 20.4 20.8 15V9.6C20.8 3 17.6 -1.4 12 -1.4Z';
  const FLASH_FACE = 'M6.4 9.6C6.4 6.6 9 5.6 12 5.6S17.6 6.6 17.6 9.6V14.8C17.6 19 15.2 22 12 22.6 8.8 22 6.4 19 6.4 14.8Z';

  // Each drawing fits a 24 by 24 face box; the picture window is -2 -2 28 28, so ears and fins can stick out.
  const DRAWINGS = {
  ironman: `
      <path d="${IRON_HELM}" fill="#b3121a"${O}/>${vol(IRON_HELM)}
      <path d="${IRON_PLATE}" fill="#eab93a"${O}/>${vol(IRON_PLATE)}
      <path d="M9.6 .8H14.4V7.2C14.4 7.9 13.9 8.4 13.2 8.4H10.8C10.1 8.4 9.6 7.9 9.6 7.2Z" fill="#b3121a"${O}/>
      <path d="M5.8 10.6C9 9.4 15 9.4 18.2 10.6M6.4 15.6L9.4 21.6M17.6 15.6L14.6 21.6" stroke="#b88a1c" stroke-width=".55" fill="none"/>
      <rect x="5.2" y="11.1" width="6.4" height="2.6" rx="1.3" transform="rotate(14 8.4 12.4)" fill="#3b4452" stroke="#14141c" stroke-width=".4"/>
      <rect x="12.4" y="11.1" width="6.4" height="2.6" rx="1.3" transform="rotate(-14 15.6 12.4)" fill="#3b4452" stroke="#14141c" stroke-width=".4"/>
      <path d="M7.6 19.2H16.4L14.6 21.2H9.4Z" fill="none" stroke="#7a5410" stroke-width=".6"/>
      <path d="M9.4 23.2L12 24.8 14.6 23.2 12 22.6Z" fill="#b3121a"/>
      ${shine('M5.4 5C6 2.6 8 1.2 10.4 .6')}
    `,
  captain: `
      <path d="M3.2 6.6L-1.8 3.4Q-.8 6.8 -2.4 8.8 .8 8.6 -.6 11.4L3 10.6Z M20.8 6.6L25.8 3.4Q24.8 6.8 26.4 8.8 23.2 8.6 24.6 11.4L21 10.6Z" fill="#f1f5f9"${O}/>
      <path d="${CAP_COWL}" fill="#1d4ed8"${O}/>${vol(CAP_COWL)}
      <path d="${CAP_FACE}" fill="${SKIN}"${O}/>${vol(CAP_FACE)}
      <rect x="3.9" y="6.9" width="6.2" height="4.2" rx="2.1" fill="#0b1a4a"/><rect x="13.9" y="6.9" width="6.2" height="4.2" rx="2.1" fill="#0b1a4a"/>
      <path d="M12 -.4L14.6 5.6H13.2L12.7 4.4H11.3L10.8 5.6H9.4Z" fill="#ffffff"${O}/>
      <path d="M12 1.8L12.4 3.2H11.6Z" fill="#1d4ed8"/>
      <path d="M12 11V14.6Q11.2 15.4 10.4 15" stroke="#b9855f" stroke-width=".6" fill="none" stroke-linecap="round"/>
      <path d="M5.4 14.4C5.6 19.6 8.6 22.6 12 22.6" stroke="#0b1a4a" stroke-width=".7" fill="none"/><path d="M18.6 14.4C18.4 19.6 15.4 22.6 12 22.6" stroke="#0b1a4a" stroke-width=".7" fill="none"/>
      <path d="M9.6 18.4Q12 20 14.4 18.4" stroke="#8a5a3a" stroke-width=".8" fill="none" stroke-linecap="round"/>
      ${shine('M5 5C6 2.4 8.4 .8 11 .4')}
    `,
  spiderman: `
      <path d="${SPIDER_HEAD}" fill="#dc2626"${O}/>${vol(SPIDER_HEAD)}
      <path d="M12 -1.8V12 M12 .6L5.8 6.4 M12 .6L18.2 6.4 M5 3.6Q12 7 19 3.6 M12 13.5V24.4 M12 13.5L7.2 22 M12 13.5L16.8 22 M12 13.5L4.2 16.6 M12 13.5L19.8 16.6 M7.2 17.2Q12 19.8 16.8 17.2 M8.6 20.8Q12 22.6 15.4 20.8" stroke="#2a0606" stroke-width=".55" fill="none"/>
      <ellipse cx="7.6" cy="10.4" rx="4.9" ry="3.4" transform="rotate(30 7.6 10.4)" fill="#0a0a0a" stroke="#f8fafc" stroke-width=".5"/>
      <ellipse cx="16.4" cy="10.4" rx="4.9" ry="3.4" transform="rotate(-30 16.4 10.4)" fill="#0a0a0a" stroke="#f8fafc" stroke-width=".5"/>
      ${shine('M5.2 6C6 3 8.4 1 11 .2')}
    `,
  strange: `
      <path d="M-.6 25L-1.4 11 .6 2 7.4 11.4 7.6 25Z M24.6 25L25.4 11 23.4 2 16.6 11.4 16.4 25Z" fill="#c0261c"${O}/>
      <path d="M.6 2L7.4 11.4 7.6 25 6 25 5.6 14Z M23.4 2L16.6 11.4 16.4 25 18 25 18.4 14Z" fill="#7f1d1d"/>
      <path d="M-.6 25L1.2 18 4.4 25Z M24.6 25L22.8 18 19.6 25Z" fill="#a31d16"/>
      <path d="M8 25L12 20 16 25Z" fill="#0e7490"${O}/>
      <circle cx="12" cy="22.6" r="1.2" fill="#facc15" stroke="#92400e" stroke-width=".35"/>
      <path d="${STRANGE_FACE}" fill="${SKIN}"${O}/>${vol(STRANGE_FACE)}
      <path d="M7.4 14C7.6 17.6 9.2 20.4 12 20.8 14.8 20.4 16.4 17.6 16.6 14 15.6 16 14 16.8 12 16.8S8.4 16 7.4 14Z" fill="#d8ae86"/>
      <path d="M6.4 10.4C5.6 3.2 9 -1.4 14.2 -1.2 18.4 -1 19.6 2.4 18.6 8 17.8 5.2 15.4 3.4 12 3.6S8 5.6 7.6 9.8Z" fill="#33211a"${O}/>
      <path d="M7.2 4.6C6.4 6.4 6.2 8.6 6.8 10.6L7.8 8.4Z M16.8 3.6C18 5 18.4 7.4 17.8 10.2L16.8 6Z" fill="#cbd2da"/>
      <path d="M8.2 8.6L11 9.6M15.8 8.6L13 9.6" stroke="#2a1a12" stroke-width=".9" stroke-linecap="round" fill="none"/>
      <path d="M12 10.6V14.6Q11 15.4 10.4 15.2M12 14.6Q13 15.4 13.6 15.2" stroke="#b98c68" stroke-width=".5" fill="none"/>
      <path d="M9.2 17Q10.6 16.2 12 16.8 13.4 16.2 14.8 17 13.6 17.8 12 17.4 10.4 17.8 9.2 17Z" fill="#3b261b"/>
      <path d="M10.2 17.8Q12 21.6 13.8 17.8 13.4 20 12 20.4 10.6 20 10.2 17.8Z" fill="#3b261b"/>
    `,
  doom: `
      <path d="${DOOM_HOOD}" fill="#166534"${O}/>${vol(DOOM_HOOD)}
      <path d="M3.6 18Q3 10 6.6 4 M20.4 18Q21 10 17.4 4" stroke="#2a9a4a" stroke-width=".6" fill="none"/>
      <path d="M5 8C5.4 4 8.4 2.4 12 2.4S18.6 4 19 8V16.4C19 21.4 16 24 12 24S5 21.4 5 16.4Z" fill="#0d3a20"/>
      <path d="${DOOM_MASK}" fill="#a8b2c0"${O}/>${vol(DOOM_MASK)}
      <path d="M6 8.4L11.2 7.4 11 10.4 6.2 10.6Z M18 8.4L12.8 7.4 13 10.4 17.8 10.6Z" fill="#7b8696"/>
      <path d="M6.8 9.8H10.8L10.4 12H7.4Z M17.2 9.8H13.2L13.6 12H16.6Z" fill="#101a24"/>
      <path d="M11.2 12L12.8 12 13.4 17 12 17.6 10.6 17Z" fill="#8f99a8"/>
      <path d="M12 5.8V8.2 M8.6 19.4H15.4 M9 20.8H15 M9.6 22.1H14.4" stroke="#566070" stroke-width=".8" fill="none"/>
      <circle cx="7.2" cy="13.2" r=".45" fill="#5b6574"/><circle cx="16.8" cy="13.2" r=".45" fill="#5b6574"/><circle cx="7.4" cy="8.3" r=".4" fill="#5b6574"/><circle cx="16.6" cy="8.3" r=".4" fill="#5b6574"/>
      ${shine('M6.6 7C8.4 6 10 5.8 11.4 5.8')}
    `,
  blackpanther: `
      <path d="M4.6 8L3 -2.6 10.2 2.4Z M19.4 8L21 -2.6 13.8 2.4Z" fill="#17101f"${O}/>
      <path d="M5.2 5.6L4.4 .2 8.2 3Z M18.8 5.6L19.6 .2 15.8 3Z" fill="#5b21b6"/>
      <path d="${PANTHER_HEAD}" fill="#17101f"${O}/>${vol(PANTHER_HEAD)}
      <path d="M4.8 10.4C5 16 8 20.8 12 22.6 16 20.8 19 16 19.2 10.4" stroke="#8b5cf6" stroke-width=".6" fill="none"/>
      <path d="M3.9 7.4L9.9 10.2M20.1 7.4L14.1 10.2" stroke="#8b5cf6" stroke-width=".5" fill="none"/>
      <path d="M12 12.2L10.4 14.4H13.6Z" fill="#33224a"${O}/>
      <path d="M9.4 18.4Q12 19.8 14.6 18.4" stroke="#a78bfa" stroke-width=".7" fill="none" stroke-linecap="round"/>
      <path d="M7.2 24.2L8.2 26 9.2 24.4Z M10.6 24.8L11.4 26 12.2 24.8Z M12.8 24.8L13.6 26 14.4 24.4Z M14.8 24.4L15.8 26 16.8 24.2Z" fill="#e5e7eb"/>
      ${shine('M6.4 4.4C8 2.8 10 2.4 11.6 2.6')}
    `,
  hulk: `
      <path d="M3.8 11L1.2 9.6Q.4 13.6 3.8 16Z M20.2 11L22.8 9.6Q23.6 13.6 20.2 16Z" fill="#69a524"${O}/>
      <path d="${HULK_FACE}" fill="#7cc42c"${O}/>${vol(HULK_FACE)}
      <path d="M3 12.4C4.2 16.4 6 19.4 8.8 21.6 6 23.6 3 21 3 15.8Z M21 12.4C19.8 16.4 18 19.4 15.2 21.6 18 23.6 21 21 21 15.8Z" fill="#5b981c"/>
      <path d="M2.8 11.6C1.4 7 2.8 2.8 6 .6 6.4 1.8 7.4 2.4 8.6 2.2 9.4 -.6 11 -1.8 12.6 -1.2 13.6 -1.8 15.4 -1.2 15.8 1.6 17.2 0 19.2 .8 18.8 2.8 20.8 3.2 22.4 6.4 21.2 11.6 20.4 8.8 19 7.2 16.8 6.8 15.4 5.6 13.4 5.4 12 6.4 10.4 5.2 8.2 5.6 7 7 5 7.6 3.8 9.2 2.8 11.6Z" fill="#20271a"${O}/>
      <path d="M4.2 9.8Q8 7.4 11.8 10.6L11.6 12.8Q8 10.8 4.4 12.4Z M19.8 9.8Q16 7.4 12.2 10.6L12.4 12.8Q16 10.8 19.6 12.4Z" fill="#4a8416"/>
      <path d="M11.2 11.8H12.8L13.8 15.6Q12 16.8 10.2 15.6Z" fill="#639e20"/>
      <ellipse cx="10.9" cy="15.6" rx=".7" ry=".5" fill="#2f5a0e"/><ellipse cx="13.1" cy="15.6" rx=".7" ry=".5" fill="#2f5a0e"/>
      <path d="M6 17.8Q12 15.4 18 17.8 17.2 22.4 12 22.8 6.8 22.4 6 17.8Z" fill="#2b1212"${O}/>
      <path d="M7.2 18Q12 16.4 16.8 18 16.4 19.6 12 19.8 7.6 19.6 7.2 18Z" fill="#f4f1dc"/>
      <path d="M8.2 21.6Q12 20.4 15.8 21.6 14.8 22.6 12 22.7 9.2 22.6 8.2 21.6Z" fill="#e9e5cc"/>
      <path d="M9.8 17.8V19.8 M12 17.4V19.9 M14.2 17.8V19.8" stroke="#2b1212" stroke-width=".3" fill="none"/>
    `,
  thor: `
      <path d="M4.4 10C3.2 16 3.6 21 5.4 25.4L8.2 22V11Z M19.6 10C20.8 16 20.4 21 18.6 25.4L15.8 22V11Z" fill="#f2c53a"${O}/>
      <path d="M5.6 7.4L1.6 6.4 3.4 4.6 -.4 2.8 2.2 1.4 -.2 -1 3.6 -.4 2.8 -2.4 6.2 -.8 7 2.8Z" fill="#f1f5f9"${O}/>
      <path d="M18.4 7.4L22.4 6.4 20.6 4.6 24.4 2.8 21.8 1.4 24.2 -1 20.4 -.4 21.2 -2.4 17.8 -.8 17 2.8Z" fill="#f1f5f9"${O}/>
      <path d="M7.2 8.8H16.8V14.8C16.8 19.6 14.8 22.4 12 23 9.2 22.4 7.2 19.6 7.2 14.8Z" fill="${SKIN}"${O}/>
      <path d="M6.8 13C6.8 21 9.2 25 12 25.4 14.8 25 17.2 21 17.2 13 16 16.6 14.2 17.8 12 17.8 9.8 17.8 8 16.6 6.8 13Z" fill="#e0b02f"${O}/>
      <path d="M5.2 9.2C5.2 3 8 -.4 12 -.4S18.8 3 18.8 9.2Z" fill="#9aa6b8"${O}/>${vol('M5.2 9.2C5.2 3 8 -.4 12 -.4S18.8 3 18.8 9.2Z')}
      <path d="M5.2 6.8Q12 9 18.8 6.8V9.6Q12 11.8 5.2 9.6Z" fill="#cbd5e1"${O}/>
      <path d="M12 -.2V6.6" stroke="#64748b" stroke-width=".5"/>
      <path d="M8 11.2L11 11.6M16 11.2L13 11.6" stroke="#6b4a1a" stroke-width=".9" stroke-linecap="round" fill="none"/>
      <path d="M12 12.4V15Q11.4 15.6 10.8 15.4" stroke="#b9855f" stroke-width=".5" fill="none"/>
      <path d="M10.6 18.8Q12 19.6 13.4 18.8" stroke="#5a3d12" stroke-width=".8" fill="none" stroke-linecap="round"/>
      ${shine('M6.6 5.6C7.6 3 9.4 1.2 11.2 .6')}
    `,
  wolverine: `
      <path d="M6 8L2.2 -3.6 9.6 2.6Z M18 8L21.8 -3.6 14.4 2.6Z" fill="#20202a"${O}/>
      <path d="${WOLF_COWL}" fill="#facc15"${O}/>${vol(WOLF_COWL)}
      <path d="M4.6 13.6C4.8 19.6 7.6 24 12 24S19.2 19.6 19.4 13.6L16.8 17V19.6C16.8 22.4 14.8 23.8 12 23.8S7.2 22.4 7.2 19.6V17Z" fill="#20202a"${O}/>
      <path d="M4.8 9.6C8 8.4 10.6 9.8 12 12 13.4 9.8 16 8.4 19.2 9.6 19.4 12.4 17.8 15.2 14.8 15 13.6 14.4 12.6 13.8 12 13.2 11.4 13.8 10.4 14.4 9.2 15 6.2 15.2 4.6 12.4 4.8 9.6Z" fill="#20202a"${O}/>
      <path d="M7.2 17C8.8 15.8 15.2 15.8 16.8 17V19.6C16.8 22.4 14.8 23.8 12 23.8S7.2 22.4 7.2 19.6Z" fill="${SKIN}"/>
      <path d="M9.8 20.4Q12 21.6 14.2 20.4" stroke="#7a4a30" stroke-width=".8" fill="none" stroke-linecap="round"/>
      <path d="M12 15.8V17.6" stroke="#b9855f" stroke-width=".5"/>
      <path d="M9 21.6H15 M8.4 18.8V20.6 M15.6 18.8V20.6" stroke="#8a6a50" stroke-width=".35" stroke-dasharray=".5 .6" fill="none"/>
      ${shine('M7 5.4C8 3.6 9.6 2.6 11.4 2.4')}
    `,
  batman: `
      <path d="M4.6 9.4L3 -2.4 9.6 2.8Z M19.4 9.4L21 -2.4 14.4 2.8Z" fill="#1c2433"${O}/>
      <path d="${BAT_COWL}" fill="#232d3f"${O}/>${vol(BAT_COWL)}
      <path d="M6.8 15C8.6 13.4 15.4 13.4 17.2 15 16.8 19.6 14.8 22.6 12 23.4 9.2 22.6 7.2 19.6 6.8 15Z" fill="${SKIN}"/>${vol('M6.8 15C8.6 13.4 15.4 13.4 17.2 15 16.8 19.6 14.8 22.6 12 23.4 9.2 22.6 7.2 19.6 6.8 15Z')}
      <path d="M10.4 14.4L12 12.6 13.6 14.4" stroke="#0b1020" stroke-width=".6" fill="none"/>
      <path d="M4.6 8.4L10.8 11.6 M19.4 8.4L13.2 11.6" stroke="#0b1020" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <path d="M9.8 19.2Q12 20.4 14.2 19.2" stroke="#8a5a3a" stroke-width=".8" fill="none" stroke-linecap="round"/>
      <path d="M11.4 22.2H12.6" stroke="#b9855f" stroke-width=".5"/>
      ${shine('M6.4 5.2C8.4 3.4 10.6 2.8 12 3')}
    `,
  superman: `
      <path d="M-.5 26L2 18.5 7.6 21.6 6 26Z M24.5 26L22 18.5 16.4 21.6 18 26Z" fill="#b91c1c"${O}/>
      <path d="M1 26C2 22.5 6 21.6 8.6 21.4L12 24 15.4 21.4C18 21.6 22 22.5 23 26Z" fill="#1d4ed8"${O}/>
      <path d="M12 23.6L13.9 24.9 12 26.2 10.1 24.9Z" fill="#facc15" stroke="#b91c1c" stroke-width=".4"/>
      <path d="M8.6 20V23.4L12 24.6 15.4 23.4V20Z" fill="${SKIN_DARK}"${O}/>
      ${ears()}
      <path d="${HEAD}" fill="${SKIN}"${O}/>${vol(HEAD)}
      <path d="M6 10.6C4.8 4 8.4 -.6 13.2 -.4 18 -.2 19.4 4 18 10.6 17.8 8 16.6 6.2 14.4 5.4 13.2 5 11.6 5.2 10.4 5.8 8.4 6.6 6.8 8.2 6 10.6Z" fill="#1b2236"${O}/>
      <path d="M13.2 5C11.6 5.2 11 6.8 11.8 8.4 12.4 7 13.6 6.4 14.6 6.6" stroke="#14141c" stroke-width=".8" fill="none" stroke-linecap="round"/>
      <path d="M7.6 8.6Q9.4 7.6 11 8.8M13 8.8Q14.6 7.6 16.4 8.6" stroke="#14141c" stroke-width=".9" fill="none" stroke-linecap="round"/>
      ${nose()}
      <path d="M10 18Q12 19.4 14 18" stroke="#9a4a3a" stroke-width=".8" stroke-linecap="round" fill="none"/>
      ${shine('M8 3.2C9.4 1.6 11.4 1 13 1.2')}
    `,
  wonderwoman: `
      <path d="M3.4 14C3 6 6.4 .6 12 .6S21 6 20.6 14C20.4 20 19.6 23.6 17.6 25.4L15.8 15.4 8.2 15.4 6.4 25.4C4.4 23.6 3.6 20 3.4 14Z" fill="#1d1814"${O}/>
      ${ears()}
      <path d="${HEAD}" fill="${SKIN}"${O}/>${vol(HEAD)}
      <path d="M6.6 10C6.8 5 9.4 2.8 12 2.8S17.2 5 17.4 10C16.2 6.8 14 5.6 12 5.6S7.8 6.8 6.6 10Z" fill="#1d1814"${O}/>
      <path d="M6.8 6Q12 2.2 17.2 6L16.8 7.2Q12 4.2 7.2 7.2Z" fill="#e0b020"${O}/>
      <path d="M12 3L12.8 5.2H11.2Z" fill="#dc2626"/>
      <path d="M8 8.8Q9.6 8 11 8.8M13 8.8Q14.4 8 16 8.8" stroke="#1d1814" stroke-width=".8" fill="none" stroke-linecap="round"/>
      ${nose()}
      <path d="M9.8 17.6Q10.9 16.9 12 17.4 13.1 16.9 14.2 17.6 13.4 19 12 19.2 10.6 19 9.8 17.6Z" fill="#c2271f"/>
    `,
  flash: `
      <path d="M4 8.6L-1.8 6.2 1 8.2 -2.6 9.4 1.6 10.6 -.4 12.6 4.2 12.6Z M20 8.6L25.8 6.2 23 8.2 26.6 9.4 22.4 10.6 24.4 12.6 19.8 12.6Z" fill="#facc15"${O}/>
      <path d="${FLASH_COWL}" fill="#dc2626"${O}/>${vol(FLASH_COWL)}
      <path d="${FLASH_FACE}" fill="${SKIN}"${O}/>${vol(FLASH_FACE)}
      <circle cx="12" cy="2.6" r="1.9" fill="#facc15"${O}/>
      <path d="M12.5 1.2L11 3H12.2L11.6 4.2 13.2 2.4H12Z" fill="#dc2626"/>
      <path d="M7.8 8.6Q9.4 7.8 11 8.6M13 8.6Q14.6 7.8 16.2 8.6" stroke="#14141c" stroke-width=".8" fill="none" stroke-linecap="round"/>
      ${nose(11.6, 14.8)}
      <path d="M9.8 18.4Q12 19.8 14.2 18.4" stroke="#9a4a3a" stroke-width=".8" stroke-linecap="round" fill="none"/>
      ${shine('M5.2 6C6 3 8.2 1 10.6 .2')}
    `,
  aquaman: `
      <path d="M3 12C2.4 5 6.2 .4 12 .4S21.6 5 21 12C20.8 17 21.2 21.4 19.6 25.4L16.8 18 7.2 18 4.4 25.4C2.8 21.4 3.2 17 3 12Z" fill="#e8ab2a"${O}/>
      <path d="M5.4 12C5.2 16 5.6 20 6.4 23 M18.6 12C18.8 16 18.4 20 17.6 23" stroke="#b97f12" stroke-width=".6" fill="none"/>
      ${ears('#e0b080')}
      <path d="${HEAD}" fill="#e0b080"${O}/>${vol(HEAD)}
      <path d="M7.4 14.2C7.6 19.6 9.6 22.8 12 23.4 14.4 22.8 16.4 19.6 16.6 14.2 15.4 16.4 14 17 12 17S8.6 16.4 7.4 14.2Z" fill="#c98f55" opacity=".85"/>
      <path d="M6.6 10C6.4 5 9 3 12 3S17.6 5 17.4 10C16.4 7 14.6 5.6 12 5.6S7.6 7 6.6 10Z" fill="#e8ab2a"${O}/>
      <path d="M9.4 16.8Q12 15.8 14.6 16.8 13.4 17.8 12 17.6 10.6 17.8 9.4 16.8Z" fill="#b9791f"/>
      <path d="M8 8.8Q9.6 8 11 8.8M13 8.8Q14.4 8 16 8.8" stroke="#8a5a14" stroke-width=".8" fill="none" stroke-linecap="round"/>
      ${nose(10.8, 14.4)}
      <path d="M5 26L7 22.4 12 24.4 17 22.4 19 26Z" fill="#ea7a1a"${O}/>
    `,
  greenlantern: `
      <path d="M3 26C4 22.8 8 22 8.6 21.6L12 24.2 15.4 21.6C16 22 20 22.8 21 26Z" fill="#1c1f26"${O}/>
      <circle cx="12" cy="25" r="1.3" fill="#22c55e"/>
      ${ears()}
      <path d="${HEAD}" fill="${SKIN}"${O}/>${vol(HEAD)}
      <path d="M6.2 10.8C5.4 4 8.4 .4 12.4 .4S18.8 3.6 17.8 10C17.4 7 15.6 5 12.4 5S7.8 6.8 7.4 10.4Z" fill="#4a3022"${O}/>
      <path d="M5.4 9C7.6 7 11 8 12 9.4 13 8 16.4 7 18.6 9 18.8 12.6 16.8 14 14.6 13.6 13.6 12.8 10.4 12.8 9.4 13.6 7.2 14 5.2 12.6 5.4 9Z" fill="#16a34a"${O}/>
      ${nose(13, 15.2)}
      <path d="M10 18.6Q12 19.8 14 18.6" stroke="#9a4a3a" stroke-width=".8" stroke-linecap="round" fill="none"/>
      ${shine('M8 3.4C9.4 1.8 11.4 1.2 13 1.4')}
    `,
  joker: `
      <path d="M3.6 25L6.4 19.6 12 22.4 17.6 19.6 20.4 25Z" fill="#6d28d9"${O}/>
      <path d="M12 22.4L9.4 25 12 24.4 14.6 25Z" fill="#22c55e"/>
      <path d="${JOKER_FACE}" fill="#f1f5ee"${O}/>${vol(JOKER_FACE)}
      <path d="M6 8.8C4.4 5.4 5.4 1.2 8.6 0 8 1.8 8.6 3 9.8 3.6 10 1.4 11.6 -.4 13.4 0 14.2 -1.2 16.2 -.4 16.4 1.6 18.2 .6 19.8 2.8 18.4 4.8 19.6 6.4 19 8.8 18 10.2 17.8 7 16.4 5.4 12 5.4S6.4 7 6.2 10.4Z" fill="#16a34a"${O}/>
      <path d="M7.6 9.6Q9.6 8.2 11 9.8 10 12.6 7.8 11.8Z M16.4 9.6Q14.4 8.2 13 9.8 14 12.6 16.2 11.8Z" fill="#1e1b2e"/>
      <path d="M12 11.6V14.4Q11.2 15 10.6 14.8" stroke="#c7cdc4" stroke-width=".5" fill="none"/>
      <path d="M5.6 16.2Q8.4 21.4 12 21.2 15.6 21.4 18.4 16.2 17.4 18.2 12 18.4 6.6 18.2 5.6 16.2Z" fill="#dc2626"${O}/>
      <path d="M8 18.4L8.6 19.6 M10 18.5L10.4 20 M12 18.5V20.2 M14 18.5L13.6 20 M16 18.4L15.4 19.6" stroke="#f8fafc" stroke-width=".6" fill="none"/>
    `,
  };

  // Where the two eyes go: centers (cx), height of the centers (y), size, color and tilt in degrees.
  // The notch draws its own animated eyes with the same numbers (see style.css).
  const EYES = {
  ironman: {cx: [8.4, 15.6], y: 12.4, w: 5, h: 1.8, color: '#ffffff', tilt: 14 },
  captain: {cx: [7, 17], y: 9, w: 5, h: 3, color: '#ffffff', tilt: 0 },
  spiderman: {cx: [7.5, 16.5], y: 10.4, w: 5.4, h: 3.2, color: '#ffffff', tilt: 30 },
  strange: {cx: [9.1, 14.9], y: 10, w: 2.4, h: 1.4, color: '#2563eb', tilt: 0 },
  doom: {cx: [8.9, 15.1], y: 10.9, w: 2.6, h: 1.4, color: '#67e8f9', tilt: 0 },
  blackpanther: {cx: [7, 17], y: 9, w: 5, h: 2.2, color: '#ffffff', tilt: 14 },
  hulk: {cx: [8.1, 15.9], y: 10.6, w: 2.8, h: 1.6, color: '#ecfccb', tilt: 0 },
  thor: {cx: [9.1, 14.9], y: 11.8, w: 2.4, h: 1.5, color: '#2563eb', tilt: 0 },
  wolverine: {cx: [8.2, 15.8], y: 12.6, w: 3.4, h: 1.4, color: '#ffffff', tilt: 18 },  batman: {cx: [8.2, 15.8], y: 11, w: 4.2, h: 1.9, color: '#f8fafc', tilt: 12 },
  superman: {cx: [9.4, 14.6], y: 10.2, w: 2.2, h: 1.2, color: '#3b82f6', tilt: 0 },
  wonderwoman: {cx: [9.6, 14.4], y: 10.2, w: 2.2, h: 1.2, color: '#2563eb', tilt: 0 },
  flash: {cx: [9.4, 14.6], y: 11.4, w: 3.2, h: 1.5, color: '#ffffff', tilt: 8 },
  aquaman: {cx: [9.6, 14.4], y: 10.8, w: 2.2, h: 1.2, color: '#22d3ee', tilt: 0 },
  greenlantern: {cx: [8.8, 15.2], y: 10.6, w: 3.2, h: 1.8, color: '#ffffff', tilt: 8 },
  joker: {cx: [9.2, 14.8], y: 10.6, w: 2, h: 1.2, color: '#bef264', tilt: 0 },
  };

  const ids = Object.keys(DRAWINGS); // the heroes only (Batman too: the plain looks show his face)
  const has = (id) => Object.prototype.hasOwnProperty.call(DRAWINGS, id);
  const faceFor = (id) => (has(id) ? id : 'batman'); // which face a look shows
  const drawingOf = (id) => DRAWINGS[id];
  const eyesOf = (id) => EYES[id];
  let pictureCount = 0; // makes the gradient names in each picture unique

  function eyesMarkup(id) {
    const e = eyesOf(id);
    if (!e) return '';
    return e.cx.map((cx, i) => {
      const turn = i === 0 ? e.tilt : -e.tilt;
      return `<rect x="${cx - e.w / 2}" y="${e.y - e.h / 2}" width="${e.w}" height="${e.h}" rx="${Math.min(e.h / 2, 1.2)}" fill="${e.color}" transform="rotate(${turn} ${cx} ${e.y})"/>`;
    }).join('');
  }

  // The full picture as SVG text, or null for a look with no drawing. withEyes: false leaves the eyes out (the notch adds its own).
  function markup(id, { withEyes = true, size = 0 } = {}) {
    if (!has(id)) return null;
    const dimension = size ? ` width="${size}" height="${size}"` : '';
    pictureCount += 1;
    const body = drawingOf(id).split('__U__').join(String(pictureCount));
    const gradients = body.includes(`hs${pictureCount}`) ? defs(pictureCount) : '';
    return `<svg xmlns="${SVG_NS}" viewBox="-2 -2 28 28"${dimension} aria-hidden="true">${gradients}${body}${withEyes ? eyesMarkup(id) : ''}</svg>`;
  }

  // In a page: the picture as a ready SVG element (the text above is fixed code in this file, never user data).
  function element(id, options) {
    const text = markup(id, options);
    if (!text) return null;
    return document.importNode(new DOMParser().parseFromString(text, 'image/svg+xml').documentElement, true);
  }

  // Character packs add drawings at run time. Each call replaces the earlier packs. The drawing text was built by lib/packs.js from checked values.
  function setPacks(packs) {
    for (const id of Object.keys(DRAWINGS)) if (id.startsWith('pack-')) { delete DRAWINGS[id]; delete EYES[id]; }
    for (const pack of packs) { DRAWINGS[pack.id] = pack.drawing; if (pack.eyes) EYES[pack.id] = pack.eyes; }
  }

  const api = { ids, has, faceFor, markup, element, setPacks, DRAWINGS, EYES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Heroes = api;
})(typeof window !== 'undefined' ? window : globalThis);
