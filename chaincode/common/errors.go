// Package common — typed errors for AgriTrade chaincode contracts.
//
// All errors implement the standard error interface and carry a machine-readable
// Code field so callers can distinguish categories without string parsing.
package common

import "fmt"

// ErrorCode classifies chaincode errors for programmatic handling.
type ErrorCode string

const (
	ErrValidation ErrorCode = "VALIDATION_ERROR"
	ErrConflict   ErrorCode = "CONFLICT_ERROR"
	ErrNotFound   ErrorCode = "NOT_FOUND"
	ErrForbidden  ErrorCode = "FORBIDDEN"
	ErrInternal   ErrorCode = "INTERNAL_ERROR"
	ErrState      ErrorCode = "INVALID_STATE"
)

// ChainError is the base error type returned by all chaincode functions.
type ChainError struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
}

func (e *ChainError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// Is enables errors.Is() comparisons against error codes.
func (e *ChainError) Is(target error) bool {
	t, ok := target.(*ChainError)
	if !ok {
		return false
	}
	return e.Code == t.Code
}

// ── Constructors ──────────────────────────────────────────────────────────────

// NewValidationError returns ErrValidation for malformed or missing input.
func NewValidationError(msg string) error {
	return &ChainError{Code: ErrValidation, Message: msg}
}

// NewConflictError returns ErrConflict when an entity already exists.
func NewConflictError(msg string) error {
	return &ChainError{Code: ErrConflict, Message: msg}
}

// NewNotFoundError returns ErrNotFound when an entity cannot be located in the world state.
func NewNotFoundError(msg string) error {
	return &ChainError{Code: ErrNotFound, Message: msg}
}

// NewForbiddenError returns ErrForbidden when the caller lacks permission.
func NewForbiddenError(msg string) error {
	return &ChainError{Code: ErrForbidden, Message: msg}
}

// NewInternalError returns ErrInternal for unexpected failures (marshal errors, stub errors).
func NewInternalError(msg string) error {
	return &ChainError{Code: ErrInternal, Message: msg}
}

// NewStateError returns ErrState when a state-machine transition is not allowed.
func NewStateError(msg string) error {
	return &ChainError{Code: ErrState, Message: msg}
}

// ── Sentinel values for errors.Is() ──────────────────────────────────────────

var (
	ErrValidationSentinel = &ChainError{Code: ErrValidation}
	ErrConflictSentinel   = &ChainError{Code: ErrConflict}
	ErrNotFoundSentinel   = &ChainError{Code: ErrNotFound}
	ErrForbiddenSentinel  = &ChainError{Code: ErrForbidden}
	ErrInternalSentinel   = &ChainError{Code: ErrInternal}
	ErrStateSentinel      = &ChainError{Code: ErrState}
)

// IsValidationError reports whether err has code ErrValidation.
func IsValidationError(err error) bool {
	e, ok := err.(*ChainError)
	return ok && e.Code == ErrValidation
}

// IsNotFound reports whether err has code ErrNotFound.
func IsNotFound(err error) bool {
	e, ok := err.(*ChainError)
	return ok && e.Code == ErrNotFound
}

// IsForbidden reports whether err has code ErrForbidden.
func IsForbidden(err error) bool {
	e, ok := err.(*ChainError)
	return ok && e.Code == ErrForbidden
}
