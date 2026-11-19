// Character packs in a page: fetch the checked list from the main program, give the drawings to Heroes,
// and put a pack's colors on an element. Colors go through the style object, which the page's security rules allow.
(function () {
  const HUES = { '--hue-a': 'a', '--hue-b': 'b', '--on-a': 'ink', '--a-text-light': 'textLight', '--a-text-dark': 'textDark' };

  // look: a pack from the list, or null to go back to the built-in colors. glow: also the notch's own accent colors.
  function paint(element, look, { glow = false } = {}) {
    const style = element.style;
    for (const name of [...Object.keys(HUES), '--accent', '--ring', '--eye']) style.removeProperty(name);
    if (!look) return;
    for (const [name, key] of Object.entries(HUES)) style.setProperty(name, look[key]);
    if (!glow) return;
    style.setProperty('--accent', look.accent);
    style.setProperty('--ring', look.accent);
    if (look.eyes) style.setProperty('--eye', look.eyes.color);
  }

  async function refresh(fetchList) {
    const packs = await fetchList();
    window.Heroes.setPacks(packs);
    return packs;
  }

  window.Packs = { paint, refresh };
})();
