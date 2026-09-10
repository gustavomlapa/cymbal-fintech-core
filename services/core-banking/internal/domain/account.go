package domain

import (
	"errors"
	"time"
)

var (
	ErrAccountNotFound     = errors.New("account not found")
	ErrInsufficientBalance = errors.New("insufficient account balance")
	ErrInvalidAmount       = errors.New("transaction amount must be greater than zero")
	ErrAccountInactive     = errors.New("account is not active")
	ErrUnauthorizedAccess  = errors.New("unauthorized account access")
)

type AccountType string

const (
	AccountTypeChecking AccountType = "CHECKING"
	AccountTypeSavings  AccountType = "SAVINGS"
	AccountTypeEscrow   AccountType = "ESCROW"
)

type AccountStatus string

const (
	AccountStatusActive    AccountStatus = "ACTIVE"
	AccountStatusSuspended AccountStatus = "SUSPENDED"
	AccountStatusClosed    AccountStatus = "CLOSED"
)

type Account struct {
	ID            string        `json:"id"`
	CustomerID    string        `json:"customerId"`
	AccountNumber string        `json:"accountNumber"`
	BranchCode    string        `json:"branchCode"`
	AccountType   AccountType   `json:"accountType"`
	Currency      string        `json:"currency"`
	Balance       float64       `json:"balance"`
	BlockedAmount float64       `json:"blockedAmount"`
	Status        AccountStatus `json:"status"`
	CreatedAt     time.Time     `json:"createdAt"`
	UpdatedAt     time.Time     `json:"updatedAt"`
}

type TransactionType string

const (
	TxTypeCredit TransactionType = "CREDIT"
	TxTypeDebit  TransactionType = "DEBIT"
)

type TransactionEntry struct {
	ID          string          `json:"id"`
	AccountID   string          `json:"accountId"`
	Type        TransactionType `json:"type"`
	Amount      float64         `json:"amount"`
	BalanceAfter float64        `json:"balanceAfter"`
	Description string          `json:"description"`
	ReferenceID string          `json:"referenceId"`
	CreatedAt   time.Time       `json:"createdAt"`
}

type Statement struct {
	Account      Account            `json:"account"`
	Entries      []TransactionEntry `json:"entries"`
	TotalDebits  float64            `json:"totalDebits"`
	TotalCredits float64            `json:"totalCredits"`
	GeneratedAt  time.Time          `json:"generatedAt"`
}

type StatementFilter struct {
	StartDate time.Time `json:"startDate"`
	EndDate   time.Time `json:"endDate"`
	Limit     int       `json:"limit"`
}
