package tests

import (
	"testing"

	"github.com/agritrade/chaincode/logistics"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── Fixtures ──────────────────────────────────────────────────────────────────

func sampleShipmentInput(id, orderID string) map[string]interface{} {
	return map[string]interface{}{
		"id":            id,
		"orderId":       orderID,
		"thirdPartyRef": "DELHIVERY-" + id,
		"cargoType":     "COLD_CHAIN",
		"weightKg":      50.0,
		"volumeM3":      0.5,
		"origin": map[string]interface{}{
			"latitude":  16.994,
			"longitude": 73.300,
			"accuracy":  5.0,
			"timestamp": "",
		},
		"destination": map[string]interface{}{
			"latitude":  19.076,
			"longitude": 72.877,
			"accuracy":  5.0,
			"timestamp": "",
		},
		"tempBreachThreshold": 8.0,
		"estimatedDelivery":   "2026-04-20T12:00:00Z",
	}
}

// ── CreateShipment ────────────────────────────────────────────────────────────

func TestCreateShipment_Success(t *testing.T) {
	sc := &logistics.SmartContract{}
	ctx := logisticsCtx(t)

	sh, err := sc.CreateShipment(ctx, toJSON(t, sampleShipmentInput("ship-001", "order-001")))

	require.NoError(t, err)
	require.NotNil(t, sh)
	assert.Equal(t, "ship-001", sh.ID)
	assert.Equal(t, "order-001", sh.OrderID)
	assert.Equal(t, logistics.ShipmentCreated, sh.Status)
	assert.Equal(t, logistics.CargoColdChain, sh.CargoType)
	assert.Equal(t, float64(50), sh.WeightKg)
	assert.Equal(t, float64(8), sh.TempBreachThreshold)
	assert.Equal(t, "LogisticsMSP", sh.LogisticsMSP)
	assert.NotEmpty(t, sh.TxID)
	assert.NotEmpty(t, sh.CreatedAt)
}

func TestCreateShipment_WrongMSP(t *testing.T) {
	sc := &logistics.SmartContract{}
	ctx := farmerCtx(t) // farmers cannot create shipments

	_, err := sc.CreateShipment(ctx, toJSON(t, sampleShipmentInput("ship-bad", "order-bad")))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "FORBIDDEN")
}

func TestCreateShipment_Duplicate(t *testing.T) {
	sc := &logistics.SmartContract{}
	ctx := logisticsCtx(t)
	input := toJSON(t, sampleShipmentInput("ship-dup", "order-dup"))

	_, err := sc.CreateShipment(ctx, input)
	require.NoError(t, err)

	_, err = sc.CreateShipment(ctx, input)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "CONFLICT")
}

func TestCreateShipment_ZeroWeight(t *testing.T) {
	sc := &logistics.SmartContract{}
	ctx := logisticsCtx(t)

	input := sampleShipmentInput("ship-zero", "order-zero")
	input["weightKg"] = 0.0
	_, err := sc.CreateShipment(ctx, toJSON(t, input))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "VALIDATION")
}

func TestCreateShipment_InvalidCargoType(t *testing.T) {
	sc := &logistics.SmartContract{}
	ctx := logisticsCtx(t)

	input := sampleShipmentInput("ship-cargo", "order-cargo")
	input["cargoType"] = "INVALID_CARGO"
	_, err := sc.CreateShipment(ctx, toJSON(t, input))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "VALIDATION")
}

// ── GetShipment ───────────────────────────────────────────────────────────────

func TestGetShipment_NotFound(t *testing.T) {
	sc := &logistics.SmartContract{}
	ctx := logisticsCtx(t)

	_, err := sc.GetShipment(ctx, "nonexistent")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "NOT_FOUND")
}

// ── UpdateLocation ────────────────────────────────────────────────────────────

func TestUpdateLocation_Success(t *testing.T) {
	sc := &logistics.SmartContract{}
	ctx := logisticsCtx(t)

	_, err := sc.CreateShipment(ctx, toJSON(t, sampleShipmentInput("ship-loc", "order-loc")))
	require.NoError(t, err)

	locInput := map[string]interface{}{
		"latitude":  18.520,
		"longitude": 73.856,
		"accuracy":  10.0,
	}
	sh, err := sc.UpdateLocation(ctx, "ship-loc", toJSON(t, locInput))

	require.NoError(t, err)
	assert.InDelta(t, 18.520, sh.CurrentLocation.Latitude, 0.001)
	// First location update should advance status to PICKED_UP
	assert.Equal(t, logistics.ShipmentPickedUp, sh.Status)
	// Previous location should be in route history
	assert.Len(t, sh.Route, 1)
}

