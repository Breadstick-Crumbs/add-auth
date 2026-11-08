import os
from dataclasses import dataclass, field


def _env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    return value if value not in (None, "") else default


@dataclass(frozen=True)
class AuthSettings:
    # Required. Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
    secret_key: str = field(default_factory=lambda: _env("AUTH_SECRET") or "")
    access_token_expire_minutes: int = field(
        default_factory=lambda: int(_env("AUTH_ACCESS_TOKEN_MINUTES", str(60 * 24 * 7)))
    )
    reset_token_expire_minutes: int = field(
        default_factory=lambda: int(_env("AUTH_RESET_TOKEN_MINUTES", "60"))
    )
    # Where the reset link points: {frontend_url}/reset-password?token=...
    frontend_url: str = field(default_factory=lambda: _env("FRONTEND_URL", "http://localhost:3000") or "")
    smtp_host: str | None = field(default_factory=lambda: _env("SMTP_HOST"))
    smtp_port: int = field(default_factory=lambda: int(_env("SMTP_PORT", "587")))
    smtp_user: str | None = field(default_factory=lambda: _env("SMTP_USER"))
    smtp_password: str | None = field(default_factory=lambda: _env("SMTP_PASSWORD"))
    email_from: str | None = field(default_factory=lambda: _env("EMAIL_FROM"))

    def __post_init__(self) -> None:
        if len(self.secret_key) < 32:
            raise RuntimeError("AUTH_SECRET must be set to at least 32 characters")


auth_settings = AuthSettings()
