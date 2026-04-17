#!/usr/bin/env bash
# =============================================================================
# AgriTrade — Bring up the Hyperledger Fabric network
# =============================================================================
# 1. Start all Docker containers (orderer, peers, CouchDB, CAs, CLI)
# 2. Create the application channel
# 3. Join all peers to the channel
# 4. Update anchor peers for each org
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CHANNEL_NAME="${FABRIC_CHANNEL_NAME:-agritrade-channel}"
DELAY="${FABRIC_DELAY:-3}"          # seconds between retries
MAX_RETRY="${FABRIC_MAX_RETRY:-5}"  # max retries for peer operations
COMPOSE_FILE="${FABRIC_DIR}/docker-compose-fabric.yml"

# Colour helpers
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${GREEN}[network-up]${NC} $*"; }
warn()    { echo -e "${YELLOW}[network-up]${NC} $*"; }
error()   { echo -e "${RED}[network-up]${NC} $*" >&2; }
section() { echo -e "${BLUE}[network-up]${NC} ── $* ──"; }

# ── Pre-flight ────────────────────────────────────────────────────────────────
check_prereqs() {
    for bin in docker docker-compose; do
        command -v "$bin" &>/dev/null || { error "$bin not found."; exit 1; }
    done

    if [ ! -f "${FABRIC_DIR}/channel-artifacts/genesis.block" ]; then
        error "genesis.block not found. Run generate.sh first."
        exit 1
    fi
}

# ── Start containers ──────────────────────────────────────────────────────────
start_containers() {
    section "Starting Docker containers"
    docker-compose -f "${COMPOSE_FILE}" up -d --remove-orphans
    info "Waiting ${DELAY}s for containers to initialise..."
    sleep "${DELAY}"
}

# ── CLI helper: run a command inside the CLI container ────────────────────────
cli_exec() {
    docker exec cli "$@"
}

# ── Set CLI environment for a specific org/peer ───────────────────────────────
# Usage: set_globals <OrgName> <peer_num>
# e.g.   set_globals Farmers 0
set_globals_in_cli() {
    local org="${1}"       # Farmers | Buyers | Logistics
    local peer_num="${2}"  # 0 | 1

    local org_lower
    org_lower="$(echo "${org}" | tr '[:upper:]' '[:lower:]')"

    local base_port
    case "${org}" in
        Farmers)  base_port=7051 ;;
        Buyers)   base_port=9051 ;;
        Logistics) base_port=11051 ;;
        *) error "Unknown org: ${org}"; exit 1 ;;
    esac

    local peer_port=$(( base_port + peer_num * 1000 ))

    CORE_PEER_LOCALMSPID="${org}MSP"
    CORE_PEER_ADDRESS="peer${peer_num}.${org_lower}.agritrade.com:${peer_port}"
    CORE_PEER_TLS_ROOTCERT_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${org_lower}.agritrade.com/peers/peer${peer_num}.${org_lower}.agritrade.com/tls/ca.crt"
    CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${org_lower}.agritrade.com/users/Admin@${org_lower}.agritrade.com/msp"

    export CORE_PEER_LOCALMSPID CORE_PEER_ADDRESS CORE_PEER_TLS_ROOTCERT_FILE CORE_PEER_MSPCONFIGPATH
}

# ── Create channel ─────────────────────────────────────────────────────────────
create_channel() {
    section "Creating channel '${CHANNEL_NAME}'"

    local orderer_ca="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/agritrade.com/orderers/orderer.agritrade.com/msp/tlscacerts/tlsca.agritrade.com-cert.pem"

    local attempt=0
    while [ $attempt -lt "$MAX_RETRY" ]; do
        if docker exec \
            -e CORE_PEER_LOCALMSPID=FarmersMSP \
            -e CORE_PEER_ADDRESS=peer0.farmers.agritrade.com:7051 \
            -e CORE_PEER_TLS_ROOTCERT_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/farmers.agritrade.com/peers/peer0.farmers.agritrade.com/tls/ca.crt" \
            -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/farmers.agritrade.com/users/Admin@farmers.agritrade.com/msp" \
            cli peer channel create \
                -o orderer.agritrade.com:7050 \
                -c "${CHANNEL_NAME}" \
                -f "/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx" \
                --outputBlock "/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block" \
                --tls \
                --cafile "${orderer_ca}"; then
            info "Channel '${CHANNEL_NAME}' created successfully."
            return 0
        fi
        warn "Channel creation attempt $((attempt+1)) failed. Retrying in ${DELAY}s..."
        sleep "${DELAY}"
        attempt=$((attempt+1))
    done
    error "Failed to create channel after ${MAX_RETRY} attempts."
    exit 1
}

