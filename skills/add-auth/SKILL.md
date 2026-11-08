---
name: add-auth
description: Add email-and-password auth to a project (sign up, sign in, sign out, sessions, roles, change password, forgot/reset password) from a tested template instead of writing it from scratch. Use when the user asks to add auth, login, sign-up, accounts, sessions, protected routes or password reset to a FastAPI, Next.js or Node backend.
---

# add-auth

Copy the tested auth templates in this plugin into the user's project and wire
them in. Don't write auth from scratch and don't change the security logic in
the templates; adapt only the edges (database access, imports, styling).

Templates live at `<skill-dir>/../../templates/`, where `<skill-dir>` is
this skill's base directory:

- `fastapi/auth/` – FastAPI package: `config.py`, `security.py`, `models.py`, `db.py`, `deps.py`, `routes.py`, `email.py`; tests in `fastapi/tests/test_auth.py`.
- `node/lib/auth/core.ts` – framework-free core (hashing, access and reset tokens, cookie options) with `core.test.ts`.
- `nextjs/` – Next.js App Router layer on top of the core: `lib/auth/{schema,users,session,email}.ts`, `app/(auth)/` (server actions, forms, and the sign-in, sign-up, forgot-password and reset-password pages), `app/account/page.tsx` (sign out, change password) and `proxy.ts`.
- `nextjs-db/` – only for a Next.js project with no database layer: `lib/db.ts` (Drizzle on postgres.js) and `drizzle.config.ts`.

## 1. Look before copying

Find out, and tell the user in one or two lines:
- Stack: FastAPI (look for `fastapi` in pyproject/requirements), Next.js (`next` in package.json), or another Node server (Express, Hono, Fastify, plain `http`).
- Database layer: SQLModel/SQLAlchemy, Drizzle, Prisma or raw SQL, and where the session or `db` object lives. Or none yet.
- How tables get created: migrations (Alembic, drizzle-kit, Prisma) or `create_all` at startup.
- How env vars get loaded: pydantic-settings, python-dotenv, `uv run --env-file`, Docker, Next's `.env.local`, or nothing.
- Existing auth: a `users` table, a login route, a JWT library, an auth provider (Clerk, Supabase, Auth.js). If auth already exists, stop and ask whether to replace it or extend it.
- Whether the project already has a `users` table with data. If so, map the template's columns onto it with a migration instead of creating a second table.
- Whether `.env` is tracked: `git ls-files .env`. If it prints the file, tell the user before writing a secret into it, and suggest `git rm --cached .env`.

## 2. Copy and wire in

Copy with the plugin's script, not by reading and rewriting the files: it
copies them exactly and costs no tokens. It is
`<skill-dir>/../../scripts/install.mjs`. Run it from the project root with
`--dry-run` first, then for real:

```bash
node <skill-dir>/../../scripts/install.mjs fastapi app --tests tests   # app/auth/*.py, tests/test_auth.py
node <skill-dir>/../../scripts/install.mjs nextjs .                     # or src if the @/ alias points there
node <skill-dir>/../../scripts/install.mjs nextjs . --with-db           # same, plus lib/db.ts and drizzle.config.ts
node <skill-dir>/../../scripts/install.mjs node src/auth                # core only, for other Node servers
```

It refuses to overwrite and copies nothing if any target file exists. When
the clash is a file to merge into (an existing `proxy.ts`, `middleware.ts`
or a page at the same path), rerun with `--keep-existing`, which copies the
rest, then merge by hand. Use `--force` only once the user agrees to lose the
file. If `node` isn't available, copy the same files by hand (`cp`), and
still don't retype them.

After copying, change only what the steps below name. Leave the logic in
`security.py`, `core.ts`, `routes.py` and `actions.ts` alone.

Don't add auth to the project's existing routes or pages on your own. List
them and ask which should need a signed-in user; if the user isn't there to
answer, leave them public and say so.

### FastAPI
1. Copy with `install.mjs fastapi <package-dir> --tests <tests-dir>` (for example `app` gives `app/auth/`).
2. Edit `auth/db.py` so it imports the project's existing session dependency (`from app.db import get_session`). That is the only place auth touches the database setup.
3. If the project uses plain SQLAlchemy, not SQLModel, rewrite `models.py`'s `User` as a SQLAlchemy model with the same columns and keep the Pydantic schemas.
4. `app.include_router(auth_router)` in the app's main file.
5. Create the `users` table: with Alembic, autogenerate a migration and apply it. With `create_all` at startup, importing `auth_router` in step 4 already registers the model, so starting the app creates the table; check that the import happens before `create_all` runs.
6. Dependencies: `pyjwt` and `pwdlib[argon2,bcrypt]`, plus `email-validator` and `python-multipart` unless the project has `fastapi[standard]`, which includes them; `sqlmodel` if not already present.
7. `auth/config.py` reads `AUTH_SECRET` at import and refuses to start without it. If nothing loads `.env` (step 1), either run the app with `uv run --env-file .env ...` and tell the user that's now the start command, or add `python-dotenv` with `load_dotenv()` at the top of the main file, whichever fits the project.
8. Tests: in the copied `test_auth.py`, change `auth` to the package path (`app.auth`) in its four import lines. Then put `os.environ.setdefault("AUTH_SECRET", "test-secret-test-secret-test-secret-1234")` in `tests/conftest.py` (create it, or add to the existing one), so the project's other tests can still import the app. Run the whole suite.

