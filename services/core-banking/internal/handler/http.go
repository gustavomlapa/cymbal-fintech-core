package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/cymbal-fintech/core-banking/internal/domain"
	"github.com/cymbal-fintech/core-banking/internal/service"
)

type HTTPHandler struct {
	bankingSvc *service.BankingService
	logger     *slog.Logger
}

func NewHTTPHandler(bankingSvc *service.BankingService, logger *slog.Logger) *HTTPHandler {
	return &HTTPHandler{
		bankingSvc: bankingSvc,
		logger:     logger,
	}
}

func (h *HTTPHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.HandleHealth)
	mux.HandleFunc("GET /api/v1/accounts/{id}", h.HandleGetAccount)
	mux.HandleFunc("POST /api/v1/accounts/credit", h.HandleCredit)
	mux.HandleFunc("POST /api/v1/accounts/debit", h.HandleDebit)
	mux.HandleFunc("GET /api/v1/accounts/{id}/statement", h.HandleGetStatement)
	mux.HandleFunc("GET /api/v1/transactions/export", h.HandleExportTransactions)
}

func (h *HTTPHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":    "UP",
		"service":   "core-banking",
		"version":   "1.2.0",
		"timestamp": r.Context().Value("time"),
	})
}

func (h *HTTPHandler) HandleGetAccount(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		// Fallback for older mux if needed
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) > 0 {
			id = parts[len(parts)-1]
		}
	}

	acc, err := h.bankingSvc.GetAccount(id)
	if err != nil {
		if errors.Is(err, domain.ErrAccountNotFound) {
			http.Error(w, `{"error": "Account not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error": "Internal server error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(acc)
}

type TransactionRequest struct {
	AccountID   string  `json:"accountId"`
	Amount      float64 `json:"amount"`
	Description string  `json:"description"`
	ReferenceID string  `json:"referenceId"`
}

func (h *HTTPHandler) HandleCredit(w http.ResponseWriter, r *http.Request) {
	var req TransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	tx, err := h.bankingSvc.Credit(req.AccountID, req.Amount, req.Description, req.ReferenceID)
	if err != nil {
		h.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(tx)
}

func (h *HTTPHandler) HandleDebit(w http.ResponseWriter, r *http.Request) {
	var req TransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	tx, err := h.bankingSvc.Debit(req.AccountID, req.Amount, req.Description, req.ReferenceID)
	if err != nil {
		h.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(tx)
}

func (h *HTTPHandler) HandleGetStatement(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) >= 2 {
			id = parts[len(parts)-2]
		}
	}

	// Extracts customer ID header (e.g. from gateway / auth proxy)
	customerID := r.Header.Get("X-Customer-ID")
	if customerID == "" {
		customerID = "cust_001" // default fallback for internal service mesh
	}

	stmt, err := h.bankingSvc.GetStatement(customerID, id)
	if err != nil {
		h.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(stmt)
}

func (h *HTTPHandler) HandleExportTransactions(w http.ResponseWriter, r *http.Request) {
	accountID := r.URL.Query().Get("accountId")
	query := r.URL.Query().Get("q")

	if accountID == "" {
		http.Error(w, `{"error": "accountId parameter is required"}`, http.StatusBadRequest)
		return
	}

	entries, err := h.bankingSvc.SearchTransactions(accountID, query)
	if err != nil {
		h.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"accountId": accountID,
		"query":     query,
		"count":     len(entries),
		"results":   entries,
	})
}

func (h *HTTPHandler) handleError(w http.ResponseWriter, err error) {
	w.Header().Set("Content-Type", "application/json")
	switch {
	case errors.Is(err, domain.ErrAccountNotFound):
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
	case errors.Is(err, domain.ErrInsufficientBalance):
		w.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
	case errors.Is(err, domain.ErrInvalidAmount):
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
	case errors.Is(err, domain.ErrAccountInactive):
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
	default:
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Internal ledger processing error"})
	}
}

