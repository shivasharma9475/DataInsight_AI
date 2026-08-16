import os
from dotenv import load_dotenv

# Load variables from ml-service/.env
load_dotenv()

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")

_DEV_DEFAULT_INTERNAL_KEY = "dev_internal_key_change_me"

_env_value = os.environ.get("INTERNAL_API_KEY")

if not _env_value and os.environ.get("ENVIRONMENT", "").lower() == "production":
    raise RuntimeError(
        "[FATAL] INTERNAL_API_KEY must be set when ENVIRONMENT=production. "
        "Refusing to start with an insecure default secret."
    )

# Shared secret between Node backend and ML service. Falls back to an
# obviously-fake default only outside production, so the project still
# runs out of the box for local development.
INTERNAL_API_KEY = _env_value or _DEV_DEFAULT_INTERNAL_KEY

os.makedirs(UPLOAD_DIR, exist_ok=True)


class _Settings:
    UPLOAD_DIR = UPLOAD_DIR


settings = _Settings()