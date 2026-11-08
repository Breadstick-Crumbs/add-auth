'use server';
// Server actions for the sign-in, sign-up and password forms.
// Adapted from nextjs/saas-starter (MIT, Vercel).
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createResetToken, hashPassword, readResetToken, verifyPassword } from '@/lib/auth/core';
import { sendResetEmail } from '@/lib/auth/email';
import { endSession, requireUser, startSession } from '@/lib/auth/session';
import { createUser, currentPasswordHash, findUserByEmail, setPasswordHash } from '@/lib/auth/users';

export type FormState = { error?: string; success?: string };

const password = z.string().min(8, 'Use at least 8 characters').max(128);
const email = z.string().email('Enter a valid email').max(255);

function parse<T extends z.ZodTypeAny>(schema: T, form: FormData): z.infer<T> | string {
  const r = schema.safeParse(Object.fromEntries(form));
  return r.success ? r.data : r.error.issues[0]?.message ?? 'Invalid input';
}

// Only same-site relative paths, so ?next= can't send people to another site.
function safeNext(next: unknown): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const data = parse(z.object({ email, password, name: z.string().max(255).optional() }), form);
  if (typeof data === 'string') return { error: data };
  if (await findUserByEmail(data.email)) return { error: 'An account with this email already exists' };
  const user = await createUser({ email: data.email, passwordHash: await hashPassword(data.password), name: data.name });
  await startSession(user.id);
  redirect(safeNext(form.get('next')));
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const data = parse(z.object({ email, password: z.string().min(1).max(128) }), form);
  if (typeof data === 'string') return { error: data };
  const user = await findUserByEmail(data.email);
  const ok = await verifyPassword(data.password, user?.passwordHash);
  if (!user || !ok || !user.isActive) return { error: 'Incorrect email or password' };
  await startSession(user.id);
  redirect(safeNext(form.get('next')));
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect('/sign-in');
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const data = parse(z.object({ currentPassword: z.string().min(1), newPassword: password }), form);
  if (typeof data === 'string') return { error: data };
  if (!(await verifyPassword(data.currentPassword, user.passwordHash))) return { error: 'Current password is wrong' };
  await setPasswordHash(user.id, await hashPassword(data.newPassword));
  return { success: 'Password changed' };
}

export async function forgotPassword(_: FormState, form: FormData): Promise<FormState> {
  const data = parse(z.object({ email }), form);
  if (typeof data === 'string') return { error: data };
  const user = await findUserByEmail(data.email);
  if (user?.isActive) await sendResetEmail(user.email, await createResetToken(user.id, user.passwordHash));
  // Same answer either way, so this can't be used to find out who has an account.
  return { success: 'If that email has an account, we sent a reset link' };
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const data = parse(z.object({ token: z.string().min(1), newPassword: password }), form);
  if (typeof data === 'string') return { error: data };
  const userId = await readResetToken(data.token, currentPasswordHash);
  if (!userId) return { error: 'This reset link is invalid or has expired' };
  await setPasswordHash(userId, await hashPassword(data.newPassword));
  return { success: 'Password updated. You can sign in now.' };
}
