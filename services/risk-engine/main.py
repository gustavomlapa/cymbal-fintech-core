import os
import json
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

from app.engine.scorer import RiskScorer
from app.engine.otp import OtpChallengeGenerator
from app.engine.auth import PartnerSignatureVerifier

logging.basicConfig(level=logging.INFO, format='{"time": "%(asctime)s", "level": "%(levelname)s", "service": "risk-engine", "message": "%(message)s"}')
logger = logging.getLogger("risk.server")

scorer = RiskScorer()
otp_gen = OtpChallengeGenerator()
auth_verifier = PartnerSignatureVerifier()


class RiskHTTPHandler(BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, data: dict):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Partner-Signature")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Partner-Signature")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/health":
            self._send_json(200, {
                "status": "UP",
                "service": "risk-engine",
                "version": "1.2.0"
            })
            return

        self._send_json(404, {"error": "Route not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        content_len = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_len) if content_len > 0 else b"{}"

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception:
            self._send_json(400, {"error": "Invalid JSON payload"})
            return

        if path == "/api/v1/risk/evaluate":
            account_id = payload.get("accountId", "acc_1001")
            amount = float(payload.get("amount", 0.0))
            destination_pix = payload.get("destinationPix", "")
            device_ip = payload.get("deviceIp", "127.0.0.1")
            is_new_device = bool(payload.get("isNewDevice", False))
            hour_of_day = int(payload.get("hourOfDay", 14))

            result = scorer.evaluate_transaction(
                account_id=account_id,
                amount=amount,
                destination_pix=destination_pix,
                device_ip=device_ip,
                is_new_device=is_new_device,
                hour_of_day=hour_of_day,
            )
            self._send_json(200, result)
            return

        if path == "/api/v1/risk/challenge":
            account_id = payload.get("accountId", "acc_1001")
            tx_ref = payload.get("transactionRef", "tx_ref_default")
            challenge = otp_gen.generate_challenge(account_id, tx_ref)
            self._send_json(201, challenge)
            return

        if path == "/api/v1/risk/verify-challenge":
            challenge_id = payload.get("challengeId")
            submitted_code = str(payload.get("otpCode", ""))
            if not challenge_id or not submitted_code:
                self._send_json(400, {"error": "challengeId and otpCode are required"})
                return

            valid = otp_gen.verify_challenge(challenge_id, submitted_code)
            if valid:
                self._send_json(200, {"verified": True, "message": "Step-up authorization confirmed"})
            else:
                self._send_json(401, {"verified": False, "error": "Invalid or expired authorization code"})
            return

        if path == "/api/v1/risk/partner-verify":
            sig = self.headers.get("X-Partner-Signature", "")
            valid = auth_verifier.verify_signature(raw_body, sig)
            if valid:
                self._send_json(200, {"valid": True, "message": "Signature verified"})
            else:
                self._send_json(403, {"valid": False, "error": "Invalid partner HMAC signature"})
            return

        self._send_json(404, {"error": "Route not found"})


def run():
    port = int(os.environ.get("PORT", 8085))
    server = HTTPServer(("0.0.0.0", port), RiskHTTPHandler)
    logger.info(f"Risk & Anti-Fraud engine running on port {port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Risk engine stopping...")
        server.server_close()


if __name__ == "__main__":
    run()
