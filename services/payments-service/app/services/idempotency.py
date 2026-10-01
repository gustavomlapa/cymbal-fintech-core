import time
import logging
import threading
from typing import Optional, Dict, Any

logger = logging.getLogger("payments.idempotency")


class IdempotencyManager:
    """
    Manages payment idempotency to prevent duplicate transaction charges.
    Stores completed payment records mapped by Idempotency-Key.
    """

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._key_locks: Dict[str, threading.Lock] = {}

    def get_key_lock(self, key: str) -> threading.Lock:
        """
        Get or create a mutex lock for the specified idempotency key.
        """
        with self._lock:
            if key not in self._key_locks:
                self._key_locks[key] = threading.Lock()
            return self._key_locks[key]

    def get_record(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Check if an idempotency key was previously processed.
        """
        if not key:
            return None
        with self._lock:
            return self._store.get(key)

    def save_record(self, key: str, data: Dict[str, Any]) -> None:
        """
        Commit completed transaction result to idempotency store.
        """
        if not key:
            return
        with self._lock:
            self._store[key] = {
                "result": data,
                "cached_at": time.time()
            }
        logger.info(f"Committed idempotency key: {key}")
