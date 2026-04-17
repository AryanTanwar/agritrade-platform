// Package logistics implements the AgriTrade LogisticsContract chaincode.
//
// Responsibilities:
//   - Create and manage shipment records linked to trade orders
//   - Track real-time GPS location updates
//   - Record IoT sensor readings (temperature, humidity — critical for cold-chain)
//   - Enforce state machine: CREATED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
//   - Support RETURNED and DAMAGED exception states
package logistics

import (
	"encoding/json"
	"fmt"

	"github.com/agritrade/chaincode/common"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

const DocTypeShipment = "SHIPMENT"

// ShipmentStatus enumerates the finite states of a shipment.
type ShipmentStatus string

const (
	ShipmentCreated         ShipmentStatus = "CREATED"
	ShipmentPickedUp        ShipmentStatus = "PICKED_UP"
	ShipmentInTransit       ShipmentStatus = "IN_TRANSIT"
	ShipmentOutForDelivery  ShipmentStatus = "OUT_FOR_DELIVERY"
	ShipmentDelivered       ShipmentStatus = "DELIVERED"
	ShipmentReturned        ShipmentStatus = "RETURNED"
	ShipmentDamaged         ShipmentStatus = "DAMAGED"
)

// CargoType classifies the produce for cold-chain compliance.
type CargoType string

const (
	CargoFresh       CargoType = "FRESH_PRODUCE"
	CargoColdChain   CargoType = "COLD_CHAIN"
	CargoDryCargo    CargoType = "DRY_CARGO"
	CargoLivestock   CargoType = "LIVESTOCK"
	CargoProcessed   CargoType = "PROCESSED_FOOD"
)

// GeoPoint holds a GPS coordinate snapshot.
type GeoPoint struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Accuracy  float64 `json:"accuracy,omitempty"` // metres
	Timestamp string  `json:"timestamp"`
}

// IoTSnapshot holds a timestamped sensor reading.
type IoTSnapshot struct {
	Temperature float64 `json:"temperature"` // °C
	Humidity    float64 `json:"humidity"`    // %
	Timestamp   string  `json:"timestamp"`
	DeviceID    string  `json:"deviceId,omitempty"`
}

// Shipment is the on-chain record for a physical shipment of agricultural produce.
type Shipment struct {
	DocType             string         `json:"docType"`
	ID                  string         `json:"id"`
	OrderID             string         `json:"orderId"`
	LogisticsProviderID string         `json:"logisticsProviderId"`
	LogisticsMSP        string         `json:"logisticsMsp"`
	// ThirdPartyRef is the external tracking number (e.g. Delhivery, Blue Dart)
	ThirdPartyRef       string         `json:"thirdPartyRef,omitempty"`
	CargoType           CargoType      `json:"cargoType"`
	WeightKg            float64        `json:"weightKg"`
	VolumeM3            float64        `json:"volumeM3,omitempty"`
	Origin              GeoPoint       `json:"origin"`
	Destination         GeoPoint       `json:"destination"`
	CurrentLocation     GeoPoint       `json:"currentLocation"`
	// Route is an ordered list of checkpoints
	Route               []GeoPoint     `json:"route,omitempty"`
	LatestIoT           IoTSnapshot    `json:"latestIoT,omitempty"`
	// TempBreaches records how many times temperature exceeded threshold
	TempBreachCount     int            `json:"tempBreachCount"`
	TempBreachThreshold float64        `json:"tempBreachThreshold,omitempty"` // °C max allowed
	Status              ShipmentStatus `json:"status"`
	EstimatedDelivery   string         `json:"estimatedDelivery,omitempty"`
	ActualDelivery      string         `json:"actualDelivery,omitempty"`
	// DeliveryProofHash is SHA-256 of the delivery photo/signature
	DeliveryProofHash   string         `json:"deliveryProofHash,omitempty"`
	DamageNotes         string         `json:"damageNotes,omitempty"`
	TxID                string         `json:"txId"`
	CreatedAt           string         `json:"createdAt"`
	UpdatedAt           string         `json:"updatedAt"`
}

