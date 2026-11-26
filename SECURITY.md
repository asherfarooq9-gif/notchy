# Security

## Reporting a problem

Please use GitHub's private reporting: **Security tab, then "Report a vulnerability"**. Do not open a public issue for a security bug. I will answer as soon as I can.

## What the app does and does not do

- **No accounts, no API keys, no telemetry.** The app has no server of its own and never asks for a key or a password.
- **Ask Claude and file tasks** use the `claude` command-line tool that you installed and signed in to yourself. The app never sees your sign-in. Claude is started with all tools turned off, so it can only answer text.
- **Network.** The app fetches weather, currency rates and calendar feeds over https only, and never from local or home-network addresses. The update check contacts github.com over https (you can switch it off in Settings). It sends nothing else out.
- **Local web servers.** One listens on `127.0.0.1` only, for the optional Claude Code hook (a web page cannot use it). The optional phone link listens on your home network for up to 10 minutes, behind a long random code, for one phone only, and refuses programs and scripts. It is not encrypted, so use it on a network you trust.
- **Screen glow** takes a tiny 32 by 18 picture of your screen about ten times a second. It is kept in memory only, never saved and never sent anywhere.
- **Your data** (notes, clipboard history, timers, settings) stays in the app's data folder on your PC in plain files. Clipboard copies from password managers are skipped. Do not copy secrets you cannot afford to have stored there; the Clipboard tool has a Clear button (pinned items stay until you remove them).
- **Computer control** (typing, Wi-Fi, brightness, sleep, shut down) is off until you switch it on. Risky actions always ask first.
- The app windows run with Electron's sandbox and context isolation on, a strict content security policy, no Node.js in the pages, and no navigation away from the app's own files.

## Installer

The installer is not signed with a paid certificate, so Windows shows "Unknown publisher". Every release lists a SHA-256 checksum (`SHA256SUMS.txt`). Compare it with `Get-FileHash "Notchy-Setup-x.y.z.exe"` in PowerShell before you run it, or build the app yourself from source (see the README).

## Updates

The installed app updates itself from this repository's GitHub releases, through `electron-updater`. The update file lists a checksum, and the downloaded installer is checked against it before it runs. Once releases are signed, Windows also checks the signature. Until then, whoever can publish a release here can ship an update, so keep two-factor sign-in on for the GitHub account and protect the `main` branch and release tags.
