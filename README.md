# Notchy

A small "notch" at the top of your Windows screen, in the style of the iPhone's Dynamic Island. It shows what is going on (a timer, the song playing, a message) and opens a panel of everyday tools. Pick a look, and the whole app wears it.

Notchy runs only on Windows 10 (version 2004 or newer) and Windows 11, 64-bit. It is built with Electron.

## Install (about one minute)

You do not need Node.js, an account, or administrator rights.

1. Go to the [Releases page](../../releases/latest) and download **`Notchy-Setup-<version>.exe`** (under "Assets").
2. Double-click the file you downloaded.
3. Windows may show a blue box, **"Windows protected your PC"**. This is expected: the installer is not signed with a paid certificate (see [Why does Windows warn me?](#why-does-windows-warn-me)). Click **More info**, then **Run anyway**.
4. Wait a few seconds. The installer asks nothing. Notchy installs and starts by itself. If you do not see it, open the Start menu, type **Notchy** and press Enter.
5. A **Welcome** window opens the first time. It asks four things, each a switch that starts off except updates: start with Windows, check for updates, ask Claude, and Claude file tasks. Pick what you want and press **Start using Notchy**. Nothing runs before you do. You can change every choice later in Settings.

That is all. Notchy installs for your own account only, into `%LOCALAPPDATA%\Programs\Notchy`, and adds a **Notchy** entry to your Start menu.

**Check the download (optional, recommended).** Each release has a `SHA256SUMS.txt`. In PowerShell run `Get-FileHash .\Notchy-Setup-<version>.exe` and compare the result with that file.

### What you will see

- The **notch** at the top center of your main screen.
- A **tray icon** at the bottom right of the taskbar. If you cannot see it, click the small `^` arrow to show hidden icons. Click it to open Settings.
- Three hotkeys:
  - `Control+Alt+N` opens the panel of tools.
  - `Control+Alt+J` opens a box where you type a command or a question.
  - `Control+Alt+K` opens the panel on a fresh note, ready to type.

You can change the hotkeys and everything else in Settings.

### Updates

Notchy checks GitHub for a new version about 30 seconds after it starts and then every few hours. It downloads the update in the background. Press **Restart and update** in Settings, General, or just quit: it installs by itself. You can switch the check off there, or press **Check now**.

### Uninstall

Windows Settings, Apps, **Notchy**, Uninstall. Your notes and settings stay in `%APPDATA%\Windows Notch` in case you install again. Delete that folder if you want them gone.

## Why does Windows warn me?

Windows SmartScreen warns about any installer that does not carry a paid code-signing certificate and is not yet widely downloaded. It does not mean the file is bad. The full source code is in this repository, every release has a SHA-256 checksum, and you can build the installer yourself (see below). Once more people install Notchy, the warning fades by itself.

## Troubleshooting

- **"Windows protected your PC".** Click **More info**, then **Run anyway**.
- **Edge or Chrome says the file "isn't commonly downloaded".** Choose **Keep**, then open the file.
- **Antivirus blocks the installer.** The installer is unsigned. Check the SHA-256 checksum against `SHA256SUMS.txt`, then allow it, or build it yourself.
- **Nothing appears after installing.** Look for the tray icon (click the `^` arrow). Press `Control+Alt+N`. If a hotkey does nothing, another program may be using it: change it in Settings.
- **Notchy did not start by itself after an update, or Windows says it cannot find `Notchy.lnk`.** Start it yourself: press the Windows key, type **Notchy**, press Enter. If that fails too, run `%LOCALAPPDATA%\Programs\Notchy\Notchy.exe`, or run the installer again (it puts the Start menu entry back). Since version 0.2.3 the installer starts the program file directly, so this should not happen; if it does, please [open an issue](../../issues/new).
- **The installer says Notchy is running.** Right-click the tray icon, choose **Quit Notchy**, then run the installer again.
- **The screen glow is dark on Netflix or Prime in a browser.** Windows hides protected video from screen capture, so the glow turns off there. YouTube, VLC and local files work.
- **"Ask Claude" or file tasks do nothing.** They need [Claude Code](https://claude.com/claude-code) installed and signed in. Nothing else in the app needs it.

Still stuck? [Open an issue](../../issues/new) and say your Windows version and what you saw.

## What it does

- **Type a command.** Press `Control+Alt+J`, type a command like "open downloads" or a question for Claude, press Enter.
- **Quick note.** Press `Control+Alt+K`. The panel opens on a fresh note, ready to type.
- **Panel of tools.** Press `Control+Alt+N`. It has notes and checklists, clipboard history, timers (focus, countdown, stopwatch), links, a message line for the notch, system numbers, unit and currency converters, weather, calendar, a file shelf, a music player view and screen time.
- **Converters.** Pictures to other formats, and Word to PDF and PDF to Word (needs Microsoft Word installed). A Word file (`.docx`, `.rtf` or old `.doc`) that names a template or picture at another address is refused before Word opens it, because Word would contact that address on its own. An old `.doc` with any web or network address in it is refused too: open it in Word, save it as `.docx`, and convert that. `.odt` files are not checked, so convert only ones you trust. Join PDFs and keep chosen pages.
- **Assistant for file tasks.** Tell Claude a task like "sort my Downloads by type". It shows a plan in plain sentences and does nothing until you press Run. Everything can be undone.
- **Phone link.** Send files from your phone to this PC over your home Wi-Fi. It is off until you press Start, works for 10 minutes and one phone, and stops when you press Stop.
- **Screen glow.** Soft light around the screen edges that follows the colors of the video on screen (Settings, Look). Pick Off, Full-screen only or Always.
- **Focus mode.** Type "focus mode on" (`Control+Alt+J`). Outside alerts stay away and the notch shows only your timer.
- **Routines.** Save a list of safe commands under a name and run it with "run <name>".
- **Looks and character packs.** Choose a look for the whole app. You can add your own look with a small `.json` file in the packs folder (Settings, Look).
- **A character with a streak.** The Home tab shows how many days in a row you finished a focus session.

## Run from source

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/asherfarooq9-gif/notchy.git
cd notchy
npm install
npm start
```

## Build the installer

```bash
npm run dist
```

The installer appears in the `release` folder as `Notchy-Setup-<version>.exe`. `npm run pack` makes the same app as a plain folder without the installer, which is faster for testing.

## Make a release (for the maintainer)

1. Change `"version"` in `package.json` (for example to `0.2.0`) and merge it to `main`.
2. Push a matching tag. GitHub Actions runs the tests, builds the installer on Windows and publishes a release with the installer, its update files and a checksum:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The workflow stops with an error if the tag and the version do not match. Everyone with Notchy installed gets the new version at their next check. You can also run the **Release** workflow by hand from the Actions tab.

## Test

```bash
npm test
```

The tests run on every pull request in GitHub Actions (Windows). On Linux or macOS a few Windows-only tests fail; that is expected.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security problems as described in [SECURITY.md](SECURITY.md).

## Privacy

- No accounts, no API keys and no telemetry. The app never asks for a key or a password.
- Your notes, clipboard history, timers and settings stay on your PC, in the app's data folder.
- Clipboard copies from password managers are skipped.
- **Ask Claude** and **file tasks** send your question or task text to Claude through the `claude` command-line tool that you installed and signed in to yourself, only if you turn them on. The app never sees your sign-in, and Claude is started with all tools off.
- The update check contacts github.com and sends nothing about you. Switch it off in Settings, General.
- Weather, currency rates and calendar feeds fetch from the websites you choose. Local and home-network addresses are never fetched.
- The phone link opens a small web page on your home network for a few minutes. It is not encrypted, so use it on a network you trust.
- Screen glow watches your screen as a tiny live video. It stays in memory, is never saved and never leaves your PC.
- Screen Time, if you turn it on, records which app is in front, on this PC only.

## Safety

- Risky commands (shut down, restart, sleep) always ask first, and shutdown waits 30 seconds so it can be cancelled.
- Computer control (typing, Wi-Fi, Bluetooth, brightness) can be switched off in Settings.
- Nothing you type is ever run as a raw command. Each action is a fixed one on a list.

## Not affiliated

Some looks are named after fictional characters and use color palettes inspired by them. The drawings are simple original cartoons. This project is not affiliated with or endorsed by Marvel, DC or any other company. All character names and trademarks belong to their owners.

## License

MIT. See [LICENSE](LICENSE).
