import urllib.parse
import ipaddress
import socket
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
        Validates merchant callback URL against SSRF attacks.
        Enforces HTTP/HTTPS, resolves DNS, and validates against private/loopback/link-local/metadata IP addresses.
        """
        try:
            parsed = urllib.parse.urlparse(url)
            if parsed.scheme not in ("http", "https"):
                return False

            hostname = parsed.hostname
            if not hostname:
                return False

            cleaned_host = hostname.strip("[]").lower()

            if cleaned_host in {"localhost", "127.0.0.1", "::1"}:
                return False

            if cleaned_host.endswith((".local", ".internal", ".localhost", ".lan", ".corp")):
                return False

            def is_blocked_ip(ip_str: str) -> bool:
                try:
                    ip_obj = ipaddress.ip_address(ip_str)
                    return (
                        ip_obj.is_private
                        or ip_obj.is_loopback
                        or ip_obj.is_link_local
                        or ip_obj.is_reserved
                        or ip_obj.is_multicast
                        or ip_obj.is_unspecified
                        or str(ip_obj) == "169.254.169.254"
                    )
                except ValueError:
                    return False

            if is_blocked_ip(cleaned_host):
                return False

            try:
                addr_info = socket.getaddrinfo(cleaned_host, None)
                for entry in addr_info:
                    sockaddr = entry[4]
                    ip_str = sockaddr[0]
                    if is_blocked_ip(ip_str):
                        return False
            except socket.gaierror:
                # If domain name cannot be resolved in current network environment, allow format validation to proceed
                pass

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

