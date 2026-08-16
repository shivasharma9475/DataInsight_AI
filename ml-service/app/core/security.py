"""
Shared internal-authentication dependency for the ML service.

The Node/Express backend is the only allowed caller of this service. It
authenticates end users itself and forwards a shared secret header
(`x-internal-key`) on every request. This module is the single source of
truth for validating that header so the check can't drift between routers.
"""
import hmac

from fastapi import Header, HTTPException

from app.core.config import INTERNAL_API_KEY


async def require_internal_key(x_internal_key: str = Header(default="")):
    # Constant-time comparison to avoid leaking timing information about
    # the shared secret.
    if not hmac.compare_digest(x_internal_key, INTERNAL_API_KEY):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: invalid or missing internal key",
        )
