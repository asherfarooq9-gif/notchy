// Each hero's special move and line. Every minute, while the notch is awake and idle, the chosen hero
// does its move (style.css: body[data-move="..."]), shows its line in the notch, and says it with a Windows voice.
// Loads in the page (as window.HeroMoves) and in Node (require), so the tests can check it.
(function (root) {
  const MOVE_EVERY_MS = 60 * 1000;
  const MOVE_MS = 3200; // the line shows this long, and the move lasts this long

  // voice: female voice or not, pitch (0 to 2, 1 is normal) and rate (1 is normal speed).
  const MOVES = {
    ironman: { line: 'I am Iron Man.', move: 'blast', voice: { female: false, pitch: 0.9, rate: 0.9 } },
    captain: { line: 'I can do this all day.', move: 'shield', voice: { female: false, pitch: 1, rate: 0.95 } },
    spiderman: { line: 'Your friendly neighborhood Spider-Man!', move: 'web', voice: { female: false, pitch: 1.25, rate: 1.15 } },
    strange: { line: "Dormammu, I've come to bargain.", move: 'portal', voice: { female: false, pitch: 0.85, rate: 0.9 } },
    hulk: { line: 'HULK SMASH!', move: 'smash', voice: { female: false, pitch: 0.3, rate: 0.8 } },
    thor: { line: 'Bring me Thanos!', move: 'hammer', voice: { female: false, pitch: 0.75, rate: 0.85 } },
    blackpanther: { line: 'Wakanda forever!', move: 'slash', voice: { female: false, pitch: 0.8, rate: 0.9 } },
    doom: { line: 'Doom does not bargain.', move: 'doomglow', voice: { female: false, pitch: 0.55, rate: 0.8 } },
    wolverine: { line: "SNIKT! Let's go, bub.", move: 'claws', voice: { female: false, pitch: 0.65, rate: 1 } },
    batman: { line: "I'm Batman.", move: 'bat', voice: { female: false, pitch: 0.5, rate: 0.8 } },
    superman: { line: 'Up, up and away!', move: 'fly', voice: { female: false, pitch: 1, rate: 1 } },
    wonderwoman: { line: 'For Themyscira!', move: 'lasso', voice: { female: true, pitch: 1.05, rate: 0.95 } },
    flash: { line: 'Fastest man alive!', move: 'bolt', voice: { female: false, pitch: 1.15, rate: 1.6 } },
    aquaman: { line: 'Permission to come aboard.', move: 'bubbles', voice: { female: false, pitch: 0.8, rate: 0.9 } },
    greenlantern: { line: 'In brightest day...', move: 'ring', voice: { female: false, pitch: 0.95, rate: 0.85 } },
    joker: { line: 'HA HA HA HA HA!', move: 'laugh', voice: { female: false, pitch: 1.7, rate: 1.3 } },
  };

  // The little effect each move shows next to the face (fixed drawings in a 24 by 24 box). Superman has none: he flies off himself.
  const FX = {
    blast: '<rect x="0" y="9" width="24" height="6" rx="3" fill="#fde68a"/><rect x="0" y="10.5" width="24" height="3" rx="1.5" fill="#ffffff"/>',
    shield: '<circle cx="12" cy="12" r="11" fill="#dc2626"/><circle cx="12" cy="12" r="8.4" fill="#f8fafc"/><circle cx="12" cy="12" r="6" fill="#dc2626"/><circle cx="12" cy="12" r="4" fill="#1d4ed8"/><path d="M12 8.6l1 2.6h2.7l-2.2 1.6.8 2.6L12 13.8l-2.3 1.6.8-2.6-2.2-1.6H11z" fill="#fff"/>',
    web: '<path d="M12 -24V2" stroke="#f8fafc" stroke-width="1.2"/>',
    portal: '<circle cx="12" cy="12" r="10.5" fill="none" stroke="#fb923c" stroke-width="1.6" stroke-dasharray="3 2"/><circle cx="12" cy="12" r="7" fill="none" stroke="#fdba74" stroke-width="1" stroke-dasharray="2 2"/>',
    smash: '<path d="M12 1l2.5 6.5L21 5l-3 6 5 2-6 2 2 6-6-3-3 5-1.5-6L3 19l3-6-5-2 6-2-3-6 6 3z" fill="#84cc16" stroke="#fef08a" stroke-width="1"/>',
    hammer: '<rect x="3" y="3" width="13" height="8" rx="1.5" fill="#94a3b8" stroke="#475569" stroke-width="1"/><rect x="8.5" y="11" width="2.6" height="12" rx="1" fill="#78350f"/>',
    slash: '<path d="M4 3L14 21M9 2L19 20M14 1L23 18" stroke="#a78bfa" stroke-width="1.6" stroke-linecap="round"/>',
    doomglow: '<circle cx="12" cy="12" r="11" fill="none" stroke="#4ade80" stroke-width="1.4"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="#86efac" stroke-width="1" opacity=".7"/>',
    claws: '<path d="M5 22L7 2M12 22V1M19 22L17 2" stroke="#e2e8f0" stroke-width="1.6" stroke-linecap="round"/>',
    bat: '<path d="M12 8.5c.6 1 1 1.6 1.6 1.6.6-1 .9-2 1.3-2.6.3 1 .3 2 .7 2.4 2.6-1.4 5.4-1.6 8.4-.4-2 1-3 2.8-3 5-1.8-1.2-3.6-.8-4.6.6-.8-1.2-2.2-1.6-3.4-.6-.4-.8-.8-1.4-1-1.4s-.6.6-1 1.4c-1.2-1-2.6-.6-3.4.6-1-1.4-2.8-1.8-4.6-.6 0-2.2-1-4-3-5 3-1.2 5.8-1 8.4.4.4-.4.4-1.4.7-2.4.4.6.7 1.6 1.3 2.6.6 0 1-.6 1.6-1.6z" fill="#facc15" stroke="#000000" stroke-width=".5"/>', // a yellow bat signal, so it shows on the black notch
    lasso: '<ellipse cx="12" cy="12" rx="11" ry="5" fill="none" stroke="#facc15" stroke-width="1.6"/>',
    bolt: '<path d="M14 1L4 13h6l-2 10 10-13h-6z" fill="#facc15" stroke="#dc2626" stroke-width=".8" stroke-linejoin="round"/>',
    bubbles: '<circle cx="6" cy="18" r="2.5" fill="none" stroke="#67e8f9" stroke-width="1"/><circle cx="14" cy="12" r="1.8" fill="none" stroke="#67e8f9" stroke-width="1"/><circle cx="10" cy="5" r="1.4" fill="none" stroke="#a5f3fc" stroke-width="1"/><circle cx="19" cy="7" r="2" fill="none" stroke="#67e8f9" stroke-width="1"/>',
    ring: '<circle cx="12" cy="12" r="9" fill="none" stroke="#4ade80" stroke-width="2.4"/>',
    laugh: '<text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" font-family="Segoe UI, sans-serif" fill="#a3e635">HA</text>',
  };

  const moveFor = (id) => (Object.prototype.hasOwnProperty.call(MOVES, id) ? MOVES[id] : null);

  // Only when you can see the notch and nothing more important is on it.
  const shouldPlay = ({ state, isFocus, isDormant, isOn }) => isOn === true && state === 'idle' && !isFocus && !isDormant;

  // A Windows voice of the wanted kind; any voice if none matches; null if Windows has none.
  const FEMALE = /zira|hazel|susan|eva|aria|jenny|female/i;
  function pickVoice(voices, female) {
    if (!voices || voices.length === 0) return null;
    return voices.find((v) => FEMALE.test(v.name) === female) || voices[0];
  }

  const api = { MOVES, FX, MOVE_EVERY_MS, MOVE_MS, moveFor, shouldPlay, pickVoice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HeroMoves = api;
})(typeof window !== 'undefined' ? window : globalThis);