# ── Join a peer to the channel ────────────────────────────────────────────────
join_channel() {
    local org="${1}"
    local peer_num="${2}"
    local org_lower
    org_lower="$(echo "${org}" | tr '[:upper:]' '[:lower:]')"

    local base_port
    case "${org}" in
        Farmers)   base_port=7051 ;;
        Buyers)    base_port=9051 ;;
        Logistics) base_port=11051 ;;
    esac
    local peer_port=$(( base_port + peer_num * 1000 ))

    info "Joining peer${peer_num}.${org_lower} to channel..."
    local attempt=0
    while [ $attempt -lt "$MAX_RETRY" ]; do
        if docker exec \
            -e CORE_PEER_LOCALMSPID="${org}MSP" \
            -e CORE_PEER_ADDRESS="peer${peer_num}.${org_lower}.agritrade.com:${peer_port}" \
            -e CORE_PEER_TLS_ROOTCERT_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${org_lower}.agritrade.com/peers/peer${peer_num}.${org_lower}.agritrade.com/tls/ca.crt" \
            -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${org_lower}.agritrade.com/users/Admin@${org_lower}.agritrade.com/msp" \
            cli peer channel join \
                -b "/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block"; then
            info "  ✓ peer${peer_num}.${org_lower} joined."
            return 0
        fi
        warn "  Join attempt $((attempt+1)) failed. Retrying in ${DELAY}s..."
        sleep "${DELAY}"
        attempt=$((attempt+1))
    done
    error "Failed to join peer${peer_num}.${org_lower} after ${MAX_RETRY} attempts."
    exit 1
}

# ── Update anchor peer for an org ─────────────────────────────────────────────
update_anchor_peer() {
    local org="${1}"
    local org_lower
    org_lower="$(echo "${org}" | tr '[:upper:]' '[:lower:]')"

    local orderer_ca="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/agritrade.com/orderers/orderer.agritrade.com/msp/tlscacerts/tlsca.agritrade.com-cert.pem"

    local base_port
    case "${org}" in
        Farmers)   base_port=7051 ;;
        Buyers)    base_port=9051 ;;
        Logistics) base_port=11051 ;;
    esac

    info "Updating anchor peer for ${org}Org..."
    docker exec \
        -e CORE_PEER_LOCALMSPID="${org}MSP" \
        -e CORE_PEER_ADDRESS="peer0.${org_lower}.agritrade.com:${base_port}" \
        -e CORE_PEER_TLS_ROOTCERT_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${org_lower}.agritrade.com/peers/peer0.${org_lower}.agritrade.com/tls/ca.crt" \
        -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${org_lower}.agritrade.com/users/Admin@${org_lower}.agritrade.com/msp" \
        cli peer channel update \
            -o orderer.agritrade.com:7050 \
            -c "${CHANNEL_NAME}" \
            -f "/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${org}MSPanchors.tx" \
            --tls \
            --cafile "${orderer_ca}"

    info "  ✓ Anchor peer updated for ${org}Org."
}

# ── Verify channel membership ─────────────────────────────────────────────────
verify_channel() {
    section "Verifying channel membership"
    docker exec \
        -e CORE_PEER_LOCALMSPID=FarmersMSP \
        -e CORE_PEER_ADDRESS=peer0.farmers.agritrade.com:7051 \
        -e CORE_PEER_TLS_ROOTCERT_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/farmers.agritrade.com/peers/peer0.farmers.agritrade.com/tls/ca.crt" \
        -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/farmers.agritrade.com/users/Admin@farmers.agritrade.com/msp" \
        cli peer channel list
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
    info "============================================="
    info " AgriTrade Fabric Network — Starting Up"
    info "============================================="

    check_prereqs
    start_containers

    section "Waiting for peers to be ready..."
    sleep 5

    create_channel

    section "Joining all peers to channel '${CHANNEL_NAME}'"
    join_channel Farmers   0
    join_channel Farmers   1
    join_channel Buyers    0
    join_channel Buyers    1
    join_channel Logistics 0
    join_channel Logistics 1

    section "Updating anchor peers"
    update_anchor_peer Farmers
    update_anchor_peer Buyers
    update_anchor_peer Logistics

    verify_channel

    info "============================================="
    info " Network is UP."
    info " Channel : ${CHANNEL_NAME}"
    info " Next    : ./scripts/deploy-chaincode.sh"
    info "============================================="
}

main "$@"
