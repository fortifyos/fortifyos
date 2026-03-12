# FORTIFY OS

Local-first financial operating shell built with React and Vite.

FORTIFY OS is the product-facing command center. It can run as a standalone local web app,
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

Local dev server:
- open the local address printed by Vite after `npm run dev`
- this is often `http://localhost:5173` or a similar local address on your machine

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
Advanced users can run FORTIFY OS as the frontend shell on top of a separate local backend
such as `treasury-system`. In that model, FORTIFY OS remains the UI while the backend owns:
- `data/raw/` for CSV and PDF statements
- `data/manual_snapshot/` and `data/manual_bnpl/`
- `database/` for SQLite
- `exports/` for reports, calendar, sanitized outputs
- `llm/` for optional local agents and categorization helpers

This hybrid model is local-first. It does not require a cloud backend.

## TCG Radar MVP
FORTIFY OS now includes a first-pass `TCG Radar` track for structured collector-market intelligence.

Current MVP shape:
- sample Python engine under `app/tcg/`
- deterministic scoring and entity resolution
- file-backed outputs written to:
  - `data/tcg/latest.json`
  - `data/tcg/archive/`
  - `data/tcg/signal_log.jsonl`
  - `data/tcg/source_receipts/`
- mirrored frontend-readable payloads under:
  - `public/tcg/latest.json`
  - `public/tcg/archive/`
  - `public/tcg/source_receipts/`
- Fortify UI page available as `TCG Radar`

Generate the current sample snapshot:
```bash
python3 app/tcg/jobs/run_cycle.py
```

Planned upgrade path:
- live source credentials
- FastAPI routes from `app/tcg/api/`
- JP source expansion
- better sealed-product analytics
- archive replay / backtesting

Optional backend dependencies for the TCG API scaffold are listed in:
- `app/tcg/requirements.txt`

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
- The current supported product surface is the local web app and optional local-first hybrid backend model.
- Passkeys/WebAuthn can be added as an unlock gate without implying a native mobile shell requirement.
