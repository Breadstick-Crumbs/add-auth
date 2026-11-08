// Run with: npx tsx --test lib/auth/core.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.AUTH_SECRET ??= 'test-secret-test-secret-test-secret-1234';

const core = await import('./core.ts');

test('hash and verify', async () => {
  const h = await core.hashPassword('password123');
  assert.equal(await core.verifyPassword('password123', h), true);
  assert.equal(await core.verifyPassword('wrong', h), false);
  assert.equal(await core.verifyPassword('anything', null), false);
});

test('access token round trip and rejection', async () => {
  const t = await core.createAccessToken('user-1');
  assert.equal(await core.readAccessToken(t), 'user-1');
  assert.equal(await core.readAccessToken('junk'), null);
  assert.equal(await core.readAccessToken(t.slice(0, -2) + 'xx'), null);
  assert.equal(await core.readAccessToken(undefined), null);
});

test('reset token works once and is not an access token', async () => {
  const oldHash = await core.hashPassword('password123');
  const t = await core.createResetToken('user-1', oldHash);
  assert.equal(await core.readAccessToken(t), null);
  assert.equal(await core.readResetToken(t, async () => oldHash), 'user-1');
  const newHash = await core.hashPassword('newpassword1');
  assert.equal(await core.readResetToken(t, async () => newHash), null);
  assert.equal(await core.readResetToken(t, async () => null), null);
});

test('short secret is refused', async () => {
  const saved = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'short';
  await assert.rejects(core.createAccessToken('x'));
  process.env.AUTH_SECRET = saved;
});
