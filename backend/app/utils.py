import base64
import hashlib
import random
import secrets

from sqlalchemy.orm import Session

from .models import Meeting


def generate_zoom_style_id(db: Session) -> str:
    """Return a unique human-friendly meeting ID like 123-456-789."""
    while True:
        raw = "".join(str(random.randint(0, 9)) for _ in range(9))
        meeting_id = f"{raw[:3]}-{raw[3:6]}-{raw[6:]}"

        exists = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()

        if not exists:
            return meeting_id


def build_invite_link(frontend_origin: str, meeting_id: str) -> str:
    return f"{frontend_origin.rstrip('/')}/join?meetingId={meeting_id}"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        100_000,
    )

    return base64.b64encode(salt + key).decode("utf-8")


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        raw = base64.b64decode(stored_hash.encode("utf-8"))
        salt = raw[:16]
        expected_key = raw[16:]

        actual_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            100_000,
        )

        return secrets.compare_digest(actual_key, expected_key)

    except Exception:
        return False
