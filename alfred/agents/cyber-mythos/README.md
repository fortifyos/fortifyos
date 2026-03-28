# Cyber Mythos

Cyber Mythos is Alfred's contained security module for FORTIFY OS. It performs local-first static analysis, safe risk simulation, scoring, and reporting. It does not perform live exploitation or destructive actions.

## Location

- Engine root: `alfred/agents/cyber-mythos/`
- Persistent security state: `knox/security/`

## Commands

- `python -m cyber_mythos.runner.main audit --target <path>`
- `python -m cyber_mythos.runner.main audit --diff --target <path>`
- `python -m cyber_mythos.runner.main audit --profile pr --target <path>`
- `python -m cyber_mythos.runner.main audit --profile weekly --target <path>`
- `python -m cyber_mythos.runner.main audit --all`
- `python -m cyber_mythos.runner.main panic --target <path>`
- `python -m cyber_mythos.runner.main secure --target <path>`
- `python -m cyber_mythos.runner.main sync-security`
- `python -m cyber_mythos.runner.main baseline --target <path>`

## Daily Operating Path

Cyber Mythos V2 is the default daily path.

- Daily use should prefer diff-aware audits for faster, lower-noise runs: `python -m cyber_mythos.runner.main audit --diff --target <path>`
- Change-review work should prefer PR mode: `python -m cyber_mythos.runner.main audit --profile pr --target <path>`
- Weekly audits remain the deeper baseline and trend-tracking path: `python -m cyber_mythos.runner.main audit --profile weekly --target <path>`

## Rollout State

V2 rollout is validated for daily use.

- Diff scans stayed reduced and stable on harmless tracked changes
- PR mode correctly detected and then cleared a temporary dependency risk with matching risk-delta reversal
- Repeated clean diff scans remained identical in score, coverage, scope, and findings while producing fresh `run_id` values
- The V2 test suite remained green during rollout validation

## Outputs

- Markdown reports in `outputs/reports/`
- Per-run snapshots in `outputs/snapshots/<run_id>/`
- Latest machine summary in `knox/security/latest-security-summary.json`
- Append-only log in `knox/security/security-log.csv`
- History in `knox/security/vulnerability-history.md`

## Baselines

`baseline` creates or refreshes a target baseline using a fresh weekly-profile audit and stores the resulting snapshot under `knox/security/baselines/`.
