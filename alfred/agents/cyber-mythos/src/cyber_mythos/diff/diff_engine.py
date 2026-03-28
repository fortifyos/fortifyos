from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import subprocess

from ..scanners.common import count_scannable_files

@dataclass(frozen=True)
class DiffScope:
    scan_mode: str
    files_scanned: int
    files_total: int
    changed_files: list[str]
    scoped_files: set[str]
    degraded_reason: str | None = None


def _run_git(repo_root: Path, args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(repo_root), *args],
        capture_output=True,
        text=True,
        check=False,
    )


def _resolve_base(repo_root: Path) -> str | None:
    current_branch = _run_git(repo_root, ["rev-parse", "--abbrev-ref", "HEAD"])
    if current_branch.returncode != 0:
        return None
    branch_name = current_branch.stdout.strip()
    for candidate in ("origin/main", "origin/master", "main", "master"):
        if candidate == branch_name:
            continue
        merge_base = _run_git(repo_root, ["merge-base", candidate, "HEAD"])
        if merge_base.returncode == 0 and merge_base.stdout.strip():
            return candidate
    return None


def _git_changed_files(repo_root: Path, base: str | None) -> tuple[list[str], str | None]:
    commands = []
    if base:
        commands.append((["diff", "--name-only", f"{base}...HEAD"], None))
    commands.append((["diff", "--name-only", "HEAD~1"], "fallback_head_prev"))

    for args, degraded_reason in commands:
        result = _run_git(repo_root, args)
        if result.returncode != 0:
            continue
        files = sorted({line.strip() for line in result.stdout.splitlines() if line.strip()})
        return files, degraded_reason
    return [], "no_git_diff_context"


def _derive_related_files(repo_root: Path, changed_files: list[str]) -> set[str]:
    related = set(changed_files)
    for changed in changed_files:
        path = repo_root / changed
        parent = path.parent
        if not parent.exists():
            continue
        for sibling in parent.iterdir():
            if sibling.is_file() and sibling.name.startswith("route."):
                related.add(sibling.relative_to(repo_root).as_posix())
        for manifest_name in ("package.json", "requirements.txt", "pyproject.toml", "pnpm-lock.yaml"):
            manifest = repo_root / manifest_name
            if manifest.exists():
                related.add(manifest.relative_to(repo_root).as_posix())
    return related


def build_diff_scope(target: Path, repo_root: Path) -> DiffScope:
    files_total = count_scannable_files(target)
    if target != repo_root:
        # Diff mode is only supported cleanly for repo-root scans in V2.
        return DiffScope(
            scan_mode="full",
            files_scanned=files_total,
            files_total=files_total,
            changed_files=[],
            scoped_files=set(),
            degraded_reason="diff_supported_at_repo_root_only",
        )

    base = _resolve_base(repo_root)
    changed_files, degraded_reason = _git_changed_files(repo_root, base)
    if not changed_files:
        return DiffScope(
            scan_mode="full",
            files_scanned=files_total,
            files_total=files_total,
            changed_files=[],
            scoped_files=set(),
            degraded_reason=degraded_reason,
        )

    scoped = _derive_related_files(repo_root, changed_files)
    scoped = {path for path in scoped if (repo_root / path).exists()}
    return DiffScope(
        scan_mode="diff",
        files_scanned=len(scoped),
        files_total=files_total,
        changed_files=changed_files,
        scoped_files=scoped,
        degraded_reason=degraded_reason,
    )
