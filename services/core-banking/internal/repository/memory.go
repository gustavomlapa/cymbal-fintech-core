package repository

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/cymbal-fintech/core-banking/internal/domain"
)

type Repository interface {
	GetAccountByID(id string) (*domain.Account, error)
	GetAccountByNumber(num string) (*domain.Account, error)
	ListAccountsByCustomer(customerID string) ([]domain.Account, error)
	UpdateAccount(account *domain.Account) error
	CreateTransaction(tx *domain.TransactionEntry) error
	GetTransactionsByAccount(accountID string) ([]domain.TransactionEntry, error)
	SearchTransactions(accountID string, query string) ([]domain.TransactionEntry, error)
}

type MemoryRepository struct {
	mu           sync.RWMutex
	accounts     map[string]*domain.Account
	transactions map[string][]domain.TransactionEntry
}

func NewMemoryRepository() *MemoryRepository {
	repo := &MemoryRepository{
		accounts:     make(map[string]*domain.Account),
		transactions: make(map[string][]domain.TransactionEntry),
	}
	repo.seed()
	return repo
}

func (r *MemoryRepository) seed() {
	now := time.Now()
	a1 := &domain.Account{
		ID:            "acc_1001",
		CustomerID:    "cust_001",
		AccountNumber: "00010928-1",
		BranchCode:    "0001",
		AccountType:   domain.AccountTypeChecking,
		Currency:      "BRL",
		Balance:       25480.50,
		BlockedAmount: 0.0,
		Status:        domain.AccountStatusActive,
		CreatedAt:     now.AddDate(0, -3, 0),
		UpdatedAt:     now,
	}

	a2 := &domain.Account{
		ID:            "acc_1002",
		CustomerID:    "cust_002",
		AccountNumber: "00010929-8",
		BranchCode:    "0001",
		AccountType:   domain.AccountTypeChecking,
		Currency:      "BRL",
		Balance:       1250.00,
		BlockedAmount: 0.0,
		Status:        domain.AccountStatusActive,
		CreatedAt:     now.AddDate(0, -1, 0),
		UpdatedAt:     now,
	}

	a3 := &domain.Account{
		ID:            "acc_1003",
		CustomerID:    "cust_003",
		AccountNumber: "00099881-2",
		BranchCode:    "0001",
		AccountType:   domain.AccountTypeEscrow,
		Currency:      "BRL",
		Balance:       1500000.00,
		BlockedAmount: 50000.0,
		Status:        domain.AccountStatusActive,
		CreatedAt:     now.AddDate(-1, 0, 0),
		UpdatedAt:     now,
	}

	r.accounts[a1.ID] = a1
	r.accounts[a2.ID] = a2
	r.accounts[a3.ID] = a3

	r.transactions[a1.ID] = []domain.TransactionEntry{
		{
			ID:           "tx_901",
			AccountID:    a1.ID,
			Type:         domain.TxTypeCredit,
			Amount:       5000.00,
			BalanceAfter: 25480.50,
			Description:  "PIX recebido - Consultoria Cymbal",
			ReferenceID:  "pix_ref_9812",
			CreatedAt:    now.Add(-2 * time.Hour),
		},
		{
			ID:           "tx_902",
			AccountID:    a1.ID,
			Type:         domain.TxTypeDebit,
			Amount:       350.00,
			BalanceAfter: 20480.50,
			Description:  "Pagamento de Boleto de Serviços",
			ReferenceID:  "bol_ref_1029",
			CreatedAt:    now.Add(-24 * time.Hour),
		},
	}
}

func (r *MemoryRepository) GetAccountByID(id string) (*domain.Account, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	acc, ok := r.accounts[id]
	if !ok {
		return nil, domain.ErrAccountNotFound
	}
	// Return copy
	copyAcc := *acc
	return &copyAcc, nil
}

func (r *MemoryRepository) GetAccountByNumber(num string) (*domain.Account, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, acc := range r.accounts {
		if acc.AccountNumber == num {
			copyAcc := *acc
			return &copyAcc, nil
		}
	}
	return nil, domain.ErrAccountNotFound
}

func (r *MemoryRepository) ListAccountsByCustomer(customerID string) ([]domain.Account, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var list []domain.Account
	for _, acc := range r.accounts {
		if acc.CustomerID == customerID {
			list = append(list, *acc)
		}
	}
	return list, nil
}

func (r *MemoryRepository) UpdateAccount(account *domain.Account) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.accounts[account.ID]; !ok {
		return domain.ErrAccountNotFound
	}
	copyAcc := *account
	copyAcc.UpdatedAt = time.Now()
	r.accounts[account.ID] = &copyAcc
	return nil
}

func (r *MemoryRepository) CreateTransaction(tx *domain.TransactionEntry) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.transactions[tx.AccountID] = append(r.transactions[tx.AccountID], *tx)
	return nil
}

func (r *MemoryRepository) GetTransactionsByAccount(accountID string) ([]domain.TransactionEntry, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	entries, ok := r.transactions[accountID]
	if !ok {
		return []domain.TransactionEntry{}, nil
	}
	res := make([]domain.TransactionEntry, len(entries))
	copy(res, entries)
	return res, nil
}

// SearchTransactions dynamically matches entries (simulating database query execution)
func (r *MemoryRepository) SearchTransactions(accountID string, query string) ([]domain.TransactionEntry, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	entries := r.transactions[accountID]
	var matched []domain.TransactionEntry
	for _, e := range entries {
		if query == "" || strings.Contains(strings.ToLower(e.Description), strings.ToLower(query)) {
			matched = append(matched, e)
		}
	}
	return matched, nil
}

