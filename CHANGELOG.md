# FortifyOS v1.0.0 — 2026-03-27

## Release: FortifyOS v1.0.0

**Tag:** `v1.0.0`
**Date:** 2026-03-27
**Commit:** `b3764526`

---

## What's New in v1.0.0

### TypeScript Foundation
- `tsconfig.json` added with strict mode and bundler resolution
- Entry points converted: `vite.config.ts`, `main.tsx`, `App.tsx`
- `@types/papaparse` installed for type coverage
- Build pipeline fully compatible with TypeScript target

### API Input Validation (TASK-PBR-001)
- Canonical request schema validation via `api.types.ts`
- Typed capability enums: `READ_VELOCITY`, `READ_RUNWAY`, `PROPOSE_ACTION`
- Consistent error envelopes with machine-readable error codes
- 12/12 verification tests passing

### Security Error Handling (TASK-FOS-002)
- All security modules now use typed error classes (no bare `throw new Error()`)
- Audit logging throughout all crypto and security operations
- No silent catch blocks — all error paths explicit
- `SecurityError` class for logged security events

Modules updated:
- `src/security/vaultSigning.js` — ECDSA key management with full audit trail
- `src/security/passkeys.js` — WebAuthn passkey creation and authentication
- `src/crypto/sovereignCrypto.js` — AES-GCM encryption, HMAC verification

### Database Migrations (TASK-PBR-002)
- Explicit migration path for `FortifySovereignDB` (Dexie/IndexedDB)
- v3: `auditLog.seq` populated from auto-increment `id`
- v4: `auditLog.epochId` initialized to `null` for lineage binding
- Upgrade functions are non-destructive and idempotent
- Rollback policy documented (manual procedure)

### Cross-Platform Alert System (TASK-PBR-003)
- Alert abstraction layer: `AlertEmitter` + `AlertDispatcher`
- Deduplication via per-tag cooldowns
- Four adapters:
  - **ConsoleAdapter** — always available, fallback
  - **BroadcastAdapter** — cross-tab via BroadcastChannel API
  - **NotificationAdapter** — native OS notifications (Web Notifications API)
  - **WebhookAdapter** — HTTP POST to configurable endpoint
- Graceful degradation when adapters unavailable

### JSDoc Documentation (TASK-FOS-003)
- All exported functions, classes, and types documented
- Priority: alerts, db, agents/api, security modules
- `@param`, `@returns`, `@throws`, `@type` annotations reflect actual signatures
- No stale examples; no invented guarantees

### Environment Stabilization
- `pnpm-lock.yaml` retained; `package-lock.json` removed
- CI pipeline uses `corepack pnpm install --frozen-lockfile`
- Production CSP: `script-src 'self'` (no `unsafe-eval`)
- `unsafe-eval` confirmed as Vite HMR dev-only; not needed in production build
- Duplicate `App.jsx` removed; import paths corrected

---

## Verification Summary

| Test Suite | Tests | Status |
|---|---|---|
| `verification/verify_pbr001.js` | 15/15 | ✅ |
| `verification/verify_fos002.js` | 24/24 | ✅ |
| `verification/verify_pbr003.js` | 26/26 | ✅ |
| `npm run build` | — | ✅ |

---

## Blocked Items (Post-v1.0)

| Item | Status | Blocker |
|---|---|---|
| R-01..R-09 Audit Mapping | Blocked | Canonical audit register not provided |
| TASK-001 (UI errors) | Blocked | Awaiting details from operator |
| TASK-FOS-004 (Routed Shell) | Deferred | PINGuard + React Router integration; post-v1 |

---

## Commit Ledger

| Commit | Description |
|--------|-------------|
| `b3764526` | TASK-FOS-003: JSDoc documentation |
| `c1f91939` | TASK-PBR-003: Cross-platform alert system |
| `f611feb8` | TASK-PBR-002: Database migrations |
| `c336a7f7` | TASK-FOS-002: Security error handling (vaultSigning, passkeys, sovereignCrypto) |
| `8f43ed80` | Stable verifier suite (verify_pbr001, verify_fos002) |
| `1e85b362` | ENVIRONMENT_FIX-02: lockfile + CSP |
| `76931873` | ENVIRONMENT_FIX-01: duplicate App cleanup |
| `c4473a4d` | TASK-PBR-001: API validation + FOS-002 partial |
| `bd3f6fed` | TASK-FOS-001: TypeScript foundation |

---

## Upgrading from Prior Versions

This is a **ground-up remediation** targeting architectural and safety quality. It does not follow a linear version path from `2.x`. The product version was reset to `1.0.0` to mark the completion of the first stability release.

**Breaking changes from prior architecture:**
- No backward compatibility guarantees with pre-remediation state
- API layer is net-new with typed validation
- Database schema has migration path from any prior state via Dexie upgrade functions
