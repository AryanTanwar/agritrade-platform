package tests

import (
	"testing"

	"github.com/agritrade/chaincode/escrow"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── Fixtures ──────────────────────────────────────────────────────────────────

func sampleEscrowInput(id, orderID string) map[string]interface{} {
	return map[string]interface{}{
		"id":               id,
		"orderId":          orderID,
		"farmerId":         "farmer-user-001",
		"farmerMsp":        "FarmersMSP",
		"amount":           2500.0,
		"currency":         "INR",
		"paymentRef":       "razorpay-pay-XYZ123",
		"paymentProofHash": "sha256:abc123def456",
		"expiresAt":        "2026-05-01T00:00:00Z",
	}
}

// ── CreateEscrow ──────────────────────────────────────────────────────────────

func TestCreateEscrow_Success(t *testing.T) {
	sc := &escrow.SmartContract{}
	ctx := buyerCtx(t)

	e, err := sc.CreateEscrow(ctx, toJSON(t, sampleEscrowInput("escrow-001", "order-001")))

	require.NoError(t, err)
	require.NotNil(t, e)
	assert.Equal(t, "escrow-001", e.ID)
	assert.Equal(t, "order-001", e.OrderID)
	assert.Equal(t, escrow.EscrowHeld, e.Status)
	assert.Equal(t, float64(2500), e.Amount)
	assert.Equal(t, "INR", e.Currency)
	assert.Equal(t, "BuyersMSP", e.BuyerMSP)
	assert.NotEmpty(t, e.HoldTxID)
	assert.NotEmpty(t, e.CreatedAt)
}

func TestCreateEscrow_WrongMSP(t *testing.T) {
	sc := &escrow.SmartContract{}
	ctx := farmerCtx(t) // farmers cannot create escrows

	_, err := sc.CreateEscrow(ctx, toJSON(t, sampleEscrowInput("escrow-bad", "order-bad")))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "FORBIDDEN")
}

func TestCreateEscrow_Duplicate(t *testing.T) {
	sc := &escrow.SmartContract{}
	ctx := buyerCtx(t)
	input := toJSON(t, sampleEscrowInput("escrow-dup", "order-dup"))

	_, err := sc.CreateEscrow(ctx, input)
	require.NoError(t, err)

	_, err = sc.CreateEscrow(ctx, input)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "CONFLICT")
}

func TestCreateEscrow_ZeroAmount(t *testing.T) {
	sc := &escrow.SmartContract{}
	ctx := buyerCtx(t)

	input := sampleEscrowInput("escrow-zero", "order-zero")
	input["amount"] = 0.0
	_, err := sc.CreateEscrow(ctx, toJSON(t, input))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "VALIDATION")
}

func TestCreateEscrow_MissingOrderID(t *testing.T) {
	sc := &escrow.SmartContract{}
	ctx := buyerCtx(t)

	_, err := sc.CreateEscrow(ctx, `{"id":"e1","orderId":"","farmerId":"f1","amount":100}`)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "VALIDATION")
}

// ── ReleaseEscrow ─────────────────────────────────────────────────────────────

func TestReleaseEscrow_Success(t *testing.T) {
	sc := &escrow.SmartContract{}
	bCtx, fCtx := withSharedStub(t, "BuyersMSP", "buyer-r", "FarmersMSP", "farmer-r")

	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("escrow-rel", "order-rel")))
	require.NoError(t, err)

	// Farmer releases (claims payment after delivery)
	e, err := sc.ReleaseEscrow(fCtx, "escrow-rel")
	require.NoError(t, err)
	assert.Equal(t, escrow.EscrowReleased, e.Status)
	assert.Equal(t, float64(2500), e.FarmerReleaseAmt)
	assert.NotEmpty(t, e.ReleaseTxID)
}

func TestReleaseEscrow_AlreadyReleased(t *testing.T) {
	sc := &escrow.SmartContract{}
	bCtx, fCtx := withSharedStub(t, "BuyersMSP", "buyer-r2", "FarmersMSP", "farmer-r2")

	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("escrow-rel2", "order-rel2")))
	require.NoError(t, err)

	_, err = sc.ReleaseEscrow(fCtx, "escrow-rel2")
	require.NoError(t, err)

	_, err = sc.ReleaseEscrow(fCtx, "escrow-rel2")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "INVALID_STATE")
}

// ── RefundEscrow ──────────────────────────────────────────────────────────────

func TestRefundEscrow_Success(t *testing.T) {
	sc := &escrow.SmartContract{}
	bCtx := buyerCtx(t)

	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("escrow-ref", "order-ref")))
	require.NoError(t, err)

	e, err := sc.RefundEscrow(bCtx, "escrow-ref")
	require.NoError(t, err)
	assert.Equal(t, escrow.EscrowRefunded, e.Status)
	assert.Equal(t, float64(2500), e.BuyerRefundAmt)
}

