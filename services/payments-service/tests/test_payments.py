import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.domain.models import PaymentOrder, PaymentStatus, PaymentMethod
from app.services.payment_service import PaymentService
from app.services.idempotency import IdempotencyManager
from app.services.webhook_dispatcher import WebhookDispatcher


class TestPaymentsService(unittest.TestCase):
    def setUp(self):
        self.idempotency_mgr = IdempotencyManager()
        self.webhook_dispatcher = WebhookDispatcher()
        self.payment_svc = PaymentService(
            idempotency_mgr=self.idempotency_mgr,
            webhook_dispatcher=self.webhook_dispatcher,
        )

    def test_create_pix_payment_success(self):
        order = self.payment_svc.process_pix_payment(
            source_account_id="acc_1001",
            pix_key="alice.silva@cymbalfintech.demo",
            amount=150.00,
            description="Pagamento de teste PIX",
            idempotency_key="idem_test_001",
        )
        self.assertIsNotNone(order)
        self.assertEqual(order.status, PaymentStatus.SETTLED)
        self.assertEqual(order.amount, 150.00)
        self.assertEqual(order.method, PaymentMethod.PIX)

    def test_idempotency_replay(self):
        first_order = self.payment_svc.process_pix_payment(
            source_account_id="acc_1001",
            pix_key="chave@cymbal.com",
            amount=50.00,
            description="Primeira chamada",
            idempotency_key="idem_key_replay_001",
        )
        second_order = self.payment_svc.process_pix_payment(
            source_account_id="acc_1001",
            pix_key="chave@cymbal.com",
            amount=50.00,
            description="Primeira chamada",
            idempotency_key="idem_key_replay_001",
        )
        self.assertEqual(first_order.id, second_order.id)

    def test_invalid_payment_amount(self):
        with self.assertRaises(ValueError):
            self.payment_svc.process_pix_payment(
                source_account_id="acc_1001",
                pix_key="chave@cymbal.com",
                amount=-10.0,
                description="Invalido",
                idempotency_key="idem_invalid",
            )

    def test_webhook_url_validation_blocks_ssrf(self):
        # Cloud metadata service (169.254.169.254)
        self.assertFalse(self.webhook_dispatcher.is_safe_callback_url("http://169.254.169.254/latest/meta-data"))
        # RFC 1918 private subnets
        self.assertFalse(self.webhook_dispatcher.is_safe_callback_url("http://10.0.0.1:8080/callback"))
        self.assertFalse(self.webhook_dispatcher.is_safe_callback_url("http://192.168.1.50/webhook"))
        self.assertFalse(self.webhook_dispatcher.is_safe_callback_url("http://172.16.10.2/events"))
        # Loopback
        self.assertFalse(self.webhook_dispatcher.is_safe_callback_url("http://127.0.0.1:8081/debit"))
        self.assertFalse(self.webhook_dispatcher.is_safe_callback_url("http://localhost:8081/accounts"))
        # Valid public URL should pass
        self.assertTrue(self.webhook_dispatcher.is_safe_callback_url("https://api.merchant.com/webhook"))



if __name__ == "__main__":
    unittest.main()

