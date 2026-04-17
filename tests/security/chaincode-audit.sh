#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AgriTrade — Chaincode security audit runner
#
# Runs all AUDIT-tagged tests plus static analysis tools.
# Exit code 0 = clean, non-zero = findings requiring attention.
#
# Usage:
#   bash tests/security/chaincode-audit.sh            # full audit
#   bash tests/security/chaincode-audit.sh --fast     # skip govulncheck
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

FAST="${1:-}"
PASS=0
FAIL=0
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHAINCODE_DIR="$REPO_ROOT/chaincode"

green() { echo -e "\033[0;32m$*\033[0m"; }
red()   { echo -e "\033[0;31m$*\033[0m"; }
bold()  { echo -e "\033[1m$*\033[0m"; }

run_check() {
  local name="$1"; shift
  echo ""
  bold "─── $name"
  if "$@"; then
    green "✅ PASS  $name"
    PASS=$((PASS + 1))
  else
    red   "❌ FAIL  $name"
    FAIL=$((FAIL + 1))
  fi
}

# ── 1. Audit-tagged unit tests ────────────────────────────────────────────────
run_check "AUDIT tests (access-control, state-machine, double-spend, input-validation)" \
  bash -c "cd '$CHAINCODE_DIR' && go test ./tests/... -run 'AUDIT' -v -count=1 2>&1"

# ── 2. Full chaincode test suite ──────────────────────────────────────────────
run_check "Full chaincode test suite" \
  bash -c "cd '$CHAINCODE_DIR' && go test ./... -v -count=1 2>&1"

# ── 3. Go vet ─────────────────────────────────────────────────────────────────
run_check "go vet (static analysis)" \
  bash -c "cd '$CHAINCODE_DIR' && go vet ./... 2>&1"

# ── 4. staticcheck (if installed) ────────────────────────────────────────────
if command -v staticcheck &>/dev/null; then
  run_check "staticcheck" \
    bash -c "cd '$CHAINCODE_DIR' && staticcheck ./... 2>&1"
else
  echo "⚠️  staticcheck not installed — skipping (install: go install honnef.co/go/tools/cmd/staticcheck@latest)"
fi

# ── 5. govulncheck — known CVEs in dependencies ───────────────────────────────
if [[ "$FAST" != "--fast" ]]; then
  if command -v govulncheck &>/dev/null; then
    run_check "govulncheck (CVE scan)" \
      bash -c "cd '$CHAINCODE_DIR' && govulncheck ./... 2>&1"
  else
    echo "⚠️  govulncheck not installed — skipping (install: go install golang.org/x/vuln/cmd/govulncheck@latest)"
  fi
fi

# ── 6. Manual audit checklist ─────────────────────────────────────────────────
echo ""
bold "─── Manual Audit Checklist"
cat <<'CHECKLIST'
  □ All state-mutating functions check ctx.GetClientIdentity().GetMSPID()
  □ GetHistory() is only exposed to participants of that trade
  □ Escrow amount matches order.total_amount (no oracle manipulation)
  □ CreateEscrow sets HoldTxID from ctx.GetStub().GetTxID()
  □ ReleaseEscrow / RefundEscrow check escrow.Status == EscrowHeld
  □ No unbounded range queries (GetStateByRange with empty keys)
  □ All ledger keys are built with BuildKey() — no string interpolation
  □ No floating-point arithmetic on amounts (use integer cents)
  □ Event payloads do not include PII (no phone, address, payment ref)
  □ Dispute resolution requires a third-party MSP (not farmer or buyer)
CHECKLIST

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════"
bold "  Chaincode Audit Summary"
echo "  ✅ Passed:  $PASS"
echo "  ❌ Failed:  $FAIL"
echo "════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  red "🚨 Fix all failures before deploying chaincode to production."
  exit 1
fi

green "🎉 All automated chaincode audit checks passed."
