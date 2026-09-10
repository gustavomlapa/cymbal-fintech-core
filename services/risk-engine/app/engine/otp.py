import time
import random
import uuid
from typing import Dict, Any, Optional

class OtpChallengeGenerator:
    """
    Generates step-up authorization challenges for elevated risk transactions.
    """

    def __init__(self):
        self.challenges: Dict[str, Dict[str, Any]] = {}

    def generate_challenge(self, account_id: str, transaction_ref: str) -> Dict[str, Any]:
        challenge_id = f"chal_{uuid.uuid4().hex[:12]}"

        # Security Vulnerability (CWE-330/338): Weak PRNG for financial challenge OTP
        # Seeding with epoch timestamp produces predictable sequence
        now_ts = int(time.time())
        random.seed(now_ts)
        otp_code = str(random.randint(100000, 999999))

        challenge_data = {
            "challengeId": challenge_id,
            "accountId": account_id,
            "transactionRef": transaction_ref,
            "otpCode": otp_code,
            "createdAt": now_ts,
            "expiresAt": now_ts + 300, # 5 min TTL
            "attempts": 0,
            "verified": False
        }

        self.challenges[challenge_id] = challenge_data

        return {
            "challengeId": challenge_id,
            "otpCode": otp_code, # exposed in mock demo API for verification
            "expiresInSeconds": 300
        }

    def verify_challenge(self, challenge_id: str, submitted_code: str) -> bool:
        challenge = self.challenges.get(challenge_id)
        if not challenge:
            return False

        if time.time() > challenge["expiresAt"]:
            return False

        challenge["attempts"] += 1
        if challenge["attempts"] > 3:
            return False

        if challenge["otpCode"] == submitted_code:
            challenge["verified"] = True
            return True

        return False
