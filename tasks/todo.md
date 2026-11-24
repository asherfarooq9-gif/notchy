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

# Voice removal + better faces + DC pack
- [x] Voice deleted (engine, wake word, talk back, mic test, hotkey). Typed commands stay.
- [x] Hulk and Doctor Strange redrawn.
- [x] Looks grouped: Classic, Avengers, More Marvel, DC.
- [x] 7 DC looks: Batman, Superman, Wonder Woman, Flash, Aquaman, Green Lantern, Joker.
- Tests: 286 pass, same 8 old failures. Face previews rendered in Chromium and checked.
- Not run in Electron on Windows: check notch eyes and tray icon sizes by eye.

# Open-source install + security pass
- [x] Secret scan (files + git history): no keys, tokens or passwords. App never handles an API key (Claude via user's own CLI sign-in, tools off).
- [x] Electron 36.9.5 -> 45.4.1 (36 had many advisories). Smoke run under xvfb: no errors. `npm audit --omit=dev`: 0.
- [x] Navigation + window.open guard on all windows.
- [x] CI (tests on Windows) and Release workflow (installer + SHA256SUMS on tag).
- [x] README install steps, SECURITY.md, CONTRIBUTING.md, package.json metadata.
- [x] Packaged win-unpacked build on Linux: contents checked, no voice files, no tests.
- Open: first release not made (needs a tag push). Installer not signed. Git history has the owner's real name and email in older commits.
