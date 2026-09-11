import hmac
import hashlib
import os
import secrets
import logging
from typing import Optional

logger = logging.getLogger("risk.auth")


class PartnerSignatureVerifier:
    def __init__(self, secret_key: Optional[str] = None):
        secret = secret_key or os.environ.get("PARTNER_HMAC_SECRET")
        if secret:
            self.secret_key = secret.encode("utf-8")
        else:
            # Ephemeral cryptographically secure secret when unconfigured
            self.secret_key = secrets.token_bytes(32)

    def compute_signature(self, payload: bytes) -> str:
        return hmac.new(self.secret_key, payload, hashlib.sha256).hexdigest()

    def verify_signature(self, payload: bytes, incoming_signature: str) -> bool:
        expected = self.compute_signature(payload)

        # Constant-time comparison to prevent timing attacks
        if hmac.compare_digest(expected, incoming_signature):
            return True

        logger.warning("Partner signature mismatch detected")
        return False


