// Package supplychain implements the AgriTrade SupplyChainContract chaincode.
//
// Responsibilities:
//   - Record immutable supply-chain events from farm to buyer
//   - Event types: HARVEST → GRADING → PACKAGING → COLD_STORAGE → DISPATCH → CHECKPOINT → DELIVERY
//   - Each event is signed by the recording actor's MSP certificate
//   - Rich history queries for full farm-to-fork provenance
package supplychain

import (
	"encoding/json"
	"fmt"

	"github.com/agritrade/chaincode/common"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

const DocTypeEvent = "SUPPLY_EVENT"

// EventType enumerates the supported supply-chain event kinds.
type EventType string

const (
	EventHarvest     EventType = "HARVEST"
	EventGrading     EventType = "GRADING"
	EventPackaging   EventType = "PACKAGING"
	EventColdStorage EventType = "COLD_STORAGE"
	EventDispatch    EventType = "DISPATCH"
	EventCheckpoint  EventType = "CHECKPOINT"
	EventDelivery    EventType = "DELIVERY"
	EventInspection  EventType = "INSPECTION"
	EventRecall      EventType = "RECALL"
)

// ActorType classifies who recorded the event.
type ActorType string

const (
	ActorFarmer     ActorType = "FARMER"
	ActorLogistics  ActorType = "LOGISTICS"
	ActorInspector  ActorType = "INSPECTOR"
	ActorWarehouse  ActorType = "WAREHOUSE"
	ActorBuyer      ActorType = "BUYER"
)

// GeoLocation enriches an event with GPS coordinates.
type GeoLocation struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Address   string  `json:"address,omitempty"`
	Altitude  float64 `json:"altitude,omitempty"` // metres above sea level
}

// IoTReadings holds sensor data attached to a supply-chain event.
type IoTReadings struct {
	Temperature float64 `json:"temperature,omitempty"` // °C
	Humidity    float64 `json:"humidity,omitempty"`    // %
	CO2Level    float64 `json:"co2Level,omitempty"`    // ppm
	LightLevel  float64 `json:"lightLevel,omitempty"`  // lux
	Vibration   float64 `json:"vibration,omitempty"`   // g
}

// SupplyChainEvent is an immutable ledger record of one point in the supply chain.
type SupplyChainEvent struct {
	DocType      string      `json:"docType"`
	ID           string      `json:"id"`
	ListingID    string      `json:"listingId"`
	OrderID      string      `json:"orderId,omitempty"`
	EventType    EventType   `json:"eventType"`
	ActorID      string      `json:"actorId"`
	ActorMSP     string      `json:"actorMsp"`
	ActorType    ActorType   `json:"actorType"`
	Location     GeoLocation `json:"location"`
	IoT          IoTReadings `json:"iot,omitempty"`
	// DocumentHash is the SHA-256 of any attached certificate/inspection report
	DocumentHash string      `json:"documentHash,omitempty"`
	// BatchNumber links this event to a physical produce batch
	BatchNumber  string      `json:"batchNumber,omitempty"`
	Notes        string      `json:"notes,omitempty"`
	TxID         string      `json:"txId"`
	Timestamp    string      `json:"timestamp"`
}

// SupplyChainSummary aggregates events for a listing's provenance report.
type SupplyChainSummary struct {
	ListingID   string              `json:"listingId"`
	TotalEvents int                 `json:"totalEvents"`
	Events      []*SupplyChainEvent `json:"events"`
	Verified    bool                `json:"verified"` // true when all mandatory event types are present
}

// SmartContract implements supply-chain provenance on AgriTrade.
type SmartContract struct {
	contractapi.Contract
}

