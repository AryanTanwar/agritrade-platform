#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AgriTrade — Full security audit runner
# Run before every release: bash tests/security/dependency-audit.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PASS=0
FAIL=0

run_check() {
  local name=$1
  shift
  echo ""
  echo "─── $name ───────────────────────────────────────────────"
  if "$@"; then
    echo "✅ $name passed"
    PASS=$((PASS+1))
  else
    echo "❌ $name FAILED"
    FAIL=$((FAIL+1))
  fi
}

# ── npm audit ────────────────────────────────────────────────────────────────
run_check "npm audit (high+critical)" \
  npm audit --audit-level=high --omit=dev

# ── audit-ci ─────────────────────────────────────────────────────────────────
run_check "audit-ci thresholds" \
  npx audit-ci --config audit-ci.json

# ── Snyk (requires SNYK_TOKEN) ────────────────────────────────────────────────
if [ -n "${SNYK_TOKEN:-}" ]; then
  run_check "Snyk dependency scan" \
    npx snyk test --severity-threshold=high
else
  echo "⚠️  SNYK_TOKEN not set — skipping Snyk scan"
fi

# ── Go vulnerabilities ────────────────────────────────────────────────────────
if command -v govulncheck &>/dev/null; then
  run_check "Go govulncheck" \
    govulncheck ./chaincode/...
else
  echo "⚠️  govulncheck not installed — skipping Go vuln check"
fi

# ── Secret scanning (Gitleaks) ────────────────────────────────────────────────
if command -v gitleaks &>/dev/null; then
  run_check "Gitleaks secret scan" \
    gitleaks detect --source . --no-git --verbose
else
  echo "⚠️  gitleaks not installed — skipping secret scan"
fi

# ── Trivy filesystem scan ─────────────────────────────────────────────────────
if command -v trivy &>/dev/null; then
  run_check "Trivy filesystem scan" \
    trivy fs . --config trivy.config.yml --exit-code 1
else
  echo "⚠️  trivy not installed — skipping container scan"
fi

# ── Licence check ─────────────────────────────────────────────────────────────
run_check "Licence compliance (no GPL)" \
  npx license-checker --production --excludePrivatePackages \
    --failOn "GPL;AGPL;LGPL" --summary

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "  Security Audit Summary"
echo "  ✅ Passed:  $PASS"
echo "  ❌ Failed:  $FAIL"
echo "════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo "🚨 Fix all failures before deploying to production."
  exit 1
fi

echo "🎉 All security checks passed."
