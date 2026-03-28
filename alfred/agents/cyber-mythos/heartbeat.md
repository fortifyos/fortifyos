# HEARTBEAT.md — CYBER MYTHOS
version: 1.1 (LOCKED)
agent: CYBER_MYTHOS
mode: autonomous-scheduled

## Purpose

Defines execution cadence, validation rules, and escalation logic for Cyber Mythos.

## Time Standard

America/New_York (ET)

## Profile Contract

- `default`: standard scheduled audit behavior
- `weekly`: deeper scan with baseline comparison and extended checks

## Ad Hoc Operations

- `/sync-security`
- `/baseline <target>`

These are not scheduled by default.
