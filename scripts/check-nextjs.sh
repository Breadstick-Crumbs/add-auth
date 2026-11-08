#!/usr/bin/env bash
# Makes a stock create-next-app, installs the templates into it with
# install.mjs --with-db, then runs lint, tsc, the core tests and next build.
#   bash scripts/check-nextjs.sh [work-dir]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
work="${1:-$(mktemp -d)}"
rm -rf "$work" && mkdir -p "$(dirname "$work")"
npx --yes create-next-app@latest "$work" --ts --app --eslint --tailwind --no-src-dir \
  --import-alias "@/*" --use-npm --yes --disable-git > /dev/null
cd "$work"
node "$here/install.mjs" nextjs . --with-db
npm install --silent --no-audit --no-fund jose bcryptjs zod server-only drizzle-orm postgres
npm install --silent --no-audit --no-fund -D tsx drizzle-kit
node -e "for (const p of ['next','react','zod','jose','bcryptjs','drizzle-orm','postgres']) console.log(p, require('./node_modules/'+p+'/package.json').version)"
grep -q cacheComponents next.config.ts && echo "cacheComponents: on" || echo "cacheComponents: off"
npx eslint .
npx tsc --noEmit
npx tsx --test lib/auth/core.test.ts
# The build only needs these to be set; nothing connects to the database.
AUTH_SECRET=check-secret-check-secret-check-secret-12 DATABASE_URL=postgres://check@localhost/check npx next build
echo "nextjs check passed"
