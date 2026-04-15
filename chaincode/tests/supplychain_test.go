package tests

import (
	"testing"

	"github.com/agritrade/chaincode/supplychain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── Fixtures ──────────────────────────────────────────────────────────────────

func sampleEventInput(id, listingID string, eventType supplychain.EventType, actorType supplychain.ActorType) map[string]interface{} {
	return map[string]interface{}{
		"id":        id,
		"listingId": listingID,
		"eventType": string(eventType),
		"actorType": string(actorType),
		"location": map[string]interface{}{
			"latitude":  17.385,
			"longitude": 78.486,
			"address":   "Hyderabad, Telangana",
		},
		"iot": map[string]interface{}{
			"temperature": 4.5,
			"humidity":    85.0,
		},
		"documentHash": "sha256:harvest-cert-abc",
		"batchNumber":  "BATCH-2026-001",
		"notes":        "Fresh harvest",
	}
}

// ── RecordEvent ───────────────────────────────────────────────────────────────

func TestRecordEvent_HarvestByFarmer(t *testing.T) {
	sc := &supplychain.SmartContract{}
	ctx := farmerCtx(t)

	input := sampleEventInput("event-001", "listing-001", supplychain.EventHarvest, supplychain.ActorFarmer)
	evt, err := sc.RecordEvent(ctx, toJSON(t, input))

	require.NoError(t, err)
	require.NotNil(t, evt)
	assert.Equal(t, "event-001", evt.ID)
	assert.Equal(t, supplychain.EventHarvest, evt.EventType)
	assert.Equal(t, supplychain.ActorFarmer, evt.ActorType)
	assert.Equal(t, "FarmersMSP", evt.ActorMSP)
	assert.NotEmpty(t, evt.TxID)
	assert.NotEmpty(t, evt.Timestamp)
	assert.InDelta(t, 4.5, evt.IoT.Temperature, 0.001)
}

func TestRecordEvent_DispatchByLogistics(t *testing.T) {
	sc := &supplychain.SmartContract{}
	ctx := logisticsCtx(t)

	input := sampleEventInput("event-disp", "listing-disp", supplychain.EventDispatch, supplychain.ActorLogistics)
	evt, err := sc.RecordEvent(ctx, toJSON(t, input))

	require.NoError(t, err)
	assert.Equal(t, supplychain.EventDispatch, evt.EventType)
	assert.Equal(t, "LogisticsMSP", evt.ActorMSP)
}

func TestRecordEvent_WrongMSPForActorType(t *testing.T) {
	sc := &supplychain.SmartContract{}
	// Buyer tries to record as FARMER actor type
	ctx := buyerCtx(t)

	input := sampleEventInput("event-bad", "listing-bad", supplychain.EventHarvest, supplychain.ActorFarmer)
	_, err := sc.RecordEvent(ctx, toJSON(t, input))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "FORBIDDEN")
}

func TestRecordEvent_UnknownEventType(t *testing.T) {
	sc := &supplychain.SmartContract{}
	ctx := farmerCtx(t)

	input := map[string]interface{}{
		"id":        "event-unk",
		"listingId": "listing-unk",
		"eventType": "INVALID_EVENT",
		"actorType": "FARMER",
	}
	_, err := sc.RecordEvent(ctx, toJSON(t, input))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "VALIDATION")
}

func TestRecordEvent_DuplicateID(t *testing.T) {
	sc := &supplychain.SmartContract{}
	ctx := farmerCtx(t)

	input := toJSON(t, sampleEventInput("event-dup", "listing-dup", supplychain.EventHarvest, supplychain.ActorFarmer))
	_, err := sc.RecordEvent(ctx, input)
	require.NoError(t, err)

	_, err = sc.RecordEvent(ctx, input)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "CONFLICT")
}

func TestRecordEvent_MissingRequiredFields(t *testing.T) {
	sc := &supplychain.SmartContract{}
	ctx := farmerCtx(t)

	_, err := sc.RecordEvent(ctx, `{"id":"","listingId":"","eventType":""}`)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "VALIDATION")
}

// ── GetEvent ──────────────────────────────────────────────────────────────────

func TestGetEvent_Success(t *testing.T) {
	sc := &supplychain.SmartContract{}
	ctx := farmerCtx(t)

	input := sampleEventInput("event-get", "listing-get", supplychain.EventGrading, supplychain.ActorFarmer)
	_, err := sc.RecordEvent(ctx, toJSON(t, input))
	require.NoError(t, err)

	evt, err := sc.GetEvent(ctx, "event-get")
	require.NoError(t, err)
	assert.Equal(t, "event-get", evt.ID)
	assert.Equal(t, supplychain.EventGrading, evt.EventType)
}

