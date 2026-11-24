# Ambient screen glow (movie color sync)

Goal: soft colored light around laptop screen edges. Color follows video on screen.

## Design
- Overlay window: full display, transparent, click-through, always on top.
- `setContentProtection(true)` so capture ignores overlay (no feedback loop).
- Capture: `desktopCapturer` tiny thumbnail (32x18), about 10 fps.
- `lib/ambient.js` (pure, tested): edge averages, smoothing, scene-cut snap, intensity.
- Overlay renderer: 4 blurred edge gradients, CSS transitions for smooth fades.
- Settings: `ambientLight` = off | movies | always, `ambientIntensity` = 1-5.
- "movies" mode = full-screen app or media playing (reuse `isFullscreen`, `media`).
- Capture runs only while glow active. Saves battery.
- Known limit: DRM video (Netflix in browser) may capture black. Local players fine.

## Steps
- [ ] `lib/ambient.js` + `test/ambient.test.js`
- [ ] Settings keys + sanitize + update `test/settings.test.js`
- [ ] Overlay window + capture loop in `main.js`
- [ ] `renderer/ambient.html` + `renderer/ambient.js`
- [ ] Settings UI row (mode, intensity)
- [ ] README line
- [ ] `npm test` green
- [ ] Review section below

## Review
(pending)
