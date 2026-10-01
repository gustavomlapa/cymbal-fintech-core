import hmac
import hashlib
import os
import logging
from typing import Optional, Union

logger = logging.getLogger("risk.auth")


class PartnerSignatureVerifier:
    def __init__(self, secret_key: Optional[Union[str, bytes]] = None):
        secret = secret_key if secret_key is not None else os.environ.get("PARTNER_HMAC_SECRET")
        if isinstance(secret, str):
            self.secret_key: Optional[bytes] = secret.encode("utf-8") if secret else None
        elif isinstance(secret, bytes):
            self.secret_key = secret if secret else None
        else:
            self.secret_key = None

        if not self.secret_key:
            logger.warning("PARTNER_HMAC_SECRET environment variable is not configured")

    def compute_signature(self, payload: Union[bytes, str]) -> str:
        if not self.secret_key:
            raise ValueError("PARTNER_HMAC_SECRET is not configured")
        if isinstance(payload, str):
            payload = payload.encode("utf-8")
        return hmac.new(self.secret_key, payload, hashlib.sha256).hexdigest()

    def verify_signature(self, payload: Union[bytes, str], incoming_signature: str) -> bool:
        if not self.secret_key or not incoming_signature or not isinstance(incoming_signature, str):
            logger.warning("Partner signature mismatch detected")
            return False

        try:
            expected = self.compute_signature(payload)
        except Exception:
            logger.warning("Partner signature computation failed")
            return False

        if hmac.compare_digest(expected, incoming_signature):
            return True

        logger.warning("Partner signature mismatch detected")
        return False
