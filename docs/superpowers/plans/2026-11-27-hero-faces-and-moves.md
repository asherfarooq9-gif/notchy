# Hero Faces and Moves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the user's own picture of each hero as the face, keep the notch character moving, and play a special move plus a spoken line every minute.

**Architecture:** Face pictures are PNG files in `<userData>/faces/<id>.png` (never in git). The main program checks them (`lib/faces.js`) and hands them out as `data:` URLs. `renderer/heroes.js` draws a round photo instead of the drawing when one exists. `renderer/hero-moves.js` holds each hero's line, voice and move. `renderer/app.js` plays one every minute.

**Tech Stack:** Electron, plain JS, node:test, CSS keyframes, Web Speech `speechSynthesis` (Windows voices).

**Spec:** the design the user approved in chat on 2026-11-27 (summarized under Global Constraints).

## Global Constraints

- Face files: `ironman, captain, spiderman, strange, hulk, thor, blackpanther, doom, wolverine, batman, superman, wonderwoman, flash, aquaman, greenlantern, joker` + `.png`, in `%APPDATA%\Notchy\faces`. No picture in the repository.
- Missing or bad file: that hero keeps its drawing. Never crash.
- Photo faces are round, with no overlaid notch eyes.
- Move + line every 60 seconds, only while the notch is awake and idle (not focus, not dancing, not a Claude state).
- Line shows as notch text for about 3 seconds; a Windows voice says it (female for Wonder Woman, low pitch for Hulk, high and fast for Joker).
- Two switches, on by default: `heroMoves` ("Character moves every minute") and `heroVoice` ("Character voice").
- Lines (exact): Iron Man "I am Iron Man." · Captain America "I can do this all day." · Spider-Man "Your friendly neighborhood Spider-Man!" · Doctor Strange "Dormammu, I've come to bargain." · Hulk "HULK SMASH!" · Thor "Bring me Thanos!" · Black Panther "Wakanda forever!" · Doctor Doom "Doom does not bargain." · Wolverine "SNIKT! Let's go, bub." · Batman "I'm Batman." · Superman "Up, up and away!" · Wonder Woman "For Themyscira!" · The Flash "Fastest man alive!" · Aquaman "Permission to come aboard." · Green Lantern "In brightest day..." · Joker "HA HA HA HA HA!"
- Respect `prefers-reduced-motion`: no shaking or flying.

## Review Focus

- A face file that is not a PNG, or is huge: skipped with a reason, drawing stays. (Task 1 test)
- Faces folder missing: no faces, no error. (Task 1 test)
- A Windows PC with no speech voices: the line still shows as text. (Task 4: voice wrapped in try, guarded on `window.speechSynthesis`)
- Switching look while a move plays: the move class is cleared before the next one. (Task 4 test on the move picker)
- Notch hidden (`dormant`): no voice plays. (Task 4 test on `shouldPlay`)

---

### Task 0: Cut the picture (one-off, not committed)

- [ ] Crop the 4×4 grid from the user's image into 16 PNGs in row order: ironman, captain, spiderman, hulk / thor, blackpanther, strange, wolverine / batman, superman, wonderwoman, flash / aquaman, greenlantern, joker, doom.
- [ ] Cover the "Qwen" mark on the doom tile by mirroring the clean left half of the lower tile onto the right.
- [ ] Save to `%APPDATA%\Notchy\faces`. Look at all 16.

### Task 1: `lib/faces.js`

**Files:** Create `lib/faces.js`, `test/faces.test.js`.

**Interfaces:** Produces `loadFaces(dir: string, ids: string[], fsImpl = fs) -> { faces: {[id]: string /* data:image/png;base64 */}, problems: string[] }`, `MAX_FACE_BYTES = 1024 * 1024`.

- [ ] Tests: missing folder gives `{faces:{}, problems:[]}`; a real PNG (8-byte signature `89 50 4E 47 0D 0A 1A 0A`) becomes a `data:image/png;base64,` URL; a file with the wrong bytes and a file over 1 MB are skipped with a problem naming the file; ids not in the list are ignored.
- [ ] Implement, run `npm test`, commit.

### Task 2: Photo faces in `renderer/heroes.js` and everywhere they show

**Files:** Modify `renderer/heroes.js`, `renderer/packs.js`, `main.js`, `preload.js`, `panel-preload.js`, `settings-preload.js`, `welcome-preload.js`, `renderer/app.js`, `renderer/panel/boot.js`, `renderer/settings.js`, `renderer/welcome.js`, `renderer/settings.html`, `renderer/welcome.html` (CSP `img-src data:`), `renderer/style.css`. Test: `test/faces.test.js`.

**Interfaces:** Heroes gains `setPhotos(map)` and `hasPhoto(id)`. `markup(id)` returns an SVG with a circle-clipped `<image>` when a photo exists (no eyes). IPC `faces:list` returns the faces map; every preload exposes it as `faces()`. `window.Packs.loadPhotos(fetch)` calls `Heroes.setPhotos`.

- [ ] Tests: after `setPhotos({thor: url})`, `markup('thor')` contains `<image` and the url and no eye `<rect`; `setPhotos({})` gives the drawing back; `hasPhoto('nobody')` is false; a non-`data:image/png` value is ignored.
- [ ] Main reads faces at start (before tray) into its own Heroes; notch hides `.eye` when `body.has-photo`.
- [ ] Run tests, commit.

### Task 3: `renderer/hero-moves.js`

**Files:** Create `renderer/hero-moves.js` (works as `window.HeroMoves` and `require`), test `test/hero-moves.test.js`.

**Interfaces:** `MOVES: {[id]: {line, voice: {female, pitch, rate}, move}}`, `moveFor(id) -> entry | null`, `shouldPlay({state, isFocus, isDormant, isOn}) -> boolean`, `MOVE_EVERY_MS = 60000`, `MOVE_MS = 3200`.

- [ ] Tests: all 16 ids have a line matching Global Constraints exactly; Wonder Woman is female; `shouldPlay` true only for awake + idle + not focus + switch on.
- [ ] Implement, commit.

### Task 4: Notch plays moves; switches in Settings

**Files:** Modify `renderer/app.js`, `renderer/index.html`, `renderer/style.css`, `lib/settings.js`, `renderer/settings.html`, `renderer/settings.js`. Tests: `test/hero-moves.test.js`, `test/themes.test.js` (settings defaults).

- [ ] `heroMoves` and `heroVoice` default true, sanitized as booleans (test).
- [ ] Idle sway animation on the face. Every `MOVE_EVERY_MS`, if `shouldPlay`, set `body.dataset.move = id` for `MOVE_MS`, show the line through `showActivity({kind:'hero', text, ms: MOVE_MS})`, speak it if `heroVoice` and voices exist. An `.fx` element holds the effect symbol; CSS keyframes per move. Reduced motion: no moves animation.
- [ ] Run tests, start the app, watch three heroes, commit.