// RecordEvent records a new supply-chain event. The caller's MSP and identity
// are captured from the transaction certificate — no explicit actorId input required.
func (s *SmartContract) RecordEvent(
	ctx contractapi.TransactionContextInterface,
	eventJSON string,
) (*SupplyChainEvent, error) {
	// All three orgs may record events; the ActorType must match the caller's MSP
	if err := common.AssertAnyMSP(ctx, "FarmersMSP", "BuyersMSP", "LogisticsMSP"); err != nil {
		return nil, err
	}

	var input struct {
		ID           string      `json:"id"`
		ListingID    string      `json:"listingId"`
		OrderID      string      `json:"orderId"`
		EventType    EventType   `json:"eventType"`
		ActorType    ActorType   `json:"actorType"`
		Location     GeoLocation `json:"location"`
		IoT          IoTReadings `json:"iot"`
		DocumentHash string      `json:"documentHash"`
		BatchNumber  string      `json:"batchNumber"`
		Notes        string      `json:"notes"`
	}
	if err := json.Unmarshal([]byte(eventJSON), &input); err != nil {
		return nil, common.NewValidationError("invalid event JSON: " + err.Error())
	}
	if input.ID == "" || input.ListingID == "" || input.EventType == "" {
		return nil, common.NewValidationError("id, listingId, and eventType are required")
	}
	if err := s.validateEventType(input.EventType); err != nil {
		return nil, err
	}

	key := common.BuildKey(DocTypeEvent, input.ID)
	if exists, err := common.StateExists(ctx, key); err != nil {
		return nil, err
	} else if exists {
		return nil, common.NewConflictError(fmt.Sprintf("supply event '%s' already exists", input.ID))
	}

	// Validate MSP-to-ActorType pairing
	mspID, err := common.GetMSPID(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.validateActorMSP(mspID, input.ActorType); err != nil {
		return nil, err
	}

	actorID, err := common.GetClientID(ctx)
	if err != nil {
		return nil, err
	}

	now := common.GetTimestamp(ctx)
	evt := &SupplyChainEvent{
		DocType:      DocTypeEvent,
		ID:           input.ID,
		ListingID:    input.ListingID,
		OrderID:      input.OrderID,
		EventType:    input.EventType,
		ActorID:      actorID,
		ActorMSP:     mspID,
		ActorType:    input.ActorType,
		Location:     input.Location,
		IoT:          input.IoT,
		DocumentHash: input.DocumentHash,
		BatchNumber:  input.BatchNumber,
		Notes:        input.Notes,
		TxID:         ctx.GetStub().GetTxID(),
		Timestamp:    now,
	}

	if err := common.PutJSON(ctx, key, evt); err != nil {
		return nil, err
	}

	_ = common.EmitEvent(ctx, "SupplyChainEvent", common.Event{
		EventType:  "SUPPLY_CHAIN_EVENT",
		EntityID:   input.ID,
		EntityType: DocTypeEvent,
		ActorID:    actorID,
		ActorMSP:   mspID,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  now,
		Metadata: map[string]string{
			"listingId": input.ListingID,
			"eventType": string(input.EventType),
			"actorType": string(input.ActorType),
		},
	})

	return evt, nil
}

// GetEvent retrieves a single supply-chain event by ID.
func (s *SmartContract) GetEvent(
	ctx contractapi.TransactionContextInterface,
	eventID string,
) (*SupplyChainEvent, error) {
	key := common.BuildKey(DocTypeEvent, eventID)
	b, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, common.NewInternalError("failed to read event state: " + err.Error())
	}
	if b == nil {
		return nil, common.NewNotFoundError(fmt.Sprintf("supply event '%s' not found", eventID))
	}

	var evt SupplyChainEvent
	if err := json.Unmarshal(b, &evt); err != nil {
		return nil, common.NewInternalError("failed to unmarshal event")
	}
	return &evt, nil
}

// GetSupplyChainHistory returns all recorded supply-chain events for a listing,
// sorted by blockchain timestamp, forming the provenance trail.
func (s *SmartContract) GetSupplyChainHistory(
	ctx contractapi.TransactionContextInterface,
	listingID string,
) (*SupplyChainSummary, error) {
	query := fmt.Sprintf(
		`{"selector":{"docType":"%s","listingId":"%s"},"sort":[{"timestamp":"asc"}]}`,
		DocTypeEvent, listingID,
	)
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, common.NewInternalError("history query failed: " + err.Error())
	}
	defer iter.Close()

	var events []*SupplyChainEvent
	for iter.HasNext() {
		res, err := iter.Next()
		if err != nil {
			return nil, common.NewInternalError("iterator error: " + err.Error())
		}
		var evt SupplyChainEvent
		if json.Unmarshal(res.Value, &evt) == nil {
			events = append(events, &evt)
		}
	}

	return &SupplyChainSummary{
		ListingID:   listingID,
		TotalEvents: len(events),
		Events:      events,
		Verified:    s.isChainComplete(events),
	}, nil
}

