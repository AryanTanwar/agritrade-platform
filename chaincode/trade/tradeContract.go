// Package trade implements the AgriTrade TradeContract chaincode.
//
// Responsibilities:
//   - Farm produce listings (create, update, cancel, query)
//   - Trade orders lifecycle (place → confirm → escrow → in-transit → delivered → completed)
//   - Rich CouchDB queries by farmer / buyer / category / status
package trade

import (
	"encoding/json"
	"fmt"

	"github.com/agritrade/chaincode/common"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ── Document type constants (used as CouchDB field for selector queries) ──────

const (
	DocTypeListing = "LISTING"
	DocTypeOrder   = "ORDER"
)

// ── Status enums ──────────────────────────────────────────────────────────────

type ListingStatus string

const (
	ListingActive    ListingStatus = "ACTIVE"
	ListingReserved  ListingStatus = "RESERVED"
	ListingSold      ListingStatus = "SOLD"
	ListingExpired   ListingStatus = "EXPIRED"
	ListingCancelled ListingStatus = "CANCELLED"
)

type OrderStatus string

const (
	OrderPlaced      OrderStatus = "PLACED"
	OrderConfirmed   OrderStatus = "CONFIRMED"
	OrderEscrowHeld  OrderStatus = "ESCROW_HELD"
	OrderInTransit   OrderStatus = "IN_TRANSIT"
	OrderDelivered   OrderStatus = "DELIVERED"
	OrderCompleted   OrderStatus = "COMPLETED"
	OrderCancelled   OrderStatus = "CANCELLED"
	OrderDisputed    OrderStatus = "DISPUTED"
)

// ── Domain models ─────────────────────────────────────────────────────────────

// Location holds geographic information for a listing or delivery address.
type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Address   string  `json:"address"`
	Village   string  `json:"village,omitempty"`
	District  string  `json:"district,omitempty"`
	State     string  `json:"state"`
	Pincode   string  `json:"pincode"`
}

// TradeListing represents an on-chain record of agricultural produce offered for sale.
type TradeListing struct {
	DocType      string        `json:"docType"`
	ID           string        `json:"id"`
	FarmerID     string        `json:"farmerId"`
	FarmerMSP    string        `json:"farmerMsp"`
	Title        string        `json:"title"`
	Description  string        `json:"description"`
	Category     string        `json:"category"`  // GRAIN | VEGETABLE | FRUIT | DAIRY | SPICE | OTHER
	Quantity     float64       `json:"quantity"`
	Unit         string        `json:"unit"`      // KG | QUINTAL | TON | LITRE | PIECE
	PricePerUnit float64       `json:"pricePerUnit"`
	Currency     string        `json:"currency"`
	Location     Location      `json:"location"`
	HarvestDate  string        `json:"harvestDate"`
	ExpiryDate   string        `json:"expiryDate"`
	IsOrganic    bool          `json:"isOrganic"`
	CertHash     string        `json:"certHash,omitempty"` // SHA-256 of uploaded certificate
	ImageHashes  []string      `json:"imageHashes,omitempty"`
	Status       ListingStatus `json:"status"`
	TxID         string        `json:"txId"`
	CreatedAt    string        `json:"createdAt"`
	UpdatedAt    string        `json:"updatedAt"`
}

// TradeOrder represents a buyer's purchase order linked to a TradeListing.
type TradeOrder struct {
	DocType      string      `json:"docType"`
	ID           string      `json:"id"`
	ListingID    string      `json:"listingId"`
	BuyerID      string      `json:"buyerId"`
	BuyerMSP     string      `json:"buyerMsp"`
	FarmerID     string      `json:"farmerId"`
	FarmerMSP    string      `json:"farmerMsp"`
	Quantity     float64     `json:"quantity"`
	UnitPrice    float64     `json:"unitPrice"`
	TotalAmount  float64     `json:"totalAmount"`
	Currency     string      `json:"currency"`
	DeliveryAddr Location    `json:"deliveryAddress"`
	Status       OrderStatus `json:"status"`
	EscrowID     string      `json:"escrowId,omitempty"`
	ShipmentID   string      `json:"shipmentId,omitempty"`
	Notes        string      `json:"notes,omitempty"`
	TxID         string      `json:"txId"`
	ConfirmedAt  string      `json:"confirmedAt,omitempty"`
	CompletedAt  string      `json:"completedAt,omitempty"`
	CreatedAt    string      `json:"createdAt"`
	UpdatedAt    string      `json:"updatedAt"`
}

