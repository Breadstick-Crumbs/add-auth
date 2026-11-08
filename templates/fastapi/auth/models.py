import uuid
from datetime import datetime, timezone

from pydantic import EmailStr
from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=255)
    hashed_password: str
    name: str | None = Field(default=None, max_length=255)
    role: str = Field(default="member", max_length=32)
    is_active: bool = True
    created_at: datetime = Field(default_factory=_now)


class RegisterIn(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=255)


class UserOut(SQLModel):
    id: uuid.UUID
    email: str
    name: str | None
    role: str


class TokenOut(SQLModel):
    access_token: str
    token_type: str = "bearer"


class ResetIn(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordIn(SQLModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class Message(SQLModel):
    message: str
