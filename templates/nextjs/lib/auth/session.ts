import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, cookieOptions, createAccessToken, readAccessToken } from './core';
import { findUserById } from './users';
import type { User } from './schema';

export async function startSession(userId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await createAccessToken(userId), cookieOptions());
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * The signed-in user, or null. Use in server components, route handlers and server actions.
 * Cached per request, so a layout and a page that both call it cost one database read.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const id = await readAccessToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const user = await findUserById(id);
  return user && user.isActive ? user : null;
});

/** Like getUser, but sends anyone not signed in (or without one of `roles`) to /sign-in. */
export async function requireUser(...roles: string[]): Promise<User> {
  const user = await getUser();
  if (!user) redirect('/sign-in');
  if (roles.length && !roles.includes(user.role)) redirect('/');
  return user;
}
