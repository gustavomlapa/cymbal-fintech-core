from enum import Enum
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import uuid


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SETTLED = "SETTLED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class PaymentMethod(str, Enum):
    PIX = "PIX"
    TED = "TED"
    INTERNAL = "INTERNAL"


@dataclass
class PaymentOrder:
    id: str
    source_account_id: str
    destination_account_id: Optional[str]
    pix_key: Optional[str]
    method: PaymentMethod
    amount: float
    currency: str
    description: str
    status: PaymentStatus
    idempotency_key: Optional[str]
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    settled_at: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

