// Package tests — Chaincode security audit
//
// These tests go beyond functional correctness and verify the security
// properties that matter most in a financial smart contract:
//
//  1. Access Control — every state-mutating function enforces MSP membership
//  2. State Machine  — invalid transitions are rejected with explicit errors
//  3. Double-spend   — duplicate asset creation is idempotent-safe (CONFLICT)
//  4. Input Validation — malformed / boundary inputs are rejected at chaincode level
//  5. Idempotency    — repeated calls with the same payload don't corrupt state
//
// Each test is labelled AUDIT: <property> for easy filtering:
//
//	go test ./tests/... -run "AUDIT"
package tests

import (
	"strings"
	"testing"

	"github.com/agritrade/chaincode/escrow"
	"github.com/agritrade/chaincode/trade"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ══════════════════════════════════════════════════════════════════════════════
// 1. ACCESS CONTROL
// ══════════════════════════════════════════════════════════════════════════════

// AUDIT: access-control — trade contract

func TestAUDIT_Trade_PlaceOrder_RequiresBuyerMSP(t *testing.T) {
	sc := &trade.SmartContract{}
	// FarmersMSP must not be able to place an order
	ctx := farmerCtx(t)
	_, err := sc.PlaceOrder(ctx, toJSON(t, sampleOrderInput("ao-001", "listing-001")))
	require.Error(t, err, "farmers must not place orders")
	assert.True(t, isForbidden(err), "expected FORBIDDEN, got: %v", err)
}

func TestAUDIT_Trade_CreateListing_RequiresFarmerMSP(t *testing.T) {
	sc := &trade.SmartContract{}
	// BuyersMSP must not be able to create a listing
	ctx := buyerCtx(t)
	_, err := sc.CreateListing(ctx, toJSON(t, sampleListingInput("al-001")))
	require.Error(t, err, "buyers must not create listings")
	assert.True(t, isForbidden(err), "expected FORBIDDEN, got: %v", err)
}

func TestAUDIT_Trade_ConfirmOrder_RequiresFarmerMSP(t *testing.T) {
	sc := &trade.SmartContract{}
	// Seed a placed order
	fCtx, bCtx := withSharedStub(t, "FarmersMSP", "farmer-001", "BuyersMSP", "buyer-001")
	_, err := sc.CreateListing(fCtx, toJSON(t, sampleListingInput("al-002")))
	require.NoError(t, err)
	_, err = sc.PlaceOrder(bCtx, toJSON(t, sampleOrderInput("ao-002", "al-002")))
	require.NoError(t, err)

	// Buyer must not be able to confirm their own order (prevents self-confirmation)
	_, err = sc.ConfirmOrder(bCtx, "ao-002")
	require.Error(t, err, "buyer must not confirm order")
	assert.True(t, isForbidden(err), "expected FORBIDDEN, got: %v", err)
}

// AUDIT: access-control — escrow contract

func TestAUDIT_Escrow_CreateEscrow_RequiresBuyerMSP(t *testing.T) {
	sc := &escrow.SmartContract{}
	ctx := farmerCtx(t)
	_, err := sc.CreateEscrow(ctx, toJSON(t, sampleEscrowInput("ae-001", "order-001")))
	require.Error(t, err)
	assert.True(t, isForbidden(err), "expected FORBIDDEN, got: %v", err)
}

func TestAUDIT_Escrow_ReleaseEscrow_ForbidsThirdPartyMSP(t *testing.T) {
	sc := &escrow.SmartContract{}
	// Seed a held escrow as buyer
	bCtx, lCtx := withSharedStub(t, "BuyersMSP", "buyer-001", "LogisticsMSP", "logistics-001")
	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("ae-rel", "order-rel")))
	require.NoError(t, err)

	// A logistics provider (neither farmer nor buyer) must not be able to release escrow
	_, err = sc.ReleaseEscrow(lCtx, "ae-rel")
	require.Error(t, err, "logistics MSP must not release escrow")
	assert.True(t, isForbidden(err), "expected FORBIDDEN, got: %v", err)
}

