from __future__ import annotations

from pathlib import Path
from typing import Iterator

TEXT_SUFFIXES = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".json", ".md", ".txt",
    ".yaml", ".yml", ".env", ".toml", ".ini", ".cfg", ".sh", ".dockerfile",
}

IGNORED_DIRS = {"node_modules", ".git", "dist", "build", "__pycache__", ".venv", "venv", "outputs", "fixtures"}


def iter_files(target: Path, include_paths: set[str] | None = None) -> Iterator[Path]:
    for path in target.rglob("*"):
        if not path.is_file():
            continue
        try:
            rel_parts = path.relative_to(target).parts
        except ValueError:
            rel_parts = path.parts
        if any(part in IGNORED_DIRS for part in rel_parts):
            continue
        rel_path = Path(*rel_parts).as_posix()
        if include_paths is not None and rel_path not in include_paths:
            continue
        if path.suffix.lower() in TEXT_SUFFIXES or path.name in {".env", "Dockerfile"}:
            yield path


def count_scannable_files(target: Path, include_paths: set[str] | None = None) -> int:
    return sum(1 for _ in iter_files(target, include_paths))


def read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return None


def find_line(text: str, pattern: str) -> int:
    for index, line in enumerate(text.splitlines(), start=1):
        if pattern in line:
            return index
    return 1
