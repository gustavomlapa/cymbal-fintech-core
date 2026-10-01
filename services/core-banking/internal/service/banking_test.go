package service_test

import (
	"fmt"
	"log/slog"
	"os"
	"sync"
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

func TestConcurrentDebits(t *testing.T) {
	svc := setupTestService()
	// acc_1002 initial balance is 1250.0
	// Two concurrent debits of 1000.0 should not both succeed (total 2000.0 > 1250.0)
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, err := svc.Debit("acc_1002", 1000.0, "Concurrent debit", fmt.Sprintf("ref_concurrent_%d", idx))
			errs <- err
		}(i)
	}
	wg.Wait()
	close(errs)

	var successCount, failCount int
	for err := range errs {
		if err == nil {
			successCount++
		} else if err == domain.ErrInsufficientBalance {
			failCount++
		} else {
			t.Errorf("unexpected error: %v", err)
		}
	}

	if successCount != 1 || failCount != 1 {
		t.Fatalf("expected 1 success and 1 insufficient balance failure, got %d successes and %d failures", successCount, failCount)
	}

	acc, err := svc.GetAccount("acc_1002")
	if err != nil {
		t.Fatalf("failed to get account: %v", err)
	}
	if acc.Balance != 250.0 {
		t.Errorf("expected balance 250.0, got %f", acc.Balance)
	}
}
