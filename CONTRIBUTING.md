# Contributing

Thanks for helping. Small, focused pull requests are easiest to review.

1. Fork the repo and make a branch.
2. `npm install`, then `npm start` to try the app and `npm test` to run the tests.
3. Add or update a test for what you change. `npm test` must pass on Windows (the tests also run in GitHub Actions).
4. Never commit keys, tokens, personal paths or logs. `.env` files are ignored on purpose.
5. Looks: colors live in `lib/themes.js`, drawings in `renderer/heroes.js`. After editing `lib/themes.js`, run `node scripts/make-looks.js`. Use your own simple drawings and color palettes only: no logos or official artwork.

Security problems: see [SECURITY.md](SECURITY.md), not a public issue.
