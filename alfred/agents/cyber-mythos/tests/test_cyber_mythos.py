from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

REPO_ROOT = Path(__file__).resolve().parents[4]
MODULE_ROOT = REPO_ROOT / "alfred" / "agents" / "cyber-mythos"
FIXTURES = MODULE_ROOT / "tests" / "fixtures"
REGISTRY_PATH = REPO_ROOT / "knox" / "security" / "repo-registry.json"

sys.path.insert(0, str(REPO_ROOT))

from cyber_mythos.diff.diff_engine import build_diff_scope  # noqa: E402
from cyber_mythos.parsers.normalize import build_finding_id, deduplicate_findings, make_finding, validate_summary_dict  # noqa: E402
from cyber_mythos.reporting.history_writer import compare_against_baseline  # noqa: E402
from cyber_mythos.rules.rule_loader import load_rules, make_rule_finding  # noqa: E402
from cyber_mythos.runner.main import main as cli_main  # noqa: E402
from cyber_mythos.scoring.score_engine import compute_score  # noqa: E402


class CyberMythosTests(unittest.TestCase):
    def setUp(self) -> None:
        self._registry_backup = REGISTRY_PATH.read_text(encoding="utf-8") if REGISTRY_PATH.exists() else None

    def tearDown(self) -> None:
        if self._registry_backup is not None:
            REGISTRY_PATH.write_text(self._registry_backup, encoding="utf-8")

    def test_deterministic_finding_id(self) -> None:
        one = build_finding_id("authorization", "missing_auth_guard", "src/app/api/admin/route.ts")
        two = build_finding_id("authorization", "missing_auth_guard", "src/app/api/admin/route.ts")
        self.assertEqual(one, two)

    def test_duplicate_collapse(self) -> None:
        finding = make_finding(
            category="authorization",
            rule_name="missing_auth_guard",
            title="Missing guard",
            severity="high",
            confidence="medium",
            framework="vite-react",
            file_path="src/app/api/admin/route.ts",
            line_start=1,
            line_end=1,
            evidence="Missing auth markers.",
            impact="Unauthorized access.",
            safe_attack_path="Route reachable without auth.",
            remediation="Add middleware.",
            references=["ASVS-4.1"],
        )
        deduped = deduplicate_findings([finding, finding])
        self.assertEqual(len(deduped), 1)

    def test_score_calculation(self) -> None:
        finding = make_finding(
            category="secrets",
            rule_name="hardcoded_secret",
            title="Secret",
            severity="critical",
            confidence="high",
            framework="python",
            file_path=".env",
            line_start=1,
            line_end=1,
            evidence="Secret pattern.",
            impact="Exposure.",
            safe_attack_path="Stolen secret.",
            remediation="Rotate.",
            references=["ASVS-8.1"],
        )
        score = compute_score([finding], scanner_count=6, triggered_scanners=3)
        self.assertEqual(score["score"], 75)
        self.assertEqual(score["coverage"], 0.5)

    def test_baseline_compare(self) -> None:
        finding = make_finding(
            category="routes",
            rule_name="exposed_admin_route",
            title="Admin route",
            severity="high",
            confidence="medium",
            framework="vite-react",
            file_path="src/app/api/admin/route.ts",
            line_start=1,
            line_end=1,
            evidence="Admin route.",
            impact="Exposure.",
            safe_attack_path="Probe route.",
            remediation="Restrict access.",
            references=["ASVS-1.2"],
        )
        comparison = compare_against_baseline([finding], {"finding_ids": []})
        self.assertIn(finding.finding_id, comparison["new"])

    def test_summary_validation(self) -> None:
        summary = {
            "run_id": "2026-01-01T00:00:00.000Z-abcd12",
            "target": "fortifyos",
            "score": 90,
            "coverage": 0.5,
            "risk_level": "hardened",
            "totals": {"critical": 0, "high": 0, "medium": 0, "low": 0},
            "top_findings": [],
            "status": "ok",
            "report_path": "alfred/agents/cyber-mythos/outputs/reports/x.md",
        }
        validate_summary_dict(summary)

    def test_rule_enable_disable(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            temp_rules = Path(tmpdir) / "rules.json"
            temp_rules.write_text(
                json.dumps(
                    {
                        "auth_scan.missing_auth_guard": {
                            "rule_id": "CM-AUTH-001",
                            "category": "authorization",
                            "severity": "high",
                            "confidence": "medium",
                            "enabled": False,
                            "description": "Disabled rule",
                            "remediation": "Disabled",
                        }
                    }
                ),
                encoding="utf-8",
            )
            rules = load_rules(temp_rules)
            finding = make_rule_finding(
                rules=rules,
                rule_key="auth_scan.missing_auth_guard",
                title="Ignored",
                framework="vite-react",
                file_path="src/app/api/admin/route.ts",
                line_start=1,
                line_end=1,
                evidence="Disabled rule.",
                impact="N/A",
                safe_attack_path="N/A",
                references=[],
            )
            self.assertIsNone(finding)

    def test_diff_engine_detects_changed_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = Path(tmpdir)
            (repo / "package.json").write_text('{"name":"tmp"}\n', encoding="utf-8")
            (repo / "src").mkdir()
            tracked = repo / "src" / "app.ts"
            tracked.write_text("export const value = 1;\n", encoding="utf-8")
            subprocess.run(["git", "init"], cwd=repo, check=True, capture_output=True, text=True)
            subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=repo, check=True, capture_output=True, text=True)
            subprocess.run(["git", "config", "user.name", "Cyber Mythos Test"], cwd=repo, check=True, capture_output=True, text=True)
            subprocess.run(["git", "add", "."], cwd=repo, check=True, capture_output=True, text=True)
            subprocess.run(["git", "commit", "-m", "init"], cwd=repo, check=True, capture_output=True, text=True)
            (repo / "README.md").write_text("# temp\n", encoding="utf-8")
            subprocess.run(["git", "add", "README.md"], cwd=repo, check=True, capture_output=True, text=True)
            subprocess.run(["git", "commit", "-m", "second"], cwd=repo, check=True, capture_output=True, text=True)
            tracked.write_text("export const value = 2;\n", encoding="utf-8")
            scope = build_diff_scope(repo, repo)
            self.assertEqual(scope.scan_mode, "diff")
            self.assertIn("src/app.ts", scope.changed_files)
            self.assertLessEqual(scope.files_scanned, scope.files_total)

    def test_cli_audit_outputs(self) -> None:
        target = FIXTURES / "weak_repo"
        result = subprocess.run(
            [sys.executable, "-m", "cyber_mythos.runner.main", "audit", "--target", str(target)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["status"], "ok")
        latest_summary = REPO_ROOT / "knox" / "security" / "latest-security-summary.json"
        self.assertTrue(latest_summary.exists())
        summary = json.loads(latest_summary.read_text(encoding="utf-8"))
        self.assertEqual(summary["target"], "weak_repo")
        report_path = REPO_ROOT / summary["report_path"]
        self.assertTrue(report_path.exists())

    def test_cli_pr_profile_outputs_additive_fields(self) -> None:
        target = FIXTURES / "weak_repo"
        subprocess.run(
            [sys.executable, "-m", "cyber_mythos.runner.main", "baseline", "--target", str(target)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        result = subprocess.run(
            [sys.executable, "-m", "cyber_mythos.runner.main", "audit", "--profile", "pr", "--target", str(target)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)
        payload = json.loads(result.stdout)
        self.assertIn("new_findings", payload)
        self.assertIn("resolved_findings", payload)
        self.assertIn("risk_delta", payload)

    def test_cli_audit_all_degraded_on_partial_failure(self) -> None:
        REGISTRY_PATH.write_text(
            json.dumps(
                {
                    "repos": [
                        {"name": "fortifyos", "path": ".", "last_scan": "", "score": 100},
                        {"name": "missing", "path": "./does-not-exist", "last_scan": "", "score": 0},
                    ]
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        result = subprocess.run(
            [sys.executable, "-m", "cyber_mythos.runner.main", "audit", "--all"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["status"], "degraded")
        self.assertEqual(len(payload["failures"]), 1)

    def test_cli_sync_security(self) -> None:
        exit_code = cli_main(["sync-security"])
        self.assertEqual(exit_code, 0)


if __name__ == "__main__":
    unittest.main()
