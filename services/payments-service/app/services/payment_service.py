import uuid
import time
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from app.domain.models import PaymentOrder, PaymentStatus, PaymentMethod
from app.services.idempotency import IdempotencyManager
from app.services.webhook_dispatcher import WebhookDispatcher

logger = logging.getLogger("payments.service")


class PaymentService:
    def __init__(
        self,
        idempotency_mgr: Optional[IdempotencyManager] = None,
        webhook_dispatcher: Optional[WebhookDispatcher] = None,
    ):
        self.idempotency_mgr = idempotency_mgr or IdempotencyManager()
        self.webhook_dispatcher = webhook_dispatcher or WebhookDispatcher()
        self.orders: Dict[str, PaymentOrder] = {}
        self._seed()

    def _seed(self):
        seed_orders = [
            PaymentOrder(
                id="pay_pix_901",
                source_account_id="acc_1001",
                destination_account_id="acc_1002",
                pix_key="bruno.santos@cymbalfintech.demo",
                method=PaymentMethod.PIX,
                amount=350.00,
                currency="BRL",
                description="Transferencia mensal PIX",
                status=PaymentStatus.SETTLED,
                idempotency_key="seed_idem_001",
                created_at="2026-09-08T10:15:00Z",
                settled_at="2026-09-08T10:15:02Z",
            ),
            PaymentOrder(
                id="pay_ted_902",
                source_account_id="acc_1003",
                destination_account_id="acc_1001",
                pix_key=None,
                method=PaymentMethod.TED,
                amount=25000.00,
                currency="BRL",
                description="Aporte de liquidez institucional",
                status=PaymentStatus.SETTLED,
                idempotency_key="seed_idem_002",
                created_at="2026-09-09T14:20:00Z",
                settled_at="2026-09-09T14:21:00Z",
            ),
        ]
        for order in seed_orders:
            self.orders[order.id] = order

    def list_payments(self, account_id: Optional[str] = None) -> List[Dict[str, Any]]:
        results = list(self.orders.values())
        if account_id:
            results = [o for o in results if o.source_account_id == account_id or o.destination_account_id == account_id]
        return [o.to_dict() for o in reversed(results)]

    def get_payment(self, payment_id: str) -> Optional[Dict[str, Any]]:
        order = self.orders.get(payment_id)
        return order.to_dict() if order else None

    def process_pix_payment(
        self,
        source_account_id: str,
        pix_key: str,
        amount: float,
        description: str,
        idempotency_key: Optional[str] = None,
    ) -> PaymentOrder:
        if amount <= 0:
            raise ValueError("Payment amount must be greater than zero")

        if not pix_key or not pix_key.strip():
            raise ValueError("PIX key is required")

        # 1. Idempotency Check
        if idempotency_key:
            cached = self.idempotency_mgr.get_record(idempotency_key)
            if cached:
                logger.info(f"Returning cached payment for idempotency key: {idempotency_key}")
                cached_data = cached["result"]
                return PaymentOrder(
                    id=cached_data["id"],
                    source_account_id=cached_data["source_account_id"],
                    destination_account_id=cached_data.get("destination_account_id"),
                    pix_key=cached_data.get("pix_key"),
                    method=PaymentMethod(cached_data["method"]),
                    amount=cached_data["amount"],
                    currency=cached_data["currency"],
                    description=cached_data["description"],
                    status=PaymentStatus(cached_data["status"]),
                    idempotency_key=idempotency_key,
                    created_at=cached_data["created_at"],
                    settled_at=cached_data.get("settled_at"),
                )

        # 2. Simulate settlement latency with Central Bank PIX rail
        time.sleep(0.01)

        # 3. Create settled payment order
        order_id = f"pay_{uuid.uuid4().hex[:10]}"
        now_str = datetime.now(timezone.utc).isoformat()

        order = PaymentOrder(
            id=order_id,
            source_account_id=source_account_id,
            destination_account_id=None,
            pix_key=pix_key,
            method=PaymentMethod.PIX,
            amount=amount,
            currency="BRL",
            description=description,
            status=PaymentStatus.SETTLED,
            idempotency_key=idempotency_key,
            created_at=now_str,
            settled_at=now_str,
        )

        self.orders[order_id] = order

        # 4. Commit to idempotency cache after settlement completes
        if idempotency_key:
            self.idempotency_mgr.save_record(idempotency_key, order.to_dict())

        logger.info(f"PIX payment {order_id} settled for amount R$ {amount:.2f}")
        return order
