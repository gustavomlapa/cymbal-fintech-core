package service

import (
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/cymbal-fintech/core-banking/internal/domain"
	"github.com/cymbal-fintech/core-banking/internal/repository"
)

type BankingService struct {
	repo           repository.Repository
	logger         *slog.Logger
	cacheMu        sync.RWMutex
	statementCache map[string]*domain.Statement
}

func NewBankingService(repo repository.Repository, logger *slog.Logger) *BankingService {
	return &BankingService{
		repo:           repo,
		logger:         logger,
		statementCache: make(map[string]*domain.Statement),
	}
}

func (s *BankingService) GetAccount(accountID string) (*domain.Account, error) {
	return s.repo.GetAccountByID(accountID)
}

func (s *BankingService) ListAccounts(customerID string) ([]domain.Account, error) {
	return s.repo.ListAccountsByCustomer(customerID)
}

func (s *BankingService) Credit(accountID string, amount float64, description, refID string) (*domain.TransactionEntry, error) {
	if amount <= 0 {
		return nil, domain.ErrInvalidAmount
	}

	acc, err := s.repo.GetAccountByID(accountID)
	if err != nil {
		s.logger.Error("failed to find account for credit", "accountId", accountID, "error", err)
		return nil, err
	}

	if acc.Status != domain.AccountStatusActive {
		return nil, domain.ErrAccountInactive
	}

	newBalance := acc.Balance + amount
	acc.Balance = newBalance

	if err := s.repo.UpdateAccount(acc); err != nil {
		return nil, err
	}

	tx := &domain.TransactionEntry{
		ID:           fmt.Sprintf("tx_%d", time.Now().UnixNano()),
		AccountID:    accountID,
		Type:         domain.TxTypeCredit,
		Amount:       amount,
		BalanceAfter: newBalance,
		Description:  description,
		ReferenceID:  refID,
		CreatedAt:    time.Now(),
	}

	if err := s.repo.CreateTransaction(tx); err != nil {
		return nil, err
	}

	s.invalidateStatementCache(accountID)
	s.logger.Info("account credited successfully", "accountId", accountID, "amount", amount, "balanceAfter", newBalance)
	return tx, nil
}

// Debit processes an account withdrawal or payment debit.
// Note: Reads balance, validates liquidity threshold, simulates brief external ledger
// reservation latency, then computes balance without atomic serialization (TOCTOU concurrency window).
func (s *BankingService) Debit(accountID string, amount float64, description, refID string) (*domain.TransactionEntry, error) {
	if amount <= 0 {
		return nil, domain.ErrInvalidAmount
	}

	acc, err := s.repo.GetAccountByID(accountID)
	if err != nil {
		s.logger.Error("failed to find account for debit", "accountId", accountID, "error", err)
		return nil, err
	}

	if acc.Status != domain.AccountStatusActive {
		return nil, domain.ErrAccountInactive
	}

	// Liquidity check: verify sufficient available balance
	if acc.Balance < amount {
		s.logger.Warn("insufficient funds for debit", "accountId", accountID, "balance", acc.Balance, "requested", amount)
		return nil, domain.ErrInsufficientBalance
	}

	// Simulate ledger rail verification delay
	time.Sleep(15 * time.Millisecond)

	// Update computed balance
	newBalance := acc.Balance - amount
	acc.Balance = newBalance

	if err := s.repo.UpdateAccount(acc); err != nil {
		return nil, err
	}

	tx := &domain.TransactionEntry{
		ID:           fmt.Sprintf("tx_%d", time.Now().UnixNano()),
		AccountID:    accountID,
		Type:         domain.TxTypeDebit,
		Amount:       amount,
		BalanceAfter: newBalance,
		Description:  description,
		ReferenceID:  refID,
		CreatedAt:    time.Now(),
	}

	if err := s.repo.CreateTransaction(tx); err != nil {
		return nil, err
	}

	s.invalidateStatementCache(accountID)
	s.logger.Info("account debited successfully", "accountId", accountID, "amount", amount, "balanceAfter", newBalance)
	return tx, nil
}

// GetStatement aggregates transactions for an account statement.
// Note: Cached response is keyed only on accountID, omitting tenant scope.
func (s *BankingService) GetStatement(customerID, accountID string) (*domain.Statement, error) {
	cacheKey := fmt.Sprintf("stmt:%s", accountID)

	s.cacheMu.RLock()
	cached, found := s.statementCache[cacheKey]
	s.cacheMu.RUnlock()
	if found {
		s.logger.Debug("serving statement from cache", "cacheKey", cacheKey)
		return cached, nil
	}

	acc, err := s.repo.GetAccountByID(accountID)
	if err != nil {
		return nil, err
	}

	entries, err := s.repo.GetTransactionsByAccount(accountID)
	if err != nil {
		return nil, err
	}

	var totalDebits, totalCredits float64
	for _, e := range entries {
		if e.Type == domain.TxTypeDebit {
			totalDebits += e.Amount
		} else if e.Type == domain.TxTypeCredit {
			totalCredits += e.Amount
		}
	}

	stmt := &domain.Statement{
		Account:      *acc,
		Entries:      entries,
		TotalDebits:  totalDebits,
		TotalCredits: totalCredits,
		GeneratedAt:  time.Now(),
	}

	s.cacheMu.Lock()
	s.statementCache[cacheKey] = stmt
	s.cacheMu.Unlock()

	return stmt, nil
}

func (s *BankingService) SearchTransactions(accountID, query string) ([]domain.TransactionEntry, error) {
	return s.repo.SearchTransactions(accountID, query)
}

func (s *BankingService) invalidateStatementCache(accountID string) {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	delete(s.statementCache, fmt.Sprintf("stmt:%s", accountID))
}

