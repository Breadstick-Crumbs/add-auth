// Framework-free auth core: password hashing and signed tokens.
// Works in Next.js, Express, Hono or plain Node. Adapted from nextjs/saas-starter (MIT, Vercel).
import { createHash } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const SALT_ROUNDS = 12;
const ACCESS_TTL_SECONDS = Number(process.env.AUTH_ACCESS_TOKEN_MINUTES ?? 60 * 24 * 7) * 60;
const RESET_TTL_SECONDS = Number(process.env.AUTH_RESET_TOKEN_MINUTES ?? 60) * 60;

export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE = ACCESS_TTL_SECONDS;

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set to at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS);
}

// A bcrypt hash of a random password. Checked when the email is unknown so a
// failed login takes the same time whether or not the account exists.
const DUMMY_HASH = '$2b$12$Li3CIV9HhVviMNR18j46b.6UUzGA0uZz78PTBLE5Ri4nurMKZeomK';

export async function verifyPassword(password: string, hashed: string | null | undefined): Promise<boolean> {
  if (!hashed) {
    await compare(password, DUMMY_HASH);
    return false;
  }
  return compare(password, hashed);
}

type Purpose = 'access' | 'reset';

async function sign(claims: Record<string, unknown>, ttlSeconds: number): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setNotBefore('0s')
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key());
}

async function read(token: string, purpose: Purpose): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    return payload.purpose === purpose ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function createAccessToken(userId: string): Promise<string> {
  return sign({ sub: userId, purpose: 'access' }, ACCESS_TTL_SECONDS);
}

/** Returns the user id, or null if the token is missing, expired, forged or not an access token. */
export async function readAccessToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const payload = await read(token, 'access');
  return payload && typeof payload.sub === 'string' ? payload.sub : null;
}

function fingerprint(hashedPassword: string): string {
  return createHash('sha256').update(hashedPassword).digest('hex').slice(0, 16);
}

// The token carries a fingerprint of the current password hash, so it stops
// working once the password changes: each reset link works once.
export function createResetToken(userId: string, hashedPassword: string): Promise<string> {
  return sign({ sub: userId, purpose: 'reset', pw: fingerprint(hashedPassword) }, RESET_TTL_SECONDS);
}

/** Returns the user id if the token is valid for this user's current password hash. */
export async function readResetToken(
  token: string,
  currentHash: (userId: string) => Promise<string | null>
): Promise<string | null> {
  const payload = await read(token, 'reset');
  if (!payload || typeof payload.sub !== 'string') return null;
  const hashed = await currentHash(payload.sub);
  if (!hashed || payload.pw !== fingerprint(hashed)) return null;
  return payload.sub;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}
