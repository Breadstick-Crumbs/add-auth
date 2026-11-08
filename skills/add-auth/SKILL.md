---
name: add-auth
description: Add email-and-password auth to a project (sign up, sign in, sign out, sessions, roles, change password, forgot/reset password) from a tested template instead of writing it from scratch. Use when the user asks to add auth, login, sign-up, accounts, sessions, protected routes or password reset to a FastAPI, Next.js or Node backend.
---

# add-auth

Copy the tested auth templates in this plugin into the user's project and wire
them in. Don't write auth from scratch and don't change the security logic in
the templates; adapt only the edges (database access, imports, UI).

Templates live next to this file at `../../templates/` (resolve against this
SKILL.md's directory):

- `templates/fastapi/auth/` – FastAPI package: `config.py`, `security.py`, `models.py`, `db.py`, `deps.py`, `routes.py`, `email.py`; tests in `templates/fastapi/tests/test_auth.py`.
- `templates/node/lib/auth/core.ts` – framework-free core (hashing, access and reset tokens, cookie options) with `core.test.ts`.
- `templates/nextjs/` – Next.js App Router layer on top of the core: `lib/auth/{schema,users,session,email}.ts`, `app/(auth)/actions.ts`, `proxy.ts`.

## 1. Look before copying

Find out, and tell the user in one or two lines:
- Stack: FastAPI (look for `fastapi` in pyproject/requirements), Next.js (`next` in package.json), or another Node server (Express, Hono, Fastify, plain `http`).
- Database layer: SQLModel/SQLAlchemy, Drizzle, Prisma or raw SQL, and where the session or `db` object lives.
- Existing auth: a `users` table, a login route, a JWT library, an auth provider (Clerk, Supabase, Auth.js). If auth already exists, stop and ask whether to replace it or extend it.
- Whether the project already has a `users` table with data. If so, map the template's columns onto it with a migration instead of creating a second table.

## 2. Copy and wire in

### FastAPI
1. Copy `templates/fastapi/auth/` into the app package (for example `app/auth/`). Fix the relative imports if the location needs it.
2. Edit `auth/db.py` so `get_session` is the project's existing session dependency. That is the only place auth touches the database setup.
3. If the project uses plain SQLAlchemy, not SQLModel, rewrite `models.py`'s `User` as a SQLAlchemy model with the same columns and keep the Pydantic schemas.
4. `app.include_router(auth_router)` in the app's main file.
5. Protect routes with `user: CurrentUser` or `dependencies=[Depends(require_role("admin"))]`.
6. Add dependencies: `pyjwt`, `pwdlib[argon2,bcrypt]`, `email-validator`, `python-multipart`, `sqlmodel` (if not already present).
7. Create the `users` table through the project's migrations (Alembic autogenerate if it has Alembic).
8. Copy `tests/test_auth.py` into the test folder, fix its imports to the new package path, and run it.

### Next.js (App Router)
1. Copy `templates/node/lib/auth/core.ts` and `core.test.ts` to `lib/auth/`.
2. Copy `templates/nextjs/lib/auth/*`, `templates/nextjs/app/(auth)/actions.ts` and `templates/nextjs/proxy.ts`.
3. Next.js 15 or earlier: rename `proxy.ts` to `middleware.ts` and its export to `middleware`. If the project already has a middleware/proxy file, merge the auth check into it.
4. Point `lib/auth/users.ts` at the project's database: change the `db` import, or rewrite its five functions for Prisma/raw SQL. Merge `schema.ts` into the existing Drizzle schema and generate a migration.
5. Set `PROTECTED` in the proxy to the app's private paths.
6. Build `/sign-in`, `/sign-up`, `/forgot-password` and `/reset-password` pages using the project's own components and styling. Each is a form posting to the matching server action through `useActionState`; pass `next` as a hidden field on sign-in, and the `token` search param on reset.
7. In server components and actions, use `getUser()` or `requireUser("admin")` from `lib/auth/session.ts`.
8. Dependencies: `jose`, `bcryptjs`, `zod`, `server-only` (and `drizzle-orm` if using the Drizzle file as-is).

### Other Node servers (Express, Hono, Fastify, plain http)
Copy only `core.ts` and `core.test.ts`. Write the routes in the project's style,
keeping the same behaviour as `templates/nextjs/app/(auth)/actions.ts`:
register, login (same error for unknown email and wrong password; call
`verifyPassword` even when the user isn't found), logout, me, change password,
forgot password (same reply whether or not the account exists), reset password
(`readResetToken` with the user's current hash). Read the token from the
`session` cookie (set with `cookieOptions()`) or an `Authorization: Bearer`
header. Add a `requireUser`/`requireRole` middleware.

## 3. Environment

Add to `.env.example` (never to a committed `.env`):
- `AUTH_SECRET` – at least 32 random characters. Generate one for the user's local `.env` with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`; never print it in chat.
- `AUTH_ACCESS_TOKEN_MINUTES` (default 7 days), `AUTH_RESET_TOKEN_MINUTES` (default 60).
- FastAPI: `FRONTEND_URL`, and `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` for reset emails. Next.js: `APP_URL`, then replace the body of `lib/auth/email.ts` with the project's email provider.
Without email configured, reset links are logged, which is fine for local dev.

## 4. Check it works

Run the copied tests and the project's own checks (tests, type-check, lint,
build). Report failures with their output. Then say what the user still has
to do themselves, usually: set `AUTH_SECRET` in production, configure email,
run the migration on their real database.

## Rules
- Keep: Argon2/bcrypt hashing, the dummy-hash check on unknown emails, same replies for unknown accounts, reset tokens tied to the password hash, `purpose` checks on tokens, httpOnly SameSite=Lax cookies, `safeNext` on redirects.
- Don't put tokens in localStorage, don't log passwords or tokens, don't widen CORS for auth routes.
- Login rate limiting is not in the templates. If the project has a rate limiter, put the login and forgot-password routes behind it; if not, mention it.
- Sessions are signed tokens, so signing out ends the session in that browser but a copied token stays valid until it expires. If the user needs "sign out everywhere", add a `token_version` column and check it in the token reader.
