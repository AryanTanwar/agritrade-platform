#!/usr/bin/env bash
# =============================================================================
# AgriTrade — Generate crypto material and channel artefacts
# =============================================================================
# Prerequisites: cryptogen, configtxgen (Fabric v2.5 binaries on PATH)
# Usage: ./scripts/generate.sh [--clean]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CHANNEL_NAME="${FABRIC_CHANNEL_NAME:-agritrade-channel}"
FABRIC_CFG_PATH="${FABRIC_DIR}"

# Colour helpers
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[generate]${NC} $*"; }
warn()  { echo -e "${YELLOW}[generate]${NC} $*"; }
error() { echo -e "${RED}[generate]${NC} $*" >&2; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────
check_prereqs() {
    local missing=0
    for bin in cryptogen configtxgen; do
        if ! command -v "$bin" &>/dev/null; then
            error "Required binary '$bin' not found. Install Hyperledger Fabric v2.5 binaries."
            missing=1
        fi
    done
    [ "$missing" -ne 0 ] && exit 1

    info "Using cryptogen:   $(cryptogen version 2>&1 | head -1)"
    info "Using configtxgen: $(configtxgen --version 2>&1 | head -1)"
}

# ── Optional clean ────────────────────────────────────────────────────────────
clean() {
    warn "Cleaning previous crypto material and channel artefacts..."
    rm -rf "${FABRIC_DIR}/crypto-config"
    rm -rf "${FABRIC_DIR}/channel-artifacts"
    info "Clean complete."
}

# ── Generate crypto material with cryptogen ────────────────────────────────────
generate_crypto() {
    info "Generating crypto material (MSP certs, TLS certs) for all orgs..."
    mkdir -p "${FABRIC_DIR}/crypto-config"

    cryptogen generate \
        --config="${FABRIC_DIR}/crypto-config.yaml" \
        --output="${FABRIC_DIR}/crypto-config"

    info "Crypto material generated at: ${FABRIC_DIR}/crypto-config"
}

# ── Create channel artefacts with configtxgen ─────────────────────────────────
generate_channel_artefacts() {
    info "Generating channel artefacts..."
    mkdir -p "${FABRIC_DIR}/channel-artifacts"

    export FABRIC_CFG_PATH="${FABRIC_DIR}"

    # 1. Genesis block for the system channel
    info "  → Genesis block (AgriTradeOrdererGenesis)..."
    configtxgen \
        -profile AgriTradeOrdererGenesis \
        -channelID system-channel \
        -outputBlock "${FABRIC_DIR}/channel-artifacts/genesis.block"

    # 2. Channel creation transaction
    info "  → Channel tx (AgriTradeChannel)..."
    configtxgen \
        -profile AgriTradeChannel \
        -outputCreateChannelTx "${FABRIC_DIR}/channel-artifacts/channel.tx" \
        -channelID "${CHANNEL_NAME}"

    # 3. Anchor peer updates — one per org
    for org in Farmers Buyers Logistics; do
        info "  → Anchor peer update for ${org}Org..."
        configtxgen \
            -profile AgriTradeChannel \
            -outputAnchorPeersUpdate "${FABRIC_DIR}/channel-artifacts/${org}MSPanchors.tx" \
            -channelID "${CHANNEL_NAME}" \
            -asOrg "${org}Org"
    done

    info "Channel artefacts generated at: ${FABRIC_DIR}/channel-artifacts/"
    ls -la "${FABRIC_DIR}/channel-artifacts/"
}

# ── Verify outputs ─────────────────────────────────────────────────────────────
verify_outputs() {
    info "Verifying outputs..."
    local ok=1

    for f in \
        "${FABRIC_DIR}/channel-artifacts/genesis.block" \
        "${FABRIC_DIR}/channel-artifacts/channel.tx" \
        "${FABRIC_DIR}/channel-artifacts/FarmersMSPanchors.tx" \
        "${FABRIC_DIR}/channel-artifacts/BuyersMSPanchors.tx" \
        "${FABRIC_DIR}/channel-artifacts/LogisticsMSPanchors.tx"; do
        if [ -f "$f" ]; then
            info "  ✓ $(basename "$f")"
        else
            error "  ✗ Missing: $(basename "$f")"
            ok=0
        fi
    done

    for org_domain in \
        "ordererOrganizations/agritrade.com" \
        "peerOrganizations/farmers.agritrade.com" \
        "peerOrganizations/buyers.agritrade.com" \
        "peerOrganizations/logistics.agritrade.com"; do
        if [ -d "${FABRIC_DIR}/crypto-config/${org_domain}/msp" ]; then
            info "  ✓ ${org_domain}/msp"
        else
            error "  ✗ Missing: ${org_domain}/msp"
            ok=0
        fi
    done

    [ "$ok" -eq 1 ] || { error "Verification failed."; exit 1; }
    info "All artefacts verified successfully."
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
    if [[ "${1:-}" == "--clean" ]]; then
        clean
    fi

    check_prereqs
    generate_crypto
    generate_channel_artefacts
    verify_outputs

    info "================================================"
    info " generate.sh complete. Run network-up.sh next."
    info "================================================"
}

main "$@"