func TestAUDIT_Escrow_RefundEscrow_ForbidsThirdPartyMSP(t *testing.T) {
	sc := &escrow.SmartContract{}
	bCtx, lCtx := withSharedStub(t, "BuyersMSP", "buyer-001", "LogisticsMSP", "logistics-001")
	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("ae-ref", "order-ref")))
	require.NoError(t, err)

	// A third-party MSP (e.g. logistics) must not be able to trigger a refund
	_, err = sc.RefundEscrow(lCtx, "ae-ref")
	require.Error(t, err, "logistics MSP must not trigger refund")
	assert.True(t, isForbidden(err), "expected FORBIDDEN, got: %v", err)
}

func TestAUDIT_Escrow_RaiseDispute_RequiresParticipant(t *testing.T) {
	sc := &escrow.SmartContract{}
	// A logistics-MSP account must not be able to raise a trade dispute
	bCtx, lCtx := withSharedStub(t, "BuyersMSP", "buyer-001", "LogisticsMSP", "logistics-001")
	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("ae-disp", "order-disp")))
	require.NoError(t, err)

	_, err = sc.RaiseDispute(lCtx, "ae-disp", "claiming goods not delivered")
	require.Error(t, err, "logistics MSP must not raise escrow disputes")
	assert.True(t, isForbidden(err), "expected FORBIDDEN, got: %v", err)
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. STATE MACHINE — invalid transitions
// ══════════════════════════════════════════════════════════════════════════════

func TestAUDIT_Trade_CannotConfirmCancelledOrder(t *testing.T) {
	sc := &trade.SmartContract{}
	fCtx, bCtx := withSharedStub(t, "FarmersMSP", "farmer-001", "BuyersMSP", "buyer-001")
	_, err := sc.CreateListing(fCtx, toJSON(t, sampleListingInput("sm-l-01")))
	require.NoError(t, err)
	_, err = sc.PlaceOrder(bCtx, toJSON(t, sampleOrderInput("sm-o-01", "sm-l-01")))
	require.NoError(t, err)
	_, err = sc.CancelOrder(fCtx, "sm-o-01")
	require.NoError(t, err)

	_, err = sc.ConfirmOrder(fCtx, "sm-o-01")
	require.Error(t, err, "cannot confirm a cancelled order")
	assert.True(t, isStateError(err), "expected STATE_ERROR, got: %v", err)
}

func TestAUDIT_Escrow_CannotReleaseBeforeHeld(t *testing.T) {
	sc := &escrow.SmartContract{}
	// Attempting to release a non-existent escrow must fail gracefully
	ctx := farmerCtx(t)
	_, err := sc.ReleaseEscrow(ctx, "nonexistent-escrow-id")
	require.Error(t, err)
	// Must return NOT_FOUND or STATE_ERROR, never panic
	assert.True(t, isNotFound(err) || isStateError(err), "unexpected error type: %v", err)
}

func TestAUDIT_Escrow_CannotReleaseAlreadyReleased(t *testing.T) {
	sc := &escrow.SmartContract{}
	bCtx, fCtx := withSharedStub(t, "BuyersMSP", "buyer-001", "FarmersMSP", "farmer-001")
	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("ae-dbl-rel", "order-dbl-rel")))
	require.NoError(t, err)

	// First release succeeds
	_, err = sc.ReleaseEscrow(fCtx, "ae-dbl-rel")
	require.NoError(t, err)

	// Second release must fail — funds cannot be released twice
	_, err = sc.ReleaseEscrow(fCtx, "ae-dbl-rel")
	require.Error(t, err, "escrow must not be released twice")
	assert.True(t, isStateError(err), "expected STATE_ERROR on double-release, got: %v", err)
}

