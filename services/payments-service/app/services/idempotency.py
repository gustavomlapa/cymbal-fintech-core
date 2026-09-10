import time
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger("payments.idempotency")


class IdempotencyManager:
    """
    Manages payment idempotency to prevent duplicate transaction charges.
    Stores completed payment records mapped by Idempotency-Key.
    """

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}

    def get_record(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Check if an idempotency key was previously processed.
        """
        if not key:
            return None
        return self._store.get(key)

    def save_record(self, key: str, data: Dict[str, Any]) -> None:
        """
        Commit completed transaction result to idempotency store.
        Note: check-then-set race window occurs when commit is only executed
        after slow downstream external rail settlement.
        """
        if not key:
            return
        self._store[key] = {
            "result": data,
            "cached_at": time.time()
        }
        logger.info(f"Committed idempotency key: {key}")

