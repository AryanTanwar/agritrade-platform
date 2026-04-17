// Package common provides shared utilities for all AgriTrade chaincode contracts.
package common

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ── Key building ─────────────────────────────────────────────────────────────

// BuildKey produces a composite ledger key from one or more parts joined by "~".
// e.g. BuildKey("LISTING", "listing-001") → "LISTING~listing-001"
func BuildKey(parts ...string) string {
	return strings.Join(parts, "~")
}

// ── Identity helpers ──────────────────────────────────────────────────────────

// GetClientID returns the unique subject string from the caller's X.509 certificate.
func GetClientID(ctx contractapi.TransactionContextInterface) (string, error) {
	id, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", NewInternalError("failed to get client ID: " + err.Error())
	}
	return id, nil
}

// GetMSPID returns the MSP identifier of the calling organisation.
func GetMSPID(ctx contractapi.TransactionContextInterface) (string, error) {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return "", NewInternalError("failed to get MSP ID: " + err.Error())
	}
	return mspID, nil
}

// AssertMSP returns ForbiddenError when the caller does not belong to allowedMSP.
func AssertMSP(ctx contractapi.TransactionContextInterface, allowedMSP string) error {
	mspID, err := GetMSPID(ctx)
	if err != nil {
		return err
	}
	if mspID != allowedMSP {
		return NewForbiddenError(fmt.Sprintf("caller MSP '%s' is not authorised; expected '%s'", mspID, allowedMSP))
	}
	return nil
}

// AssertAnyMSP returns ForbiddenError when the caller does not belong to any of allowedMSPs.
func AssertAnyMSP(ctx contractapi.TransactionContextInterface, allowedMSPs ...string) error {
	mspID, err := GetMSPID(ctx)
	if err != nil {
		return err
	}
	for _, allowed := range allowedMSPs {
		if mspID == allowed {
			return nil
		}
	}
	return NewForbiddenError(fmt.Sprintf("caller MSP '%s' is not in the authorised set %v", mspID, allowedMSPs))
}

// ── Timestamp ─────────────────────────────────────────────────────────────────

// GetTimestamp returns the transaction timestamp as an RFC3339 string.
// Falls back to the current wall-clock time if the stub timestamp is unavailable.
func GetTimestamp(ctx contractapi.TransactionContextInterface) string {
	ts, err := ctx.GetStub().GetTxTimestamp()
	if err != nil || ts == nil {
		return time.Now().UTC().Format(time.RFC3339)
	}
	return time.Unix(ts.GetSeconds(), int64(ts.GetNanos())).UTC().Format(time.RFC3339)
}

// ── Events ────────────────────────────────────────────────────────────────────

// Event is the payload emitted via SetEvent for off-chain indexing.
type Event struct {
	EventType  string            `json:"eventType"`
	EntityID   string            `json:"entityId"`
	EntityType string            `json:"entityType"`
	ActorID    string            `json:"actorId"`
	ActorMSP   string            `json:"actorMsp,omitempty"`
	TxID       string            `json:"txId"`
	Timestamp  string            `json:"timestamp"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

// EmitEvent serialises evt and calls SetEvent with the given name.
func EmitEvent(ctx contractapi.TransactionContextInterface, name string, evt Event) error {
	payload, err := json.Marshal(evt)
	if err != nil {
		return NewInternalError("failed to marshal event: " + err.Error())
	}
	if err := ctx.GetStub().SetEvent(name, payload); err != nil {
		return NewInternalError("failed to emit event: " + err.Error())
	}
	return nil
}

// ── History ───────────────────────────────────────────────────────────────────

// HistoryRecord represents one version of a ledger key across its transaction history.
type HistoryRecord struct {
	TxID      string          `json:"txId"`
	Value     json.RawMessage `json:"value"`
	Timestamp string          `json:"timestamp"`
	IsDelete  bool            `json:"isDelete"`
}

// GetHistory retrieves the full modification history for a ledger key.
func GetHistory(ctx contractapi.TransactionContextInterface, key string) ([]*HistoryRecord, error) {
	iter, err := ctx.GetStub().GetHistoryForKey(key)
	if err != nil {
		return nil, NewInternalError("failed to get history for key '" + key + "': " + err.Error())
	}
	defer iter.Close()

	var records []*HistoryRecord
	for iter.HasNext() {
		mod, err := iter.Next()
		if err != nil {
			return nil, NewInternalError("history iterator error: " + err.Error())
		}

		rec := &HistoryRecord{
			TxID:     mod.TxId,
			Value:    mod.Value,
			IsDelete: mod.IsDelete,
		}
		if mod.Timestamp != nil {
			rec.Timestamp = time.Unix(mod.Timestamp.GetSeconds(), int64(mod.Timestamp.GetNanos())).UTC().Format(time.RFC3339)
		}
		records = append(records, rec)
	}
	return records, nil
}

// ── Pagination helper for rich queries ───────────────────────────────────────

// PagedQueryResult wraps paginated query results.
type PagedQueryResult struct {
	Records  []json.RawMessage `json:"records"`
	Bookmark string            `json:"bookmark"`
	Count    int32             `json:"count"`
}

// ExecutePagedQuery runs a CouchDB selector query with pagination.
func ExecutePagedQuery(
	ctx contractapi.TransactionContextInterface,
	query string,
	pageSize int32,
	bookmark string,
) (*PagedQueryResult, error) {
	iter, metadata, err := ctx.GetStub().GetQueryResultWithPagination(query, pageSize, bookmark)
	if err != nil {
		return nil, NewInternalError("paginated query failed: " + err.Error())
	}
	defer iter.Close()

	var records []json.RawMessage
	for iter.HasNext() {
		res, err := iter.Next()
		if err != nil {
			return nil, NewInternalError("iterator error: " + err.Error())
		}
		records = append(records, res.Value)
	}

	return &PagedQueryResult{
		Records:  records,
		Bookmark: metadata.Bookmark,
		Count:    metadata.FetchedRecordsCount,
	}, nil
}

// ── General helpers ───────────────────────────────────────────────────────────

// DefaultIfEmpty returns val if non-empty, otherwise returns defaultVal.
func DefaultIfEmpty(val, defaultVal string) string {
	if val == "" {
		return defaultVal
	}
	return val
}

// StateExists checks whether a key already exists in the world state.
func StateExists(ctx contractapi.TransactionContextInterface, key string) (bool, error) {
	b, err := ctx.GetStub().GetState(key)
	if err != nil {
		return false, NewInternalError("state read error for key '" + key + "': " + err.Error())
	}
	return b != nil, nil
}

// PutJSON marshals v to JSON and writes it to the world state under key.
func PutJSON(ctx contractapi.TransactionContextInterface, key string, v interface{}) error {
	b, err := json.Marshal(v)
	if err != nil {
		return NewInternalError("failed to marshal state: " + err.Error())
	}
	if err := ctx.GetStub().PutState(key, b); err != nil {
		return NewInternalError("failed to put state for key '" + key + "': " + err.Error())
	}
	return nil
}
