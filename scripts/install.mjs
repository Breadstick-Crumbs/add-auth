#!/usr/bin/env node
// Copies the auth templates into a project, byte for byte.
//
//   node install.mjs fastapi <package-dir> [--tests <dir>]
//       <package-dir>/auth/*.py, and <dir>/test_auth.py if --tests is given
//   node install.mjs nextjs <app-root>
//       <app-root>/lib/auth/*.ts, <app-root>/app/(auth)/actions.ts, <app-root>/proxy.ts
//       (<app-root> is where the @/ alias points: the project root, or src/)
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
      add('nextjs/app/(auth)/actions.ts', join(target, 'app/(auth)/actions.ts'));
      add('nextjs/proxy.ts', join(target, 'proxy.ts'));
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
  const tests = option('--tests');
  const [stack, target] = args;
  const usage = 'usage: install.mjs <fastapi|nextjs|node> <target-dir> [--tests <dir>] [--force | --keep-existing] [--dry-run]';
  if (!stack || !target || args.length > 2) {
    log(usage);
    return 2;
  }
  const pairs = plan(stack, resolve(target), { tests: tests && resolve(tests) });
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