// SmartContract is the Fabric contract that implements trade listing and order logic.
type SmartContract struct {
	contractapi.Contract
}

// ── Listing functions ─────────────────────────────────────────────────────────

// CreateListing creates a new farm produce listing. Caller must be FarmersMSP.
func (s *SmartContract) CreateListing(
	ctx contractapi.TransactionContextInterface,
	listingJSON string,
) (*TradeListing, error) {
	if err := common.AssertMSP(ctx, "FarmersMSP"); err != nil {
		return nil, err
	}

	var input struct {
		ID           string   `json:"id"`
		Title        string   `json:"title"`
		Description  string   `json:"description"`
		Category     string   `json:"category"`
		Quantity     float64  `json:"quantity"`
		Unit         string   `json:"unit"`
		PricePerUnit float64  `json:"pricePerUnit"`
		Currency     string   `json:"currency"`
		Location     Location `json:"location"`
		HarvestDate  string   `json:"harvestDate"`
		ExpiryDate   string   `json:"expiryDate"`
		IsOrganic    bool     `json:"isOrganic"`
		CertHash     string   `json:"certHash"`
		ImageHashes  []string `json:"imageHashes"`
	}
	if err := json.Unmarshal([]byte(listingJSON), &input); err != nil {
		return nil, common.NewValidationError("invalid listing JSON: " + err.Error())
	}
	if input.ID == "" || input.Title == "" || input.Category == "" {
		return nil, common.NewValidationError("id, title, and category are required")
	}
	if input.Quantity <= 0 {
		return nil, common.NewValidationError("quantity must be positive")
	}
	if input.PricePerUnit <= 0 {
		return nil, common.NewValidationError("pricePerUnit must be positive")
	}

	key := common.BuildKey(DocTypeListing, input.ID)
	exists, err := common.StateExists(ctx, key)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, common.NewConflictError(fmt.Sprintf("listing '%s' already exists", input.ID))
	}

	farmerID, err := common.GetClientID(ctx)
	if err != nil {
		return nil, err
	}
	farmerMSP, err := common.GetMSPID(ctx)
	if err != nil {
		return nil, err
	}

	now := common.GetTimestamp(ctx)
	listing := &TradeListing{
		DocType:      DocTypeListing,
		ID:           input.ID,
		FarmerID:     farmerID,
		FarmerMSP:    farmerMSP,
		Title:        input.Title,
		Description:  input.Description,
		Category:     input.Category,
		Quantity:     input.Quantity,
		Unit:         input.Unit,
		PricePerUnit: input.PricePerUnit,
		Currency:     common.DefaultIfEmpty(input.Currency, "INR"),
		Location:     input.Location,
		HarvestDate:  input.HarvestDate,
		ExpiryDate:   input.ExpiryDate,
		IsOrganic:    input.IsOrganic,
		CertHash:     input.CertHash,
		ImageHashes:  input.ImageHashes,
		Status:       ListingActive,
		TxID:         ctx.GetStub().GetTxID(),
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := common.PutJSON(ctx, key, listing); err != nil {
		return nil, err
	}

	_ = common.EmitEvent(ctx, "ListingCreated", common.Event{
		EventType:  "LISTING_CREATED",
		EntityID:   input.ID,
		EntityType: DocTypeListing,
		ActorID:    farmerID,
		ActorMSP:   farmerMSP,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  now,
	})

	return listing, nil
}

// UpdateListing allows the listing owner to change price, quantity, or description.
func (s *SmartContract) UpdateListing(
	ctx contractapi.TransactionContextInterface,
	listingID string,
	updateJSON string,
) (*TradeListing, error) {
	listing, err := s.GetListing(ctx, listingID)
	if err != nil {
		return nil, err
	}

	callerID, err := common.GetClientID(ctx)
	if err != nil {
		return nil, err
	}
	if listing.FarmerID != callerID {
		return nil, common.NewForbiddenError("only the listing owner may update it")
	}
	if listing.Status != ListingActive {
		return nil, common.NewStateError(fmt.Sprintf("cannot update a listing in status '%s'", listing.Status))
	}

	var update struct {
		Quantity     *float64 `json:"quantity"`
		PricePerUnit *float64 `json:"pricePerUnit"`
		Description  *string  `json:"description"`
	}
	if err := json.Unmarshal([]byte(updateJSON), &update); err != nil {
		return nil, common.NewValidationError("invalid update JSON: " + err.Error())
	}
	if update.Quantity != nil {
		if *update.Quantity <= 0 {
			return nil, common.NewValidationError("quantity must be positive")
		}
		listing.Quantity = *update.Quantity
	}
	if update.PricePerUnit != nil {
		if *update.PricePerUnit <= 0 {
			return nil, common.NewValidationError("pricePerUnit must be positive")
		}
		listing.PricePerUnit = *update.PricePerUnit
	}
	if update.Description != nil {
		listing.Description = *update.Description
	}

	listing.UpdatedAt = common.GetTimestamp(ctx)
	listing.TxID = ctx.GetStub().GetTxID()

	if err := common.PutJSON(ctx, common.BuildKey(DocTypeListing, listingID), listing); err != nil {
		return nil, err
	}
	return listing, nil
}