func TestAUDIT_Escrow_CannotRefundAfterRelease(t *testing.T) {
	sc := &escrow.SmartContract{}
	bCtx, fCtx := withSharedStub(t, "BuyersMSP", "buyer-001", "FarmersMSP", "farmer-001")
	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("ae-ref-rel", "order-ref-rel")))
	require.NoError(t, err)
	_, err = sc.ReleaseEscrow(fCtx, "ae-ref-rel")
	require.NoError(t, err)

	// After funds are released to farmer, buyer cannot also claim a refund
	_, err = sc.RefundEscrow(bCtx, "ae-ref-rel")
	require.Error(t, err, "cannot refund an already-released escrow")
	assert.True(t, isStateError(err), "expected STATE_ERROR, got: %v", err)
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. DOUBLE-SPEND / DUPLICATE CREATION
// ══════════════════════════════════════════════════════════════════════════════

func TestAUDIT_Trade_CreateListing_Duplicate(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t)
	input := toJSON(t, sampleListingInput("dup-listing-001"))

	_, err := sc.CreateListing(ctx, input)
	require.NoError(t, err)

	_, err = sc.CreateListing(ctx, input)
	require.Error(t, err, "duplicate listing must be rejected")
	assert.True(t, isConflict(err), "expected CONFLICT, got: %v", err)
}

func TestAUDIT_Trade_PlaceOrder_Duplicate(t *testing.T) {
	sc := &trade.SmartContract{}
	fCtx, bCtx := withSharedStub(t, "FarmersMSP", "farmer-001", "BuyersMSP", "buyer-001")
	_, err := sc.CreateListing(fCtx, toJSON(t, sampleListingInput("dup-l-002")))
	require.NoError(t, err)
	input := toJSON(t, sampleOrderInput("dup-o-002", "dup-l-002"))

	_, err = sc.PlaceOrder(bCtx, input)
	require.NoError(t, err)

	_, err = sc.PlaceOrder(bCtx, input)
	require.Error(t, err, "duplicate order must be rejected")
	assert.True(t, isConflict(err), "expected CONFLICT, got: %v", err)
}

func TestAUDIT_Escrow_CreateEscrow_Duplicate(t *testing.T) {
	sc := &escrow.SmartContract{}
	ctx := buyerCtx(t)
	input := toJSON(t, sampleEscrowInput("dup-escrow-001", "dup-order-001"))

	_, err := sc.CreateEscrow(ctx, input)
	require.NoError(t, err)

	_, err = sc.CreateEscrow(ctx, input)
	require.Error(t, err, "duplicate escrow must be rejected")
	assert.True(t, isConflict(err), "expected CONFLICT on duplicate escrow, got: %v", err)
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. INPUT VALIDATION
// ══════════════════════════════════════════════════════════════════════════════

func TestAUDIT_Escrow_NegativeAmount_Rejected(t *testing.T) {
	sc := &escrow.SmartContract{}
	ctx := buyerCtx(t)
	input := sampleEscrowInput("iv-001", "iv-order-001")
	input["amount"] = -500.0 // negative payment
	_, err := sc.CreateEscrow(ctx, toJSON(t, input))
	require.Error(t, err, "negative escrow amount must be rejected")
}

func TestAUDIT_Escrow_ZeroAmount_Rejected(t *testing.T) {
	sc := &escrow.SmartContract{}
	ctx := buyerCtx(t)
	input := sampleEscrowInput("iv-002", "iv-order-002")
	input["amount"] = 0.0
	_, err := sc.CreateEscrow(ctx, toJSON(t, input))
	require.Error(t, err, "zero escrow amount must be rejected")
}

func TestAUDIT_Trade_ZeroQuantityListing_Rejected(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t)
	input := sampleListingInput("iv-l-001")
	input["quantity"] = 0.0
	_, err := sc.CreateListing(ctx, toJSON(t, input))
	require.Error(t, err, "zero-quantity listing must be rejected")
}

func TestAUDIT_Trade_NegativePriceListing_Rejected(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t)
	input := sampleListingInput("iv-l-002")
	input["pricePerUnit"] = -100.0
	_, err := sc.CreateListing(ctx, toJSON(t, input))
	require.Error(t, err, "negative price listing must be rejected")
}

