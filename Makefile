.PHONY: all test up down dev deploy

all: test

test:
	@echo "=== Running CymbalFintech Service Test Suites ==="
	@echo "-> Testing identity-service (Node.js)..."
	node --test services/identity-service/test/*.test.js
	@echo "-> Testing payments-service (Python)..."
	python3 -m unittest discover services/payments-service/tests
	@echo "-> Testing credit-service (Node.js)..."
	node --test services/credit-service/test/*.test.js
	@echo "-> Testing risk-engine (Python)..."
	python3 -m unittest discover services/risk-engine/tests
	@echo "-> Testing web-portal (Node.js)..."
	node --test services/web-portal/test/*.test.js
	@echo "All service tests passed successfully!"

up:
	docker compose up --build -d

down:
	docker compose down

dev:
	bash scripts/start-local.sh

deploy:
	bash scripts/deploy-cloudrun.sh