// SmartContract manages logistics and shipment tracking for AgriTrade.
type SmartContract struct {
	contractapi.Contract
}

// CreateShipment registers a new shipment. Only LogisticsMSP clients may create shipments.
func (s *SmartContract) CreateShipment(
	ctx contractapi.TransactionContextInterface,
	shipmentJSON string,
) (*Shipment, error) {
	if err := common.AssertMSP(ctx, "LogisticsMSP"); err != nil {
		return nil, err
	}

	var input struct {
		ID                  string    `json:"id"`
		OrderID             string    `json:"orderId"`
		ThirdPartyRef       string    `json:"thirdPartyRef"`
		CargoType           CargoType `json:"cargoType"`
		WeightKg            float64   `json:"weightKg"`
		VolumeM3            float64   `json:"volumeM3"`
		Origin              GeoPoint  `json:"origin"`
		Destination         GeoPoint  `json:"destination"`
		TempBreachThreshold float64   `json:"tempBreachThreshold"`
		EstimatedDelivery   string    `json:"estimatedDelivery"`
	}
	if err := json.Unmarshal([]byte(shipmentJSON), &input); err != nil {
		return nil, common.NewValidationError("invalid shipment JSON: " + err.Error())
	}
	if input.ID == "" || input.OrderID == "" {
		return nil, common.NewValidationError("id and orderId are required")
	}
	if input.WeightKg <= 0 {
		return nil, common.NewValidationError("weightKg must be positive")
	}
	if err := s.validateCargoType(input.CargoType); err != nil {
		return nil, err
	}

	key := common.BuildKey(DocTypeShipment, input.ID)
	if exists, err := common.StateExists(ctx, key); err != nil {
		return nil, err
	} else if exists {
		return nil, common.NewConflictError(fmt.Sprintf("shipment '%s' already exists", input.ID))
	}

	providerID, err := common.GetClientID(ctx)
	if err != nil {
		return nil, err
	}
	providerMSP, err := common.GetMSPID(ctx)
	if err != nil {
		return nil, err
	}

	now := common.GetTimestamp(ctx)
	origin := input.Origin
	origin.Timestamp = now

	shipment := &Shipment{
		DocType:             DocTypeShipment,
		ID:                  input.ID,
		OrderID:             input.OrderID,
		LogisticsProviderID: providerID,
		LogisticsMSP:        providerMSP,
		ThirdPartyRef:       input.ThirdPartyRef,
		CargoType:           input.CargoType,
		WeightKg:            input.WeightKg,
		VolumeM3:            input.VolumeM3,
		Origin:              origin,
		Destination:         input.Destination,
		CurrentLocation:     origin,
		TempBreachThreshold: input.TempBreachThreshold,
		Status:              ShipmentCreated,
		EstimatedDelivery:   input.EstimatedDelivery,
		TxID:                ctx.GetStub().GetTxID(),
		CreatedAt:           now,
		UpdatedAt:           now,
	}

	if err := common.PutJSON(ctx, key, shipment); err != nil {
		return nil, err
	}

	_ = common.EmitEvent(ctx, "ShipmentCreated", common.Event{
		EventType:  "SHIPMENT_CREATED",
		EntityID:   input.ID,
		EntityType: DocTypeShipment,
		ActorID:    providerID,
		ActorMSP:   providerMSP,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  now,
		Metadata: map[string]string{
			"orderId":   input.OrderID,
			"cargoType": string(input.CargoType),
		},
	})

	return shipment, nil
}

