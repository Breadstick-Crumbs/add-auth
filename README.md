# add-auth

Stop rebuilding auth in every project. Say "add auth" and your coding agent drops in the same tested sign-up, sign-in and password reset code each time, wired to your own database.

Works with **FastAPI**, **Next.js** (App Router) and any **Node** server (Express, Hono, Fastify, plain `http`).

## What you get

- Sign up, sign in, sign out
- Sessions in an httpOnly cookie, or a bearer token for API and mobile clients
- Roles: `require_role("admin")` in FastAPI, `requireUser("admin")` in Next.js
- Change password, plus forgot/reset password by email; each reset link works once
- Users live in your own database: no vendor, no per-user pricing
- Tests you copy into the project along with the code

The code is taken from two widely used MIT templates, [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template) and [nextjs/saas-starter](https://github.com/nextjs/saas-starter). It keeps their Argon2/bcrypt hashing and timing-safe login and adds single-use reset links, typed tokens and roles.

## Install

As a Claude Code plugin:

```
/plugin marketplace add Breadstick-Crumbs/add-auth
/plugin install add-auth@add-auth
```

Then, in any project:

```
add auth
```

The skill finds your stack and database layer, copies the templates, wires them in, adds a migration, sets up `.env.example` and runs the tests.

Not using Claude Code? Copy the templates yourself: they're plain files.

```
templates/
  fastapi/auth/        config, security, models, db, deps, routes, email
  fastapi/tests/       pytest suite (in-memory SQLite, no server needed)
  node/lib/auth/       core.ts: hashing and tokens for any Node server, with tests
  nextjs/              session helpers, server actions, proxy.ts, Drizzle schema
```

## Use it

FastAPI:

```python
from fastapi import Depends
from app.auth import CurrentUser, auth_router, require_role

app.include_router(auth_router)  # /auth/register, /auth/login, /auth/me, ...

@app.get("/projects")
def projects(user: CurrentUser): ...

@app.delete("/projects/{id}", dependencies=[Depends(require_role("admin"))])
def delete_project(id: str): ...
```

Next.js:

```ts
import { requireUser } from '@/lib/auth/session';

export default async function Dashboard() {
  const user = await requireUser();
  return <h1>Hi {user.name ?? user.email}</h1>;
}
```

## Settings

| Variable | Default | |
|---|---|---|
| `AUTH_SECRET` | none | Required, 32+ random characters |
| `AUTH_ACCESS_TOKEN_MINUTES` | 10080 (7 days) | Session length |
| `AUTH_RESET_TOKEN_MINUTES` | 60 | Reset link lifetime |
| `FRONTEND_URL` / `APP_URL` | `http://localhost:3000` | Base of the reset link |
| `SMTP_*`, `EMAIL_FROM` | unset | FastAPI reset emails; unset logs the link instead |

## Run the template tests

```bash
cd templates/fastapi
uv run --no-project --with "fastapi[standard]" --with sqlmodel --with pyjwt --with "pwdlib[argon2,bcrypt]" --with email-validator --with pytest python -m pytest tests
```

```bash
cd templates/node
npm i jose bcryptjs && npx tsx --test lib/auth/core.test.ts
```

## Good to know

- Sessions are signed tokens. Signing out clears the cookie; to sign a user out on every device, add a `token_version` column (the skill explains how).
- Put the login and forgot-password routes behind your rate limiter.

## License

MIT. Includes code adapted from the two templates above; see [LICENSE](LICENSE).
