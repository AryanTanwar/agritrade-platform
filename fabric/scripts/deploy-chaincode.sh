#!/usr/bin/env bash
# =============================================================================
# AgriTrade — Deploy chaincode using Fabric v2.5 lifecycle
# =============================================================================
# Lifecycle steps:
#   1. Build Go binaries
#   2. Package chaincode (peer lifecycle chaincode package)
#   3. Install on anchor peers of all orgs
#   4. Query installed — capture package ID
#   5. Approve for each org (approveformyorg)
#   6. Check commit readiness
#   7. Commit on channel (commit)
#   8. Query committed — verify
#   9. Invoke Init if required
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${FABRIC_DIR}/.." && pwd)"
CHAINCODE_DIR="${REPO_ROOT}/chaincode"

CHANNEL_NAME="${FABRIC_CHANNEL_NAME:-agritrade-channel}"
CC_VERSION="${CC_VERSION:-1.0}"
CC_SEQUENCE="${CC_SEQUENCE:-1}"
ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/agritrade.com/orderers/orderer.agritrade.com/msp/tlscacerts/tlsca.agritrade.com-cert.pem"

# Chaincode definitions: name → cmd path (relative to module root)
declare -A CC_COMMANDS=(
    ["trade"]="./cmd/trade"
    ["escrow"]="./cmd/escrow"
    ["supplychain"]="./cmd/supplychain"
    ["logistics"]="./cmd/logistics"
)

# Endorsement policies per chaincode
declare -A CC_POLICIES=(
    ["trade"]="OutOf(2, 'FarmersMSP.peer', 'BuyersMSP.peer', 'LogisticsMSP.peer')"
    ["escrow"]="AND('FarmersMSP.peer', 'BuyersMSP.peer')"
    ["supplychain"]="OutOf(2, 'FarmersMSP.peer', 'BuyersMSP.peer', 'LogisticsMSP.peer')"
    ["logistics"]="AND('LogisticsMSP.peer', OutOf(1, 'FarmersMSP.peer', 'BuyersMSP.peer'))"
)

# Colour helpers
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()    { echo -e "${YELLOW}[deploy]${NC} $*"; }
error()   { echo -e "${RED}[deploy]${NC} $*" >&2; }
section() { echo -e "${BLUE}[deploy]${NC} ── $* ──"; }

# ── Build Go chaincode binaries ───────────────────────────────────────────────
build_chaincode() {
    local cc_name="${1}"
    local cmd_path="${CC_COMMANDS[$cc_name]}"
    section "Building ${cc_name} chaincode"

    pushd "${CHAINCODE_DIR}" > /dev/null
    GOOS=linux GOARCH=amd64 go build \
        -v \
        -o "/tmp/chaincode/${cc_name}/${cc_name}" \
        "${cmd_path}"
    popd > /dev/null
    info "Built binary: /tmp/chaincode/${cc_name}/${cc_name}"
}

# ── Package chaincode ─────────────────────────────────────────────────────────
package_chaincode() {
    local cc_name="${1}"
    local pkg_path="/tmp/${cc_name}.tar.gz"
    section "Packaging ${cc_name} chaincode"

    # Create connection.json for external chaincode (binary + metadata)
    local cc_dir="/tmp/chaincode/${cc_name}"
    mkdir -p "${cc_dir}"

    cat > "${cc_dir}/connection.json" <<EOF
{
    "address": "${cc_name}-chaincode:7052",
    "dial_timeout": "10s",
    "tls_required": false
}
EOF

    cat > "${cc_dir}/metadata.json" <<EOF
{
    "type": "ccaas",
    "label": "${cc_name}_${CC_VERSION}"
}
EOF

    # For standard (non-external) deployment, package the binary directly
    docker exec cli peer lifecycle chaincode package \
        "/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${cc_name}.tar.gz" \
        --path "/opt/gopath/src/github.com/agritrade/chaincode/cmd/${cc_name}" \
        --lang golang \
        --label "${cc_name}_${CC_VERSION}"

    info "Packaged: ${cc_name}_${CC_VERSION}"
}

