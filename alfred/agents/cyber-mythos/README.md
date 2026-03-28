# Cyber Mythos

Cyber Mythos is Alfred's contained security module for FORTIFY OS. It performs local-first static analysis, safe risk simulation, scoring, and reporting. It does not perform live exploitation or destructive actions.

## Location

- Engine root: `alfred/agents/cyber-mythos/`
- Persistent security state: `knox/security/`

## Commands

- `python -m cyber_mythos.runner.main audit --target <path>`
- `python -m cyber_mythos.runner.main audit --profile weekly --target <path>`
- `python -m cyber_mythos.runner.main panic --target <path>`
- `python -m cyber_mythos.runner.main secure --target <path>`
- `python -m cyber_mythos.runner.main sync-security`
- `python -m cyber_mythos.runner.main baseline --target <path>`

## Outputs

- Markdown reports in `outputs/reports/`
- Per-run snapshots in `outputs/snapshots/<run_id>/`
- Latest machine summary in `knox/security/latest-security-summary.json`
- Append-only log in `knox/security/security-log.csv`
- History in `knox/security/vulnerability-history.md`

## Baselines

`baseline` creates or refreshes a target baseline using a fresh weekly-profile audit and stores the resulting snapshot under `knox/security/baselines/`.
