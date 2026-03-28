# AGENT ROUTER — FORTIFY OS
version: 1.0 (LOCKED)
layer: Alfred Orchestration
timezone: America/New_York

---

## PURPOSE

Define how Alfred routes security-analysis requests to Cyber Mythos.

This router is responsible for:

- recognizing supported security commands
- selecting the correct Cyber Mythos execution mode
- invoking the Python CLI with a stable contract
- validating expected outputs
- surfacing concise operator-facing results
- escalating failures when execution or outputs are invalid

This router does NOT perform scanning itself.

---

## ROUTED AGENT

Primary security operator:

- `CYBER_MYTHOS`

Skill file:

- `alfred/agents/cyber-mythos/SKILL.md`

Heartbeat file:

- `alfred/agents/cyber-mythos/heartbeat.md`

Engine root:

- `alfred/agents/cyber-mythos/`

---

## ROUTING PRINCIPLE

Alfred is the orchestrator.
Cyber Mythos is the security-analysis engine.

Routing flow:

1. Alfred receives command
2. Alfred resolves target path
3. Alfred maps command to Cyber Mythos CLI
4. Alfred invokes Python subprocess
5. Alfred validates required output artifacts
6. Alfred reads summary JSON
7. Alfred returns concise result status to operator
8. Alfred escalates if validation fails

---

## SUPPORTED COMMANDS

### 1. Full Audit

Operator command:

`/audit <target>`

Default behavior:

- standard scan profile
- all enabled v1 scanners
- full markdown report
- summary JSON refresh
- CSV log append
- history append
- snapshot bundle creation

Engine command:

`python -m cyber_mythos.runner.main audit --target <path>`

---

### 2. Weekly Audit Profile

Operator command:

`/audit <target> --profile weekly`

Behavior:

- deeper scheduled scan
- baseline comparison enabled
- extended checks within v1 limits
- full markdown report
- summary JSON refresh
- score delta tracking
- snapshot bundle creation

Engine command:

`python -m cyber_mythos.runner.main audit --profile weekly --target <path>`

---

### 3. Panic Scan

Operator command:

`/panic <target>`

Behavior:

- critical and high findings only
- condensed report
- immediate risk visibility
- summary JSON refresh
- snapshot bundle creation

Engine command:

`python -m cyber_mythos.runner.main panic --target <path>`

---

### 4. Hardening Mode

Operator command:

`/secure <target>`

Behavior:

- remediation-focused output only
- no long-form vulnerability dump
- prioritized defensive actions
- summary JSON refresh
- snapshot bundle creation

Engine command:

`python -m cyber_mythos.runner.main secure --target <path>`

---

### 5. Sync Security State

Operator command:

`/sync-security`

Behavior:

- rebuild latest summary from most recent valid outputs
- no new scan required

Engine command:

`python -m cyber_mythos.runner.main sync-security`

---

### 6. Baseline Management

Operator command:

`/baseline <target>`

Behavior:

- create or refresh target baseline
- no scheduled execution by default

Engine command:

`python -m cyber_mythos.runner.main baseline --target <path>`

---

## PROFILE CONTRACT

Supported profiles:

- `default` (implicit)
- `weekly`

Profile behavior:

- `default` -> standard daily audit behavior
- `weekly` -> deeper audit, baseline comparison, extended checks

Profiles must be passed consistently across:

- Alfred commands
- Python CLI invocations
- heartbeat scheduling references

---

## AD HOC OPERATIONS

These commands are not part of scheduled heartbeat execution by default:

- `/sync-security`
- `/baseline <target>`

They are manual or Alfred-triggered operations only.

---

## TARGET RESOLUTION RULES

Target input may be:

- repo root name
- relative path inside the Fortify repo
- absolute local path explicitly provided by the operator

Resolution rules:

1. Prefer exact repo-local matches first
2. Resolve relative paths from the Fortify repo root
3. Reject missing or ambiguous targets
4. Do not silently fall back to a different repo
5. Always pass the resolved canonical path to Cyber Mythos

