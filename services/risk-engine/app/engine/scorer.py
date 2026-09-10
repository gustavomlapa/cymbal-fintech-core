from enum import Enum
from typing import Dict, Any, List
import logging

logger = logging.getLogger("risk.scorer")


class RiskDecision(str, Enum):
    APPROVE = "APPROVE"
    CHALLENGE_OTP = "CHALLENGE_OTP"
    DENY = "DENY"


class RiskScorer:
    def __init__(self):
        self.blocked_ips = {"198.51.100.42", "203.0.113.19"}
        self.suspicious_subnets = ["198.51.", "203.0."]

    def evaluate_transaction(
        self,
        account_id: str,
        amount: float,
        destination_pix: str,
        device_ip: str = "127.0.0.1",
        is_new_device: bool = False,
        hour_of_day: int = 14,
    ) -> Dict[str, Any]:
        flags: List[str] = []
        score = 10  # baseline normal risk

        # Rule 1: Immediate IP blocklist
        if device_ip in self.blocked_ips:
            return {
                "score": 100,
                "decision": RiskDecision.DENY,
                "flags": ["IP_BLACKLISTED"],
                "reason": "Originating IP is marked in high-risk fraud blocklist"
            }

        # Rule 2: Amount threshold checks
        if amount > 50000.0:
            score += 55
            flags.append("HIGH_VALUE_THRESHOLD_EXCEEDED")
        elif amount > 5000.0:
            score += 25
            flags.append("ELEVATED_AMOUNT")

        # Rule 3: Unrecognized device
        if is_new_device:
            score += 20
            flags.append("UNRECOGNIZED_DEVICE")

        # Rule 4: Night-time high risk window (22:00 - 06:00)
        if hour_of_day >= 22 or hour_of_day < 6:
            score += 15
            flags.append("OFF_HOURS_EXECUTION")

        score = min(score, 100)

        if score < 40:
            decision = RiskDecision.APPROVE
            reason = "Low risk profile within normal user behavioral patterns"
        elif score <= 75:
            decision = RiskDecision.CHALLENGE_OTP
            reason = "Medium risk triggered; step-up two-factor authorization required"
        else:
            decision = RiskDecision.DENY
            reason = "Critical risk threshold breached; transaction blocked"

        logger.info(f"Evaluated account {account_id}: amount={amount}, score={score}, decision={decision}")

        return {
            "score": score,
            "decision": decision,
            "flags": flags,
            "reason": reason
        }
