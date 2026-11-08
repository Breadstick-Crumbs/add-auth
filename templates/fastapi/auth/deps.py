import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from . import security
from .models import User

from .db import get_session

SessionDep = Annotated[Session, Depends(get_session)]

# auto_error=False so a browser request with the cookie (and no header) still works.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

COOKIE_NAME = "session"


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not signed in",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    request: Request,
    session: SessionDep,
    bearer: Annotated[str | None, Depends(oauth2_scheme)],
) -> User:
    token = bearer or request.cookies.get(COOKIE_NAME)
    if not token:
        raise _unauthorized()
    user_id = security.read_access_token(token)
    if not user_id:
        raise _unauthorized()
    try:
        user = session.get(User, uuid.UUID(user_id))
    except ValueError:
        raise _unauthorized()
    if not user or not user.is_active:
        raise _unauthorized()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: str) -> Callable[[User], User]:
    """Use as: Depends(require_role("admin")) or a route's dependencies=[...]."""

    def check(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
        return user

    return check
