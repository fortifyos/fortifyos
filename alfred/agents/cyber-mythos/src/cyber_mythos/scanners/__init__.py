from . import ai_risk_scan, auth_scan, config_scan, dependency_scan, repo_recon, route_scan, secrets_scan

SCANNER_ORDER = [
    ("repo_recon", repo_recon.scan),
    ("secrets_scan", secrets_scan.scan),
    ("auth_scan", auth_scan.scan),
    ("route_scan", route_scan.scan),
    ("config_scan", config_scan.scan),
    ("dependency_scan", dependency_scan.scan),
    ("ai_risk_scan", ai_risk_scan.scan),
]
