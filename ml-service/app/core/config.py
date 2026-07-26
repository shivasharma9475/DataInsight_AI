import os

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")
# Shared secret so this internal service only accepts calls from the Node backend
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "dev_internal_key_change_me")

os.makedirs(UPLOAD_DIR, exist_ok=True)


class _Settings:
    UPLOAD_DIR = UPLOAD_DIR


settings = _Settings()