func TestRefundEscrow_AfterRelease(t *testing.T) {
	sc := &escrow.SmartContract{}
	bCtx, fCtx := withSharedStub(t, "BuyersMSP", "buyer-rf2", "FarmersMSP", "farmer-rf2")

	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("escrow-rfail", "order-rfail")))
	require.NoError(t, err)

	_, err = sc.ReleaseEscrow(fCtx, "escrow-rfail")
	require.NoError(t, err)

	// Cannot refund after releasing
	_, err = sc.RefundEscrow(bCtx, "escrow-rfail")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "INVALID_STATE")
}

// ── RaiseDispute ──────────────────────────────────────────────────────────────

func TestRaiseDispute_Success(t *testing.T) {
	sc := &escrow.SmartContract{}
	bCtx := buyerCtx(t)

	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("escrow-disp", "order-disp")))
	require.NoError(t, err)

	e, err := sc.RaiseDispute(bCtx, "escrow-disp", "Produce was damaged on arrival")
	require.NoError(t, err)
	assert.Equal(t, escrow.EscrowDisputed, e.Status)
	assert.Equal(t, "Produce was damaged on arrival", e.DisputeReason)
}

func TestRaiseDispute_EmptyReason(t *testing.T) {
	sc := &escrow.SmartContract{}
	bCtx := buyerCtx(t)

	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("escrow-norea", "order-norea")))
	require.NoError(t, err)

	_, err = sc.RaiseDispute(bCtx, "escrow-norea", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "VALIDATION")
}

func TestRaiseDispute_NotAParty(t *testing.T) {
	sc := &escrow.SmartContract{}
	bCtx := buyerCtx(t)
	// A different logistics user tries to dispute
	lCtx := newCtx(t, "LogisticsMSP", "logistics-intruder")
	lCtx.stub = bCtx.stub

	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("escrow-notparty", "order-np")))
	require.NoError(t, err)

	_, err = sc.RaiseDispute(lCtx, "escrow-notparty", "Bad reason")
	require.Error(t, err)
	// logistics MSP is not FarmersMSP or BuyersMSP for this escrow's caller check
	assert.Error(t, err)
}

// ── ResolveDispute ────────────────────────────────────────────────────────────

func TestResolveDispute_FarmerWins(t *testing.T) {
	sc := &escrow.SmartContract{}
	bCtx, fCtx := withSharedStub(t, "BuyersMSP", "buyer-res", "FarmersMSP", "farmer-res")

	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("escrow-res", "order-res")))
	require.NoError(t, err)

	_, err = sc.RaiseDispute(bCtx, "escrow-res", "Test dispute")
	require.NoError(t, err)

	resolution := map[string]interface{}{
		"outcome":          "FARMER_WINS",
		"farmerReleaseAmt": 2500.0,
		"buyerRefundAmt":   0.0,
	}
	e, err := sc.ResolveDispute(fCtx, "escrow-res", toJSON(t, resolution))
	require.NoError(t, err)
	assert.Equal(t, escrow.EscrowReleased, e.Status)
	assert.Equal(t, escrow.OutcomeFarmerWins, e.DisputeOutcome)
	assert.Equal(t, float64(2500), e.FarmerReleaseAmt)
}

func TestResolveDispute_Split(t *testing.T) {
	sc := &escrow.SmartContract{}
	bCtx, fCtx := withSharedStub(t, "BuyersMSP", "buyer-split", "FarmersMSP", "farmer-split")

	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("escrow-split", "order-split")))
	require.NoError(t, err)
	_, err = sc.RaiseDispute(bCtx, "escrow-split", "Quality issue")
	require.NoError(t, err)

	resolution := map[string]interface{}{
		"outcome":          "SPLIT",
		"farmerReleaseAmt": 1500.0,
		"buyerRefundAmt":   1000.0,
	}
	e, err := sc.ResolveDispute(fCtx, "escrow-split", toJSON(t, resolution))
	require.NoError(t, err)
	assert.Equal(t, escrow.OutcomeSplit, e.DisputeOutcome)
	assert.Equal(t, float64(1500), e.FarmerReleaseAmt)
	assert.Equal(t, float64(1000), e.BuyerRefundAmt)
}

func TestResolveDispute_AmountsExceedTotal(t *testing.T) {
	sc := &escrow.SmartContract{}
	bCtx, fCtx := withSharedStub(t, "BuyersMSP", "buyer-over", "FarmersMSP", "farmer-over")

	_, err := sc.CreateEscrow(bCtx, toJSON(t, sampleEscrowInput("escrow-over", "order-over")))
	require.NoError(t, err)
	_, err = sc.RaiseDispute(bCtx, "escrow-over", "reason")
	require.NoError(t, err)

	resolution := map[string]interface{}{
		"outcome":          "SPLIT",
		"farmerReleaseAmt": 2000.0,
		"buyerRefundAmt":   1000.0, // total = 3000 > escrow.Amount 2500
	}
	_, err = sc.ResolveDispute(fCtx, "escrow-over", toJSON(t, resolution))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "VALIDATION")
}

// ── GetEscrow ─────────────────────────────────────────────────────────────────

func TestGetEscrow_NotFound(t *testing.T) {
	sc := &escrow.SmartContract{}
	ctx := buyerCtx(t)

	_, err := sc.GetEscrow(ctx, "does-not-exist")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "NOT_FOUND")
}