// CancelListing cancels an ACTIVE listing. Only the farmer owner may cancel.
func (s *SmartContract) CancelListing(
	ctx contractapi.TransactionContextInterface,
	listingID string,
) error {
	listing, err := s.GetListing(ctx, listingID)
	if err != nil {
		return err
	}

	callerID, err := common.GetClientID(ctx)
	if err != nil {
		return err
	}
	if listing.FarmerID != callerID {
		return common.NewForbiddenError("only the listing owner may cancel it")
	}
	if listing.Status == ListingSold || listing.Status == ListingCancelled {
		return common.NewStateError(fmt.Sprintf("cannot cancel a listing in status '%s'", listing.Status))
	}

	listing.Status = ListingCancelled
	listing.UpdatedAt = common.GetTimestamp(ctx)
	listing.TxID = ctx.GetStub().GetTxID()

	return common.PutJSON(ctx, common.BuildKey(DocTypeListing, listingID), listing)
}

// GetListing retrieves a single listing by ID.
func (s *SmartContract) GetListing(
	ctx contractapi.TransactionContextInterface,
	listingID string,
) (*TradeListing, error) {
	key := common.BuildKey(DocTypeListing, listingID)
	b, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, common.NewInternalError("failed to read listing state: " + err.Error())
	}
	if b == nil {
		return nil, common.NewNotFoundError(fmt.Sprintf("listing '%s' not found", listingID))
	}

	var listing TradeListing
	if err := json.Unmarshal(b, &listing); err != nil {
		return nil, common.NewInternalError("failed to unmarshal listing")
	}
	return &listing, nil
}

// GetListingHistory returns the full ledger history for a listing.
func (s *SmartContract) GetListingHistory(
	ctx contractapi.TransactionContextInterface,
	listingID string,
) ([]*common.HistoryRecord, error) {
	return common.GetHistory(ctx, common.BuildKey(DocTypeListing, listingID))
}

// QueryActiveListings performs a CouchDB rich query for ACTIVE listings.
// Optionally filter by category (pass "" to return all).
// Requires CouchDB state database.
func (s *SmartContract) QueryActiveListings(
	ctx contractapi.TransactionContextInterface,
	category string,
) ([]*TradeListing, error) {
	var selector string
	if category != "" {
		selector = fmt.Sprintf(
			`{"selector":{"docType":"%s","status":"%s","category":"%s"},"sort":[{"createdAt":"desc"}]}`,
			DocTypeListing, ListingActive, category,
		)
	} else {
		selector = fmt.Sprintf(
			`{"selector":{"docType":"%s","status":"%s"},"sort":[{"createdAt":"desc"}]}`,
			DocTypeListing, ListingActive,
		)
	}
	return s.queryListings(ctx, selector)
}

// QueryListingsByFarmer returns all listings belonging to a given farmer ID.
func (s *SmartContract) QueryListingsByFarmer(
	ctx contractapi.TransactionContextInterface,
	farmerID string,
) ([]*TradeListing, error) {
	query := fmt.Sprintf(
		`{"selector":{"docType":"%s","farmerId":"%s"},"sort":[{"createdAt":"desc"}]}`,
		DocTypeListing, farmerID,
	)
	return s.queryListings(ctx, query)
}

// ── Order functions ───────────────────────────────────────────────────────────

