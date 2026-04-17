// Package tests provides shared test helpers for all AgriTrade chaincode contracts.
//
// Uses shimtest.MockStub to simulate the Fabric peer environment without
// requiring a running network. Each test creates an isolated in-memory state.
package tests

import (
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"fmt"
	"math/rand"
	"strconv"
	"testing"

	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-chaincode-go/shimtest"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/stretchr/testify/require"
)

// ── Mock identity ─────────────────────────────────────────────────────────────

// mockIdentity implements cid.ClientIdentity for testing.
type mockIdentity struct {
	mspID string
	id    string
}

func (m *mockIdentity) GetID() (string, error)         { return m.id, nil }
func (m *mockIdentity) GetMSPID() (string, error)      { return m.mspID, nil }
func (m *mockIdentity) GetAttributeValue(attr string) (string, bool, error) {
	return "", false, nil
}
func (m *mockIdentity) AssertAttributeValue(attr, val string) error {
	return fmt.Errorf("attribute not set in mock")
}
func (m *mockIdentity) GetX509Certificate() (*x509.Certificate, error) {
	return &x509.Certificate{
		Subject: pkix.Name{CommonName: m.id},
	}, nil
}

// ── Mock transaction context ──────────────────────────────────────────────────

// mockCtx satisfies contractapi.TransactionContextInterface using a shimtest.MockStub.
type mockCtx struct {
	stub     *shimtest.MockStub
	identity *mockIdentity
}

func (c *mockCtx) GetStub() shim.ChaincodeStubInterface { return c.stub }
func (c *mockCtx) GetClientIdentity() contractapi.ClientIdentity {
	return c.identity
}

// ── Factories ─────────────────────────────────────────────────────────────────

// newCtx returns a ready-to-use mock context with an active transaction.
func newCtx(t *testing.T, mspID, clientID string) *mockCtx {
	t.Helper()
	stub := shimtest.NewMockStub("agritrade-test", nil)
	txID := "tx-" + strconv.Itoa(rand.Intn(1_000_000))
	stub.MockTransactionStart(txID)
	t.Cleanup(func() { stub.MockTransactionEnd(txID) })
	return &mockCtx{
		stub:     stub,
		identity: &mockIdentity{mspID: mspID, id: clientID},
	}
}

// farmerCtx returns a context authenticating as a FarmersMSP client.
func farmerCtx(t *testing.T) *mockCtx {
	return newCtx(t, "FarmersMSP", "farmer-user-001")
}

// buyerCtx returns a context authenticating as a BuyersMSP client.
func buyerCtx(t *testing.T) *mockCtx {
	return newCtx(t, "BuyersMSP", "buyer-user-001")
}

// logisticsCtx returns a context authenticating as a LogisticsMSP client.
func logisticsCtx(t *testing.T) *mockCtx {
	return newCtx(t, "LogisticsMSP", "logistics-user-001")
}

// withSharedStub creates two contexts that share the same MockStub (same ledger state).
// Used to test cross-role interactions (e.g. farmer creates listing, buyer places order).
func withSharedStub(t *testing.T, mspID1, id1, mspID2, id2 string) (*mockCtx, *mockCtx) {
	t.Helper()
	stub := shimtest.NewMockStub("agritrade-shared", nil)
	txID := "tx-" + strconv.Itoa(rand.Intn(1_000_000))
	stub.MockTransactionStart(txID)
	t.Cleanup(func() { stub.MockTransactionEnd(txID) })

	ctx1 := &mockCtx{stub: stub, identity: &mockIdentity{mspID: mspID1, id: id1}}
	ctx2 := &mockCtx{stub: stub, identity: &mockIdentity{mspID: mspID2, id: id2}}
	return ctx1, ctx2
}

// ── JSON helpers ──────────────────────────────────────────────────────────────

// toJSON marshals v to a JSON string; fails the test on error.
func toJSON(t *testing.T, v interface{}) string {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err, "toJSON failed")
	return string(b)
}

// ── Common fixture data ───────────────────────────────────────────────────────

func sampleListingInput(id string) map[string]interface{} {
	return map[string]interface{}{
		"id":           id,
		"title":        "Organic Alphonso Mangoes",
		"description":  "Premium grade Alphonso from Ratnagiri",
		"category":     "FRUIT",
		"quantity":     100.0,
		"unit":         "KG",
		"pricePerUnit": 250.0,
		"currency":     "INR",
		"location": map[string]interface{}{
			"latitude":  16.994,
			"longitude": 73.300,
			"address":   "Ratnagiri, Maharashtra",
			"state":     "Maharashtra",
			"pincode":   "415612",
		},
		"harvestDate": "2026-04-10",
		"expiryDate":  "2026-04-25",
		"isOrganic":   true,
		"certHash":    "abc123",
	}
}

func sampleOrderInput(id, listingID string) map[string]interface{} {
	return map[string]interface{}{
		"id":        id,
		"listingId": listingID,
		"quantity":  10.0,
		"deliveryAddress": map[string]interface{}{
			"latitude":  19.076,
			"longitude": 72.877,
			"address":   "Mumbai",
			"state":     "Maharashtra",
			"pincode":   "400001",
		},
		"notes": "Handle with care",
	}
}