// UpdateLocation records a new GPS checkpoint for the shipment.
// Only the logistics provider that owns the shipment may update it.
func (s *SmartContract) UpdateLocation(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
	locationJSON string,
) (*Shipment, error) {
	shipment, err := s.GetShipment(ctx, shipmentID)
	if err != nil {
		return nil, err
	}

	if err := s.assertProvider(ctx, shipment); err != nil {
		return nil, err
	}
	if shipment.Status == ShipmentDelivered || shipment.Status == ShipmentReturned {
		return nil, common.NewStateError(fmt.Sprintf("cannot update location for a shipment in status '%s'", shipment.Status))
	}

	var loc GeoPoint
	if err := json.Unmarshal([]byte(locationJSON), &loc); err != nil {
		return nil, common.NewValidationError("invalid location JSON: " + err.Error())
	}
	loc.Timestamp = common.GetTimestamp(ctx)

	// Append to route history
	shipment.Route = append(shipment.Route, shipment.CurrentLocation)
	shipment.CurrentLocation = loc
	shipment.UpdatedAt = common.GetTimestamp(ctx)
	shipment.TxID = ctx.GetStub().GetTxID()

	// Auto-advance status on first location update after creation
	if shipment.Status == ShipmentCreated {
		shipment.Status = ShipmentPickedUp
	}

	return s.saveShipment(ctx, shipment)
}

// RecordIoT records a temperature/humidity reading from an IoT device.
// Automatically flags temperature breaches against the configured threshold.
func (s *SmartContract) RecordIoT(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
	iotJSON string,
) (*Shipment, error) {
	shipment, err := s.GetShipment(ctx, shipmentID)
	if err != nil {
		return nil, err
	}

	if err := common.AssertMSP(ctx, "LogisticsMSP"); err != nil {
		return nil, err
	}
	active := map[ShipmentStatus]bool{
		ShipmentPickedUp: true, ShipmentInTransit: true, ShipmentOutForDelivery: true,
	}
	if !active[shipment.Status] {
		return nil, common.NewStateError(fmt.Sprintf("cannot record IoT for shipment in status '%s'", shipment.Status))
	}

	var reading IoTSnapshot
	if err := json.Unmarshal([]byte(iotJSON), &reading); err != nil {
		return nil, common.NewValidationError("invalid IoT JSON: " + err.Error())
	}
	reading.Timestamp = common.GetTimestamp(ctx)

	// Detect temperature breach
	if shipment.TempBreachThreshold > 0 && reading.Temperature > shipment.TempBreachThreshold {
		shipment.TempBreachCount++
		_ = common.EmitEvent(ctx, "TemperatureBreach", common.Event{
			EventType:  "TEMPERATURE_BREACH",
			EntityID:   shipmentID,
			EntityType: DocTypeShipment,
			TxID:       ctx.GetStub().GetTxID(),
			Timestamp:  reading.Timestamp,
			Metadata: map[string]string{
				"temperature": fmt.Sprintf("%.2f", reading.Temperature),
				"threshold":   fmt.Sprintf("%.2f", shipment.TempBreachThreshold),
				"breachCount": fmt.Sprintf("%d", shipment.TempBreachCount),
			},
		})
	}

	shipment.LatestIoT = reading
	shipment.UpdatedAt = reading.Timestamp
	shipment.TxID = ctx.GetStub().GetTxID()

	return s.saveShipment(ctx, shipment)
}

// UpdateStatus advances the shipment state machine.
func (s *SmartContract) UpdateStatus(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
	newStatus string,
) (*Shipment, error) {
	shipment, err := s.GetShipment(ctx, shipmentID)
	if err != nil {
		return nil, err
	}

	if err := s.assertProvider(ctx, shipment); err != nil {
		return nil, err
	}

	next := ShipmentStatus(newStatus)
	if err := s.validateTransition(shipment.Status, next); err != nil {
		return nil, err
	}

	now := common.GetTimestamp(ctx)
	shipment.Status = next
	shipment.UpdatedAt = now
	shipment.TxID = ctx.GetStub().GetTxID()

	_ = common.EmitEvent(ctx, "ShipmentStatusUpdated", common.Event{
		EventType:  "SHIPMENT_STATUS_UPDATED",
		EntityID:   shipmentID,
		EntityType: DocTypeShipment,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  now,
		Metadata:   map[string]string{"newStatus": newStatus},
	})

	return s.saveShipment(ctx, shipment)
}