// PlaceOrder creates a buy order against a listing. Caller must be BuyersMSP.
func (s *SmartContract) PlaceOrder(
	ctx contractapi.TransactionContextInterface,
	orderJSON string,
) (*TradeOrder, error) {
	if err := common.AssertMSP(ctx, "BuyersMSP"); err != nil {
		return nil, err
	}

	var input struct {
		ID           string   `json:"id"`
		ListingID    string   `json:"listingId"`
		Quantity     float64  `json:"quantity"`
		DeliveryAddr Location `json:"deliveryAddress"`
		Notes        string   `json:"notes"`
	}
	if err := json.Unmarshal([]byte(orderJSON), &input); err != nil {
		return nil, common.NewValidationError("invalid order JSON: " + err.Error())
	}
	if input.ID == "" || input.ListingID == "" {
		return nil, common.NewValidationError("id and listingId are required")
	}
	if input.Quantity <= 0 {
		return nil, common.NewValidationError("quantity must be positive")
	}

	orderKey := common.BuildKey(DocTypeOrder, input.ID)
	if exists, err := common.StateExists(ctx, orderKey); err != nil {
		return nil, err
	} else if exists {
		return nil, common.NewConflictError(fmt.Sprintf("order '%s' already exists", input.ID))
	}

	listing, err := s.GetListing(ctx, input.ListingID)
	if err != nil {
		return nil, err
	}
	if listing.Status != ListingActive {
		return nil, common.NewStateError(fmt.Sprintf("listing is not available (status: %s)", listing.Status))
	}
	if input.Quantity > listing.Quantity {
		return nil, common.NewValidationError(
			fmt.Sprintf("requested %.4f exceeds available %.4f %s", input.Quantity, listing.Quantity, listing.Unit),
		)
	}

	buyerID, err := common.GetClientID(ctx)
	if err != nil {
		return nil, err
	}
	buyerMSP, err := common.GetMSPID(ctx)
	if err != nil {
		return nil, err
	}

	now := common.GetTimestamp(ctx)
	order := &TradeOrder{
		DocType:      DocTypeOrder,
		ID:           input.ID,
		ListingID:    input.ListingID,
		BuyerID:      buyerID,
		BuyerMSP:     buyerMSP,
		FarmerID:     listing.FarmerID,
		FarmerMSP:    listing.FarmerMSP,
		Quantity:     input.Quantity,
		UnitPrice:    listing.PricePerUnit,
		TotalAmount:  input.Quantity * listing.PricePerUnit,
		Currency:     listing.Currency,
		DeliveryAddr: input.DeliveryAddr,
		Status:       OrderPlaced,
		Notes:        input.Notes,
		TxID:         ctx.GetStub().GetTxID(),
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	// Decrement available quantity; reserve if fully allocated
	listing.Quantity -= input.Quantity
	if listing.Quantity == 0 {
		listing.Status = ListingReserved
	}
	listing.UpdatedAt = now
	if err := common.PutJSON(ctx, common.BuildKey(DocTypeListing, input.ListingID), listing); err != nil {
		return nil, err
	}

	if err := common.PutJSON(ctx, orderKey, order); err != nil {
		return nil, err
	}

	_ = common.EmitEvent(ctx, "OrderPlaced", common.Event{
		EventType:  "ORDER_PLACED",
		EntityID:   input.ID,
		EntityType: DocTypeOrder,
		ActorID:    buyerID,
		ActorMSP:   buyerMSP,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  now,
		Metadata: map[string]string{
			"listingId":   input.ListingID,
			"totalAmount": fmt.Sprintf("%.2f", order.TotalAmount),
			"currency":    order.Currency,
		},
	})

	return order, nil
}

// ConfirmOrder is called by the farmer to accept a PLACED order.
func (s *SmartContract) ConfirmOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) (*TradeOrder, error) {
	order, err := s.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}

	callerID, err := common.GetClientID(ctx)
	if err != nil {
		return nil, err
	}
	if order.FarmerID != callerID {
		return nil, common.NewForbiddenError("only the farmer may confirm the order")
	}
	if order.Status != OrderPlaced {
		return nil, common.NewStateError(fmt.Sprintf("order must be PLACED to confirm, got '%s'", order.Status))
	}

	now := common.GetTimestamp(ctx)
	order.Status = OrderConfirmed
	order.ConfirmedAt = now
	order.UpdatedAt = now
	order.TxID = ctx.GetStub().GetTxID()

	return s.saveOrder(ctx, order)
}