func TestAUDIT_Trade_EmptyID_Rejected(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t)
	input := sampleListingInput("")
	_, err := sc.CreateListing(ctx, toJSON(t, input))
	require.Error(t, err, "empty ID must be rejected")
}

func TestAUDIT_Trade_MalformedJSON_Rejected(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t)
	_, err := sc.CreateListing(ctx, `{"id": "bad-json", "title":`)
	require.Error(t, err, "malformed JSON must be rejected cleanly (no panic)")
}

func TestAUDIT_Escrow_MalformedJSON_Rejected(t *testing.T) {
	sc := &escrow.SmartContract{}
	ctx := buyerCtx(t)
	_, err := sc.CreateEscrow(ctx, `not-valid-json`)
	require.Error(t, err, "malformed JSON must be rejected cleanly (no panic)")
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. IDEMPOTENCY — confirmed order query is stable
// ══════════════════════════════════════════════════════════════════════════════

func TestAUDIT_Trade_GetOrder_Idempotent(t *testing.T) {
	sc := &trade.SmartContract{}
	fCtx, bCtx := withSharedStub(t, "FarmersMSP", "farmer-001", "BuyersMSP", "buyer-001")
	_, err := sc.CreateListing(fCtx, toJSON(t, sampleListingInput("idem-l-001")))
	require.NoError(t, err)
	_, err = sc.PlaceOrder(bCtx, toJSON(t, sampleOrderInput("idem-o-001", "idem-l-001")))
	require.NoError(t, err)

	// Multiple reads must return consistent state
	o1, err := sc.GetOrder(bCtx, "idem-o-001")
	require.NoError(t, err)
	o2, err := sc.GetOrder(bCtx, "idem-o-001")
	require.NoError(t, err)
	assert.Equal(t, o1.ID, o2.ID)
	assert.Equal(t, o1.Status, o2.Status)
}

func TestAUDIT_Escrow_GetEscrow_Idempotent(t *testing.T) {
	sc := &escrow.SmartContract{}
	ctx := buyerCtx(t)
	_, err := sc.CreateEscrow(ctx, toJSON(t, sampleEscrowInput("idem-e-001", "idem-order-001")))
	require.NoError(t, err)

	e1, err := sc.GetEscrow(ctx, "idem-e-001")
	require.NoError(t, err)
	e2, err := sc.GetEscrow(ctx, "idem-e-001")
	require.NoError(t, err)
	assert.Equal(t, e1.ID, e2.ID)
	assert.Equal(t, e1.Amount, e2.Amount)
	assert.Equal(t, e1.Status, e2.Status)
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers — error classification
// ══════════════════════════════════════════════════════════════════════════════

func isForbidden(err error) bool {
	return err != nil && (strings.Contains(err.Error(), "FORBIDDEN") ||
		strings.Contains(err.Error(), "forbidden") ||
		strings.Contains(err.Error(), "unauthorized") ||
		strings.Contains(err.Error(), "Unauthorized"))
}

func isStateError(err error) bool {
	// ChainError formats as "[INVALID_STATE] <msg>" per common/errors.go.
	return err != nil && (strings.Contains(err.Error(), "INVALID_STATE") ||
		strings.Contains(err.Error(), "cannot release") ||
		strings.Contains(err.Error(), "cannot refund") ||
		strings.Contains(err.Error(), "cannot confirm") ||
		strings.Contains(err.Error(), "invalid state") ||
		strings.Contains(err.Error(), "invalid transition"))
}

func isConflict(err error) bool {
	return err != nil && (strings.Contains(err.Error(), "CONFLICT") ||
		strings.Contains(err.Error(), "already exists") ||
		strings.Contains(err.Error(), "duplicate"))
}

func isNotFound(err error) bool {
	return err != nil && (strings.Contains(err.Error(), "NOT_FOUND") ||
		strings.Contains(err.Error(), "not found") ||
		strings.Contains(err.Error(), "does not exist"))
}
