#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=========================================================="
echo " Starting CymbalFintech Core Platform (Local Environment) "
echo "=========================================================="

PORTS=(3000 8081 8082 8083 8084 8085)

# 1. Pre-flight check: free any stale processes lingering on service ports
echo "-> Checking and freeing service ports..."
for port in "${PORTS[@]}"; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "   Freeing port $port (terminating stale PID(s): $pids)..."
    kill -9 $pids 2>/dev/null || true
  fi
done

PIDS=()

cleanup() {
  echo ""
  echo "Shutting down CymbalFintech microservices..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  for port in "${PORTS[@]}"; do
    stale=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$stale" ]; then
      kill -9 $stale 2>/dev/null || true
    fi
  done
  echo "All services terminated."
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 2. Start Identity Service (Node.js) on port 8082
echo "-> Starting identity-service on :8082..."
PORT=8082 node "$DIR/services/identity-service/src/index.js" &
PIDS+=($!)

# 3. Start Payments Service (Python) on port 8083
echo "-> Starting payments-service on :8083..."
PYTHONPATH="$DIR/services/payments-service" PORT=8083 python3 "$DIR/services/payments-service/main.py" &
PIDS+=($!)

# 4. Start Credit Service (Node.js) on port 8084
echo "-> Starting credit-service on :8084..."
PORT=8084 node "$DIR/services/credit-service/src/index.js" &
PIDS+=($!)

# 5. Start Risk Engine (Python) on port 8085
echo "-> Starting risk-engine on :8085..."
PYTHONPATH="$DIR/services/risk-engine" PORT=8085 python3 "$DIR/services/risk-engine/main.py" &
PIDS+=($!)

# 6. Start Web Portal (Node.js) on port 3000
echo "-> Starting web-portal on :3000..."
PORT=3000 node "$DIR/services/web-portal/server.js" &
PIDS+=($!)

sleep 2

echo ""
echo "=========================================================="
echo " CymbalFintech Platform is ONLINE!                        "
echo "=========================================================="
echo " Central Web Portal:  http://localhost:3000"
echo " Identity Service:    http://localhost:8082/health"
echo " Payments Service:    http://localhost:8083/health"
echo " Credit Service:      http://localhost:8084/health"
echo " Risk Engine:         http://localhost:8085/health"
echo " Core Banking API:    http://localhost:8081/health (Run via Go/Docker)"
echo "=========================================================="
echo " Press Ctrl+C to terminate all services."
echo ""

wait