func TestUpdateLocation_WrongProvider(t *testing.T) {
	sc := &logistics.SmartContract{}
	lCtx1 := logisticsCtx(t)
	lCtx2 := newCtx(t, "LogisticsMSP", "different-provider-999")
	lCtx2.stub = lCtx1.stub

	_, err := sc.CreateShipment(lCtx1, toJSON(t, sampleShipmentInput("ship-prov", "order-prov")))
	require.NoError(t, err)

	_, err = sc.UpdateLocation(lCtx2, "ship-prov", `{"latitude":18.5,"longitude":73.8}`)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "FORBIDDEN")
}

func TestUpdateLocation_DeliveredShipment(t *testing.T) {
	sc := &logistics.SmartContract{}
	lCtx, bCtx := withSharedStub(t, "LogisticsMSP", "logistics-del", "BuyersMSP", "buyer-del")

	_, err := sc.CreateShipment(lCtx, toJSON(t, sampleShipmentInput("ship-del", "order-del")))
	require.NoError(t, err)

	// Advance to delivered
	_, _ = sc.UpdateLocation(lCtx, "ship-del", `{"latitude":19.0,"longitude":72.8}`)
	_, _ = sc.UpdateStatus(lCtx, "ship-del", string(logistics.ShipmentInTransit))
	_, _ = sc.UpdateStatus(lCtx, "ship-del", string(logistics.ShipmentOutForDelivery))
	_, _ = sc.ConfirmDelivery(lCtx, "ship-del", "proof-hash-abc")

	// Now trying to update location should fail
	_, err = sc.UpdateLocation(lCtx, "ship-del", `{"latitude":0,"longitude":0}`)
	require.Error(t, err)
	_ = bCtx // used for setup context
	assert.Contains(t, err.Error(), "INVALID_STATE")
}

// ── RecordIoT ─────────────────────────────────────────────────────────────────

func TestRecordIoT_NormalReading(t *testing.T) {
	sc := &logistics.SmartContract{}
	ctx := logisticsCtx(t)

	_, err := sc.CreateShipment(ctx, toJSON(t, sampleShipmentInput("ship-iot", "order-iot")))
	require.NoError(t, err)
	_, err = sc.UpdateLocation(ctx, "ship-iot", `{"latitude":18.0,"longitude":73.5}`)
	require.NoError(t, err)

	iotInput := map[string]interface{}{
		"temperature": 5.5,  // within threshold of 8.0
		"humidity":    82.0,
		"deviceId":    "iot-sensor-001",
	}
	sh, err := sc.RecordIoT(ctx, "ship-iot", toJSON(t, iotInput))

	require.NoError(t, err)
	assert.InDelta(t, 5.5, sh.LatestIoT.Temperature, 0.001)
	assert.Equal(t, 0, sh.TempBreachCount) // no breach
}

func TestRecordIoT_TemperatureBreach(t *testing.T) {
	sc := &logistics.SmartContract{}
	ctx := logisticsCtx(t)

	_, err := sc.CreateShipment(ctx, toJSON(t, sampleShipmentInput("ship-breach", "order-breach")))
	require.NoError(t, err)
	_, err = sc.UpdateLocation(ctx, "ship-breach", `{"latitude":18.0,"longitude":73.5}`)
	require.NoError(t, err)

	iotInput := map[string]interface{}{
		"temperature": 12.0, // exceeds threshold of 8.0°C
		"humidity":    75.0,
	}
	sh, err := sc.RecordIoT(ctx, "ship-breach", toJSON(t, iotInput))

	require.NoError(t, err)
	assert.Equal(t, 1, sh.TempBreachCount)
}

// ── UpdateStatus ─────────────────────────────────────────────────────────────

