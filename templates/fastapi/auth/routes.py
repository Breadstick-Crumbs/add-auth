"""Auth routes: register, login, logout, me, change password, forgot/reset password.

Mount with: app.include_router(auth_router)

Adapted from fastapi/full-stack-fastapi-template (MIT, Sebastián Ramírez).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlmodel import select

from . import security
from .config import auth_settings
from .deps import COOKIE_NAME, CurrentUser, SessionDep
from .email import send_reset_email
from .models import ChangePasswordIn, Message, RegisterIn, ResetIn, TokenOut, User, UserOut

auth_router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize(email: str) -> str:
    return email.strip().lower()


def _get_by_email(session: SessionDep, email: str) -> User | None:
    return session.exec(select(User).where(User.email == _normalize(email))).first()


def _issue(response: Response, user: User) -> TokenOut:
    token = security.create_access_token(str(user.id))
    # Browsers use the cookie; API clients and mobile apps use the returned token.
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=auth_settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=auth_settings.frontend_url.startswith("https://"),
        samesite="lax",
    )
    return TokenOut(access_token=token)


@auth_router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, session: SessionDep, response: Response) -> TokenOut:
    if _get_by_email(session, body.email):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    user = User(
        email=_normalize(body.email),
        name=body.name,
        hashed_password=security.hash_password(body.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return _issue(response, user)


@auth_router.post("/login", response_model=TokenOut)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep,
    response: Response,
) -> TokenOut:
    # OAuth2 form field is "username"; it holds the email.
    user = _get_by_email(session, form.username)
    if not user:
        security.verify_password(form.password, security.DUMMY_HASH)
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    ok, new_hash = security.verify_password(form.password, user.hashed_password)
    if not ok or not user.is_active:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if new_hash:
        user.hashed_password = new_hash
        session.add(user)
        session.commit()
    return _issue(response, user)


@auth_router.post("/logout", response_model=Message)
def logout(response: Response) -> Message:
    response.delete_cookie(COOKIE_NAME)
    return Message(message="Signed out")


@auth_router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user


@auth_router.post("/change-password", response_model=Message)
def change_password(body: ChangePasswordIn, user: CurrentUser, session: SessionDep) -> Message:
    ok, _ = security.verify_password(body.current_password, user.hashed_password)
    if not ok:
        raise HTTPException(status_code=400, detail="Current password is wrong")
    user.hashed_password = security.hash_password(body.new_password)
    session.add(user)
    session.commit()
    return Message(message="Password changed")


class ForgotIn(BaseModel):
    email: EmailStr


@auth_router.post("/forgot-password", response_model=Message)
def forgot_password(body: ForgotIn, session: SessionDep, tasks: BackgroundTasks) -> Message:
    user = _get_by_email(session, body.email)
    if user and user.is_active:
        token = security.create_reset_token(str(user.id), user.hashed_password)
        tasks.add_task(send_reset_email, user.email, token)
    # Same answer either way, so this can't be used to find out who has an account.
    return Message(message="If that email has an account, we sent a reset link")


@auth_router.post("/reset-password", response_model=Message)
def reset_password(body: ResetIn, session: SessionDep) -> Message:
    parsed = security.read_reset_token(body.token)
    user = None
    if parsed:
        user_id, fingerprint = parsed
        try:
            user = session.get(User, uuid.UUID(user_id))
        except ValueError:
            user = None
        if user and not security.reset_token_matches(fingerprint, user.hashed_password):
            user = None
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")
    user.hashed_password = security.hash_password(body.new_password)
    session.add(user)
    session.commit()
    return Message(message="Password updated")