If target resolution fails:

- do not invoke the engine
- return a routing error immediately

---

## OUTPUT CONTRACT

After a successful routed run, Alfred expects:

- `alfred/agents/cyber-mythos/outputs/reports/<date>_<target>.md`
- `alfred/agents/cyber-mythos/outputs/snapshots/<run_id>/`
- `alfred/agents/cyber-mythos/outputs/snapshots/<run_id>/run.json`
- `knox/security/latest-security-summary.json`
- `knox/security/security-log.csv`
- `knox/security/vulnerability-history.md`

Alfred reads:

- `knox/security/latest-security-summary.json`
- `alfred/agents/cyber-mythos/outputs/snapshots/<run_id>/run.json`

Alfred may link operators to:

- latest markdown report path
- latest snapshot directory

---

## REQUIRED VALIDATION

A routed run is considered valid only if:

- subprocess exits successfully
- `run.json` exists
- `run.json.status == success`
- `run_id` is new for that execution
- summary JSON exists and parses
- report path recorded in summary exists
- CSV log contains the current `run_id`
- history update completed

Do NOT treat unchanged findings as failure.

A clean repo with no new issues is a valid result.

---

## RESULT SHAPE RETURNED TO ALFRED

For valid runs, Alfred should surface:

- command executed
- resolved target
- run status
- score
- coverage
- risk level
- totals by severity
- top findings
- report path
- run_id
- timestamp

Recommended operator-facing success shape:

```json
{
  "status": "ok",
  "command": "audit",
  "target": "fortifyos",
  "run_id": "2026-03-27T21:00:00Z",
  "score": 74,
  "coverage": 0.68,
  "risk_level": "medium",
  "top_findings": ["CM-AUTH-001", "CM-SECRETS-002"],
  "report_path": "alfred/agents/cyber-mythos/outputs/reports/2026-03-27_fortifyos.md"
}
```

Recommended operator-facing failure shape:

```json
{
  "status": "error",
  "command": "audit",
  "target": "fortifyos",
  "reason": "summary JSON missing",
  "last_success": "2026-03-26T21:00:00Z"
}
```

---

## ESCALATION RULES

### Routing Error

Trigger:

- invalid command
- unsupported profile
- unresolved target
- ambiguous target

Action:

- do not run engine
- return immediate operator error

### Execution Error

Trigger:

- subprocess exits non-zero
- engine invocation fails
- timeout reached

Action:

- mark routed operation failed
- preserve stderr/stdout reference if available
- surface concise failure reason

### Validation Error

Trigger:

- missing `run.json`
- invalid summary JSON
- stale or reused `run_id`
- required outputs missing

Action:

- mark routed operation failed
- classify as degraded visibility
- refer to heartbeat escalation logic

### Critical Visibility Error

Trigger:

- panic scan fails
- no valid successful run within heartbeat threshold

Action:

- mark system status: `visibility_compromised`
- require manual audit

---

## SAFETY ENFORCEMENT

Alfred must never route Cyber Mythos into:

- exploit execution
- payload generation
- network scanning
- destructive actions
- automatic code modification of target repos

If a command attempts to exceed v1 scope:

- reject at router layer
- do not pass through to engine

---

## OPERATOR RESPONSE STYLE

For successful runs, Alfred should respond with:

- current risk level
- score
- top findings count or identifiers
- report location
- whether action is required

For failed runs, Alfred should respond with:

- failure type
- affected target
- last successful run timestamp if known
- whether manual audit is required

Keep operator output concise and actionable.

---

## SUCCESS STATE

Router is healthy when:

- commands map deterministically
- targets resolve correctly
- engine invocations are consistent
- outputs validate every run
- failures are surfaced clearly
- no out-of-scope action passes through

---

## END STATE

Alfred reliably functions as the control layer for Cyber Mythos:

- commands are stable
- execution is validated
- outputs are trustworthy
- failures are visible
- security intelligence remains current

END OF FILE
