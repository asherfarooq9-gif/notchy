# Notch

A small "notch" at the top of your Windows screen, in the style of the iPhone's Dynamic Island. It shows what is going on (a timer, the song playing, a message), and opens a panel of everyday tools.

It runs only on Windows (built and tested on Windows 11). It is built with Electron. Nothing is uploaded anywhere unless you use a feature that says so (see "Privacy" below).

## What it does

- **Type a command.** Press `Control+Alt+J`, type a command like "open downloads" or a question for Claude, press Enter.
- **Panel of tools.** Press `Control+Alt+N`. It has notes and checklists, clipboard history, timers (focus, countdown, stopwatch), links, a message line for the notch, system numbers, unit and currency converters, weather, calendar, a file shelf, a music player view and screen time.
- **Converters.** Pictures to other formats, and Word to PDF and PDF to Word (needs Microsoft Word installed). Join PDFs and keep chosen pages.
- **Assistant for file tasks.** Tell Claude a task like "sort my Downloads by type". It shows a plan in plain sentences and does nothing until you press Run. Everything can be undone.
- **Phone link.** Send files from your phone to this PC over your home Wi-Fi. It is off until you press Start, works for 10 minutes and one phone, and stops when you press Stop.
- **Screen glow.** Soft light around the screen edges that follows the colors of the video on screen (Settings, Look). Pick Off, Full-screen only or Always. Protected video (Netflix or Prime in a browser) may show as black and then the glow stays off. YouTube, VLC and local files work.
- **Focus mode.** Type "focus mode on" (`Control+Alt+J`). Outside alerts stay away and the notch shows only your timer.
- **Routines.** Save a list of safe commands under a name and run it with "run <name>".
- **Looks and character packs.** Choose a look for the whole app. You can add your own look with a small `.json` file in the packs folder (Settings, Look).
- **A character with a streak.** The Home tab shows how many days in a row you finished a focus session.

## Install

There is no download page yet. Build the installer yourself (see "Build the installer").

Windows may warn "Unknown publisher" the first time, because the installer is not signed with a paid certificate. Choose "More info", then "Run anyway".

## Run from source

You need [Node.js](https://nodejs.org) (a recent version).

```bash
npm install
npm start
```

## Build the installer

```bash
npm run dist
```

The installer appears in the `release` folder as `Notch Setup <version>.exe`. `npm run pack` makes the same app as a plain folder without the installer, which is faster for testing.

## Test

```bash
npm test
```

## Privacy

- Your notes, clipboard history, timers and settings stay on your PC, in the app's data folder.
- Clipboard copies from password managers are skipped.
- **Ask Claude** and **file tasks** send your question or task text to Claude through the `claude` command-line tool, only if you turn them on and have it installed.
- Weather, currency rates and calendar feeds fetch from the websites you choose. Local and home-network addresses are never fetched.
- The phone link opens a small web page on your home network for a few minutes. It is not encrypted, so use it on a network you trust.
- Screen Time, if you turn it on, records which app is in front, on this PC only.

## Safety

- Risky commands (shut down, restart, sleep) always ask first, and shutdown waits 30 seconds so it can be cancelled.
- Computer control (typing, Wi-Fi, Bluetooth, brightness) can be switched off in Settings.
- Nothing you type is ever run as a raw command. Each action is a fixed one on a list.

## Not affiliated

Some looks are named after fictional characters and use color palettes inspired by them. The drawings are simple original cartoons. This project is not affiliated with or endorsed by Marvel, DC or any other company. All character names and trademarks belong to their owners.

## License

MIT. See [LICENSE](LICENSE).
