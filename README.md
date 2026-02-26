# FORTIFYOS // KNOX v3.0.3 — Obsidian Override

Mobile-first PWA with encrypted local-first vault (Dexie + WebCrypto) and capability-based agent handshake.

## Requirements
- Node 18+ recommended

## Install
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages
1) Create repo named `fortifyos`
2) Push this project to `main`
3) Run:
```bash
npm run deploy:pages
```

Then enable GitHub Pages:
- Settings → Pages → Source: `gh-pages` branch `/root`

URL:
`https://YOUR_USERNAME.github.io/fortifyos/`

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

## Pre-Market Intelligence Radar (Macro Sentinel)

Automation + report generator lives in `radar/`.
- Workflow: `.github/workflows/premarket-radar.yml`
- Generator: `radar/scripts/radar.py`
- Ticker universe: `radar/config/tickers.json`

Set GitHub Secrets to enable richer data + Telegram delivery:
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- Optional: `FINNHUB_API_KEY`, `NEWSAPI_KEY`, `X_BEARER_TOKEN`, `TRADIER_TOKEN`
- Kill switch: `STOP_PREMARKET_RADAR` (set to `1`)
