# FORTIFYOS

Local-first financial operating shell built with React and Vite.

FORTIFYOS is the product-facing command center. It can run as a standalone local web app,
or advanced users can pair it with a separate local finance engine such as
`treasury-system` for SQLite-backed data, imports, exports, and optional local LLM helpers.

## Requirements
- Node 18+ recommended
- Git

## Install
```bash
git clone https://github.com/YOUR_USERNAME/fortifyos.git
cd fortifyos
npm install
npm run dev
```

Default local dev server:
- `http://127.0.0.1:5173`

## Build
```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages
1. Push this project to `main`
2. Run:
```bash
npm run deploy
```
3. In GitHub, enable Pages on the `gh-pages` branch

Resulting URL pattern:
`https://YOUR_USERNAME.github.io/fortifyos/`

## Current repo structure
```text
fortifyos/
  src/              React app, views, modules, Field Manual
  public/           static assets
  app/macro/        macro and market data logic/assets
  radar/            radar config and scripts
  scripts/          build/update helper scripts
  archive/          legacy reference docs not part of live product docs
  package.json      npm scripts and dependencies
  README.md         install + operating notes
```

## Optional hybrid local stack
Advanced users can run FORTIFYOS as the frontend shell on top of a separate local backend
such as `treasury-system`. In that model, FORTIFYOS remains the UI while the backend owns:
- `data/raw/` for CSV and PDF statements
- `data/manual_snapshot/` and `data/manual_bnpl/`
- `database/` for SQLite
- `exports/` for reports, calendar, sanitized outputs
- `llm/` for optional local agents and categorization helpers

This hybrid model is local-first. It does not require a cloud backend.

## Docs note
Older Knox concept docs and prototype assets have been moved to:
- `archive/legacy-docs/`

Those files are historical reference only and should not be treated as current install or
runtime documentation.

## Security model (current)
- Encrypted-at-rest audit log (AES-GCM)
- Key derived from passphrase (PBKDF2) + local salt
- Export/import vault for offline backups
- Capability-based agent access:
  - window.FORTIFY.getHandshake()
  - window.FORTIFY.agentRequest(req)

## Notes
- A PWA cannot guarantee hardware Secure Enclave binding. Passkeys/WebAuthn can be added later as an unlock gate.


## Native Secure-Keystore Mode (Dual Runtime)

This project supports:
- **Web Sovereign Mode (PWA):** GitHub Pages deploy, passphrase unlock.
- **Native Sovereign Mode (Capacitor):** iOS/Android shell, device-secret stored in OS secure storage.

### Build Native
1. Install deps
2. Initialize and add platforms:

```bash
npm install
npm run cap:add:ios
npm run cap:add:android
```

3. Sync and open:

```bash
npm run cap:sync
npm run cap:open:ios
# or
npm run cap:open:android
```

**Note:** Native mode uses `@capacitor-community/secure-storage` to store a device secret. This secret is used to derive encryption keys via HKDF. On platforms where the plugin is backed by Keychain/Keystore, keys become device-bound.

### Biometrics (FaceID/TouchID/Fingerprint)

Native mode can require a biometric prompt before loading the device secret.
This uses `@capgo/capacitor-native-biometric` (pinned to 8.4.2; fixed versions are >= 8.3.6).

Enable in-app:
- Settings → **Require Biometrics (Native)** → ON
