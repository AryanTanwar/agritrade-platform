package tests

import (
	"strings"
	"testing"

	"github.com/agritrade/chaincode/trade"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── CreateListing ─────────────────────────────────────────────────────────────

func TestCreateListing_Success(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t)

	input := toJSON(t, sampleListingInput("listing-001"))
	listing, err := sc.CreateListing(ctx, input)

	require.NoError(t, err)
	require.NotNil(t, listing)
	assert.Equal(t, "listing-001", listing.ID)
	assert.Equal(t, "FRUIT", listing.Category)
	assert.Equal(t, float64(100), listing.Quantity)
	assert.Equal(t, float64(250), listing.PricePerUnit)
	assert.Equal(t, trade.ListingActive, listing.Status)
	assert.Equal(t, "FarmersMSP", listing.FarmerMSP)
	assert.NotEmpty(t, listing.TxID)
	assert.NotEmpty(t, listing.CreatedAt)
}

func TestCreateListing_WrongMSP(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := buyerCtx(t) // buyers cannot create listings

	input := toJSON(t, sampleListingInput("listing-002"))
	_, err := sc.CreateListing(ctx, input)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "FORBIDDEN")
}

func TestCreateListing_DuplicateID(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t)
	input := toJSON(t, sampleListingInput("listing-dup"))

	_, err := sc.CreateListing(ctx, input)
	require.NoError(t, err)

	_, err = sc.CreateListing(ctx, input)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "CONFLICT")
}

func TestCreateListing_InvalidJSON(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t)

	_, err := sc.CreateListing(ctx, "{not-valid-json}")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "VALIDATION")
}

func TestCreateListing_MissingRequiredFields(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t)

	_, err := sc.CreateListing(ctx, `{"id":"","title":"","category":""}`)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "VALIDATION")
}

func TestCreateListing_NegativeQuantity(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t)

	input := sampleListingInput("listing-neg")
	input["quantity"] = -5.0
	_, err := sc.CreateListing(ctx, toJSON(t, input))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "VALIDATION")
}

// ── GetListing ────────────────────────────────────────────────────────────────

func TestGetListing_NotFound(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t)

	_, err := sc.GetListing(ctx, "nonexistent-id")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "NOT_FOUND")
}

// ── UpdateListing ─────────────────────────────────────────────────────────────

func TestUpdateListing_Success(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t)

	_, err := sc.CreateListing(ctx, toJSON(t, sampleListingInput("listing-upd")))
	require.NoError(t, err)

	newQty := 80.0
	newPrice := 275.0
	update := map[string]interface{}{
		"quantity":     newQty,
		"pricePerUnit": newPrice,
		"description":  "Updated description",
	}
	updated, err := sc.UpdateListing(ctx, "listing-upd", toJSON(t, update))

	require.NoError(t, err)
	assert.Equal(t, newQty, updated.Quantity)
	assert.Equal(t, newPrice, updated.PricePerUnit)
	assert.Equal(t, "Updated description", updated.Description)
}

func TestUpdateListing_WrongOwner(t *testing.T) {
	sc := &trade.SmartContract{}
	farmerCtx1 := newCtx(t, "FarmersMSP", "farmer-A")
	farmerCtx2 := newCtx(t, "FarmersMSP", "farmer-B")

	// Share state between two farmer contexts
	farmerCtx2.stub = farmerCtx1.stub

	_, err := sc.CreateListing(farmerCtx1, toJSON(t, sampleListingInput("listing-owner")))
	require.NoError(t, err)

	_, err = sc.UpdateListing(farmerCtx2, "listing-owner", `{"quantity":50}`)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "FORBIDDEN")
}

// ── CancelListing ─────────────────────────────────────────────────────────────

func TestCancelListing_Success(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t)

	_, err := sc.CreateListing(ctx, toJSON(t, sampleListingInput("listing-cancel")))
	require.NoError(t, err)

	err = sc.CancelListing(ctx, "listing-cancel")
	require.NoError(t, err)

	listing, err := sc.GetListing(ctx, "listing-cancel")
	require.NoError(t, err)
	assert.Equal(t, trade.ListingCancelled, listing.Status)
}

// ── PlaceOrder ────────────────────────────────────────────────────────────────

func TestPlaceOrder_Success(t *testing.T) {
	sc := &trade.SmartContract{}
	fCtx, bCtx := withSharedStub(t, "FarmersMSP", "farmer-001", "BuyersMSP", "buyer-001")

	_, err := sc.CreateListing(fCtx, toJSON(t, sampleListingInput("listing-po")))
	require.NoError(t, err)

	order, err := sc.PlaceOrder(bCtx, toJSON(t, sampleOrderInput("order-001", "listing-po")))

	require.NoError(t, err)
	require.NotNil(t, order)
	assert.Equal(t, "order-001", order.ID)
	assert.Equal(t, trade.OrderPlaced, order.Status)
	assert.Equal(t, float64(10), order.Quantity)
	assert.Equal(t, float64(2500), order.TotalAmount) // 10 * 250
	assert.Equal(t, "farmer-001", order.FarmerID)
	assert.Equal(t, "buyer-001", order.BuyerID)
}

func TestPlaceOrder_WrongMSP(t *testing.T) {
	sc := &trade.SmartContract{}
	ctx := farmerCtx(t) // farmer trying to place an order

	_, err := sc.CreateListing(ctx, toJSON(t, sampleListingInput("listing-farm")))
	require.NoError(t, err)

	_, err = sc.PlaceOrder(ctx, toJSON(t, sampleOrderInput("order-bad", "listing-farm")))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "FORBIDDEN")
}

