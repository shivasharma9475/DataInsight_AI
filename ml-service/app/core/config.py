import os
from dotenv import load_dotenv

# Load variables from ml-service/.env
load_dotenv()

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")

# Shared secret between Node backend and ML service
INTERNAL_API_KEY = os.environ.get(
    "INTERNAL_API_KEY",
    "dev_internal_key_change_me"
)

os.makedirs(UPLOAD_DIR, exist_ok=True)


class _Settings:
    UPLOAD_DIR = UPLOAD_DIR


settings = _Settings()