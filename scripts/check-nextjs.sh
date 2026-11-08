#!/usr/bin/env bash
# Installs the Next.js templates into a throwaway app with install.mjs, then
# type-checks it, runs the core tests and runs `next build`.
#   bash scripts/check-nextjs.sh [work-dir]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
work="${1:-$(mktemp -d)}"
rm -rf "$work" && mkdir -p "$work"
node "$here/install.mjs" nextjs "$work"
cd "$work"
mkdir -p lib/db
cat > lib/db/index.ts <<'EOF'
import { drizzle } from 'drizzle-orm/node-postgres';
export const db = drizzle(process.env.DATABASE_URL!);
EOF
cat > app/layout.tsx <<'EOF'
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
EOF
cat > app/page.tsx <<'EOF'
import { signOut } from './(auth)/actions';
import { getUser } from '@/lib/auth/session';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const user = await getUser().catch(() => null);
  return <form action={signOut}><p>{user?.email ?? 'signed out'}</p><button>Sign out</button></form>;
}
EOF
cat > package.json <<'EOF'
{ "name": "add-auth-check", "private": true, "type": "module" }
EOF
cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["dom", "ES2022"], "module": "esnext", "moduleResolution": "bundler",
    "strict": true, "noEmit": true, "skipLibCheck": true, "allowImportingTsExtensions": true,
    "jsx": "preserve", "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
EOF
npm install --silent --no-audit --no-fund next react react-dom server-only drizzle-orm pg jose bcryptjs zod
npm install --silent --no-audit --no-fund -D typescript tsx @types/node @types/react @types/pg
node -e "for (const p of ['next','react','zod','jose','bcryptjs','drizzle-orm']) console.log(p, require('./node_modules/'+p+'/package.json').version)"
npx tsc -p .
npx tsx --test lib/auth/core.test.ts
AUTH_SECRET=check-secret-check-secret-check-secret-12 DATABASE_URL=postgres://check@localhost/check npx next build
echo "nextjs check passed"