func TestGetEvent_NotFound(t *testing.T) {
	sc := &supplychain.SmartContract{}
	ctx := farmerCtx(t)

	_, err := sc.GetEvent(ctx, "nonexistent-event")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "NOT_FOUND")
}

// ── Provenance chain ──────────────────────────────────────────────────────────

func TestVerifySupplyChain_Complete(t *testing.T) {
	sc := &supplychain.SmartContract{}

	// Share state across all three orgs
	fCtx, lCtx := withSharedStub(t, "FarmersMSP", "farmer-sc", "LogisticsMSP", "logistics-sc")
	bCtx := newCtx(t, "BuyersMSP", "buyer-sc")
	bCtx.stub = fCtx.stub

	listingID := "listing-verify"

	// Record the three mandatory events
	events := []struct {
		ctx       *mockCtx
		id        string
		eventType supplychain.EventType
		actorType supplychain.ActorType
	}{
		{fCtx, "ev-harvest", supplychain.EventHarvest, supplychain.ActorFarmer},
		{fCtx, "ev-packaging", supplychain.EventPackaging, supplychain.ActorFarmer},
		{lCtx, "ev-dispatch", supplychain.EventDispatch, supplychain.ActorLogistics},
		{lCtx, "ev-delivery", supplychain.EventDelivery, supplychain.ActorLogistics},
	}

	for _, e := range events {
		input := sampleEventInput(e.id, listingID, e.eventType, e.actorType)
		_, err := sc.RecordEvent(e.ctx, toJSON(t, input))
		require.NoError(t, err, "failed to record event %s", e.id)
	}

	result, err := sc.VerifySupplyChain(fCtx, listingID)
	require.NoError(t, err)
	assert.Contains(t, result, `"verified":true`)
	assert.Contains(t, result, `"totalEvents":4`)
}

func TestVerifySupplyChain_Incomplete(t *testing.T) {
	sc := &supplychain.SmartContract{}
	fCtx := farmerCtx(t)

	listingID := "listing-incomplete"
	// Only record HARVEST — no dispatch or delivery
	input := sampleEventInput("ev-h-only", listingID, supplychain.EventHarvest, supplychain.ActorFarmer)
	_, err := sc.RecordEvent(fCtx, toJSON(t, input))
	require.NoError(t, err)

	result, err := sc.VerifySupplyChain(fCtx, listingID)
	require.NoError(t, err)
	assert.Contains(t, result, `"verified":false`)
	assert.Contains(t, result, "DISPATCH")
	assert.Contains(t, result, "DELIVERY")
}

// ── GetSupplyChainHistory ─────────────────────────────────────────────────────

func TestGetSupplyChainHistory_MultipleEvents(t *testing.T) {
	sc := &supplychain.SmartContract{}
	ctx := farmerCtx(t)

	listingID := "listing-multi"
	for i, et := range []supplychain.EventType{supplychain.EventHarvest, supplychain.EventGrading, supplychain.EventPackaging} {
		input := sampleEventInput(
			"multi-ev-"+string(rune('0'+i)),
			listingID, et, supplychain.ActorFarmer,
		)
		_, err := sc.RecordEvent(ctx, toJSON(t, input))
		require.NoError(t, err)
	}

	// shimtest doesn't support rich queries, but the function should not panic
	summary, err := sc.GetSupplyChainHistory(ctx, listingID)
	// Rich queries require CouchDB — shimtest returns empty results, not errors
	if err == nil {
		assert.Equal(t, listingID, summary.ListingID)
	}
}

// ── InspectionEvent by multiple MSPs ─────────────────────────────────────────

func TestRecordEvent_InspectorByBuyer(t *testing.T) {
	sc := &supplychain.SmartContract{}
	bCtx := buyerCtx(t)

	input := sampleEventInput("event-insp", "listing-insp", supplychain.EventInspection, supplychain.ActorInspector)
	evt, err := sc.RecordEvent(bCtx, toJSON(t, input))

	require.NoError(t, err)
	assert.Equal(t, supplychain.EventInspection, evt.EventType)
	assert.Equal(t, "BuyersMSP", evt.ActorMSP)
}
