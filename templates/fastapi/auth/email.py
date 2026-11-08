import logging
import smtplib
from email.message import EmailMessage

from .config import auth_settings

log = logging.getLogger("auth.email")


def send_email(to: str, subject: str, body: str) -> None:
    """Sends over SMTP. With SMTP_HOST unset it logs the email instead (local dev)."""
    s = auth_settings
    if not s.smtp_host or not s.email_from:
        log.warning("SMTP not configured; email to %s: %s\n%s", to, subject, body)
        return
    msg = EmailMessage()
    msg["From"] = s.email_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as smtp:
        smtp.starttls()
        if s.smtp_user and s.smtp_password:
            smtp.login(s.smtp_user, s.smtp_password)
        smtp.send_message(msg)


def send_reset_email(to: str, token: str) -> None:
    link = f"{auth_settings.frontend_url}/reset-password?token={token}"
    minutes = auth_settings.reset_token_expire_minutes
    send_email(
        to,
        "Reset your password",
        f"Open this link to choose a new password:\n\n{link}\n\n"
        f"It works once and expires in {minutes} minutes. "
        "If you didn't ask for this, ignore this email.",
    )
