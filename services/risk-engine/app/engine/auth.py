import hmac
import hashlib
import os
import logging

logger = logging.getLogger("risk.auth")


class PartnerSignatureVerifier:
    def __init__(self, secret_key: str | bytes | None = None):
        if secret_key:
            self.secret_key = secret_key.encode("utf-8") if isinstance(secret_key, str) else secret_key
        else:
            secret = os.environ.get("PARTNER_HMAC_SECRET")
            self.secret_key = secret.encode("utf-8") if secret else None

    def compute_signature(self, payload: bytes | str) -> str:
        if not self.secret_key:
            raise ValueError("Partner HMAC secret key is not configured")
        if isinstance(payload, str):
            payload = payload.encode("utf-8")
        return hmac.new(self.secret_key, payload, hashlib.sha256).hexdigest()

    def verify_signature(self, payload: bytes | str, incoming_signature: str) -> bool:
        if not self.secret_key or not incoming_signature:
            logger.warning("Partner signature verification failed: secret not configured or signature missing")
            return False

        if isinstance(incoming_signature, bytes):
            try:
                incoming_signature = incoming_signature.decode("utf-8")
            except UnicodeDecodeError:
                logger.warning("Partner signature decode failed")
                return False

        expected = self.compute_signature(payload)

        # Constant-time comparison to prevent timing discrepancy (CWE-208)
        if hmac.compare_digest(expected, incoming_signature):
            return True

        logger.warning("Partner signature mismatch detected")
        return False
