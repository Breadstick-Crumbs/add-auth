# add-auth

[![test](https://github.com/Breadstick-Crumbs/add-auth/actions/workflows/test.yml/badge.svg)](https://github.com/Breadstick-Crumbs/add-auth/actions/workflows/test.yml)

Stop rebuilding auth in every project. Say "add auth" and your coding agent drops in the same tested sign-up, sign-in and password reset code each time, wired to your own database.

Works with **FastAPI**, **Next.js** (App Router) and any **Node** server (Express, Hono, Fastify, plain `http`).

## What you get

- Sign up, sign in, sign out
- Sessions in an httpOnly cookie, or a bearer token for API and mobile clients
- Roles: `require_role("admin")` in FastAPI, `requireUser("admin")` in Next.js
- Change password, plus forgot/reset password by email; each reset link works once
- Users live in your own database: no vendor, no per-user pricing
- Next.js: ready sign-in, sign-up, forgot-password, reset-password and account pages, in plain Tailwind
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

The skill finds your stack and database layer, copies the templates, wires them in, adds a migration, sets up `.env.example` and runs the tests. The files are copied by a script, not retyped by the model, so the security code arrives exactly as tested.

Not using Claude Code? Run the same script yourself:

```bash
node scripts/install.mjs fastapi path/to/app --tests path/to/tests
node scripts/install.mjs nextjs path/to/next-app   # add --with-db if it has no database layer
node scripts/install.mjs node path/to/server/auth
```

It never overwrites a file unless you pass `--force`; `--keep-existing` copies the rest and leaves your files alone; `--dry-run` shows what it would do. The templates are plain files, so copying them by hand works too.

```
templates/
  fastapi/auth/        config, security, models, db, deps, routes, email
  fastapi/tests/       pytest suite (in-memory SQLite, no server needed)
  node/lib/auth/       core.ts: hashing and tokens for any Node server, with tests
  nextjs/              session helpers, server actions, pages, proxy.ts, Drizzle schema
  nextjs-db/           lib/db.ts and drizzle.config.ts, for an app with no database yet
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
bash scripts/check-nextjs.sh          # fresh create-next-app + templates: eslint, tsc, core tests, next build
node --test scripts/install.test.mjs  # the copy script
```

CI runs all of these on every push and weekly against the latest FastAPI, Next.js and zod.

## Good to know

- Sessions are signed tokens. Signing out clears the cookie; to sign a user out on every device, add a `token_version` column (the skill explains how).
- Put the login and forgot-password routes behind your rate limiter.

## License

MIT. Includes code adapted from the two templates above; see [LICENSE](LICENSE).