// AttachEscrow links an escrow contract to the order and moves status to ESCROW_HELD.
// Called by payment service after the escrow chaincode confirms funds are locked.
func (s *SmartContract) AttachEscrow(
	ctx contractapi.TransactionContextInterface,
	orderID, escrowID string,
) (*TradeOrder, error) {
	order, err := s.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.Status != OrderConfirmed {
		return nil, common.NewStateError("order must be CONFIRMED before attaching escrow")
	}

	order.EscrowID = escrowID
	order.Status = OrderEscrowHeld
	order.UpdatedAt = common.GetTimestamp(ctx)
	order.TxID = ctx.GetStub().GetTxID()

	return s.saveOrder(ctx, order)
}

// MarkInTransit updates status to IN_TRANSIT and attaches the shipment ID.
func (s *SmartContract) MarkInTransit(
	ctx contractapi.TransactionContextInterface,
	orderID, shipmentID string,
) (*TradeOrder, error) {
	order, err := s.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.Status != OrderEscrowHeld {
		return nil, common.NewStateError("order must be ESCROW_HELD to mark as in-transit")
	}

	order.ShipmentID = shipmentID
	order.Status = OrderInTransit
	order.UpdatedAt = common.GetTimestamp(ctx)
	order.TxID = ctx.GetStub().GetTxID()

	return s.saveOrder(ctx, order)
}

// ConfirmDelivery is called by the buyer to acknowledge receipt.
func (s *SmartContract) ConfirmDelivery(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) (*TradeOrder, error) {
	order, err := s.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}

	callerID, err := common.GetClientID(ctx)
	if err != nil {
		return nil, err
	}
	if order.BuyerID != callerID {
		return nil, common.NewForbiddenError("only the buyer may confirm delivery")
	}
	if order.Status != OrderInTransit {
		return nil, common.NewStateError("order must be IN_TRANSIT to confirm delivery")
	}

	order.Status = OrderDelivered
	order.UpdatedAt = common.GetTimestamp(ctx)
	order.TxID = ctx.GetStub().GetTxID()

	return s.saveOrder(ctx, order)
}

// CompleteOrder finalises the trade after escrow is released. Marks listing as SOLD.
func (s *SmartContract) CompleteOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) (*TradeOrder, error) {
	order, err := s.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.Status != OrderDelivered {
		return nil, common.NewStateError("order must be DELIVERED to complete")
	}

	now := common.GetTimestamp(ctx)
	order.Status = OrderCompleted
	order.CompletedAt = now
	order.UpdatedAt = now
	order.TxID = ctx.GetStub().GetTxID()

	// Mark the source listing as SOLD if quantity is exhausted
	if listing, lerr := s.GetListing(ctx, order.ListingID); lerr == nil {
		if listing.Quantity == 0 {
			listing.Status = ListingSold
			listing.UpdatedAt = now
			_ = common.PutJSON(ctx, common.BuildKey(DocTypeListing, order.ListingID), listing)
		}
	}

	_ = common.EmitEvent(ctx, "OrderCompleted", common.Event{
		EventType:  "ORDER_COMPLETED",
		EntityID:   orderID,
		EntityType: DocTypeOrder,
		ActorID:    order.BuyerID,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  now,
	})

	return s.saveOrder(ctx, order)
}

// CancelOrder cancels an order that has not yet been shipped.
func (s *SmartContract) CancelOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) (*TradeOrder, error) {
	order, err := s.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}

	callerID, err := common.GetClientID(ctx)
	if err != nil {
		return nil, err
	}
	// Both buyer and farmer may cancel before shipment
	if order.BuyerID != callerID && order.FarmerID != callerID {
		return nil, common.NewForbiddenError("only an order party may cancel the order")
	}
	cancellable := map[OrderStatus]bool{
		OrderPlaced:    true,
		OrderConfirmed: true,
	}
	if !cancellable[order.Status] {
		return nil, common.NewStateError(fmt.Sprintf("cannot cancel order in status '%s'", order.Status))
	}

	// Restore listing quantity
	if listing, lerr := s.GetListing(ctx, order.ListingID); lerr == nil {
		listing.Quantity += order.Quantity
		if listing.Status == ListingReserved {
			listing.Status = ListingActive
		}
		listing.UpdatedAt = common.GetTimestamp(ctx)
		_ = common.PutJSON(ctx, common.BuildKey(DocTypeListing, order.ListingID), listing)
	}

	order.Status = OrderCancelled
	order.UpdatedAt = common.GetTimestamp(ctx)
	order.TxID = ctx.GetStub().GetTxID()

	return s.saveOrder(ctx, order)
}

