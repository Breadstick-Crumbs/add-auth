// The only file that talks to the database. Point `db` at your project's
// Drizzle instance; if the project uses Prisma or raw SQL, rewrite these five
// functions and nothing else changes.
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, type User } from './schema';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(input: { email: string; passwordHash: string; name?: string | null }): Promise<User> {
  const rows = await db
    .insert(users)
    .values({ email: normalizeEmail(input.email), passwordHash: input.passwordHash, name: input.name ?? null })
    .returning();
  return rows[0];
}

export async function setPasswordHash(id: string, passwordHash: string): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

export async function currentPasswordHash(id: string): Promise<string | null> {
  const user = await findUserById(id);
  return user && user.isActive ? user.passwordHash : null;
}
