# Ambient screen glow (movie color sync)

Goal: soft colored light around laptop screen edges. Color follows video on screen.

## Design
- Overlay window: full display, transparent, click-through, always on top.
- `setContentProtection(true)` so capture ignores overlay (no feedback loop).
- Capture: `desktopCapturer` tiny thumbnail (32x18), about 10 fps.
- `lib/ambient.js` (pure, tested): edge averages, smoothing, scene-cut snap, intensity.
- Overlay renderer: 4 blurred edge gradients, CSS transitions for smooth fades.
- Settings: `ambientLight` = off | movies | always, `ambientIntensity` = 1-5.
- "movies" mode = full-screen app only (reuse `isFullscreen`).
- Capture runs only while glow active. Saves battery.
- Known limit: DRM video (Netflix in browser) may capture black. Local players fine.

## Steps
- [x] `lib/ambient.js` + `test/ambient.test.js`
- [x] Settings keys + sanitize + update `test/settings.test.js`
- [x] Overlay window + capture loop in `main.js`
- [x] `renderer/ambient.html` + `renderer/ambient.js`
- [x] Settings UI row (mode, intensity)
- [x] README line
- [x] `npm test`: new tests green, 8 old failures unrelated
- [x] Review section below

## Review
- 8 tests fail with and without my change (Windows paths, missing pdf-lib / qrcode deps on Linux). Unrelated.
- All new tests pass (`test/ambient.test.js`, settings test).
- NOT run on real Windows. Overlay, capture and DRM behavior need a manual check:
  1. `npm start`, Settings, Look, Screen glow = Always.
  2. Play a local video. Edges should follow its colors.
  3. Try Netflix in browser. Expect black, glow fades out.
- Scope: primary display only. Full-screen mode = any full-screen app (movie or game).
