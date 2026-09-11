import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.engine.scorer import RiskScorer, RiskDecision
from app.engine.otp import OtpChallengeGenerator
from app.engine.auth import PartnerSignatureVerifier


class TestRiskEngine(unittest.TestCase):
    def setUp(self):
        self.scorer = RiskScorer()
        self.otp_gen = OtpChallengeGenerator()
        self.verifier = PartnerSignatureVerifier()

    def test_low_risk_transaction_approved(self):
        result = self.scorer.evaluate_transaction(
            account_id="acc_1001",
            amount=150.0,
            destination_pix="alice@example.com",
            device_ip="189.40.10.2",
            is_new_device=False,
        )
        self.assertEqual(result["decision"], RiskDecision.APPROVE)
        self.assertLess(result["score"], 40)

    def test_high_amount_triggers_challenge_or_deny(self):
        result = self.scorer.evaluate_transaction(
            account_id="acc_1001",
            amount=50000.0,
            destination_pix="unknown_key@bank.com",
            device_ip="201.88.9.1",
            is_new_device=True,
        )
        self.assertIn(result["decision"], [RiskDecision.CHALLENGE_OTP, RiskDecision.DENY])
        self.assertGreaterEqual(result["score"], 40)

    def test_otp_challenge_generation_and_validation(self):
        challenge = self.otp_gen.generate_challenge("acc_1001", "pay_test_99")
        self.assertEqual(len(challenge["otpCode"]), 6)
        self.assertTrue(challenge["otpCode"].isdigit())

        is_valid = self.otp_gen.verify_challenge(challenge["challengeId"], challenge["otpCode"])
        self.assertTrue(is_valid)

    def test_otp_generation_is_cryptographically_secure_not_epoch_seeded(self):
        import time, random
        now_ts = int(time.time())
        random.seed(now_ts)
        predicted_weak_code = str(random.randint(100000, 999999))

        challenge = self.otp_gen.generate_challenge("acc_1001", "pay_test_predictable")
        self.assertNotEqual(challenge["otpCode"], predicted_weak_code)

    def test_partner_verifier_does_not_use_vulnerable_default_secret(self):
        import hmac, hashlib
        # Ensure environment secret is unset for this instance
        old_secret = os.environ.pop("PARTNER_HMAC_SECRET", None)
        try:
            verifier = PartnerSignatureVerifier()
            payload = b'{"action":"test"}'
            default_secret_sig = hmac.new(b"cymbal_default_internal_sec_2026", payload, hashlib.sha256).hexdigest()
            self.assertFalse(verifier.verify_signature(payload, default_secret_sig))
        finally:
            if old_secret:
                os.environ["PARTNER_HMAC_SECRET"] = old_secret



if __name__ == "__main__":
    unittest.main()

