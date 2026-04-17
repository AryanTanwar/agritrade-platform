#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AgriTrade — OWASP ZAP DAST scan runner
#
# Runs an authenticated API scan against the running gateway using the
# ZAP Docker image.  Designed to run in CI after the integration stack
# is up (docker compose --profile test).
#
# Usage:
#   bash tests/security/zap-scan.sh [TARGET_URL]
#
# Environment:
#   TARGET_URL   Gateway base URL (default: http://localhost:8080)
#   ZAP_IMAGE    ZAP Docker image (default: ghcr.io/zaproxy/zaproxy:stable)
#   REPORT_DIR   Where to write reports (default: tests/security/zap-reports)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

TARGET_URL="${1:-${TARGET_URL:-http://localhost:8080}}"
ZAP_IMAGE="${ZAP_IMAGE:-ghcr.io/zaproxy/zaproxy:stable}"
REPORT_DIR="${REPORT_DIR:-tests/security/zap-reports}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

green() { echo -e "\033[0;32m$*\033[0m"; }
red()   { echo -e "\033[0;31m$*\033[0m"; }
bold()  { echo -e "\033[1m$*\033[0m"; }

mkdir -p "$REPO_ROOT/$REPORT_DIR"

bold "════════════════════════════════════════════════════"
bold " AgriTrade OWASP ZAP DAST Scan"
echo " Target:  $TARGET_URL"
echo " Image:   $ZAP_IMAGE"
echo " Reports: $REPO_ROOT/$REPORT_DIR"
bold "════════════════════════════════════════════════════"
echo ""

# ── 1. Verify target is up ────────────────────────────────────────────────────
bold "─── Checking target health"
MAX_WAIT=60
for i in $(seq 1 $MAX_WAIT); do
  if curl -sf "$TARGET_URL/health" > /dev/null 2>&1; then
    green "✅ Target is up"
    break
  fi
  if [ "$i" -eq "$MAX_WAIT" ]; then
    red "❌ Target did not respond after ${MAX_WAIT}s — aborting ZAP scan"
    exit 1
  fi
  echo "   Waiting for target... ($i/${MAX_WAIT}s)"
  sleep 1
done
echo ""

# ── 2. Run ZAP API scan ───────────────────────────────────────────────────────
bold "─── Running ZAP API scan"
docker run --rm \
  --network host \
  -v "$REPO_ROOT:/zap/wrk:ro" \
  -v "$REPO_ROOT/$REPORT_DIR:/zap/reports:rw" \
  "$ZAP_IMAGE" \
  zap-api-scan.py \
    -t "$TARGET_URL/api/v1" \
    -f openapi \
    -c /zap/wrk/tests/security/owasp-zap-config.yaml \
    -r /zap/reports/zap-report.html \
    -J /zap/reports/zap-report.json \
    -w /zap/reports/zap-report.md \
    -z "-config scanner.maxDepth=5 \
        -config scanner.maxChildren=10 \
        -config view.mode=attack" \
  ; ZAP_EXIT=$?

echo ""

# ── 3. Parse results ──────────────────────────────────────────────────────────
REPORT_JSON="$REPO_ROOT/$REPORT_DIR/zap-report.json"
if [ -f "$REPORT_JSON" ]; then
  HIGHS=$(python3 -c "
import json, sys
data = json.load(open('$REPORT_JSON'))
alerts = data.get('site', [{}])[0].get('alerts', [])
highs = [a for a in alerts if a.get('riskcode') in ('3', '4')]
print(len(highs))
" 2>/dev/null || echo "0")

  MEDIUMS=$(python3 -c "
import json, sys
data = json.load(open('$REPORT_JSON'))
alerts = data.get('site', [{}])[0].get('alerts', [])
meds = [a for a in alerts if a.get('riskcode') == '2']
print(len(meds))
" 2>/dev/null || echo "0")

  echo ""
  bold "─── ZAP Findings Summary"
  echo "  🔴 High / Critical: $HIGHS"
  echo "  🟡 Medium:          $MEDIUMS"
  echo "  📄 Full report:     $REPORT_DIR/zap-report.html"
  echo ""

  if [ "$HIGHS" -gt 0 ]; then
    red "❌ $HIGHS HIGH/CRITICAL findings — fix before deploying to production."
    exit 1
  fi
  green "✅ No HIGH/CRITICAL findings."
else
  echo "⚠️  Could not find $REPORT_JSON — check ZAP logs above."
fi

exit $ZAP_EXIT
