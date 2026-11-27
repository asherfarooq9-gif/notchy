// The hero drawings, in one place. Used by the notch icon, the tray icon, the panel and the settings window.
// They are my own simple cartoons in each hero's colors, not official artwork.
// Loads in the page (as window.Heroes) and in Node (require), so the tray icon can use the same drawings.
(function (root) {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Cartoon bots: a big round head, big eyes, a bold outline and a soft shine. Each hero's colors, mask, hair and helmet
  // follow the reference picture. Eye whites are class "eyeball"; pupils (with their shine) are class "pupil": on the notch
  // the pupils look around and lids close over the eyes to blink (style.css, LIDS below).
  // "__U__" is swapped for a number in markup(), so two pictures on one page never share a gradient name.
  const defs = (u) => `<defs><linearGradient id="hs${u}" x1="0" y1="0" x2="1" y2="1"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient><linearGradient id="hg${u}" x1="0" y1="0" x2=".7" y2=".9"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`; // used by character packs
  const OL = ' stroke="#1b1410" stroke-width=".65" stroke-linejoin="round" stroke-linecap="round"';
  const HEAD = 'M12 1.4C5.6 1.4 2.2 5.8 2.2 11.8c0 6.8 4.4 11.6 9.8 11.6s9.8-4.8 9.8-11.6C21.8 5.8 18.4 1.4 12 1.4Z';
  const grad = (id, a, b, c) => `<radialGradient id="${id}__U__" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`;
  const paint = (id) => `url(#${id}__U__)`;
  const SKIN = ['#ffd9b3', '#f2b787', '#d9925e'];
  const SKIN_MID = SKIN[1];
  const gloss = (d = 'M5.6 5.2Q7.8 2.9 10.8 2.5') => `<path d="${d}" stroke="#fff" stroke-opacity=".55" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
  // Two round cartoon eyes (at x 8 and 16) with pupils that can look around.
  function eyes(pupil, { y = 13.2, rx = 2.1, ry = 2.3 } = {}) {
    return [8, 16].map((cx) => `<ellipse class="eyeball" cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff"${OL}/>`).join('')
      + [8, 16].map((cx) => `<circle class="pupil" cx="${cx + 0.35}" cy="${y + 0.35}" r="1.2" fill="${pupil}"/><circle class="pupil" cx="${cx + 0.75}" cy="${y - 0.15}" r=".42" fill="#fff"/>`).join('');
  }
  const blush = () => '<ellipse cx="5.4" cy="16.8" rx="1.4" ry=".8" fill="#f28b82" opacity=".45"/><ellipse cx="18.6" cy="16.8" rx="1.4" ry=".8" fill="#f28b82" opacity=".45"/>';
  const smile = (y) => `<path d="M9.6 ${y}Q12 ${y + 2} 14.4 ${y}" stroke="#7a3b25" stroke-width=".75" fill="none" stroke-linecap="round"/>`;
  const grin = (y) => `<path d="M8.8 ${y}Q12 ${y + 3.4} 15.2 ${y}Q12 ${y + 1} 8.8 ${y}Z" fill="#fff"${OL}/>`;
  const ears = () => `<ellipse cx="2.3" cy="13" rx="1.4" ry="2" fill="${SKIN_MID}"${OL}/><ellipse cx="21.7" cy="13" rx="1.4" ry="2" fill="${SKIN_MID}"${OL}/>`;

  // Each drawing fits a 24 by 24 face box; the picture window is -2 -2 28 28, so ears, wings and helmets can stick out.
  const DRAWINGS = {
  ironman: `<defs>${grad('ir', '#ff5b4f', '#d3191b', '#8f0d10')}${grad('ig', '#ffe58a', '#f2bb34', '#c98912')}</defs>
      <path d="${HEAD}" fill="${paint('ir')}"${OL}/>
      <path d="M4.6 8.6Q12 6.2 19.4 8.6L19 15.6Q17.8 21.8 12 22.6 6.2 21.8 5 15.6Z" fill="${paint('ig')}"${OL}/>
      <path d="M9.6 1.8H14.4V7.6L12 8.6 9.6 7.6Z" fill="${paint('ir')}"${OL}/>
      <path class="eyeball" d="M5.6 12.3L10.6 12.9 10.2 14.5 6 13.9Z" fill="#e8fbff" stroke="#38bdf8" stroke-width=".6" stroke-linejoin="round"/>
      <path class="eyeball" d="M18.4 12.3L13.4 12.9 13.8 14.5 18 13.9Z" fill="#e8fbff" stroke="#38bdf8" stroke-width=".6" stroke-linejoin="round"/>
      <path d="M8.6 19.2H15.4L14.2 20.6H9.8Z" fill="#a8740e" opacity=".75"/>
      <path d="M6 16.4L8.6 20.4M18 16.4L15.4 20.4" stroke="#a8740e" stroke-width=".5" fill="none"/>
      ${gloss()}`,
  captain: `<defs>${grad('cb', '#5b8cff', '#1d4ed8', '#122f8a')}${grad('sk', ...SKIN)}</defs>
      <path d="M3.2 9.6L.2 5.4 2.4 5.8 1.4 3 3.6 4.4 3.6 1.6 5.8 6.2Z M20.8 9.6L23.8 5.4 21.6 5.8 22.6 3 20.4 4.4 20.4 1.6 18.2 6.2Z" fill="#f8fafc"${OL}/>
      <path d="${HEAD}" fill="${paint('cb')}"${OL}/>
      <path d="M4.4 14.6Q12 12.4 19.6 14.6Q19.2 21.8 12 23.2 4.8 21.8 4.4 14.6Z" fill="${paint('sk')}"${OL}/>
      <path d="M12 2.6L13.1 5.2 15.9 5.4 13.7 7.2 14.4 9.9 12 8.4 9.6 9.9 10.3 7.2 8.1 5.4 10.9 5.2Z" fill="#fff"${OL}/>
      ${eyes('#1e40af', { y: 12, ry: 2 })}
      ${smile(18.2)}
      ${gloss()}`,
  spiderman: `<defs>${grad('sr', '#ff5a4e', '#e0201c', '#a50f12')}</defs>
      <path d="M12 .6C5.6.6 2.4 5.2 2.4 11.2c0 6.8 4.2 12.2 9.6 12.2s9.6-5.4 9.6-12.2C21.6 5.2 18.4.6 12 .6Z" fill="${paint('sr')}" stroke="#2a0606" stroke-width=".7"/>
      <path d="M12 .8V23.2M12 12L4 5.4M12 12L20 5.4M12 12L2.8 13M12 12L21.2 13M12 12L5.2 20.4M12 12L18.8 20.4M8.6 3.2Q12 5 15.4 3.2M5.4 6.8Q12 10.4 18.6 6.8M3.6 11.6Q12 15.4 20.4 11.6M4.6 17Q12 20.8 19.4 17" fill="none" stroke="#7a0b0b" stroke-width=".35" stroke-linecap="round"/>
      <path class="eyeball" d="M3.4 9.2C5.8 7.6 10 9.4 11 13.6 8.4 15.8 4.6 14.6 3.4 9.2Z" fill="#fff" stroke="#111" stroke-width="1.1" stroke-linejoin="round"/>
      <path class="eyeball" d="M20.6 9.2C18.2 7.6 14 9.4 13 13.6 15.6 15.8 19.4 14.6 20.6 9.2Z" fill="#fff" stroke="#111" stroke-width="1.1" stroke-linejoin="round"/>
      ${gloss('M5.2 4.6Q7.4 2.4 10.4 2')}`,
  strange: `<defs>${grad('sk', ...SKIN)}</defs>
      <path d="M2.6 23.4L1.2 13.4 4.4 9 6.6 19Z M21.4 23.4L22.8 13.4 19.6 9 17.4 19Z" fill="#b91c1c"${OL}/>
      <path d="${HEAD}" fill="${paint('sk')}"${OL}/>
      <path d="M2.6 11.6C1.6 4.6 6 .4 12.4.4 18.6.4 22.6 4.6 21.4 11.4 20.6 8.4 19.4 6.6 17.6 6 15.4 5.2 13 6.2 12 7.6 10.6 5.6 7.6 5 5.4 6.4 3.8 7.6 3 9.4 2.6 11.6Z" fill="#2a1a12"${OL}/>
      <path d="M2.8 10.6Q3 8 4.6 6.8L5.2 9.6Z M21.2 10.6Q21 8 19.4 6.8L18.8 9.6Z" fill="#cfd5dc"/>
      <path d="M5.8 10.2L10 10.8M18.2 10.2L14 10.8" stroke="#2a1a12" stroke-width=".9" stroke-linecap="round"/>
      ${eyes('#3b5b7a', { y: 13 })}
      <path d="M8.6 17.6Q12 16.2 15.4 17.6 14.6 18.4 12 17.9 9.4 18.4 8.6 17.6Z" fill="#2a1a12"/>
      <path d="M10.8 18.7H13.2" stroke="#7a3b25" stroke-width=".5" stroke-linecap="round"/>
      <path d="M10.4 19.3Q12 18.9 13.6 19.3L12.8 22.4 12 23 11.2 22.4Z" fill="#2a1a12"/>`,
  hulk: `<defs>${grad('hu', '#9be35a', '#5fb02c', '#3b7a18')}</defs>
      <ellipse cx="1.8" cy="13" rx="1.6" ry="2.2" fill="#5fb02c" stroke="#1d3a0c" stroke-width=".6"/>
      <ellipse cx="22.2" cy="13" rx="1.6" ry="2.2" fill="#5fb02c" stroke="#1d3a0c" stroke-width=".6"/>
      <path d="M12 1.6C5.4 1.6 1.8 5.8 1.8 11.8c0 6.8 4.4 11.6 10.2 11.6s10.2-4.8 10.2-11.6C22.2 5.8 18.6 1.6 12 1.6Z" fill="${paint('hu')}" stroke="#1d3a0c" stroke-width=".7"/>
      <path d="M2 10.4C1.4 4.6 5.4.2 11.6.2 18.6.2 22.8 4.8 22 10.6 21 8.2 19.6 7.2 18 7.6 17.6 5.8 16.2 5.6 15 6.6 14.4 5 13 4.8 12 6 11 4.8 9.4 5 8.8 6.6 7.8 5.6 6.2 5.8 5.8 7.6 4.2 7.2 2.8 8.2 2 10.4Z" fill="#141a10" stroke="#0a0d08" stroke-width=".5"/>
      <path d="M4.6 9.8L10.6 11.4M19.4 9.8L13.4 11.4" stroke="#1f3d0d" stroke-width="1.6" stroke-linecap="round"/>
      <ellipse class="eyeball" cx="8" cy="13.4" rx="2.3" ry="2" fill="#fff" stroke="#1d3a0c" stroke-width=".5"/>
      <ellipse class="eyeball" cx="16" cy="13.4" rx="2.3" ry="2" fill="#fff" stroke="#1d3a0c" stroke-width=".5"/>
      <circle class="pupil" cx="8.5" cy="13.8" r="1.15" fill="#2a1a10"/><circle class="pupil" cx="15.5" cy="13.8" r="1.15" fill="#2a1a10"/>
      <circle class="pupil" cx="8.9" cy="13.3" r=".38" fill="#fff"/><circle class="pupil" cx="15.9" cy="13.3" r=".38" fill="#fff"/>
      <path d="M8.4 11.6L10.8 12.2M15.6 11.6L13.2 12.2" stroke="#1f3d0d" stroke-width="1" stroke-linecap="round"/>
      <path d="M8.2 18.4Q12 17 15.8 18.4V19.6Q12 21 8.2 19.6Z" fill="#fff" stroke="#1d3a0c" stroke-width=".55" stroke-linejoin="round"/>
      <path d="M10.1 17.9V20M12 17.6V20.3M13.9 17.9V20M8.4 19H15.6" stroke="#1d3a0c" stroke-width=".3"/>
      <ellipse cx="5.4" cy="16.6" rx="1.3" ry=".7" fill="#3f8a1c" opacity=".6"/><ellipse cx="18.6" cy="16.6" rx="1.3" ry=".7" fill="#3f8a1c" opacity=".6"/>`,
  thor: `<defs>${grad('sk', ...SKIN)}${grad('hm', '#f1f5f9', '#b6c0cc', '#7d8896')}</defs>
      <path d="M2 11C1.2 18 2.2 22.6 4.6 24.4L7 19.2Z M22 11C22.8 18 21.8 22.6 19.4 24.4L17 19.2Z" fill="#f2c94c"${OL}/>
      <path d="M4.2 7.6L-.6 2.6 1.6 3 .2-.6 3 1.4 2.8-1.8 6.4 4Z M19.8 7.6L24.6 2.6 22.4 3 23.8-.6 21 1.4 21.2-1.8 17.6 4Z" fill="#f1f5f9"${OL}/>
      <path d="${HEAD}" fill="${paint('sk')}"${OL}/>
      <path d="M2.6 10.4C2.6 4.4 6.6.6 12 .6S21.4 4.4 21.4 10.4Z" fill="${paint('hm')}"${OL}/>
      <path d="M2.6 9.2Q12 11.4 21.4 9.2V10.8Q12 13 2.6 10.8Z" fill="#cbd5e1"${OL}/>
      <path d="M12 .8V8.6" stroke="#7d8896" stroke-width=".8"/>
      <path d="M2.6 10.8C2.4 14 3 17 4.4 19L6 12.4Z M21.4 10.8C21.6 14 21 17 19.6 19L18 12.4Z" fill="#f2c94c"${OL}/>
      <path d="M6 11.8L9.8 12.2M18 11.8L14.2 12.2" stroke="#c7962a" stroke-width=".9" stroke-linecap="round"/>
      ${eyes('#2563eb', { y: 13.8, ry: 2 })}
      <path d="M4.6 15.6C5 21 8 24 12 24.4S19 21 19.4 15.6C17.8 18.4 15.4 19.4 12 19.4S6.2 18.4 4.6 15.6Z" fill="#e8b93a"${OL}/>
      <path d="M8.4 17.6Q12 16 15.6 17.6 14.4 18.6 12 18.1 9.6 18.6 8.4 17.6Z" fill="#e8b93a"${OL}/>
      <path d="M9.4 18.4Q12 20.8 14.6 18.4Q12 19.2 9.4 18.4Z" fill="#fff" stroke="#7a5410" stroke-width=".5" stroke-linejoin="round"/>
      ${gloss('M5.4 4.6Q7.6 2.4 10.6 2')}`,
  blackpanther: `<defs>${grad('bp', '#3b3550', '#17141f', '#07060a')}</defs>
      <path d="M4.2 7.4L3.2.2 8.6 3.4Z M19.8 7.4L20.8.2 15.4 3.4Z" fill="#17141f"${OL}/>
      <path d="M4.8 5.6L4.4 1.8 7.2 3.6Z M19.2 5.6L19.6 1.8 16.8 3.6Z" fill="#7c3aed"/>
      <path d="${HEAD}" fill="${paint('bp')}"${OL}/>
      <path d="M12 3V9.4M8 3.6Q9.4 7 10.8 9.6M16 3.6Q14.6 7 13.2 9.6M3.6 10.6Q7 11.6 9.4 13.8M20.4 10.6Q17 11.6 14.6 13.8M5.2 16.4Q8.4 19.6 12 21.6 15.6 19.6 18.8 16.4M9.2 15.8Q12 17.4 14.8 15.8" stroke="#a78bfa" stroke-width=".55" fill="none" stroke-linecap="round"/>
      <path class="eyeball" d="M5 12.2Q8 11 10.6 13.4 8 14.6 5 12.2Z" fill="#fff" stroke="#c4b5fd" stroke-width=".5"/>
      <path class="eyeball" d="M19 12.2Q16 11 13.4 13.4 16 14.6 19 12.2Z" fill="#fff" stroke="#c4b5fd" stroke-width=".5"/>
      ${gloss()}`,
  doom: `<defs>${grad('dh', '#3aa35f', '#166534', '#0b3b1e')}${grad('dm', '#e2e8f0', '#a3afbf', '#6b7787')}</defs>
      <path d="M12-.6C5-.6.8 4.6.8 11.8c0 7.4 4.6 12.4 11.2 12.4s11.2-5 11.2-12.4C23.2 4.6 19-.6 12-.6Z" fill="${paint('dh')}"${OL}/>
      <path d="M12 2.4C6.6 2.4 3.8 6.4 3.8 11.8c0 6 3.6 10.2 8.2 10.2s8.2-4.2 8.2-10.2C20.2 6.4 17.4 2.4 12 2.4Z" fill="#082a15"/>
      <path d="M12 4C7.6 4 5.4 7.2 5.4 11.8c0 5.4 2.8 9.4 6.6 9.4s6.6-4 6.6-9.4C18.6 7.2 16.4 4 12 4Z" fill="${paint('dm')}"${OL}/>
      <path d="M5.8 10.6Q12 8.6 18.2 10.6" stroke="#5b6574" stroke-width=".7" fill="none"/>
      <path class="eyeball" d="M6.6 11.8H10.6L10.2 13.4H7.2Z" fill="#0f172a"/>
      <path class="eyeball" d="M17.4 11.8H13.4L13.8 13.4H16.8Z" fill="#0f172a"/>
      <ellipse class="pupil" cx="8.6" cy="12.6" rx="1.1" ry=".45" fill="#67e8f9"/><ellipse class="pupil" cx="15.4" cy="12.6" rx="1.1" ry=".45" fill="#67e8f9"/>
      <path d="M12 11V16" stroke="#7b8696" stroke-width="1"/>
      <path d="M9 18H15M9.4 19.4H14.6M10 20.6H14" stroke="#4b5563" stroke-width=".6"/>
      <circle cx="7" cy="16" r=".45" fill="#5b6574"/><circle cx="17" cy="16" r=".45" fill="#5b6574"/>
      ${gloss('M6.8 6.6Q8.8 4.8 11.2 4.6')}`,
  wolverine: `<defs>${grad('wy', '#ffe066', '#f5c400', '#c99700')}${grad('sk', ...SKIN)}</defs>
      <path d="M5.6 11L1.4-2.6 9.4 3.6Z M18.4 11L22.6-2.6 14.6 3.6Z" fill="#1f2937"${OL}/>
      <path d="${HEAD}" fill="${paint('wy')}"${OL}/>
      <path d="M2.4 10.4Q6 9.2 10.8 12.6L11 15.4Q7 15.8 3 14.6Z M21.6 10.4Q18 9.2 13.2 12.6L13 15.4Q17 15.8 21 14.6Z" fill="#1f2937"/>
      <path d="M5 15.6Q12 14 19 15.6Q18.6 22 12 23.2 5.4 22 5 15.6Z" fill="${paint('sk')}"${OL}/>
      <path d="M5 15.6Q4.6 19.4 6.8 21.6L7.6 17Z M19 15.6Q19.4 19.4 17.2 21.6L16.4 17Z" fill="#3a2a1c"/>
      <path class="eyeball" d="M5.2 12.4L9.8 13.4 9.4 14.4 5.6 13.6Z" fill="#fff"/>
      <path class="eyeball" d="M18.8 12.4L14.2 13.4 14.6 14.4 18.4 13.6Z" fill="#fff"/>
      <path d="M9.8 20Q12 19 14.2 20" stroke="#7a3b25" stroke-width=".75" fill="none" stroke-linecap="round"/>
      ${gloss()}`,
  batman: `<defs>${grad('bc', '#4b5563', '#1f2937', '#0b0f16')}${grad('sk', ...SKIN)}</defs>
      <path d="M4.4 8.4L3.6-1.8 8.8 3.4Z M19.6 8.4L20.4-1.8 15.2 3.4Z" fill="#1f2937"${OL}/>
      <path d="${HEAD}" fill="${paint('bc')}"${OL}/>
      <path d="M5.2 15.4Q8.4 14.2 10.6 15.6L12 14.6 13.4 15.6Q15.6 14.2 18.8 15.4Q18.4 22 12 23.2 5.6 22 5.2 15.4Z" fill="${paint('sk')}"${OL}/>
      <path d="M5 10.8L10.4 12.2M19 10.8L13.6 12.2" stroke="#0b0f16" stroke-width=".9" stroke-linecap="round"/>
      <path class="eyeball" d="M5.4 11.6L10 12.8 9.4 13.8 5.8 13Z" fill="#fff"/>
      <path class="eyeball" d="M18.6 11.6L14 12.8 14.6 13.8 18.2 13Z" fill="#fff"/>
      <path d="M10 19.6H14" stroke="#7a3b25" stroke-width=".75" stroke-linecap="round"/>
      ${gloss()}`,
  superman: `<defs>${grad('sk', ...SKIN)}</defs>
      ${ears()}
      <path d="${HEAD}" fill="${paint('sk')}"${OL}/>
      <path d="M2.6 11.4C1.6 4.6 6 .6 12.2.6 18.4.6 22.4 4.6 21.4 11.2 20.6 8 19 6.4 16.6 5.8 14.6 5.4 12.6 5.8 11.2 6.6 9 7.4 6.6 7.4 4.4 8.6 3.4 9.4 2.8 10.4 2.6 11.4Z" fill="#141b2d"${OL}/>
      <path d="M12.6 6.4C11 6.8 10.6 8.6 11.6 9.6 12 8.6 12.8 8.2 13.6 8.4" stroke="#141b2d" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M5.8 10.6Q8 9.6 10.2 10.6M13.8 10.6Q16 9.6 18.2 10.6" stroke="#141b2d" stroke-width=".9" fill="none" stroke-linecap="round"/>
      ${eyes('#2563eb')}
      ${grin(17.8)}
      <path d="M11.4 21.6Q12 22.1 12.6 21.6" stroke="#b9855f" stroke-width=".5" fill="none" stroke-linecap="round"/>`,
  wonderwoman: `<defs>${grad('sk', ...SKIN)}</defs>
      <path d="M2.2 12C1.4 4.8 6 .4 12 .4S22.6 4.8 21.8 12C21.6 17.6 22.8 21.6 20.8 24.6 19 23.6 18.6 20.6 18.6 17.4L5.4 17.4C5.4 20.6 5 23.6 3.2 24.6 1.2 21.6 2.4 17.6 2.2 12Z" fill="#14110f"${OL}/>
      <path d="${HEAD}" fill="${paint('sk')}"${OL}/>
      <path d="M3.4 11C3.6 5.4 7.4 2.6 12 2.6S20.4 5.4 20.6 11C19.4 7.4 16.4 5.8 12 5.8S4.6 7.4 3.4 11Z" fill="#14110f"${OL}/>
      <path d="M5 7.4Q12 3.6 19 7.4L18.4 8.8Q12 5.8 5.6 8.8Z" fill="#f2c230"${OL}/>
      <path d="M12 3.6L12.7 5.2 14.4 5.3 13.1 6.4 13.5 8 12 7.1 10.5 8 10.9 6.4 9.6 5.3 11.3 5.2Z" fill="#dc2626" stroke="#7f1d1d" stroke-width=".3"/>
      <path d="M6 10Q8 8.8 10.2 9.8M13.8 9.8Q16 8.8 18 10" stroke="#14110f" stroke-width=".6" fill="none" stroke-linecap="round"/>
      ${eyes('#2563eb')}
      <path d="M5.9 11.6L4.9 10.8M5.9 12.3L4.8 11.9M18.1 11.6L19.1 10.8M18.1 12.3L19.2 11.9" stroke="#14110f" stroke-width=".6" stroke-linecap="round"/>
      ${blush()}
      <path d="M10.2 18.6Q11.1 18 12 18.4 12.9 18 13.8 18.6 13 19.9 12 20 11 19.9 10.2 18.6Z" fill="#dc2626" stroke="#7f1d1d" stroke-width=".3"/>
      <circle cx="2.6" cy="16" r=".7" fill="#f2c230" stroke="#7a5410" stroke-width=".3"/><circle cx="21.4" cy="16" r=".7" fill="#f2c230" stroke="#7a5410" stroke-width=".3"/>`,
  flash: `<defs>${grad('fr', '#ff5b4f', '#d3191b', '#8f0d10')}${grad('sk', ...SKIN)}</defs>
      <path d="M2.6 9.4L-1.6 7 .6 9.2-2 10.6 1.4 11.6-.4 13.6 2.8 13.2Z M21.4 9.4L25.6 7 23.4 9.2 26 10.6 22.6 11.6 24.4 13.6 21.2 13.2Z" fill="#facc15"${OL}/>
      <path d="${HEAD}" fill="${paint('fr')}"${OL}/>
      <path d="M5 15Q12 13.4 19 15Q18.6 22 12 23.2 5.4 22 5 15Z" fill="${paint('sk')}"${OL}/>
      <circle cx="12" cy="4.6" r="1.9" fill="#facc15"${OL}/>
      <path d="M12.5 3.2L11 5H12.2L11.6 6.2 13.2 4.4H12Z" fill="#dc2626"/>
      ${eyes('#1d4ed8', { y: 11.8, ry: 2 })}
      <path d="M9.6 18.6Q12.6 20.2 14.6 18.2" stroke="#7a3b25" stroke-width=".75" fill="none" stroke-linecap="round"/>
      ${gloss()}`,
  aquaman: `<defs>${grad('sk', '#f2c08f', '#d99a62', '#b9763f')}</defs>
      <path d="M1.8 12C1 4.6 5.8.2 12 .2S23 4.6 22.2 12C22 17.6 23.4 21.6 21 24.6 19 23 18.4 19.8 18.4 16.6H5.6C5.6 19.8 5 23 3 24.6.6 21.6 2 17.6 1.8 12Z" fill="#3b2416"${OL}/>
      <path d="M3.4 14Q2.6 18 4.2 22M20.6 14Q21.4 18 19.8 22M5.4 3.6Q8 2 11 2.4" stroke="#6b4a30" stroke-width=".6" fill="none" stroke-linecap="round"/>
      <path d="${HEAD}" fill="${paint('sk')}"${OL}/>
      <path d="M3.4 11.4C3.4 5.6 7 2.6 12 2.6S20.6 5.6 20.6 11.4C19.6 7.6 17 6 14.4 5.8L12 7.2 9.6 5.8C7 6 4.4 7.6 3.4 11.4Z" fill="#3b2416"${OL}/>
      <path d="M5.6 10.2L10.2 11.2M18.4 10.2L13.8 11.2" stroke="#24160e" stroke-width="1.1" stroke-linecap="round"/>
      ${eyes('#4d6b1a')}
      <path d="M4.4 14.8C4.8 20.6 8 24.2 12 24.6S19.2 20.6 19.6 14.8C18 17.6 15.4 18.4 12 18.4S6 17.6 4.4 14.8Z" fill="#2e1c12"${OL}/>
      <path d="M8.4 17Q12 15.6 15.6 17 14.4 18 12 17.5 9.6 18 8.4 17Z" fill="#2e1c12"/>
      <path d="M10.6 18.7H13.4" stroke="#8a5a3a" stroke-width=".6" stroke-linecap="round"/>`,
  greenlantern: `<defs>${grad('sk', ...SKIN)}</defs>
      ${ears()}
      <path d="${HEAD}" fill="${paint('sk')}"${OL}/>
      <path d="M2.6 11C1.8 4.6 6.2.8 12.2.8S22.4 4.8 21.4 10.8C20.6 7.8 18.6 6 15.8 5.6 14 5.4 12.2 6 11 7 9.4 5.8 7.2 5.8 5.4 6.8 3.8 7.8 3 9.4 2.6 11Z" fill="#5a3a22"${OL}/>
      <path d="M3.4 11.6Q6.6 9.6 10.4 11.4 12 12.2 13.6 11.4 17.4 9.6 20.6 11.6 20.8 15 18 15.8 15.6 16.2 13.6 14.6 12 13.8 10.4 14.6 8.4 16.2 6 15.8 3.2 15 3.4 11.6Z" fill="#16a34a"${OL}/>
      <ellipse class="eyeball" cx="7.8" cy="13" rx="2" ry="1.3" fill="#ecfdf5" stroke="#4ade80" stroke-width=".6"/>
      <ellipse class="eyeball" cx="16.2" cy="13" rx="2" ry="1.3" fill="#ecfdf5" stroke="#4ade80" stroke-width=".6"/>
      ${grin(18)}`,
  joker: `<defs>${grad('jw', '#ffffff', '#e6ece4', '#b9c4b6')}</defs>
      <path d="M2.4 12C.6 6 3.4.4 9.6-.4 10.6 1 12 1.6 13.4.4 18.6.4 23 5 21.6 12 20.6 9 19.4 7.4 17.2 7 16 5.2 13.6 4.8 12 6.4 10.4 4.8 8 5.2 6.8 7 4.6 7.4 3.4 9 2.4 12Z" fill="#16a34a"${OL}/>
      <path d="M12 3C6.6 3 4 7 4 12.6c0 6.2 3.6 10.8 8 10.8s8-4.6 8-10.8C20 7 17.4 3 12 3Z" fill="${paint('jw')}"${OL}/>
      <path d="M4.2 11Q4.4 5.2 9.4 4.2 8.4 6 8.8 7.4 10.4 5.4 12.4 5.4 11.6 6.8 12 8 14 5.6 17 6.2 16.4 7.2 16.6 8.2 18.6 7.6 19.8 10.4 18.4 8.4 15.6 8.4 12 8.6 8.4 8.6 5.8 8.8 4.2 11Z" fill="#16a34a"${OL}/>
      <path d="M5.4 12.6Q8 10 10.6 12.4 10 15.6 8 15.6 5.8 15.4 5.4 12.6Z M18.6 12.6Q16 10 13.4 12.4 14 15.6 16 15.6 18.2 15.4 18.6 12.6Z" fill="#4c1d95" opacity=".55"/>
      ${eyes('#a3e635', { y: 13, rx: 1.8, ry: 1.9 })}
      <path d="M5.4 10.6Q7.6 8.4 10.4 10.4M18.6 10.6Q16.4 8.4 13.6 10.4" stroke="#14532d" stroke-width=".8" fill="none" stroke-linecap="round"/>
      <path d="M5.8 17Q12 23.4 18.2 17Q12 19.4 5.8 17Z" fill="#dc2626"${OL}/>
      <path d="M7.4 18.2Q12 20.6 16.6 18.2Q12 19.4 7.4 18.2Z" fill="#fff"/>
      <path d="M9.4 18.9V19.8M11 19.2V20.2M12.6 19.2V20.2M14.4 18.9V19.8" stroke="#dc2626" stroke-width=".25"/>`,
  };

  // Character packs bring their own eye spots (lib/packs.js); the built-in bots draw their eyes themselves.
  const EYES = {};

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

  // Your own face pictures (lib/faces.js checks the files). Only PNG data pictures are taken.
  const PHOTO = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
  let photos = {};
  function setPhotos(map) {
    photos = {};
    for (const [id, url] of Object.entries(map || {})) if (has(id) && typeof url === 'string' && PHOTO.test(url)) photos[id] = url;
  }
  const hasPhoto = (id) => Object.prototype.hasOwnProperty.call(photos, id);

  // Eyelids, so the bots blink on the notch (style.css ".hero .lid"). Measured on the drawings above in the 24 by 24
  // face box: eye centers (cx), height (y), eye size (w, h), lid color, tilt in degrees (the right eye mirrors it).
  const LIDS = {
    ironman: { cx: [8.1, 15.9], y: 13.4, w: 5.4, h: 2.6, color: '#f2bb34', tilt: 7 },
    captain: { cx: [8, 16], y: 12, w: 4.6, h: 4.4, color: '#1d4ed8', tilt: 0 },
    spiderman: { cx: [7.2, 16.8], y: 11.6, w: 8.2, h: 5.4, color: '#d81e1e', tilt: 30 },
    strange: { cx: [8, 16], y: 13, w: 4.6, h: 5, color: SKIN_MID, tilt: 0 },
    hulk: { cx: [8, 16], y: 13.4, w: 4.8, h: 4.2, color: '#5fb02c', tilt: 0 },
    thor: { cx: [8, 16], y: 13.8, w: 4.6, h: 4.4, color: SKIN_MID, tilt: 0 },
    blackpanther: { cx: [7.8, 16.2], y: 12.8, w: 6, h: 2.8, color: '#17141f', tilt: 12 },
    doom: { cx: [8.6, 15.4], y: 12.6, w: 4.4, h: 2, color: '#a3afbf', tilt: 0 },
    wolverine: { cx: [7.5, 16.5], y: 13.4, w: 5, h: 2.4, color: '#1f2937', tilt: 12 },
    batman: { cx: [7.7, 16.3], y: 12.7, w: 5, h: 2.6, color: '#1f2937', tilt: 14 },
    superman: { cx: [8, 16], y: 13.2, w: 4.6, h: 5, color: SKIN_MID, tilt: 0 },
    wonderwoman: { cx: [8, 16], y: 13.2, w: 4.6, h: 5, color: SKIN_MID, tilt: 0 },
    flash: { cx: [8, 16], y: 11.8, w: 4.6, h: 4.4, color: '#d3191b', tilt: 0 },
    aquaman: { cx: [8, 16], y: 13.2, w: 4.6, h: 5, color: '#d99a62', tilt: 0 },
    greenlantern: { cx: [7.8, 16.2], y: 13, w: 4.4, h: 3, color: '#16a34a', tilt: 0 },
    joker: { cx: [8, 16], y: 13, w: 4, h: 4.2, color: '#e6ece4', tilt: 0 },
  };
  function lidsMarkup(id, table = LIDS) {
    const lid = table[id];
    if (!lid) return '';
    return lid.cx.map((cx, i) => {
      const turn = i === 0 ? lid.tilt : -lid.tilt;
      return `<ellipse class="lid" cx="${cx}" cy="${lid.y}" rx="${lid.w / 2 + 0.35}" ry="${lid.h / 2 + 0.35}" fill="${lid.color}" transform="rotate(${turn} ${cx} ${lid.y})"/>`;
    }).join('');
  }

  // Eyelids for your face pictures (cut-outs of the reference art, face only, filling the 24 by 24 box), measured on them.
  const PHOTO_LIDS = {
    ironman: { cx: [7.3, 15.7], y: 13, w: 3.8, h: 1.4, color: '#e8b630', tilt: 0 },
    captain: { cx: [8.2, 16.2], y: 12.5, w: 2.4, h: 1, color: '#e9a874', tilt: 0 },
    spiderman: { cx: [7.3, 15.8], y: 13.4, w: 5.2, h: 6.8, color: '#d81e1e', tilt: -40 },
    strange: { cx: [8.2, 14.3], y: 12.2, w: 2, h: 0.8, color: '#e5a36c', tilt: 0 },
    hulk: { cx: [7.6, 15.5], y: 13.3, w: 2.2, h: 0.9, color: '#4a8a1c', tilt: 0 },
    thor: { cx: [8.8, 14.6], y: 10.8, w: 2, h: 0.8, color: '#e6a265', tilt: 0 },
    blackpanther: { cx: [7.8, 15.4], y: 12.6, w: 2.4, h: 1, color: '#15141c', tilt: 10 },
    doom: { cx: [7.6, 16.4], y: 11.7, w: 3.6, h: 1.2, color: '#8a98aa', tilt: 0 },
    wolverine: { cx: [7.6, 15.4], y: 13.7, w: 2.2, h: 0.9, color: '#123a6b', tilt: 12 },
    batman: { cx: [8.4, 15.2], y: 13.8, w: 2.2, h: 0.8, color: '#121418', tilt: 12 },
    superman: { cx: [8.5, 14.75], y: 10.5, w: 2.2, h: 1, color: '#e9a46a', tilt: 0 },
    wonderwoman: { cx: [8.35, 14.6], y: 10.7, w: 2, h: 1, color: '#ebab78', tilt: 0 },
    flash: { cx: [7.6, 15.4], y: 13.3, w: 2.6, h: 1.1, color: '#b81414', tilt: 8 },
    aquaman: { cx: [8.8, 14.3], y: 9.3, w: 2, h: 0.8, color: '#d39158', tilt: 0 },
    greenlantern: { cx: [7.8, 14.2], y: 11.9, w: 2.4, h: 1, color: '#16a34a', tilt: 0 },
    joker: { cx: [8.2, 14.4], y: 12.8, w: 2.4, h: 1.2, color: '#e8eef0', tilt: 0 },
  };

  // A face picture: your cut-out (face only, no background) filling the face box. It has its own eyes.
  function photoMarkup(id, dimension, withLids) {
    return `<svg xmlns="${SVG_NS}" viewBox="-2 -2 28 28"${dimension} aria-hidden="true">`
      + `<image href="${photos[id]}" x="0" y="0" width="24" height="24" preserveAspectRatio="xMidYMid meet"/>`
      + `${withLids ? lidsMarkup(id, PHOTO_LIDS) : ''}</svg>`;
  }

  // The full picture as SVG text, or null for a look with no drawing. withEyes: false leaves the eyes out (the notch adds its own).
  // withLids: add eyelids so the notch can make the bot blink (only the notch animates them; elsewhere they would close the eyes).
  // photo: false shows the built-in bot even when you have a face picture.
  function markup(id, { withEyes = true, size = 0, withLids = false, photo = true } = {}) {
    if (!has(id)) return null;
    const dimension = size ? ` width="${size}" height="${size}"` : '';
    pictureCount += 1;
    if (photo && hasPhoto(id)) return photoMarkup(id, dimension, withLids);
    const body = drawingOf(id).split('__U__').join(String(pictureCount));
    const gradients = body.includes(`hs${pictureCount}`) ? defs(pictureCount) : '';
    return `<svg xmlns="${SVG_NS}" viewBox="-2 -2 28 28"${dimension} aria-hidden="true">${gradients}${body}${withEyes ? eyesMarkup(id) : ''}${withLids ? lidsMarkup(id) : ''}</svg>`;
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

  const api = { ids, has, faceFor, markup, element, setPacks, setPhotos, hasPhoto, LIDS, PHOTO_LIDS, DRAWINGS, EYES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Heroes = api;
})(typeof window !== 'undefined' ? window : globalThis);