func TestPlaceOrder_ExceedsAvailableQuantity(t *testing.T) {
	sc := &trade.SmartContract{}
	fCtx, bCtx := withSharedStub(t, "FarmersMSP", "farmer-002", "BuyersMSP", "buyer-002")

	_, err := sc.CreateListing(fCtx, toJSON(t, sampleListingInput("listing-qty")))
	require.NoError(t, err)

	input := sampleOrderInput("order-over", "listing-qty")
	input["quantity"] = 999.0 // listing only has 100
	_, err = sc.PlaceOrder(bCtx, toJSON(t, input))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "VALIDATION")
}

func TestPlaceOrder_InactiveListing(t *testing.T) {
	sc := &trade.SmartContract{}
	fCtx, bCtx := withSharedStub(t, "FarmersMSP", "farmer-003", "BuyersMSP", "buyer-003")

	_, err := sc.CreateListing(fCtx, toJSON(t, sampleListingInput("listing-inactive")))
	require.NoError(t, err)
	err = sc.CancelListing(fCtx, "listing-inactive")
	require.NoError(t, err)

	_, err = sc.PlaceOrder(bCtx, toJSON(t, sampleOrderInput("order-bad2", "listing-inactive")))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "INVALID_STATE")
}

// ── Order lifecycle ───────────────────────────────────────────────────────────

func TestOrderLifecycle_FullHappyPath(t *testing.T) {
	sc := &trade.SmartContract{}
	fCtx, bCtx := withSharedStub(t, "FarmersMSP", "farmer-lc", "BuyersMSP", "buyer-lc")

	// Create listing
	_, err := sc.CreateListing(fCtx, toJSON(t, sampleListingInput("listing-lc")))
	require.NoError(t, err)

	// Place order
	order, err := sc.PlaceOrder(bCtx, toJSON(t, sampleOrderInput("order-lc", "listing-lc")))
	require.NoError(t, err)
	assert.Equal(t, trade.OrderPlaced, order.Status)

	// Farmer confirms
	order, err = sc.ConfirmOrder(fCtx, "order-lc")
	require.NoError(t, err)
	assert.Equal(t, trade.OrderConfirmed, order.Status)
	assert.NotEmpty(t, order.ConfirmedAt)

	// Escrow attached
	order, err = sc.AttachEscrow(fCtx, "order-lc", "escrow-001")
	require.NoError(t, err)
	assert.Equal(t, trade.OrderEscrowHeld, order.Status)
	assert.Equal(t, "escrow-001", order.EscrowID)

	// Mark in transit
	order, err = sc.MarkInTransit(fCtx, "order-lc", "shipment-001")
	require.NoError(t, err)
	assert.Equal(t, trade.OrderInTransit, order.Status)
	assert.Equal(t, "shipment-001", order.ShipmentID)

	// Buyer confirms delivery
	order, err = sc.ConfirmDelivery(bCtx, "order-lc")
	require.NoError(t, err)
	assert.Equal(t, trade.OrderDelivered, order.Status)

	// Complete order
	order, err = sc.CompleteOrder(fCtx, "order-lc")
	require.NoError(t, err)
	assert.Equal(t, trade.OrderCompleted, order.Status)
	assert.NotEmpty(t, order.CompletedAt)
}

func TestConfirmOrder_WrongFarmer(t *testing.T) {
	sc := &trade.SmartContract{}
	fCtx, bCtx := withSharedStub(t, "FarmersMSP", "farmer-A", "BuyersMSP", "buyer-A")

	_, err := sc.CreateListing(fCtx, toJSON(t, sampleListingInput("listing-wrong")))
	require.NoError(t, err)
	_, err = sc.PlaceOrder(bCtx, toJSON(t, sampleOrderInput("order-wrong", "listing-wrong")))
	require.NoError(t, err)

	// buyer tries to confirm the order — should fail
	_, err = sc.ConfirmOrder(bCtx, "order-wrong")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "FORBIDDEN")
}

func TestDisputeOrder_Success(t *testing.T) {
	sc := &trade.SmartContract{}
	fCtx, bCtx := withSharedStub(t, "FarmersMSP", "farmer-d", "BuyersMSP", "buyer-d")

	_, err := sc.CreateListing(fCtx, toJSON(t, sampleListingInput("listing-dispute")))
	require.NoError(t, err)
	_, err = sc.PlaceOrder(bCtx, toJSON(t, sampleOrderInput("order-dispute", "listing-dispute")))
	require.NoError(t, err)
	_, err = sc.ConfirmOrder(fCtx, "order-dispute")
	require.NoError(t, err)
	_, err = sc.AttachEscrow(fCtx, "order-dispute", "escrow-d")
	require.NoError(t, err)

	order, err := sc.DisputeOrder(bCtx, "order-dispute")
	require.NoError(t, err)
	assert.Equal(t, trade.OrderDisputed, order.Status)
}

// ── QueryOrdersByBuyer ────────────────────────────────────────────────────────

func TestGetOrderHistory_Empty(t *testing.T) {
	sc := &trade.SmartContract{}
	fCtx, bCtx := withSharedStub(t, "FarmersMSP", "farmer-hist", "BuyersMSP", "buyer-hist")

	_, err := sc.CreateListing(fCtx, toJSON(t, sampleListingInput("listing-hist")))
	require.NoError(t, err)
	_, err = sc.PlaceOrder(bCtx, toJSON(t, sampleOrderInput("order-hist", "listing-hist")))
	require.NoError(t, err)

	// shimtest does not implement GetHistoryForKey — skip if unsupported.
	history, err := sc.GetOrderHistory(bCtx, "order-hist")
	if err != nil && strings.Contains(err.Error(), "not implemented") {
		t.Skip("shimtest does not implement GetHistoryForKey")
	}
	assert.NoError(t, err)
	_ = history
}