// DisputeOrder raises a dispute. Either party may dispute after escrow is held.
func (s *SmartContract) DisputeOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) (*TradeOrder, error) {
	order, err := s.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}

	callerID, err := common.GetClientID(ctx)
	if err != nil {
		return nil, err
	}
	if order.BuyerID != callerID && order.FarmerID != callerID {
		return nil, common.NewForbiddenError("only an order party may raise a dispute")
	}
	disputable := map[OrderStatus]bool{
		OrderEscrowHeld: true,
		OrderInTransit:  true,
		OrderDelivered:  true,
	}
	if !disputable[order.Status] {
		return nil, common.NewStateError(fmt.Sprintf("cannot dispute order in status '%s'", order.Status))
	}

	order.Status = OrderDisputed
	order.UpdatedAt = common.GetTimestamp(ctx)
	order.TxID = ctx.GetStub().GetTxID()

	_ = common.EmitEvent(ctx, "OrderDisputed", common.Event{
		EventType:  "ORDER_DISPUTED",
		EntityID:   orderID,
		EntityType: DocTypeOrder,
		ActorID:    callerID,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  order.UpdatedAt,
	})

	return s.saveOrder(ctx, order)
}

// GetOrder retrieves a single order by ID.
func (s *SmartContract) GetOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) (*TradeOrder, error) {
	key := common.BuildKey(DocTypeOrder, orderID)
	b, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, common.NewInternalError("failed to read order state: " + err.Error())
	}
	if b == nil {
		return nil, common.NewNotFoundError(fmt.Sprintf("order '%s' not found", orderID))
	}

	var order TradeOrder
	if err := json.Unmarshal(b, &order); err != nil {
		return nil, common.NewInternalError("failed to unmarshal order")
	}
	return &order, nil
}

// GetOrderHistory returns the full ledger history for an order.
func (s *SmartContract) GetOrderHistory(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) ([]*common.HistoryRecord, error) {
	return common.GetHistory(ctx, common.BuildKey(DocTypeOrder, orderID))
}

// QueryOrdersByBuyer returns all orders for a given buyer.
func (s *SmartContract) QueryOrdersByBuyer(
	ctx contractapi.TransactionContextInterface,
	buyerID string,
) ([]*TradeOrder, error) {
	query := fmt.Sprintf(
		`{"selector":{"docType":"%s","buyerId":"%s"},"sort":[{"createdAt":"desc"}]}`,
		DocTypeOrder, buyerID,
	)
	return s.queryOrders(ctx, query)
}

// QueryOrdersByFarmer returns all orders for a given farmer.
func (s *SmartContract) QueryOrdersByFarmer(
	ctx contractapi.TransactionContextInterface,
	farmerID string,
) ([]*TradeOrder, error) {
	query := fmt.Sprintf(
		`{"selector":{"docType":"%s","farmerId":"%s"},"sort":[{"createdAt":"desc"}]}`,
		DocTypeOrder, farmerID,
	)
	return s.queryOrders(ctx, query)
}

// ── Private helpers ───────────────────────────────────────────────────────────

func (s *SmartContract) saveOrder(ctx contractapi.TransactionContextInterface, order *TradeOrder) (*TradeOrder, error) {
	if err := common.PutJSON(ctx, common.BuildKey(DocTypeOrder, order.ID), order); err != nil {
		return nil, err
	}
	return order, nil
}

func (s *SmartContract) queryListings(ctx contractapi.TransactionContextInterface, query string) ([]*TradeListing, error) {
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, common.NewInternalError("listing query failed: " + err.Error())
	}
	defer iter.Close()

	var listings []*TradeListing
	for iter.HasNext() {
		res, err := iter.Next()
		if err != nil {
			return nil, common.NewInternalError("listing iterator error: " + err.Error())
		}
		var l TradeListing
		if json.Unmarshal(res.Value, &l) == nil {
			listings = append(listings, &l)
		}
	}
	return listings, nil
}

func (s *SmartContract) queryOrders(ctx contractapi.TransactionContextInterface, query string) ([]*TradeOrder, error) {
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, common.NewInternalError("order query failed: " + err.Error())
	}
	defer iter.Close()

	var orders []*TradeOrder
	for iter.HasNext() {
		res, err := iter.Next()
		if err != nil {
			return nil, common.NewInternalError("order iterator error: " + err.Error())
		}
		var o TradeOrder
		if json.Unmarshal(res.Value, &o) == nil {
			orders = append(orders, &o)
		}
	}
	return orders, nil
}
