"""Compatibility shim for `python -m cyber_mythos...` from repo root.

The actual package lives under `alfred/agents/cyber-mythos/src/cyber_mythos`.
"""

from pathlib import Path

_PKG_ROOT = (
    Path(__file__).resolve().parent.parent
    / "alfred"
    / "agents"
    / "cyber-mythos"
    / "src"
    / "cyber_mythos"
)

__path__ = [str(_PKG_ROOT)]
