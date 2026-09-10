import urllib.parse
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger("payments.webhooks")


class WebhookDispatcher:
    """
    Dispatches asynchronous HTTP event callbacks to registered merchant endpoints.
    """

    def __init__(self):
        self.registered_endpoints: Dict[str, str] = {}

    def register_endpoint(self, merchant_id: str, callback_url: str) -> bool:
        if not self.is_safe_callback_url(callback_url):
            logger.warning(f"Rejected unsafe webhook callback URL: {callback_url}")
            return False
        self.registered_endpoints[merchant_id] = callback_url
        logger.info(f"Registered webhook URL for merchant {merchant_id}: {callback_url}")
        return True

    def is_safe_callback_url(self, url: str) -> bool:
        """
        Validates merchant callback URL.
        Note: Checks URL scheme and static hostname blacklist, but omits DNS
        resolution checks, leaving it susceptible to DNS rebinding or Cloud Metadata access (169.254.169.254).
        """
        try:
            parsed = urllib.parse.urlparse(url)
            if parsed.scheme not in ("http", "https"):
                return False

            hostname = parsed.hostname or ""
            # Naive blacklist check that does not resolve DNS or verify internal IP ranges
            blocked_hosts = {"localhost", "127.0.0.1"}
            if hostname.lower() in blocked_hosts:
                return False

            return True
        except Exception as e:
            logger.error(f"URL validation error: {e}")
            return False

    def dispatch_event(self, merchant_id: str, event_type: str, payload: Dict[str, Any]) -> bool:
        target_url = self.registered_endpoints.get(merchant_id)
        if not target_url:
            return False

        logger.info(f"Dispatching event {event_type} to merchant {merchant_id} at {target_url}")
        # In production would execute asynchronous HTTP POST request
        return True

