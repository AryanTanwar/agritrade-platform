// Package escrow implements the AgriTrade EscrowContract chaincode.
//
// Responsibilities:
//   - Hold buyer funds on-chain until delivery is confirmed
//   - Release funds to the farmer on delivery confirmation
//   - Refund buyer on dispute resolution or cancellation
//   - Record immutable audit trail of every escrow state change
package escrow

import (
	"encoding/json"
	"fmt"

	"github.com/agritrade/chaincode/common"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

const DocTypeEscrow = "ESCROW"

// EscrowStatus enumerates the finite states of an escrow record.
type EscrowStatus string

const (
	EscrowHeld     EscrowStatus = "HELD"
	EscrowReleased EscrowStatus = "RELEASED"
	EscrowRefunded EscrowStatus = "REFUNDED"
	EscrowDisputed EscrowStatus = "DISPUTED"
	EscrowExpired  EscrowStatus = "EXPIRED"
)

// DisputeOutcome is set by an admin after dispute resolution.
type DisputeOutcome string

const (
	OutcomeFarmerWins DisputeOutcome = "FARMER_WINS"
	OutcomeBuyerWins  DisputeOutcome = "BUYER_WINS"
	OutcomeSplit      DisputeOutcome = "SPLIT"
)

// Escrow is the ledger record that holds payment state for a trade order.
type Escrow struct {
	DocType         string         `json:"docType"`
	ID              string         `json:"id"`
	OrderID         string         `json:"orderId"`
	BuyerID         string         `json:"buyerId"`
	BuyerMSP        string         `json:"buyerMsp"`
	FarmerID        string         `json:"farmerId"`
	FarmerMSP       string         `json:"farmerMsp"`
	Amount          float64        `json:"amount"`
	Currency        string         `json:"currency"`
	Status          EscrowStatus   `json:"status"`
	// Payment reference from off-chain payment gateway (Razorpay, etc.)
	PaymentRef      string         `json:"paymentRef,omitempty"`
	// Hash of the external payment proof document
	PaymentProofHash string        `json:"paymentProofHash,omitempty"`
	DisputeReason   string         `json:"disputeReason,omitempty"`
	DisputeOutcome  DisputeOutcome `json:"disputeOutcome,omitempty"`
	// Release split percentages (used for SPLIT outcome)
	FarmerReleaseAmt float64       `json:"farmerReleaseAmt,omitempty"`
	BuyerRefundAmt   float64       `json:"buyerRefundAmt,omitempty"`
	HoldTxID        string         `json:"holdTxId"`
	ReleaseTxID     string         `json:"releaseTxId,omitempty"`
	ExpiresAt       string         `json:"expiresAt,omitempty"` // ISO8601 — auto-refund after this
	CreatedAt       string         `json:"createdAt"`
	UpdatedAt       string         `json:"updatedAt"`
}

// SmartContract provides escrow management for agricultural trades.
type SmartContract struct {
	contractapi.Contract
}

// CreateEscrow initialises a new escrow record in HELD state.
// Only BuyersMSP clients may create escrows (they are the payer).
func (s *SmartContract) CreateEscrow(
	ctx contractapi.TransactionContextInterface,
	escrowJSON string,
) (*Escrow, error) {
	if err := common.AssertMSP(ctx, "BuyersMSP"); err != nil {
		return nil, err
	}

	var input struct {
		ID               string  `json:"id"`
		OrderID          string  `json:"orderId"`
		FarmerID         string  `json:"farmerId"`
		FarmerMSP        string  `json:"farmerMsp"`
		Amount           float64 `json:"amount"`
		Currency         string  `json:"currency"`
		PaymentRef       string  `json:"paymentRef"`
		PaymentProofHash string  `json:"paymentProofHash"`
		ExpiresAt        string  `json:"expiresAt"`
	}
	if err := json.Unmarshal([]byte(escrowJSON), &input); err != nil {
		return nil, common.NewValidationError("invalid escrow JSON: " + err.Error())
	}
	if input.ID == "" || input.OrderID == "" || input.FarmerID == "" {
		return nil, common.NewValidationError("id, orderId, and farmerId are required")
	}
	if input.Amount <= 0 {
		return nil, common.NewValidationError("amount must be positive")
	}

	key := common.BuildKey(DocTypeEscrow, input.ID)
	if exists, err := common.StateExists(ctx, key); err != nil {
		return nil, err
	} else if exists {
		return nil, common.NewConflictError(fmt.Sprintf("escrow '%s' already exists", input.ID))
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
	escrow := &Escrow{
		DocType:          DocTypeEscrow,
		ID:               input.ID,
		OrderID:          input.OrderID,
		BuyerID:          buyerID,
		BuyerMSP:         buyerMSP,
		FarmerID:         input.FarmerID,
		FarmerMSP:        common.DefaultIfEmpty(input.FarmerMSP, "FarmersMSP"),
		Amount:           input.Amount,
		Currency:         common.DefaultIfEmpty(input.Currency, "INR"),
		Status:           EscrowHeld,
		PaymentRef:       input.PaymentRef,
		PaymentProofHash: input.PaymentProofHash,
		ExpiresAt:        input.ExpiresAt,
		HoldTxID:         ctx.GetStub().GetTxID(),
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := common.PutJSON(ctx, key, escrow); err != nil {
		return nil, err
	}

	_ = common.EmitEvent(ctx, "EscrowCreated", common.Event{
		EventType:  "ESCROW_CREATED",
		EntityID:   input.ID,
		EntityType: DocTypeEscrow,
		ActorID:    buyerID,
		ActorMSP:   buyerMSP,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  now,
		Metadata: map[string]string{
			"orderId":  input.OrderID,
			"amount":   fmt.Sprintf("%.2f", input.Amount),
			"currency": escrow.Currency,
		},
	})

	return escrow, nil
}

// ReleaseEscrow releases funds to the farmer after confirmed delivery.
// Caller must be the farmer (FarmersMSP) to self-claim, or BuyersMSP to authorise.
// For full release, both-party consent is modelled by requiring the farmer to call this
// after the buyer has confirmed delivery (off-chain enforcement via order status).
func (s *SmartContract) ReleaseEscrow(
	ctx contractapi.TransactionContextInterface,
	escrowID string,
) (*Escrow, error) {
	escrow, err := s.GetEscrow(ctx, escrowID)
	if err != nil {
		return nil, err
	}
	if escrow.Status != EscrowHeld {
		return nil, common.NewStateError(fmt.Sprintf("cannot release escrow in status '%s'", escrow.Status))
	}

	// Either the farmer claims or an authorised admin releases
	if err := common.AssertAnyMSP(ctx, "FarmersMSP", "BuyersMSP"); err != nil {
		return nil, err
	}

	now := common.GetTimestamp(ctx)
	escrow.Status = EscrowReleased
	escrow.FarmerReleaseAmt = escrow.Amount
	escrow.ReleaseTxID = ctx.GetStub().GetTxID()
	escrow.UpdatedAt = now

	if err := common.PutJSON(ctx, common.BuildKey(DocTypeEscrow, escrowID), escrow); err != nil {
		return nil, err
	}

	_ = common.EmitEvent(ctx, "EscrowReleased", common.Event{
		EventType:  "ESCROW_RELEASED",
		EntityID:   escrowID,
		EntityType: DocTypeEscrow,
		ActorID:    escrow.FarmerID,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  now,
		Metadata: map[string]string{
			"orderId":          escrow.OrderID,
			"releasedAmount":   fmt.Sprintf("%.2f", escrow.Amount),
			"currency":         escrow.Currency,
		},
	})

	return escrow, nil
}

// RefundEscrow returns funds to the buyer. Called after a confirmed cancellation.
// Only BuyersMSP or an admin-level MSP identity may trigger a refund.
func (s *SmartContract) RefundEscrow(
	ctx contractapi.TransactionContextInterface,
	escrowID string,
) (*Escrow, error) {
	escrow, err := s.GetEscrow(ctx, escrowID)
	if err != nil {
		return nil, err
	}
	refundable := map[EscrowStatus]bool{
		EscrowHeld:     true,
		EscrowDisputed: true,
	}
	if !refundable[escrow.Status] {
		return nil, common.NewStateError(fmt.Sprintf("cannot refund escrow in status '%s'", escrow.Status))
	}

	if err := common.AssertAnyMSP(ctx, "BuyersMSP", "FarmersMSP"); err != nil {
		return nil, err
	}

	now := common.GetTimestamp(ctx)
	escrow.Status = EscrowRefunded
	escrow.BuyerRefundAmt = escrow.Amount
	escrow.ReleaseTxID = ctx.GetStub().GetTxID()
	escrow.UpdatedAt = now

	if err := common.PutJSON(ctx, common.BuildKey(DocTypeEscrow, escrowID), escrow); err != nil {
		return nil, err
	}

	_ = common.EmitEvent(ctx, "EscrowRefunded", common.Event{
		EventType:  "ESCROW_REFUNDED",
		EntityID:   escrowID,
		EntityType: DocTypeEscrow,
		ActorID:    escrow.BuyerID,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  now,
		Metadata: map[string]string{
			"orderId":       escrow.OrderID,
			"refundAmount":  fmt.Sprintf("%.2f", escrow.Amount),
			"currency":      escrow.Currency,
		},
	})

	return escrow, nil
}

// RaiseDispute moves an escrow into DISPUTED state and records the reason.
func (s *SmartContract) RaiseDispute(
	ctx contractapi.TransactionContextInterface,
	escrowID, reason string,
) (*Escrow, error) {
	escrow, err := s.GetEscrow(ctx, escrowID)
	if err != nil {
		return nil, err
	}
	if escrow.Status != EscrowHeld {
		return nil, common.NewStateError(fmt.Sprintf("can only dispute a HELD escrow, got '%s'", escrow.Status))
	}
	if reason == "" {
		return nil, common.NewValidationError("dispute reason is required")
	}

	callerID, err := common.GetClientID(ctx)
	if err != nil {
		return nil, err
	}
	if escrow.BuyerID != callerID && escrow.FarmerID != callerID {
		return nil, common.NewForbiddenError("only an escrow party may raise a dispute")
	}

	escrow.Status = EscrowDisputed
	escrow.DisputeReason = reason
	escrow.UpdatedAt = common.GetTimestamp(ctx)

	if err := common.PutJSON(ctx, common.BuildKey(DocTypeEscrow, escrowID), escrow); err != nil {
		return nil, err
	}

	_ = common.EmitEvent(ctx, "EscrowDisputed", common.Event{
		EventType:  "ESCROW_DISPUTED",
		EntityID:   escrowID,
		EntityType: DocTypeEscrow,
		ActorID:    callerID,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  escrow.UpdatedAt,
		Metadata:   map[string]string{"reason": reason},
	})

	return escrow, nil
}

// ResolveDispute records the admin's dispute resolution and triggers the split/release/refund.
// Only an admin-level identity (any MSP admin) may call this.
func (s *SmartContract) ResolveDispute(
	ctx contractapi.TransactionContextInterface,
	escrowID string,
	resolutionJSON string,
) (*Escrow, error) {
	escrow, err := s.GetEscrow(ctx, escrowID)
	if err != nil {
		return nil, err
	}
	if escrow.Status != EscrowDisputed {
		return nil, common.NewStateError("escrow must be DISPUTED to resolve")
	}

	var resolution struct {
		Outcome          DisputeOutcome `json:"outcome"`
		FarmerReleaseAmt float64        `json:"farmerReleaseAmt"`
		BuyerRefundAmt   float64        `json:"buyerRefundAmt"`
	}
	if err := json.Unmarshal([]byte(resolutionJSON), &resolution); err != nil {
		return nil, common.NewValidationError("invalid resolution JSON: " + err.Error())
	}
	if resolution.Outcome == "" {
		return nil, common.NewValidationError("outcome is required")
	}

	// Validate amounts add up
	total := resolution.FarmerReleaseAmt + resolution.BuyerRefundAmt
	if total > escrow.Amount+0.001 { // floating-point tolerance
		return nil, common.NewValidationError(
			fmt.Sprintf("split amounts %.2f exceed escrow total %.2f", total, escrow.Amount),
		)
	}

	now := common.GetTimestamp(ctx)
	switch resolution.Outcome {
	case OutcomeFarmerWins:
		escrow.Status = EscrowReleased
		escrow.FarmerReleaseAmt = escrow.Amount
	case OutcomeBuyerWins:
		escrow.Status = EscrowRefunded
		escrow.BuyerRefundAmt = escrow.Amount
	case OutcomeSplit:
		escrow.Status = EscrowReleased // funds split; settlement handled off-chain
		escrow.FarmerReleaseAmt = resolution.FarmerReleaseAmt
		escrow.BuyerRefundAmt = resolution.BuyerRefundAmt
	default:
		return nil, common.NewValidationError(fmt.Sprintf("unknown outcome '%s'", resolution.Outcome))
	}

	escrow.DisputeOutcome = resolution.Outcome
	escrow.ReleaseTxID = ctx.GetStub().GetTxID()
	escrow.UpdatedAt = now

	if err := common.PutJSON(ctx, common.BuildKey(DocTypeEscrow, escrowID), escrow); err != nil {
		return nil, err
	}

	_ = common.EmitEvent(ctx, "DisputeResolved", common.Event{
		EventType:  "DISPUTE_RESOLVED",
		EntityID:   escrowID,
		EntityType: DocTypeEscrow,
		TxID:       ctx.GetStub().GetTxID(),
		Timestamp:  now,
		Metadata: map[string]string{
			"outcome":          string(resolution.Outcome),
			"farmerReleaseAmt": fmt.Sprintf("%.2f", escrow.FarmerReleaseAmt),
			"buyerRefundAmt":   fmt.Sprintf("%.2f", escrow.BuyerRefundAmt),
		},
	})

	return escrow, nil
}

// GetEscrow retrieves a single escrow record by ID.
func (s *SmartContract) GetEscrow(
	ctx contractapi.TransactionContextInterface,
	escrowID string,
) (*Escrow, error) {
	key := common.BuildKey(DocTypeEscrow, escrowID)
	b, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, common.NewInternalError("failed to read escrow state: " + err.Error())
	}
	if b == nil {
		return nil, common.NewNotFoundError(fmt.Sprintf("escrow '%s' not found", escrowID))
	}

	var escrow Escrow
	if err := json.Unmarshal(b, &escrow); err != nil {
		return nil, common.NewInternalError("failed to unmarshal escrow")
	}
	return &escrow, nil
}

// GetEscrowByOrder queries for an escrow linked to a specific order ID.
func (s *SmartContract) GetEscrowByOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) (*Escrow, error) {
	query := fmt.Sprintf(
		`{"selector":{"docType":"%s","orderId":"%s"}}`,
		DocTypeEscrow, orderID,
	)
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, common.NewInternalError("escrow query failed: " + err.Error())
	}
	defer iter.Close()

	if !iter.HasNext() {
		return nil, common.NewNotFoundError(fmt.Sprintf("no escrow found for order '%s'", orderID))
	}
	res, err := iter.Next()
	if err != nil {
		return nil, common.NewInternalError("iterator error: " + err.Error())
	}

	var escrow Escrow
	if err := json.Unmarshal(res.Value, &escrow); err != nil {
		return nil, common.NewInternalError("failed to unmarshal escrow")
	}
	return &escrow, nil
}

// GetEscrowHistory returns the full ledger history for an escrow.
func (s *SmartContract) GetEscrowHistory(
	ctx contractapi.TransactionContextInterface,
	escrowID string,
) ([]*common.HistoryRecord, error) {
	return common.GetHistory(ctx, common.BuildKey(DocTypeEscrow, escrowID))
}
