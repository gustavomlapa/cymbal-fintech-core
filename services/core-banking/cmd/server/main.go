package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cymbal-fintech/core-banking/internal/handler"
	"github.com/cymbal-fintech/core-banking/internal/repository"
	"github.com/cymbal-fintech/core-banking/internal/service"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	repo := repository.NewMemoryRepository()
	bankingSvc := service.NewBankingService(repo, logger)
	httpHandler := handler.NewHTTPHandler(bankingSvc, logger)

	mux := http.NewServeMux()
	httpHandler.RegisterRoutes(mux)

	// Add basic middleware for request logging and CORS
	handlerWithMiddleware := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Customer-ID")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		start := time.Now()
		mux.ServeHTTP(w, r)
		logger.Info("http request processed",
			"method", r.Method,
			"path", r.URL.Path,
			"durationMs", time.Since(start).Milliseconds(),
		)
	})

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handlerWithMiddleware,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		logger.Info("core banking microservice starting", "port", port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server startup failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down core banking service...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error("server forced to shutdown", "error", err)
	}

	logger.Info("core banking service exited gracefully")
}