### Next.js (App Router)
1. Copy with `install.mjs nextjs <app-root>`; add `--with-db` if the project has no database layer. With `--with-db`, add `drizzle-orm`, `postgres` and dev dependency `drizzle-kit`, `DATABASE_URL` in `.env.local`, and scripts `"db:generate": "drizzle-kit generate"` and `"db:migrate": "drizzle-kit migrate"`. In a `src/` layout, fix the `schema` path in `drizzle.config.ts`.
2. Next.js 15 or earlier: rename `proxy.ts` to `middleware.ts` and its export to `middleware`. If the project already has one, merge the auth check into it.
3. With an existing database layer, point `lib/auth/users.ts` at it: change the `db` import, or rewrite its five functions for Prisma or raw SQL. Merge `schema.ts` into the existing Drizzle schema.
4. Create the table: `drizzle-kit generate`, then `drizzle-kit migrate` (or the project's own migration commands).
5. Set `PROTECTED` in the proxy to the app's private paths (`/account` is the shipped account page).
6. The pages use plain Tailwind classes. If the project has its own components or doesn't use Tailwind, restyle `app/(auth)/forms.tsx` and the pages; keep their structure. In particular, keep reading `searchParams` and `requireUser()` inside `<Suspense>`, which the build needs when `cacheComponents` is on (the Next 16 default).
7. In server components and actions, use `getUser()` or `requireUser("admin")` from `lib/auth/session.ts`.
8. Dependencies: `jose`, `bcryptjs`, `zod`, `server-only`, and dev dependency `tsx` for the test. Add `"test:auth": "tsx --test lib/auth/core.test.ts"` to the scripts.
9. If `.gitignore` has `.env*`, add `!.env.example` so the example file can be committed.

### Other Node servers (Express, Hono, Fastify, plain http)
Copy only the core with `install.mjs node <dir>`. Write the routes in the project's style,
keeping the same behaviour as `templates/nextjs/app/(auth)/actions.ts`:
register, login (same error for unknown email and wrong password; call
`verifyPassword` even when the user isn't found), logout, me, change password,
forgot password (same reply whether or not the account exists), reset password
(`readResetToken` with the user's current hash). Read the token from the
`session` cookie (set with `cookieOptions()`) or an `Authorization: Bearer`
header. Add a `requireUser`/`requireRole` middleware. Run `core.test.ts` with
`npx tsx --test`.

## 3. Environment

Add to `.env.example` (never put real values in a committed file):
- `AUTH_SECRET` – at least 32 random characters. Write a generated one into the local env file (`.env`, or `.env.local` for Next.js) without printing it in chat: `python -c "import secrets; print(secrets.token_urlsafe(32))"` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
- `AUTH_ACCESS_TOKEN_MINUTES` (default 7 days), `AUTH_RESET_TOKEN_MINUTES` (default 60).
- FastAPI: `FRONTEND_URL`, and `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` for reset emails. Next.js: `APP_URL`, `DATABASE_URL`, then replace the body of `lib/auth/email.ts` with the project's email provider.
Without email configured, reset links are logged, which is fine for local dev.

## 4. Check it works

Run the copied tests, the project's existing tests, and its other checks
(type-check, lint, build). For FastAPI, also start the app once against its
real database and load `/docs`. Report failures with their output. Then tell
the user:
- the command to start the app, if it changed;
- which routes or pages are protected, and which existing ones you left public;
- what's left for them: `AUTH_SECRET` in production, an email provider, the migration on their real database, and login rate limiting if the project has no rate limiter.

## Rules
- Keep: Argon2/bcrypt hashing, the dummy-hash check on unknown emails, same replies for unknown accounts, reset tokens tied to the password hash, `purpose` checks on tokens, httpOnly SameSite=Lax cookies, `safeNext` on redirects.
- Don't put tokens in localStorage, don't log passwords or tokens, don't widen CORS for auth routes.
- Login rate limiting is not in the templates. If the project has a rate limiter, put the login and forgot-password routes behind it; if not, mention it.
- Sessions are signed tokens, so signing out ends the session in that browser but a copied token stays valid until it expires, and a password reset doesn't sign out other browsers. If the user needs "sign out everywhere", add a `token_version` column and check it in the token reader.