// ConfirmDelivery marks the shipment as DELIVERED and records proof.
// Can be called by the logistics provider with proof hash.
func (s *SmartContract) ConfirmDelivery(
	ctx contractapi.TransactionContextInterface,
	shipmentID, deliveryProofHash string,
) (*Shipment, error) {
	shipment, err := s.GetShipment(ctx, shipmentID)
	if err != nil {
		return nil, err
	}

	if err := common.AssertAnyMSP(ctx, "LogisticsMSP", "BuyersMSP"); err != nil {
		return nil, err
	}
	if shipment.Status != ShipmentOutForDelivery && shipment.Status != ShipmentInTransit {
		return nil, common.NewStateError(fmt.Sprintf("shipment must be OUT_FOR_DELIVERY or IN_TRANSIT to confirm delivery, got '%s'", shipment.Status))
	}

	now := common.GetTimestamp(ctx)
	shipment.Status = ShipmentDelivered
	shipment.ActualDelivery = now
	shipment.DeliveryProofHash = deliveryProofHash
	shipment.UpdatedAt = now
	shipment.TxID = ctx.GetStub().GetTxID()

	_ = common.EmitEvent(ctx, "ShipmentDelivered", common.Event{
		EventType:  "SHIPMENT_DELIVERED",
		EntityID:   shipmentID,
		EntityType: DocTypeShipment,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  now,
		Metadata: map[string]string{
			"orderId":           shipment.OrderID,
			"deliveryProofHash": deliveryProofHash,
			"tempBreachCount":   fmt.Sprintf("%d", shipment.TempBreachCount),
		},
	})

	return s.saveShipment(ctx, shipment)
}

// ReportDamage marks the shipment as DAMAGED and records damage notes.
func (s *SmartContract) ReportDamage(
	ctx contractapi.TransactionContextInterface,
	shipmentID, damageNotes string,
) (*Shipment, error) {
	shipment, err := s.GetShipment(ctx, shipmentID)
	if err != nil {
		return nil, err
	}

	if err := common.AssertAnyMSP(ctx, "LogisticsMSP", "BuyersMSP"); err != nil {
		return nil, err
	}
	if shipment.Status == ShipmentDelivered || shipment.Status == ShipmentDamaged {
		return nil, common.NewStateError(fmt.Sprintf("cannot report damage for shipment in status '%s'", shipment.Status))
	}

	shipment.Status = ShipmentDamaged
	shipment.DamageNotes = damageNotes
	shipment.UpdatedAt = common.GetTimestamp(ctx)
	shipment.TxID = ctx.GetStub().GetTxID()

	_ = common.EmitEvent(ctx, "ShipmentDamaged", common.Event{
		EventType:  "SHIPMENT_DAMAGED",
		EntityID:   shipmentID,
		EntityType: DocTypeShipment,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  shipment.UpdatedAt,
		Metadata:   map[string]string{"damageNotes": damageNotes},
	})

	return s.saveShipment(ctx, shipment)
}

// GetShipment retrieves a shipment by ID.
func (s *SmartContract) GetShipment(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
) (*Shipment, error) {
	key := common.BuildKey(DocTypeShipment, shipmentID)
	b, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, common.NewInternalError("failed to read shipment state: " + err.Error())
	}
	if b == nil {
		return nil, common.NewNotFoundError(fmt.Sprintf("shipment '%s' not found", shipmentID))
	}

	var shipment Shipment
	if err := json.Unmarshal(b, &shipment); err != nil {
		return nil, common.NewInternalError("failed to unmarshal shipment")
	}
	return &shipment, nil
}

