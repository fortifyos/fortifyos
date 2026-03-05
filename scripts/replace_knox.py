#!/usr/bin/env python3
"""Replace KnoxTerminalMod function in App.jsx (lines 4527-4671) with new tiered version."""
import sys

APP_PATH = '/Users/fortifylabs/fortifyos-main-2/src/App.jsx'
NEW_FUNC_PATH = '/Users/fortifylabs/fortifyos-main-2/scripts/knox_new.jsx'

# Line numbers (1-based) to replace — inclusive
START_LINE = 4527
END_LINE = 4671

with open(APP_PATH, 'r', encoding='utf-8') as f:
    lines = f.readlines()

total = len(lines)
print(f"Total lines: {total}")

# Sanity check: confirm the function starts where expected
start_content = lines[START_LINE - 1].strip()
end_content = lines[END_LINE - 1].strip()
print(f"Line {START_LINE}: {start_content[:80]}")
print(f"Line {END_LINE}: {end_content[:80]}")

if 'KnoxTerminalMod' not in start_content:
    print("ERROR: Expected KnoxTerminalMod on start line — aborting", file=sys.stderr)
    sys.exit(1)

with open(NEW_FUNC_PATH, 'r', encoding='utf-8') as f:
    new_content = f.read()

# Build replacement: lines before + new function + newline + lines after
before = lines[:START_LINE - 1]
after = lines[END_LINE:]  # everything after end line

new_lines = before + [new_content + '\n'] + after

with open(APP_PATH, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Done. Replaced lines {START_LINE}-{END_LINE} ({END_LINE - START_LINE + 1} lines) with new function ({len(new_content.splitlines())} lines).")
print(f"New total lines: {len(new_lines)}")
