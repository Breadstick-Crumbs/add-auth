"""Copy next to your tests. Runs against in-memory SQLite, so it needs no database server."""

import os

os.environ.setdefault("AUTH_SECRET", "test-secret-test-secret-test-secret-1234")

from fastapi import Depends, FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import Session, SQLModel, create_engine  # noqa: E402
from sqlmodel.pool import StaticPool  # noqa: E402

from auth import CurrentUser, auth_router, require_role  # noqa: E402
from auth import security  # noqa: E402
from auth.db import get_session  # noqa: E402
from auth.models import User  # noqa: E402

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

app = FastAPI()
app.include_router(auth_router)


@app.get("/admin-only", dependencies=[Depends(require_role("admin"))])
def admin_only() -> dict:
    return {"ok": True}


@app.get("/hello")
def hello(user: CurrentUser) -> dict:
    return {"email": user.email}


def _session():
    with Session(engine) as s:
        yield s


app.dependency_overrides[get_session] = _session
sent: list[tuple[str, str]] = []


def setup_function() -> None:
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    sent.clear()


def _client(monkeypatch=None) -> TestClient:
    return TestClient(app)


def _register(c: TestClient, email="a@example.com", password="password123"):
    return c.post("/auth/register", json={"email": email, "password": password})


def _login(c: TestClient, email="a@example.com", password="password123"):
    return c.post("/auth/login", data={"username": email, "password": password})


def test_register_login_me():
    c = _client()
    r = _register(c, email="A@Example.com")
    assert r.status_code == 201
    token = r.json()["access_token"]
    assert c.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["email"] == "a@example.com"
    assert _login(c, email="a@example.com").status_code == 200


def test_cookie_session_and_logout():
    c = _client()
    _register(c)
    assert c.get("/hello").json() == {"email": "a@example.com"}
    c.post("/auth/logout")
    assert c.get("/hello").status_code == 401


def test_duplicate_and_wrong_password():
    c = _client()
    _register(c)
    assert _register(c).status_code == 400
    assert _login(c, password="wrong-password").status_code == 400
    assert _login(c, email="nobody@example.com").status_code == 400


def test_no_token_and_bad_token():
    c = TestClient(app)
    assert c.get("/auth/me").status_code == 401
    assert c.get("/auth/me", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_reset_token_is_not_an_access_token():
    c = _client()
    _register(c)
    with Session(engine) as s:
        user = s.exec(__import__("sqlmodel").select(User)).one()
        reset = security.create_reset_token(str(user.id), user.hashed_password)
    assert TestClient(app).get("/auth/me", headers={"Authorization": f"Bearer {reset}"}).status_code == 401


def test_role_check():
    c = _client()
    _register(c)
    assert c.get("/admin-only").status_code == 403
    with Session(engine) as s:
        user = s.exec(__import__("sqlmodel").select(User)).one()
        user.role = "admin"
        s.add(user)
        s.commit()
    assert c.get("/admin-only").status_code == 200


def test_forgot_and_reset_password_once(monkeypatch):
    import auth.routes

    monkeypatch.setattr(auth.routes, "send_reset_email", lambda to, token: sent.append((to, token)))
    c = _client()
    _register(c)
    assert c.post("/auth/forgot-password", json={"email": "nobody@example.com"}).status_code == 200
    assert sent == []
    c.post("/auth/forgot-password", json={"email": "a@example.com"})
    (_, token), = sent
    r = c.post("/auth/reset-password", json={"token": token, "new_password": "newpassword1"})
    assert r.status_code == 200
    assert _login(c, password="newpassword1").status_code == 200
    assert _login(c, password="password123").status_code == 400
    again = c.post("/auth/reset-password", json={"token": token, "new_password": "another-pass1"})
    assert again.status_code == 400


def test_change_password():
    c = _client()
    _register(c)
    bad = c.post("/auth/change-password", json={"current_password": "nope-nope", "new_password": "newpassword1"})
    assert bad.status_code == 400
    ok = c.post("/auth/change-password", json={"current_password": "password123", "new_password": "newpassword1"})
    assert ok.status_code == 200
    assert _login(c, password="newpassword1").status_code == 200
