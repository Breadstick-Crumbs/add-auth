#!/usr/bin/env node
// Copies the auth templates into a project, byte for byte.
//
//   node install.mjs fastapi <package-dir> [--tests <dir>]
//       <package-dir>/auth/*.py, and <dir>/test_auth.py if --tests is given
//   node install.mjs nextjs <app-root> [--with-db]
//       <app-root>/lib/auth/*.ts, <app-root>/app/(auth)/* (actions and the sign-in,
//       sign-up, forgot and reset pages), <app-root>/app/account/page.tsx, <app-root>/proxy.ts
//       (<app-root> is where the @/ alias points: the project root, or src/)
//       --with-db, for a project with no database layer: <app-root>/lib/db.ts
//       (Drizzle on postgres.js) and ./drizzle.config.ts
//   node install.mjs node <auth-dir>
//       <auth-dir>/core.ts and core.test.ts
//
// Options: --force overwrites existing files; --keep-existing copies the rest
// and leaves existing ones alone; --dry-run only prints the plan.
// Without either, nothing is written if any target exists.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATES = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.endsWith('.pyc'))
    .map((e) => e.name);
}

// Every file under dir, as paths relative to it.
function treeIn(dir, prefix = '') {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((e) => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    return e.isDirectory() ? treeIn(dir, rel) : [rel];
  });
}

function plan(stack, target, opts) {
  const pairs = [];
  const add = (from, to) => pairs.push([join(TEMPLATES, from), to]);
  if (stack === 'fastapi') {
    for (const f of filesIn(join(TEMPLATES, 'fastapi/auth'))) add(`fastapi/auth/${f}`, join(target, 'auth', f));
    if (opts.tests) add('fastapi/tests/test_auth.py', join(opts.tests, 'test_auth.py'));
  } else if (stack === 'node' || stack === 'nextjs') {
    const authDir = stack === 'node' ? target : join(target, 'lib/auth');
    for (const f of filesIn(join(TEMPLATES, 'node/lib/auth'))) add(`node/lib/auth/${f}`, join(authDir, f));
    if (stack === 'nextjs') {
      for (const f of filesIn(join(TEMPLATES, 'nextjs/lib/auth'))) add(`nextjs/lib/auth/${f}`, join(authDir, f));
      for (const f of treeIn(join(TEMPLATES, 'nextjs/app'))) add(`nextjs/app/${f}`, join(target, 'app', f));
      add('nextjs/proxy.ts', join(target, 'proxy.ts'));
      if (opts.withDb) {
        add('nextjs-db/lib/db.ts', join(target, 'lib/db.ts'));
        // drizzle-kit looks for its config in the project root, which is where this runs.
        add('nextjs-db/drizzle.config.ts', resolve('drizzle.config.ts'));
      }
    }
  } else {
    return null;
  }
  return pairs;
}

export function install(argv, log = console.log) {
  const args = [...argv];
  const flag = (name) => {
    const i = args.indexOf(name);
    if (i === -1) return false;
    args.splice(i, 1);
    return true;
  };
  const option = (name) => {
    const i = args.indexOf(name);
    if (i === -1 || i === args.length - 1) return undefined;
    return args.splice(i, 2)[1];
  };
  const force = flag('--force');
  const keepExisting = flag('--keep-existing');
  const dryRun = flag('--dry-run');
  const withDb = flag('--with-db');
  const tests = option('--tests');
  const [stack, target] = args;
  const usage = 'usage: install.mjs <fastapi|nextjs|node> <target-dir> [--tests <dir>] [--with-db] [--force | --keep-existing] [--dry-run]';
  if (!stack || !target || args.length > 2) {
    log(usage);
    return 2;
  }
  if (withDb && stack !== 'nextjs') {
    log('--with-db is only for nextjs');
    return 2;
  }
  const pairs = plan(stack, resolve(target), { tests: tests && resolve(tests), withDb });
  if (!pairs) {
    log(`unknown stack "${stack}"\n${usage}`);
    return 2;
  }
  const clashes = pairs.filter(([, to]) => existsSync(to));
  if (clashes.length && !force && !keepExisting) {
    log('these files exist already, so nothing was copied');
    log('(--keep-existing copies the rest and leaves these alone; --force overwrites them):');
    for (const [, to] of clashes) log(`  ${relative(process.cwd(), to)}`);
    return 1;
  }
  for (const [from, to] of pairs) {
    if (!force && existsSync(to)) {
      log(`kept existing ${relative(process.cwd(), to)}`);
      continue;
    }
    if (!dryRun) {
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(from, to);
    }
    log(`${dryRun ? 'would copy' : 'copied'} ${relative(process.cwd(), to)}`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = install(process.argv.slice(2));
}
