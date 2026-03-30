# HEARTBEAT.md — CYBER MYTHOS
version: 1.1 (LOCKED)
agent: CYBER_MYTHOS
mode: autonomous-scheduled

## Purpose

Defines execution cadence, validation rules, and escalation logic for Cyber Mythos.

## Time Standard

America/New_York (ET)

## Profile Contract

- `default`: diff-aware daily audit behavior
- `weekly`: deeper scan with baseline comparison and extended checks

## Daily Defaults

Cyber Mythos V2 is the default daily operating path.

- Daily scheduled execution should prefer `audit --diff`
- Weekly scheduled execution should prefer `audit --profile weekly`
- PR review work should prefer `audit --profile pr`

Recommended daily engine command:

`python -m cyber_mythos.runner.main audit --diff --target <path>`

Recommended weekly engine command:

`python -m cyber_mythos.runner.main audit --profile weekly --target <path>`

## Ad Hoc Operations

- `/sync-security`
- `/baseline <target>`

These are not scheduled by default.
