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

## Plaid Integration (Secure)
Plaid linking requires a backend because Plaid secrets cannot be exposed in a static frontend.

### 1) Start Plaid bridge backend
```bash
cp .env.plaid.example .env
# fill PLAID_CLIENT_ID / PLAID_SECRET
npm run plaid:server
```

### 2) Point frontend to backend
Create `.env.local`:
```bash
VITE_PLAID_API_BASE=http://localhost:8787
```

Then run:
```bash
npm run dev
```

### 3) Use in app
Universal Sync -> `FILE IMPORT`:
- `PREPARE LINK`
- `CONNECT ACCOUNTS`

After link success, transactions are imported into the editable transaction table and can be committed to snapshot.

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