func TestUpdateStatus_ValidTransitions(t *testing.T) {
	sc := &logistics.SmartContract{}
	ctx := logisticsCtx(t)

	_, err := sc.CreateShipment(ctx, toJSON(t, sampleShipmentInput("ship-trans", "order-trans")))
	require.NoError(t, err)

	transitions := []logistics.ShipmentStatus{
		logistics.ShipmentPickedUp,
		logistics.ShipmentInTransit,
		logistics.ShipmentOutForDelivery,
	}

	// First do a location update to auto-advance to PICKED_UP
	_, err = sc.UpdateLocation(ctx, "ship-trans", `{"latitude":17.0,"longitude":74.0}`)
	require.NoError(t, err)

	for _, next := range transitions[1:] { // skip PICKED_UP (already done)
		sh, err := sc.UpdateStatus(ctx, "ship-trans", string(next))
		require.NoError(t, err, "transition to %s failed", next)
		assert.Equal(t, next, sh.Status)
	}
}

func TestUpdateStatus_InvalidTransition(t *testing.T) {
	sc := &logistics.SmartContract{}
	ctx := logisticsCtx(t)

	_, err := sc.CreateShipment(ctx, toJSON(t, sampleShipmentInput("ship-inv", "order-inv")))
	require.NoError(t, err)

	// Jump from CREATED directly to DELIVERED — not allowed
	_, err = sc.UpdateStatus(ctx, "ship-inv", string(logistics.ShipmentDelivered))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "INVALID_STATE")
}

// ── ConfirmDelivery ───────────────────────────────────────────────────────────

func TestConfirmDelivery_Success(t *testing.T) {
	sc := &logistics.SmartContract{}
	lCtx, bCtx := withSharedStub(t, "LogisticsMSP", "logi-del2", "BuyersMSP", "buy-del2")

	_, err := sc.CreateShipment(lCtx, toJSON(t, sampleShipmentInput("ship-cd", "order-cd")))
	require.NoError(t, err)

	_, err = sc.UpdateLocation(lCtx, "ship-cd", `{"latitude":19.0,"longitude":72.8}`)
	require.NoError(t, err)
	_, err = sc.UpdateStatus(lCtx, "ship-cd", string(logistics.ShipmentInTransit))
	require.NoError(t, err)
	_, err = sc.UpdateStatus(lCtx, "ship-cd", string(logistics.ShipmentOutForDelivery))
	require.NoError(t, err)

	sh, err := sc.ConfirmDelivery(bCtx, "ship-cd", "sha256:delivery-proof")
	require.NoError(t, err)
	assert.Equal(t, logistics.ShipmentDelivered, sh.Status)
	assert.Equal(t, "sha256:delivery-proof", sh.DeliveryProofHash)
	assert.NotEmpty(t, sh.ActualDelivery)
}

// ── ReportDamage ──────────────────────────────────────────────────────────────

func TestReportDamage_Success(t *testing.T) {
	sc := &logistics.SmartContract{}
	ctx := logisticsCtx(t)

	_, err := sc.CreateShipment(ctx, toJSON(t, sampleShipmentInput("ship-dmg", "order-dmg")))
	require.NoError(t, err)
	_, err = sc.UpdateLocation(ctx, "ship-dmg", `{"latitude":18.0,"longitude":73.5}`)
	require.NoError(t, err)

	sh, err := sc.ReportDamage(ctx, "ship-dmg", "Cold chain broken — crates crushed")
	require.NoError(t, err)
	assert.Equal(t, logistics.ShipmentDamaged, sh.Status)
	assert.Equal(t, "Cold chain broken — crates crushed", sh.DamageNotes)
}

func TestReportDamage_AlreadyDelivered(t *testing.T) {
	sc := &logistics.SmartContract{}
	lCtx, bCtx := withSharedStub(t, "LogisticsMSP", "logi-dmg2", "BuyersMSP", "buy-dmg2")

	_, err := sc.CreateShipment(lCtx, toJSON(t, sampleShipmentInput("ship-dmg2", "order-dmg2")))
	require.NoError(t, err)
	_, err = sc.UpdateLocation(lCtx, "ship-dmg2", `{"latitude":19.0,"longitude":72.8}`)
	require.NoError(t, err)
	_, err = sc.UpdateStatus(lCtx, "ship-dmg2", string(logistics.ShipmentInTransit))
	require.NoError(t, err)
	_, err = sc.UpdateStatus(lCtx, "ship-dmg2", string(logistics.ShipmentOutForDelivery))
	require.NoError(t, err)
	_, err = sc.ConfirmDelivery(bCtx, "ship-dmg2", "proof-hash")
	require.NoError(t, err)

	// Cannot report damage after delivery
	_, err = sc.ReportDamage(lCtx, "ship-dmg2", "late damage report")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "INVALID_STATE")
}
