#!/usr/bin/env bash
# =============================================================================
# AgriTrade — Tear down the Hyperledger Fabric network
# =============================================================================
# Stops and removes all Fabric containers, volumes, and chaincode images.
# Pass --deep to also remove crypto-config/ and channel-artifacts/.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_FILE="${FABRIC_DIR}/docker-compose-fabric.yml"
DEEP_CLEAN="${1:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[teardown]${NC} $*"; }
warn()  { echo -e "${YELLOW}[teardown]${NC} $*"; }
error() { echo -e "${RED}[teardown]${NC} $*" >&2; }

# ── Confirm intent ────────────────────────────────────────────────────────────
confirm() {
    if [ -t 0 ]; then
        read -r -p "$(echo -e "${YELLOW}[teardown]${NC} This will DESTROY all Fabric containers and volumes. Continue? [y/N] ")" confirm
        [[ "$confirm" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }
    else
        warn "Running non-interactively — proceeding with teardown."
    fi
}

# ── Stop and remove Docker Compose services ───────────────────────────────────
stop_containers() {
    info "Stopping and removing Fabric containers..."
    docker-compose -f "${COMPOSE_FILE}" down --volumes --remove-orphans 2>/dev/null || true
    info "Containers removed."
}

# ── Remove dangling chaincode docker images ───────────────────────────────────
remove_chaincode_images() {
    info "Removing chaincode Docker images..."
    # Fabric peer creates images named like dev-<peer>-<cc>-<version>
    local images
    images=$(docker images --filter "reference=dev-*" -q 2>/dev/null || true)
    if [ -n "$images" ]; then
        # shellcheck disable=SC2086
        docker rmi -f $images 2>/dev/null || true
        info "Chaincode images removed."
    else
        info "No chaincode images to remove."
    fi
}

# ── Remove named Docker volumes ───────────────────────────────────────────────
remove_volumes() {
    info "Removing named Docker volumes..."
    local volumes=(
        "orderer.agritrade.com"
        "peer0.farmers.agritrade.com"
        "peer1.farmers.agritrade.com"
        "peer0.buyers.agritrade.com"
        "peer1.buyers.agritrade.com"
        "peer0.logistics.agritrade.com"
        "peer1.logistics.agritrade.com"
        "couchdb0" "couchdb1" "couchdb2"
        "couchdb3" "couchdb4" "couchdb5"
    )
    for vol in "${volumes[@]}"; do
        docker volume rm "${vol}" 2>/dev/null && info "  Removed volume: ${vol}" || true
    done
}

# ── Deep clean: remove crypto material and channel artefacts ──────────────────
deep_clean() {
    warn "Deep clean: removing crypto-config/ and channel-artifacts/..."
    rm -rf "${FABRIC_DIR}/crypto-config"
    rm -rf "${FABRIC_DIR}/channel-artifacts"
    info "Crypto material and channel artefacts removed."
}

# ── Prune dangling networks ───────────────────────────────────────────────────
prune_networks() {
    info "Pruning unused Docker networks..."
    docker network rm agritrade-fabric 2>/dev/null && info "  Removed network: agritrade-fabric" || true
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
    info "============================================="
    info " AgriTrade Fabric Network — Teardown"
    info "============================================="

    confirm
    stop_containers
    remove_chaincode_images
    remove_volumes
    prune_networks

    if [[ "${DEEP_CLEAN}" == "--deep" ]]; then
        deep_clean
        info "Deep clean complete."
    else
        info "Crypto material and channel artefacts preserved."
        info "Run with --deep to also remove them."
    fi

    info "============================================="
    info " Teardown complete."
    info "============================================="
}

main "$@"
