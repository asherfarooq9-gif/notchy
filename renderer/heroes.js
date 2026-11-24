// The hero drawings, in one place. Used by the notch icon, the tray icon, the panel and the settings window.
// They are my own simple cartoons in each hero's colors, not official artwork.
// Loads in the page (as window.Heroes) and in Node (require), so the tray icon can use the same drawings.
(function (root) {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Each drawing fits a 24 by 24 face box; the picture window is -2 -2 28 28, so ears and fins can stick out.
  const DRAWINGS = {
  ironman: `
      <path d="M12 -1.6C6.4 -1.6 3.4 2 3.2 7.5L3 15C3 19.8 6 23 9 24.6L12 25.6 15 24.6C18 23 21 19.8 21 15L20.8 7.5C20.6 2 17.6 -1.6 12 -1.6Z" fill="#b3121a" stroke="#3b0a0c" stroke-width=".6"/>
      <path d="M5.4 5.4C5.4 2.8 8 .8 12 .8S18.6 2.8 18.6 5.4L19 13.5C19 17.8 17 20.8 14.8 22.4L12 23.6 9.2 22.4C7 20.8 5 17.8 5 13.5Z" fill="#eab93a" stroke="#3b0a0c" stroke-width=".5"/>
      <path d="M9.6 .8H14.4V7.2C14.4 7.9 13.9 8.4 13.2 8.4H10.8C10.1 8.4 9.6 7.9 9.6 7.2Z" fill="#b3121a" stroke="#3b0a0c" stroke-width=".4"/>
      <path d="M5.8 10.6C9 9.4 15 9.4 18.2 10.6M6.4 15.6L9.4 21.6M17.6 15.6L14.6 21.6" stroke="#b88a1c" stroke-width=".55" fill="none"/>
      <rect x="5.2" y="11.1" width="6.4" height="2.6" rx="1.3" transform="rotate(14 8.4 12.4)" fill="#5b6574"/>
      <rect x="12.4" y="11.1" width="6.4" height="2.6" rx="1.3" transform="rotate(-14 15.6 12.4)" fill="#5b6574"/>
      <path d="M7.6 19.2H16.4L14.6 21.2H9.4Z" fill="none" stroke="#7a5410" stroke-width=".6"/>
      <path d="M9.4 23.2L12 24.8 14.6 23.2 12 22.6Z" fill="#b3121a"/>
    `,
  captain: `
      <path d="M2.5 11C2.5 3 6.5 -1 12 -1S21.5 3 21.5 11V15C21.5 20.5 17.5 24.5 12 24.5S2.5 20.5 2.5 15Z" fill="#1d4ed8"/>
      <path d="M5 12.8C7 10.8 17 10.8 19 12.8V15.2C19 20 16 23 12 23S5 20 5 15.2Z" fill="#e8c39e"/>
      <path d="M2.5 7.5L-2 4.5 -.5 10 2.5 11.5Z M21.5 7.5L26 4.5 24.5 10 21.5 11.5Z" fill="#f1f5f9" stroke="#94a3b8" stroke-width=".45" stroke-linejoin="round"/>
      <path d="M12 .6L13 3.2 15.7 3.3 13.6 5 14.3 7.6 12 6.1 9.7 7.6 10.4 5 8.3 3.3 11 3.2Z" fill="#ffffff"/>
      <path d="M9.5 18.6Q12 20 14.5 18.6" stroke="#8a5a3a" stroke-width=".8" fill="none"/>
    `,
  spiderman: `
      <path d="M12 -1.8C6.6 -1.8 3.2 2.8 3.2 9.6 3.2 16.6 7.2 24.4 12 24.4S20.8 16.6 20.8 9.6C20.8 2.8 17.4 -1.8 12 -1.8Z" fill="#dc2626"/>
      <path d="M12 -1.8V12 M12 .6L5.8 6.4 M12 .6L18.2 6.4 M5 3.6Q12 7 19 3.6 M12 13.5V24.4 M12 13.5L7.2 22 M12 13.5L16.8 22 M12 13.5L4.2 16.6 M12 13.5L19.8 16.6 M7.2 17.2Q12 19.8 16.8 17.2 M8.6 20.8Q12 22.6 15.4 20.8" stroke="#2a0606" stroke-width=".55" fill="none"/>
      <ellipse cx="7.6" cy="10.4" rx="4.7" ry="3.2" transform="rotate(30 7.6 10.4)" fill="#0a0a0a"/>
      <ellipse cx="16.4" cy="10.4" rx="4.7" ry="3.2" transform="rotate(-30 16.4 10.4)" fill="#0a0a0a"/>
    `,
  strange: `
      <path d="M-.6 25L-1.4 11 .6 2 7.4 11.4 7.6 25Z M24.6 25L25.4 11 23.4 2 16.6 11.4 16.4 25Z" fill="#c0261c"/>
      <path d="M.6 2L7.4 11.4 7.6 25 6 25 5.6 14Z M23.4 2L16.6 11.4 16.4 25 18 25 18.4 14Z" fill="#7f1d1d"/>
      <path d="M-.6 25L1.2 18 4.4 25Z M24.6 25L22.8 18 19.6 25Z" fill="#a31d16"/>
      <path d="M8 25L12 20 16 25Z" fill="#0e7490"/>
      <circle cx="12" cy="22.6" r="1.1" fill="#facc15" stroke="#92400e" stroke-width=".3"/>
      <path d="M7.4 8.2C7.4 4.6 9.4 3 12 3S16.6 4.6 16.6 8.2V14C16.6 18.6 14.6 21.8 12 22.2S7.4 18.6 7.4 14Z" fill="#e8c39e"/>
      <path d="M7.4 14C7.6 17.6 9.2 20.4 12 20.8 14.8 20.4 16.4 17.6 16.6 14 15.6 16 14 16.8 12 16.8S8.4 16 7.4 14Z" fill="#d8ae86"/>
      <path d="M6.4 10.4C5.6 3.2 9 -1.4 14.2 -1.2 18.4 -1 19.6 2.4 18.6 8 17.8 5.2 15.4 3.4 12 3.6S8 5.6 7.6 9.8Z" fill="#33211a"/>
      <path d="M7.2 4.6C6.4 6.4 6.2 8.6 6.8 10.6L7.8 8.4Z M16.8 3.6C18 5 18.4 7.4 17.8 10.2L16.8 6Z" fill="#cbd2da"/>
      <path d="M8.2 8.6L11 9.6M15.8 8.6L13 9.6" stroke="#2a1a12" stroke-width=".9" stroke-linecap="round" fill="none"/>
      <path d="M12 10.6V14.6Q11 15.4 10.4 15.2M12 14.6Q13 15.4 13.6 15.2" stroke="#b98c68" stroke-width=".5" fill="none"/>
      <path d="M9.2 17Q10.6 16.2 12 16.8 13.4 16.2 14.8 17 13.6 17.8 12 17.4 10.4 17.8 9.2 17Z" fill="#3b261b"/>
      <path d="M10.2 17.8Q12 21.6 13.8 17.8 13.4 20 12 20.4 10.6 20 10.2 17.8Z" fill="#3b261b"/>
    `,
  doom: `
      <path d="M12 -1.8C6 -1.8 1.4 3.4 1.4 11V19C1.4 23 5.6 25.4 12 25.4S22.6 23 22.6 19V11C22.6 3.4 18 -1.8 12 -1.8Z" fill="#166534"/>
      <path d="M3.6 18Q3 10 6.6 4 M20.4 18Q21 10 17.4 4" stroke="#2a9a4a" stroke-width=".6" fill="none"/>
      <path d="M5 8C5.4 4 8.4 2.4 12 2.4S18.6 4 19 8V16.4C19 21.4 16 24 12 24S5 21.4 5 16.4Z" fill="#0d3a20"/>
      <path d="M5.8 7C7.2 5.6 16.8 5.6 18.2 7V15.4C18.2 20 15.6 23 12 23.4S5.8 20 5.8 15.4Z" fill="#a8b2c0"/>
      <path d="M6 8.4L11.2 7.4 11 10.4 6.2 10.6Z M18 8.4L12.8 7.4 13 10.4 17.8 10.6Z" fill="#7b8696"/>
      <path d="M6.8 9.8H10.8L10.4 12H7.4Z M17.2 9.8H13.2L13.6 12H16.6Z" fill="#101a24"/>
      <path d="M11.2 12L12.8 12 13.4 17 12 17.6 10.6 17Z" fill="#8f99a8"/>
      <path d="M12 5.8V8.2 M8.6 19.4H15.4 M9 20.8H15 M9.6 22.1H14.4" stroke="#566070" stroke-width=".8" fill="none"/>
      <circle cx="7.2" cy="13.2" r=".45" fill="#5b6574"/><circle cx="16.8" cy="13.2" r=".45" fill="#5b6574"/><circle cx="7.4" cy="8.3" r=".4" fill="#5b6574"/><circle cx="16.6" cy="8.3" r=".4" fill="#5b6574"/>
    `,
  blackpanther: `
      <path d="M4.2 7.5L2.2 -2 9.2 2.5Z M19.8 7.5L21.8 -2 14.8 2.5Z" fill="#1c1030"/>
      <path d="M4 10C4 4 7.5 1.5 12 1.5S20 4 20 10V15C20 20 16.5 23.5 12 23.5S4 20 4 15Z" fill="#1c1030"/>
      <path d="M7 4.2L8.6 7M17 4.2L15.4 7M12 2V6.5M8 19.6Q12 22 16 19.6M10.4 14.5H13.6" stroke="#c4b5fd" stroke-width=".8" fill="none"/>
    `,
  hulk: `
      <path d="M3.8 11L1.2 9.6Q.4 13.6 3.8 16Z M20.2 11L22.8 9.6Q23.6 13.6 20.2 16Z" fill="#69a524"/>
      <path d="M3 10.4C3 4.8 7 2.8 12 2.8S21 4.8 21 10.4V15.8C21 21.6 17.2 25 12 25S3 21.6 3 15.8Z" fill="#7cc42c"/>
      <path d="M3 12.4C4.2 16.4 6 19.4 8.8 21.6 6 23.6 3 21 3 15.8Z M21 12.4C19.8 16.4 18 19.4 15.2 21.6 18 23.6 21 21 21 15.8Z" fill="#5b981c"/>
      <path d="M2.8 11.6C1.4 7 2.8 2.8 6 .6 6.4 1.8 7.4 2.4 8.6 2.2 9.4 -.6 11 -1.8 12.6 -1.2 13.6 -1.8 15.4 -1.2 15.8 1.6 17.2 0 19.2 .8 18.8 2.8 20.8 3.2 22.4 6.4 21.2 11.6 20.4 8.8 19 7.2 16.8 6.8 15.4 5.6 13.4 5.4 12 6.4 10.4 5.2 8.2 5.6 7 7 5 7.6 3.8 9.2 2.8 11.6Z" fill="#20271a"/>
      <path d="M4.2 9.8Q8 7.4 11.8 10.6L11.6 12.8Q8 10.8 4.4 12.4Z M19.8 9.8Q16 7.4 12.2 10.6L12.4 12.8Q16 10.8 19.6 12.4Z" fill="#4a8416"/>
      <path d="M11.2 11.8H12.8L13.8 15.6Q12 16.8 10.2 15.6Z" fill="#639e20"/>
      <ellipse cx="10.9" cy="15.6" rx=".7" ry=".5" fill="#2f5a0e"/><ellipse cx="13.1" cy="15.6" rx=".7" ry=".5" fill="#2f5a0e"/>
      <path d="M6 17.8Q12 15.4 18 17.8 17.2 22.4 12 22.8 6.8 22.4 6 17.8Z" fill="#2b1212"/>
      <path d="M7.2 18Q12 16.4 16.8 18 16.4 19.6 12 19.8 7.6 19.6 7.2 18Z" fill="#f4f1dc"/>
      <path d="M8.2 21.6Q12 20.4 15.8 21.6 14.8 22.6 12 22.7 9.2 22.6 8.2 21.6Z" fill="#e9e5cc"/>
      <path d="M9.8 17.8V19.8 M12 17.4V19.9 M14.2 17.8V19.8" stroke="#2b1212" stroke-width=".3" fill="none"/>
      <path d="M5 14.4L6.2 19 M19 14.4L17.8 19" stroke="#477d14" stroke-width=".6" fill="none"/>
    `,
  thor: `
      <path d="M5 13L1 -4.6 1.6 .4 -.6 -.6 .4 4 -2 3.4 -.4 8 -2.6 8 -.4 12 -2 13.4 2.8 17Z M19 13L23 -4.6 22.4 .4 24.6 -.6 23.6 4 26 3.4 24.4 8 26.6 8 24.4 12 26 13.4 21.2 17Z" fill="#e5e7eb" stroke="#94a3b8" stroke-width=".45" stroke-linejoin="round"/>
      <path d="M4.2 12L1.2 -2M19.8 12L22.8 -2" stroke="#94a3b8" stroke-width=".5" fill="none"/>
      <path d="M5.2 9.5L5.8 19 8 15.5 8 9.5Z M18.8 9.5L18.2 19 16 15.5 16 9.5Z" fill="#facc15"/>
      <path d="M8 9.6H16V15.5C16 20 14.4 22.6 12 23.4S8 20 8 15.5Z" fill="#e8c39e"/>
      <path d="M5.2 9.5C5.2 2.6 8 -1 12 -1S18.8 2.6 18.8 9.5Z" fill="#94a3b8"/>
      <path d="M5.2 7.2L12 9 18.8 7.2V10H5.2Z" fill="#f1f5f9"/>
      <path d="M5.6 8.3L12 10.1 18.4 8.3" stroke="#64748b" stroke-width=".6" fill="none"/>
      <path d="M8.4 11.1L11 11.6M15.6 11.1L13 11.6" stroke="#6b4a1a" stroke-width=".9" stroke-linecap="round" fill="none"/>
      <path d="M7.6 14C7.8 22 10 24.6 12 24.8S16.2 22 16.4 14C15.4 17.6 13.8 18.4 12 18.4S8.6 17.6 7.6 14Z" fill="#b8860b"/>
      <path d="M10.6 19.6H13.4" stroke="#5a3d12" stroke-width=".8" fill="none"/>
    `,
  wolverine: `
      <path d="M4.6 23V8.5C4.6 3 7.6 .2 12 .2S19.4 3 19.4 8.5V23Z" fill="#facc15"/>
      <path d="M4.6 5.5L-1.2 -4.8 8.5 8.8 11 12.2 4.6 14.5Z M19.4 5.5L25.2 -4.8 15.5 8.8 13 12.2 19.4 14.5Z" fill="#26262b"/>
      <path d="M4.8 11L11.4 12 11.4 14.2 4.8 14.8Z M19.2 11L12.6 12 12.6 14.2 19.2 14.8Z" fill="#26262b"/>
      <path d="M4.6 14.5L8.2 17 8.8 23.6 4.6 23Z M19.4 14.5L15.8 17 15.2 23.6 19.4 23Z" fill="#26262b"/>
      <path d="M8 16.8C10 15.4 14 15.4 16 16.8V19.6C16 22.2 14.4 23.6 12 23.6S8 22.2 8 19.6Z" fill="#e8c39e"/>
      <path d="M11 7.4H13L12.5 14.6 12 15.6 11.5 14.6Z" fill="#facc15"/>
      <path d="M9.4 18.4Q12 17.6 14.6 18.4M9.6 20.8Q12 22 14.4 20.8" stroke="#8a6a50" stroke-width=".7" fill="none"/>
    `,
  batman: `
      <path d="M4.2 9.4L2.4 -2 9.4 3.2Z M19.8 9.4L21.6 -2 14.6 3.2Z" fill="#1f2937"/>
      <path d="M12 2.2C6.2 2.2 3.4 6.2 3.4 11.4 3.4 17 6.4 22.4 12 24.8 17.6 22.4 20.6 17 20.6 11.4 20.6 6.2 17.8 2.2 12 2.2Z" fill="#1f2937"/>
      <path d="M12 2.2C9 2.2 6.6 3.4 5.4 5.8 7.6 4.6 9.6 4.4 12 5 14.4 4.4 16.4 4.6 18.6 5.8 17.4 3.4 15 2.2 12 2.2Z" fill="#374151"/>
      <path d="M6.6 15.4C8.6 13.8 15.4 13.8 17.4 15.4 17 19.4 14.8 22.2 12 23 9.2 22.2 7 19.4 6.6 15.4Z" fill="#e8c39e"/>
      <path d="M5.4 7.8L10.8 10.6 M18.6 7.8L13.2 10.6" stroke="#111827" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <path d="M9.6 19.2Q12 20.4 14.4 19.2" stroke="#8a5a3a" stroke-width=".8" fill="none"/>
      <path d="M10.6 15.6H13.4" stroke="#b98c68" stroke-width=".5" fill="none"/>
    `,
  superman: `
      <path d="M4 25L5.4 20.6 12 23 18.6 20.6 20 25Z" fill="#1d4ed8"/>
      <path d="M2 25L4 19 7 21.4 6 25Z M22 25L20 19 17 21.4 18 25Z" fill="#b91c1c"/>
      <path d="M7.4 8.6C7.4 4.8 9.4 3.2 12 3.2S16.6 4.8 16.6 8.6V14.4C16.6 19 14.6 22 12 22.6S7.4 19 7.4 14.4Z" fill="#f0c8a0"/>
      <path d="M6.6 10.4C5.6 3.6 8.8 -.4 13 -.4 17.4 -.4 19 3 18.2 9 17.8 6.2 16 4.6 12.6 4.6 10.2 4.6 8.2 6.4 7.6 10Z" fill="#111827"/>
      <path d="M12.6 4.6C11.4 5.4 11 7.2 11.8 8.6 11.2 7.2 11.6 5.8 12.6 4.6Z" fill="#111827" stroke="#111827" stroke-width=".5"/>
      <path d="M8 9L11 9.4M16 9L13 9.4" stroke="#111827" stroke-width=".8" stroke-linecap="round" fill="none"/>
      <path d="M12 10.6V14.4Q11.2 15 10.6 14.8" stroke="#b98c68" stroke-width=".5" fill="none"/>
      <path d="M10 18.2Q12 19.4 14 18.2" stroke="#9a4a3a" stroke-width=".8" stroke-linecap="round" fill="none"/>
      <path d="M12 20.6V21.4" stroke="#d9a982" stroke-width=".6" fill="none"/>
    `,
  wonderwoman: `
      <path d="M3.6 14C3.2 6 6.6 1 12 1S20.8 6 20.4 14C20.2 19.6 19.4 23.4 17.4 25L15.6 14 8.4 14 6.6 25C4.6 23.4 3.8 19.6 3.6 14Z" fill="#1c1917"/>
      <path d="M7.4 8.4C7.4 4.8 9.4 3.4 12 3.4S16.6 4.8 16.6 8.4V14.4C16.6 19 14.6 22 12 22.6S7.4 19 7.4 14.4Z" fill="#f0c8a0"/>
      <path d="M7 6.6C8.6 3.4 15.4 3.4 17 6.6L16.4 8.2C14.8 5.6 9.2 5.6 7.6 8.2Z" fill="#1c1917"/>
      <path d="M6.8 5.8Q12 2.2 17.2 5.8L16.8 6.8Q12 4 7.2 6.8Z" fill="#d4a017" stroke="#8a6508" stroke-width=".3"/>
      <path d="M12 3.4L12.6 5.1H11.4Z" fill="#dc2626"/>
      <path d="M8.2 9.2Q9.6 8.4 11 9.2M13 9.2Q14.4 8.4 15.8 9.2" stroke="#1c1917" stroke-width=".7" fill="none"/>
      <path d="M12 10.8V14.4Q11.2 15 10.6 14.8" stroke="#b98c68" stroke-width=".5" fill="none"/>
      <path d="M9.8 18Q12 17.2 14.2 18 13.4 19.6 12 19.6 10.6 19.6 9.8 18Z" fill="#c2271f"/>
    `,
  flash: `
      <path d="M4.6 8L-1.4 4.6 1.6 7.6 -2.2 8.4 2.4 10.6 .2 12.4 4.8 12.4Z M19.4 8L25.4 4.6 22.4 7.6 26.2 8.4 21.6 10.6 23.8 12.4 19.2 12.4Z" fill="#facc15" stroke="#a16207" stroke-width=".3" stroke-linejoin="round"/>
      <path d="M12 -1.4C6.4 -1.4 3.2 3 3.2 9.6V15C3.2 20.4 6.8 24.6 12 24.6S20.8 20.4 20.8 15V9.6C20.8 3 17.6 -1.4 12 -1.4Z" fill="#dc2626"/>
      <path d="M12 -1.4C9 -1.4 6.6 .2 5.2 3.2 8.2 1.4 10 1.4 12 2.6 14 1.4 15.8 1.4 18.8 3.2 17.4 .2 15 -1.4 12 -1.4Z" fill="#ef4444"/>
      <path d="M6.8 10C6.8 6.4 9 5 12 5S17.2 6.4 17.2 10V14.6C17.2 18.6 15 21.4 12 22 9 21.4 6.8 18.6 6.8 14.6Z" fill="#f0c8a0"/>
      <path d="M6.6 8.6Q12 5.2 17.4 8.6L17.2 10.2Q12 7.4 6.8 10.2Z" fill="#dc2626"/>
      <path d="M12 10.8V14.4Q11.2 15 10.6 14.8" stroke="#b98c68" stroke-width=".5" fill="none"/>
      <path d="M10 18.4Q12 19.6 14 18.4" stroke="#9a4a3a" stroke-width=".8" stroke-linecap="round" fill="none"/>
    `,
  aquaman: `
      <path d="M3 12C2.6 5.4 6.2 1 12 1S21.4 5.4 21 12C20.8 17 21 21 19.4 25L16.6 18.4 7.4 18.4 4.6 25C3 21 3.2 17 3 12Z" fill="#e0a526"/>
      <path d="M3 12C3.2 8 4.8 4.4 8 2.6 5.6 5 5 8.6 5.4 13Z M21 12C20.8 8 19.2 4.4 16 2.6 18.4 5 19 8.6 18.6 13Z" fill="#b97f12"/>
      <path d="M7.4 8.6C7.4 5 9.4 3.6 12 3.6S16.6 5 16.6 8.6V14.2C16.6 19 14.6 22.2 12 22.8S7.4 19 7.4 14.2Z" fill="#e7b88a"/>
      <path d="M7.4 14C7.6 19 9.6 23.4 12 24.2 14.4 23.4 16.4 19 16.6 14 15.4 16 14 16.6 12 16.6S8.6 16 7.4 14Z" fill="#c8891f"/>
      <path d="M6.8 8.4C8.6 5.6 15.4 5.6 17.2 8.4L16.6 9.2C14.8 7 9.2 7 7.4 9.2Z" fill="#c8891f"/>
      <path d="M9.4 17.8Q12 16.8 14.6 17.8 13.6 18.8 12 18.6 10.4 18.8 9.4 17.8Z" fill="#7a4f10"/>
      <path d="M12 10.8V14.4Q11.2 15 10.6 14.8" stroke="#a8764a" stroke-width=".5" fill="none"/>
    `,
  greenlantern: `
      <path d="M7 8.6C7 4.8 9.2 3.2 12 3.2S17 4.8 17 8.6V14.4C17 19 14.8 22 12 22.6S7 19 7 14.4Z" fill="#e8c39e"/>
      <path d="M6.2 10.6C5.4 3.8 8.4 .2 12.4 .2 16.6 .2 18.8 3.4 17.8 9.6 17.4 6.6 15.6 4.8 12.4 4.8 9.6 4.8 7.8 6.6 7.4 10Z" fill="#4a3022"/>
      <path d="M5.4 9.6C8 7.6 16 7.6 18.6 9.6 18.6 12.6 16.6 14.2 14.4 13.6 13.4 12.6 10.6 12.6 9.6 13.6 7.4 14.2 5.4 12.6 5.4 9.6Z" fill="#16a34a" stroke="#14532d" stroke-width=".4"/>
      <path d="M12 12.6V14.8Q11.2 15.4 10.6 15.2" stroke="#b98c68" stroke-width=".5" fill="none"/>
      <path d="M10 18.4Q12 19.6 14 18.4" stroke="#9a4a3a" stroke-width=".8" stroke-linecap="round" fill="none"/>
      <path d="M8.8 16.4Q12 17.4 15.2 16.4" stroke="#d9a982" stroke-width=".4" fill="none"/>
    `,
  joker: `
      <path d="M3.6 25L6.4 19.6 12 22.4 17.6 19.6 20.4 25Z" fill="#6d28d9"/>
      <path d="M12 22.4L9.4 25 12 24.4 14.6 25Z" fill="#22c55e"/>
      <path d="M7 8.6C7 5 9.2 3.6 12 3.6S17 5 17 8.6V14.4C17 19 14.8 22 12 22.6S7 19 7 14.4Z" fill="#f1f5ee"/>
      <path d="M6 8.8C4.4 5.4 5.4 1.2 8.6 0 8 1.8 8.6 3 9.8 3.6 10 1.4 11.6 -.4 13.4 0 14.2 -1.2 16.2 -.4 16.4 1.6 18.2 .6 19.8 2.8 18.4 4.8 19.6 6.4 19 8.8 18 10.2 17.8 7 16.4 5.4 12 5.4S6.4 7 6.2 10.4Z" fill="#16a34a"/>
      <path d="M7.6 9.6Q9.6 8.2 11 9.8 10 12.6 7.8 11.8Z M16.4 9.6Q14.4 8.2 13 9.8 14 12.6 16.2 11.8Z" fill="#1e1b2e"/>
      <path d="M12 11.6V14.4Q11.2 15 10.6 14.8" stroke="#c7cdc4" stroke-width=".5" fill="none"/>
      <path d="M5.6 16.2Q8.4 21.4 12 21.2 15.6 21.4 18.4 16.2 17.4 18.2 12 18.4 6.6 18.2 5.6 16.2Z" fill="#dc2626"/>
      <path d="M8 18.4L8.6 19.6 M10 18.5L10.4 20 M12 18.5V20.2 M14 18.5L13.6 20 M16 18.4L15.4 19.6" stroke="#f8fafc" stroke-width=".6" fill="none"/>
      <path d="M5.6 16.2Q5.2 15.2 6 14.6 M18.4 16.2Q18.8 15.2 18 14.6" stroke="#b91c1c" stroke-width=".6" fill="none"/>
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
    return `<svg xmlns="${SVG_NS}" viewBox="-2 -2 28 28"${dimension} aria-hidden="true">${drawingOf(id)}${withEyes ? eyesMarkup(id) : ''}</svg>`;
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
