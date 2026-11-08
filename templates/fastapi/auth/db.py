"""The one line that ties auth to your project's database.

Replace the function below with an import of your existing session dependency,
for example:

    from app.db import get_session  # noqa: F401
"""

from collections.abc import Iterator

from sqlmodel import Session


def get_session() -> Iterator[Session]:
    raise RuntimeError("auth/db.py: import your project's get_session here")
    yield  # pragma: no cover