# ── Install chaincode on a peer ───────────────────────────────────────────────
install_chaincode() {
    local cc_name="${1}"
    local org="${2}"
    local peer_num="${3}"
    local org_lower
    org_lower="$(echo "${org}" | tr '[:upper:]' '[:lower:]')"

    local base_port
    case "${org}" in
        Farmers)   base_port=7051 ;;
        Buyers)    base_port=9051 ;;
        Logistics) base_port=11051 ;;
    esac
    local peer_port=$(( base_port + peer_num * 1000 ))

    info "Installing ${cc_name} on peer${peer_num}.${org_lower}..."

    docker exec \
        -e CORE_PEER_LOCALMSPID="${org}MSP" \
        -e CORE_PEER_ADDRESS="peer${peer_num}.${org_lower}.agritrade.com:${peer_port}" \
        -e CORE_PEER_TLS_ROOTCERT_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${org_lower}.agritrade.com/peers/peer${peer_num}.${org_lower}.agritrade.com/tls/ca.crt" \
        -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${org_lower}.agritrade.com/users/Admin@${org_lower}.agritrade.com/msp" \
        cli peer lifecycle chaincode install \
            "/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${cc_name}.tar.gz"

    info "  ✓ Installed on peer${peer_num}.${org_lower}"
}

# ── Get package ID ────────────────────────────────────────────────────────────
get_package_id() {
    local cc_name="${1}"
    local org="${2}"
    local org_lower
    org_lower="$(echo "${org}" | tr '[:upper:]' '[:lower:]')"

    local result
    result=$(docker exec \
        -e CORE_PEER_LOCALMSPID="${org}MSP" \
        -e CORE_PEER_ADDRESS="peer0.${org_lower}.agritrade.com:$([ "${org}" = "Farmers" ] && echo 7051 || [ "${org}" = "Buyers" ] && echo 9051 || echo 11051)" \
        -e CORE_PEER_TLS_ROOTCERT_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${org_lower}.agritrade.com/peers/peer0.${org_lower}.agritrade.com/tls/ca.crt" \
        -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${org_lower}.agritrade.com/users/Admin@${org_lower}.agritrade.com/msp" \
        cli peer lifecycle chaincode queryinstalled 2>&1)

    echo "${result}" | grep "${cc_name}_${CC_VERSION}" | awk -F'[, ]+' '{print $3}'
}

# ── Approve chaincode for an org ──────────────────────────────────────────────
approve_chaincode() {
    local cc_name="${1}"
    local org="${2}"
    local package_id="${3}"
    local org_lower
    org_lower="$(echo "${org}" | tr '[:upper:]' '[:lower:]')"
    local policy="${CC_POLICIES[$cc_name]}"

    local base_port
    case "${org}" in
        Farmers)   base_port=7051 ;;
        Buyers)    base_port=9051 ;;
        Logistics) base_port=11051 ;;
    esac

    info "Approving ${cc_name} for ${org}Org (package_id=${package_id})..."

    docker exec \
        -e CORE_PEER_LOCALMSPID="${org}MSP" \
        -e CORE_PEER_ADDRESS="peer0.${org_lower}.agritrade.com:${base_port}" \
        -e CORE_PEER_TLS_ROOTCERT_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${org_lower}.agritrade.com/peers/peer0.${org_lower}.agritrade.com/tls/ca.crt" \
        -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${org_lower}.agritrade.com/users/Admin@${org_lower}.agritrade.com/msp" \
        cli peer lifecycle chaincode approveformyorg \
            -o orderer.agritrade.com:7050 \
            --channelID "${CHANNEL_NAME}" \
            --name "${cc_name}" \
            --version "${CC_VERSION}" \
            --package-id "${package_id}" \
            --sequence "${CC_SEQUENCE}" \
            --signature-policy "${policy}" \
            --tls \
            --cafile "${ORDERER_CA}"

    info "  ✓ ${org}Org approved."
}

