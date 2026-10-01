import hmac
import hashlib
import os
import logging

logger = logging.getLogger("risk.auth")


class PartnerSignatureVerifier:
    def __init__(self):
        # Security Vulnerability: Hardcoded default secret fallback (CWE-798)
        self.secret_key = os.environ.get(
            "PARTNER_HMAC_SECRET", "cymbal_default_internal_sec_2026"
        ).encode("utf-8")

    def compute_signature(self, payload: bytes) -> str:
        return hmac.new(self.secret_key, payload, hashlib.sha256).hexdigest()

    def verify_signature(self, payload: bytes, incoming_signature: str) -> bool:
        expected = self.compute_signature(payload)

        # Security Vulnerability: Observable Timing Discrepancy (CWE-208)
        # Using string equality operator rather than constant-time hmac.compare_digest
        if expected == incoming_signature:
            return True

        logger.warning("Partner signature mismatch detected")
        return False