// GetShipmentByOrder queries for the shipment linked to a specific order.
func (s *SmartContract) GetShipmentByOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) (*Shipment, error) {
	query := fmt.Sprintf(
		`{"selector":{"docType":"%s","orderId":"%s"}}`,
		DocTypeShipment, orderID,
	)
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, common.NewInternalError("shipment query failed: " + err.Error())
	}
	defer iter.Close()

	if !iter.HasNext() {
		return nil, common.NewNotFoundError(fmt.Sprintf("no shipment found for order '%s'", orderID))
	}
	res, err := iter.Next()
	if err != nil {
		return nil, common.NewInternalError("iterator error: " + err.Error())
	}

	var shipment Shipment
	if err := json.Unmarshal(res.Value, &shipment); err != nil {
		return nil, common.NewInternalError("failed to unmarshal shipment")
	}
	return &shipment, nil
}

// GetShipmentHistory returns the full Fabric ledger history for a shipment record.
func (s *SmartContract) GetShipmentHistory(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
) ([]*common.HistoryRecord, error) {
	return common.GetHistory(ctx, common.BuildKey(DocTypeShipment, shipmentID))
}

// QueryShipmentsByProvider returns all shipments for a logistics provider.
func (s *SmartContract) QueryShipmentsByProvider(
	ctx contractapi.TransactionContextInterface,
	providerID string,
) ([]*Shipment, error) {
	query := fmt.Sprintf(
		`{"selector":{"docType":"%s","logisticsProviderId":"%s"},"sort":[{"createdAt":"desc"}]}`,
		DocTypeShipment, providerID,
	)
	return s.queryShipments(ctx, query)
}

// ── Private helpers ───────────────────────────────────────────────────────────

func (s *SmartContract) saveShipment(ctx contractapi.TransactionContextInterface, shipment *Shipment) (*Shipment, error) {
	if err := common.PutJSON(ctx, common.BuildKey(DocTypeShipment, shipment.ID), shipment); err != nil {
		return nil, err
	}
	return shipment, nil
}

func (s *SmartContract) assertProvider(ctx contractapi.TransactionContextInterface, shipment *Shipment) error {
	if err := common.AssertMSP(ctx, "LogisticsMSP"); err != nil {
		return err
	}
	callerID, err := common.GetClientID(ctx)
	if err != nil {
		return err
	}
	if shipment.LogisticsProviderID != callerID {
		return common.NewForbiddenError("only the assigned logistics provider may update this shipment")
	}
	return nil
}

// validateTransition enforces the allowed state-machine transitions.
func (s *SmartContract) validateTransition(current, next ShipmentStatus) error {
	allowed := map[ShipmentStatus][]ShipmentStatus{
		ShipmentCreated:        {ShipmentPickedUp},
		ShipmentPickedUp:       {ShipmentInTransit, ShipmentDamaged, ShipmentReturned},
		ShipmentInTransit:      {ShipmentOutForDelivery, ShipmentDamaged, ShipmentReturned},
		ShipmentOutForDelivery: {ShipmentDelivered, ShipmentDamaged, ShipmentReturned},
	}
	for _, s := range allowed[current] {
		if s == next {
			return nil
		}
	}
	return common.NewStateError(
		fmt.Sprintf("transition from '%s' to '%s' is not allowed", current, next),
	)
}

func (s *SmartContract) validateCargoType(ct CargoType) error {
	valid := map[CargoType]bool{
		CargoFresh: true, CargoColdChain: true, CargoDryCargo: true,
		CargoLivestock: true, CargoProcessed: true,
	}
	if ct != "" && !valid[ct] {
		return common.NewValidationError(fmt.Sprintf("unknown cargo type '%s'", ct))
	}
	return nil
}

func (s *SmartContract) queryShipments(ctx contractapi.TransactionContextInterface, query string) ([]*Shipment, error) {
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, common.NewInternalError("shipment query failed: " + err.Error())
	}
	defer iter.Close()

	var shipments []*Shipment
	for iter.HasNext() {
		res, err := iter.Next()
		if err != nil {
			return nil, common.NewInternalError("iterator error: " + err.Error())
		}
		var sh Shipment
		if json.Unmarshal(res.Value, &sh) == nil {
			shipments = append(shipments, &sh)
		}
	}
	return shipments, nil
}