# ── Commit chaincode ──────────────────────────────────────────────────────────
commit_chaincode() {
    local cc_name="${1}"
    local policy="${CC_POLICIES[$cc_name]}"
    section "Committing ${cc_name} on channel ${CHANNEL_NAME}"

    docker exec \
        -e CORE_PEER_LOCALMSPID=FarmersMSP \
        -e CORE_PEER_ADDRESS=peer0.farmers.agritrade.com:7051 \
        -e CORE_PEER_TLS_ROOTCERT_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/farmers.agritrade.com/peers/peer0.farmers.agritrade.com/tls/ca.crt" \
        -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/farmers.agritrade.com/users/Admin@farmers.agritrade.com/msp" \
        cli peer lifecycle chaincode commit \
            -o orderer.agritrade.com:7050 \
            --channelID "${CHANNEL_NAME}" \
            --name "${cc_name}" \
            --version "${CC_VERSION}" \
            --sequence "${CC_SEQUENCE}" \
            --signature-policy "${policy}" \
            --tls \
            --cafile "${ORDERER_CA}" \
            --peerAddresses peer0.farmers.agritrade.com:7051 \
            --tlsRootCertFiles "/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/farmers.agritrade.com/peers/peer0.farmers.agritrade.com/tls/ca.crt" \
            --peerAddresses peer0.buyers.agritrade.com:9051 \
            --tlsRootCertFiles "/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/buyers.agritrade.com/peers/peer0.buyers.agritrade.com/tls/ca.crt" \
            --peerAddresses peer0.logistics.agritrade.com:11051 \
            --tlsRootCertFiles "/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/logistics.agritrade.com/peers/peer0.logistics.agritrade.com/tls/ca.crt"

    info "  ✓ ${cc_name} committed on channel."
}

# ── Deploy a single chaincode end-to-end ──────────────────────────────────────
deploy_single() {
    local cc_name="${1}"
    section "Deploying chaincode: ${cc_name} v${CC_VERSION}"

    mkdir -p "/tmp/chaincode/${cc_name}"
    build_chaincode "${cc_name}"
    package_chaincode "${cc_name}"

    for org in Farmers Buyers Logistics; do
        install_chaincode "${cc_name}" "${org}" 0
    done

    local pkg_id
    pkg_id=$(get_package_id "${cc_name}" Farmers)
    if [ -z "${pkg_id}" ]; then
        error "Could not determine package ID for ${cc_name}. Install may have failed."
        exit 1
    fi
    info "Package ID: ${pkg_id}"

    for org in Farmers Buyers Logistics; do
        approve_chaincode "${cc_name}" "${org}" "${pkg_id}"
    done

    commit_chaincode "${cc_name}"

    # Verify
    docker exec \
        -e CORE_PEER_LOCALMSPID=FarmersMSP \
        -e CORE_PEER_ADDRESS=peer0.farmers.agritrade.com:7051 \
        -e CORE_PEER_TLS_ROOTCERT_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/farmers.agritrade.com/peers/peer0.farmers.agritrade.com/tls/ca.crt" \
        -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/farmers.agritrade.com/users/Admin@farmers.agritrade.com/msp" \
        cli peer lifecycle chaincode querycommitted \
            --channelID "${CHANNEL_NAME}" \
            --name "${cc_name}"

    info "  ✓ ${cc_name} deployed and verified."
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
    local cc_filter="${1:-all}"  # deploy specific CC or all

    info "============================================="
    info " AgriTrade Chaincode Deployment"
    info " Channel : ${CHANNEL_NAME}"
    info " Version : ${CC_VERSION}"
    info " Sequence: ${CC_SEQUENCE}"
    info "============================================="

    if [ "${cc_filter}" = "all" ]; then
        for cc_name in trade escrow supplychain logistics; do
            deploy_single "${cc_name}"
        done
    else
        deploy_single "${cc_filter}"
    fi

    info "============================================="
    info " All chaincodes deployed successfully."
    info "============================================="
}

main "$@"
