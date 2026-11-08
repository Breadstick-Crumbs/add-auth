"""Password hashing and signed tokens.

Adapted from fastapi/full-stack-fastapi-template (MIT, Sebastián Ramírez).
"""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher

from .config import auth_settings

ALGORITHM = "HS256"

# Argon2 for new hashes; bcrypt is accepted so hashes from an older system
# still verify, and they are upgraded to Argon2 on the next login.
password_hash = PasswordHash((Argon2Hasher(), BcryptHasher()))

# Hash of a random password. Checked when the email is unknown so a failed
# login takes the same time whether or not the account exists.
DUMMY_HASH = password_hash.hash("not-a-real-password-0f3a9c")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> tuple[bool, str | None]:
    """Returns (ok, new_hash). new_hash is set when the stored hash should be upgraded."""
    return password_hash.verify_and_update(password, hashed)


def _encode(claims: dict[str, Any], expires_in: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {**claims, "iat": now, "nbf": now, "exp": now + expires_in}
    return jwt.encode(payload, auth_settings.secret_key, algorithm=ALGORITHM)


def _decode(token: str, purpose: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, auth_settings.secret_key, algorithms=[ALGORITHM])
    except InvalidTokenError:
        return None
    if payload.get("purpose") != purpose:
        return None
    return payload


def create_access_token(user_id: str) -> str:
    return _encode(
        {"sub": user_id, "purpose": "access"},
        timedelta(minutes=auth_settings.access_token_expire_minutes),
    )


def read_access_token(token: str) -> str | None:
    payload = _decode(token, "access")
    return str(payload["sub"]) if payload else None


def _fingerprint(hashed_password: str) -> str:
    return hashlib.sha256(hashed_password.encode()).hexdigest()[:16]


def create_reset_token(user_id: str, hashed_password: str) -> str:
    # The token carries a fingerprint of the current password hash, so it stops
    # working once the password changes: each reset link works once.
    return _encode(
        {"sub": user_id, "purpose": "reset", "pw": _fingerprint(hashed_password)},
        timedelta(minutes=auth_settings.reset_token_expire_minutes),
    )


def read_reset_token(token: str) -> tuple[str, str] | None:
    """Returns (user_id, fingerprint) or None."""
    payload = _decode(token, "reset")
    if not payload:
        return None
    return str(payload["sub"]), str(payload.get("pw", ""))


def reset_token_matches(fingerprint: str, hashed_password: str) -> bool:
    return fingerprint == _fingerprint(hashed_password)
