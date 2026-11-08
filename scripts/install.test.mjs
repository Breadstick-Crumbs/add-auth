// Run with: node --test scripts/install.test.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { install } from './install.mjs';

const TEMPLATES = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const tmp = () => mkdtempSync(join(tmpdir(), 'add-auth-'));
const quiet = () => {};

test('fastapi copies the package and tests byte for byte', () => {
  const d = tmp();
  assert.equal(install(['fastapi', join(d, 'app'), '--tests', join(d, 'tests')], quiet), 0);
  for (const f of ['__init__.py', 'config.py', 'db.py', 'deps.py', 'email.py', 'models.py', 'routes.py', 'security.py']) {
    assert.deepEqual(readFileSync(join(d, 'app/auth', f)), readFileSync(join(TEMPLATES, 'fastapi/auth', f)), f);
  }
  assert.ok(existsSync(join(d, 'tests/test_auth.py')));
});

test('nextjs puts core, adapter, actions and proxy under the root', () => {
  const d = tmp();
  assert.equal(install(['nextjs', d], quiet), 0);
  for (const f of ['lib/auth/core.ts', 'lib/auth/core.test.ts', 'lib/auth/session.ts', 'lib/auth/users.ts',
    'lib/auth/schema.ts', 'lib/auth/email.ts', 'app/(auth)/actions.ts', 'proxy.ts']) {
    assert.ok(existsSync(join(d, f)), f);
  }
});

test('node copies only the core', () => {
  const d = tmp();
  assert.equal(install(['node', join(d, 'src/auth')], quiet), 0);
  assert.ok(existsSync(join(d, 'src/auth/core.ts')));
  assert.ok(!existsSync(join(d, 'src/auth/session.ts')));
});

test('an existing file stops the whole copy unless --force', () => {
  const d = tmp();
  mkdirSync(join(d, 'lib/auth'), { recursive: true });
  writeFileSync(join(d, 'lib/auth/session.ts'), 'mine');
  const lines = [];
  assert.equal(install(['nextjs', d], (l) => lines.push(l)), 1);
  assert.equal(readFileSync(join(d, 'lib/auth/session.ts'), 'utf8'), 'mine');
  assert.ok(!existsSync(join(d, 'proxy.ts')), 'nothing else copied');
  assert.ok(lines.some((l) => l.includes('session.ts')));
  assert.equal(install(['nextjs', d, '--force'], quiet), 0);
  assert.notEqual(readFileSync(join(d, 'lib/auth/session.ts'), 'utf8'), 'mine');
});

test('--keep-existing copies the rest and leaves the clash alone', () => {
  const d = tmp();
  writeFileSync(join(d, 'proxy.ts'), 'my proxy');
  const lines = [];
  assert.equal(install(['nextjs', d, '--keep-existing'], (l) => lines.push(l)), 0);
  assert.equal(readFileSync(join(d, 'proxy.ts'), 'utf8'), 'my proxy');
  assert.ok(existsSync(join(d, 'lib/auth/session.ts')));
  assert.ok(lines.some((l) => l.startsWith('kept existing') && l.includes('proxy.ts')));
});

test('--dry-run writes nothing', () => {
  const d = tmp();
  assert.equal(install(['fastapi', d, '--dry-run'], quiet), 0);
  assert.ok(!existsSync(join(d, 'auth')));
});

test('bad arguments return 2', () => {
  assert.equal(install([], quiet), 2);
  assert.equal(install(['django', 'x'], quiet), 2);
  assert.equal(install(['node', 'a', 'b'], quiet), 2);
});
