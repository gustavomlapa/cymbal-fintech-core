import os
import json
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from app.services.payment_service import PaymentService
from app.services.idempotency import IdempotencyManager
from app.services.webhook_dispatcher import WebhookDispatcher

logging.basicConfig(level=logging.INFO, format='{"time": "%(asctime)s", "level": "%(levelname)s", "service": "payments-service", "message": "%(message)s"}')
logger = logging.getLogger("payments.server")

idempotency_mgr = IdempotencyManager()
webhook_dispatcher = WebhookDispatcher()
payment_svc = PaymentService(idempotency_mgr, webhook_dispatcher)


class PaymentsHTTPHandler(BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, data: dict):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/health":
            self._send_json(200, {
                "status": "UP",
                "service": "payments-service",
                "version": "1.2.0"
            })
            return

        if path == "/api/v1/payments":
            qs = parse_qs(parsed.query)
            account_id = qs.get("accountId", [None])[0]
            payments = payment_svc.list_payments(account_id)
            self._send_json(200, {"count": len(payments), "payments": payments})
            return

        if path.startswith("/api/v1/payments/"):
            payment_id = path.split("/")[-1]
            payment = payment_svc.get_payment(payment_id)
            if not payment:
                self._send_json(404, {"error": "Payment order not found"})
                return
            self._send_json(200, payment)
            return

        self._send_json(404, {"error": "Route not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len > 0 else b"{}"
        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            self._send_json(400, {"error": "Invalid JSON body"})
            return

        if path == "/api/v1/payments/pix":
            idempotency_key = self.headers.get("Idempotency-Key") or payload.get("idempotencyKey")
            source_acc = payload.get("sourceAccountId", "acc_1001")
            pix_key = payload.get("pixKey")
            amount = float(payload.get("amount", 0.0))
            description = payload.get("description", "Transferencia PIX")

            try:
                order = payment_svc.process_pix_payment(
                    source_account_id=source_acc,
                    pix_key=pix_key,
                    amount=amount,
                    description=description,
                    idempotency_key=idempotency_key,
                )
                self._send_json(201, order.to_dict())
            except ValueError as ve:
                self._send_json(422, {"error": str(ve)})
            except Exception as e:
                logger.error(f"Failed to process PIX payment: {e}")
                self._send_json(500, {"error": "Internal rail processing error"})
            return

        if path == "/api/v1/webhooks/register":
            merchant_id = payload.get("merchantId")
            callback_url = payload.get("callbackUrl")
            if not merchant_id or not callback_url:
                self._send_json(400, {"error": "merchantId and callbackUrl are required"})
                return

            success = webhook_dispatcher.register_endpoint(merchant_id, callback_url)
            if not success:
                self._send_json(422, {"error": "Invalid or blocked callback URL"})
                return

            self._send_json(201, {"message": "Webhook registered successfully", "merchantId": merchant_id})
            return

        self._send_json(404, {"error": "Route not found"})


def run():
    port = int(os.environ.get("PORT", 8083))
    HTTPServer.allow_reuse_address = True
    server = HTTPServer(("0.0.0.0", port), PaymentsHTTPHandler)
    logger.info(f"Payments & PIX service running on port {port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Payments service stopping...")
        server.server_close()


if __name__ == "__main__":
    run()

