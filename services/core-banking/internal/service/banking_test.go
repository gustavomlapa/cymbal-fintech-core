package service_test

import (
	"log/slog"
	"os"
	"testing"

	"github.com/cymbal-fintech/core-banking/internal/domain"
	"github.com/cymbal-fintech/core-banking/internal/repository"
	"github.com/cymbal-fintech/core-banking/internal/service"
)

func setupTestService() *service.BankingService {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	repo := repository.NewMemoryRepository()
	return service.NewBankingService(repo, logger)
}

func TestCreditAccount(t *testing.T) {
	svc := setupTestService()
	tx, err := svc.Credit("acc_1001", 500.0, "Test Credit", "ref_test_1")
	if err != nil {
		t.Fatalf("expected credit to succeed, got %v", err)
	}
	if tx.Amount != 500.0 {
		t.Errorf("expected amount 500, got %f", tx.Amount)
	}

	acc, err := svc.GetAccount("acc_1001")
	if err != nil {
		t.Fatalf("failed to get account: %v", err)
	}
	if acc.Balance != 25480.50+500.0 {
		t.Errorf("expected balance %f, got %f", 25480.50+500.0, acc.Balance)
	}
}

func TestDebitAccount(t *testing.T) {
	svc := setupTestService()
	tx, err := svc.Debit("acc_1002", 250.0, "Test Debit", "ref_test_2")
	if err != nil {
		t.Fatalf("expected debit to succeed, got %v", err)
	}
	if tx.Amount != 250.0 {
		t.Errorf("expected amount 250, got %f", tx.Amount)
	}

	acc, err := svc.GetAccount("acc_1002")
	if err != nil {
		t.Fatalf("failed to get account: %v", err)
	}
	if acc.Balance != 1250.0-250.0 {
		t.Errorf("expected balance %f, got %f", 1000.0, acc.Balance)
	}
}

func TestDebitInsufficientFunds(t *testing.T) {
	svc := setupTestService()
	_, err := svc.Debit("acc_1002", 999999.0, "Excessive Debit", "ref_test_3")
	if err != domain.ErrInsufficientBalance {
		t.Fatalf("expected ErrInsufficientBalance, got %v", err)
	}
}

func TestGetStatement(t *testing.T) {
	svc := setupTestService()
	stmt, err := svc.GetStatement("cust_001", "acc_1001")
	if err != nil {
		t.Fatalf("expected statement to be generated, got %v", err)
	}
	if stmt.Account.ID != "acc_1001" {
		t.Errorf("expected account acc_1001, got %s", stmt.Account.ID)
	}
	if len(stmt.Entries) == 0 {
		t.Errorf("expected transaction entries in statement")
	}
}

func TestGetStatementUnauthorized(t *testing.T) {
	svc := setupTestService()

	// Direct IDOR attempt: cust_002 requesting cust_001's account
	_, err := svc.GetStatement("cust_002", "acc_1001")
	if err != domain.ErrUnauthorizedAccess {
		t.Fatalf("expected ErrUnauthorizedAccess, got %v", err)
	}

	// Authorized call populates cache
	_, err = svc.GetStatement("cust_001", "acc_1001")
	if err != nil {
		t.Fatalf("expected authorized statement request to succeed, got %v", err)
	}

	// Cache collision / IDOR attempt after statement is cached
	_, err = svc.GetStatement("cust_002", "acc_1001")
	if err != domain.ErrUnauthorizedAccess {
		t.Fatalf("expected ErrUnauthorizedAccess on cached statement, got %v", err)
	}
}

