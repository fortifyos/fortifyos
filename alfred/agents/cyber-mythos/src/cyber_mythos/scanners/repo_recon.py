from __future__ import annotations

from pathlib import Path

from .common import iter_files


def scan(target: Path, *, include_paths: set[str] | None = None, **_: object) -> tuple[list, dict]:
    manifests = []
    framework = "unknown"
    api_routes = 0
    env_files = 0
    docker_files = 0
    ci_files = 0

    for file_path in iter_files(target, include_paths):
        rel = file_path.relative_to(target).as_posix()
        name = file_path.name
        if name in {"package.json", "pyproject.toml", "requirements.txt", "pnpm-lock.yaml"}:
            manifests.append(rel)
        if rel.startswith(".github/workflows/"):
            ci_files += 1
        if "api" in rel.lower():
            api_routes += 1
        if name in {".env", ".env.local", ".env.example"}:
            env_files += 1
        if name == "Dockerfile" or rel.endswith(".dockerfile"):
            docker_files += 1

    if (target / "package.json").exists():
        framework = "vite-react"
    if (target / "pyproject.toml").exists() or (target / "requirements.txt").exists():
        framework = "python"

    recon = {
        "framework": framework,
        "manifests": sorted(manifests),
        "api_routes_detected": api_routes,
        "env_files_detected": env_files,
        "docker_files_detected": docker_files,
        "ci_files_detected": ci_files,
    }
    return [], recon