// GetSupplyChainByOrder returns all supply-chain events linked to a specific order.
func (s *SmartContract) GetSupplyChainByOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) ([]*SupplyChainEvent, error) {
	query := fmt.Sprintf(
		`{"selector":{"docType":"%s","orderId":"%s"},"sort":[{"timestamp":"asc"}]}`,
		DocTypeEvent, orderID,
	)
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, common.NewInternalError("order supply-chain query failed: " + err.Error())
	}
	defer iter.Close()

	var events []*SupplyChainEvent
	for iter.HasNext() {
		res, err := iter.Next()
		if err != nil {
			return nil, common.NewInternalError("iterator error: " + err.Error())
		}
		var evt SupplyChainEvent
		if json.Unmarshal(res.Value, &evt) == nil {
			events = append(events, &evt)
		}
	}
	return events, nil
}

// VerifySupplyChain checks whether the mandatory event sequence for a listing
// is complete (HARVEST → DISPATCH → DELIVERY). Returns a boolean result and
// a list of missing event types.
func (s *SmartContract) VerifySupplyChain(
	ctx contractapi.TransactionContextInterface,
	listingID string,
) (string, error) {
	summary, err := s.GetSupplyChainHistory(ctx, listingID)
	if err != nil {
		return "", err
	}

	seen := make(map[EventType]bool)
	for _, evt := range summary.Events {
		seen[evt.EventType] = true
	}

	mandatory := []EventType{EventHarvest, EventDispatch, EventDelivery}
	var missing []string
	for _, et := range mandatory {
		if !seen[et] {
			missing = append(missing, string(et))
		}
	}

	result := struct {
		ListingID   string   `json:"listingId"`
		Verified    bool     `json:"verified"`
		TotalEvents int      `json:"totalEvents"`
		Missing     []string `json:"missing"`
	}{
		ListingID:   listingID,
		Verified:    len(missing) == 0,
		TotalEvents: summary.TotalEvents,
		Missing:     missing,
	}

	b, err := json.Marshal(result)
	if err != nil {
		return "", common.NewInternalError("failed to marshal verification result")
	}
	return string(b), nil
}

// GetEventLedgerHistory returns the raw Fabric ledger history for an event record.
func (s *SmartContract) GetEventLedgerHistory(
	ctx contractapi.TransactionContextInterface,
	eventID string,
) ([]*common.HistoryRecord, error) {
	return common.GetHistory(ctx, common.BuildKey(DocTypeEvent, eventID))
}

// ── Private helpers ───────────────────────────────────────────────────────────

func (s *SmartContract) validateEventType(et EventType) error {
	valid := map[EventType]bool{
		EventHarvest: true, EventGrading: true, EventPackaging: true,
		EventColdStorage: true, EventDispatch: true, EventCheckpoint: true,
		EventDelivery: true, EventInspection: true, EventRecall: true,
	}
	if !valid[et] {
		return common.NewValidationError(fmt.Sprintf("unknown event type '%s'", et))
	}
	return nil
}

// validateActorMSP enforces that the calling MSP is consistent with the declared actorType.
func (s *SmartContract) validateActorMSP(mspID string, actorType ActorType) error {
	allowed := map[string][]ActorType{
		"FarmersMSP":   {ActorFarmer, ActorInspector},
		"BuyersMSP":    {ActorBuyer, ActorInspector},
		"LogisticsMSP": {ActorLogistics, ActorWarehouse, ActorInspector},
	}
	for _, at := range allowed[mspID] {
		if at == actorType {
			return nil
		}
	}
	return common.NewForbiddenError(
		fmt.Sprintf("MSP '%s' is not permitted to record actor type '%s'", mspID, actorType),
	)
}

// isChainComplete returns true when at least the three mandatory event types are present.
func (s *SmartContract) isChainComplete(events []*SupplyChainEvent) bool {
	seen := make(map[EventType]bool)
	for _, e := range events {
		seen[e.EventType] = true
	}
	return seen[EventHarvest] && seen[EventDispatch] && seen[EventDelivery]
}
