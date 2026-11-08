import { Suspense } from 'react';
import { signOut } from '@/app/(auth)/actions';
import { ChangePasswordForm } from '@/app/(auth)/forms';
import { requireUser } from '@/lib/auth/session';

// Reads cookies, so it sits inside <Suspense> for cacheComponents.
async function SignedInAs() {
  const user = await requireUser();
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      Signed in as {user.name ? `${user.name} (${user.email})` : user.email}
    </p>
  );
}

export default function AccountPage() {
  return (
    <div className="flex min-h-screen justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="flex w-full max-w-md flex-col gap-8 rounded-xl bg-white p-8 shadow-sm dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
            <Suspense fallback={<p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>}>
              <SignedInAs />
            </Suspense>
          </div>
          <form action={signOut}>
            <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700" type="submit">
              Sign out
            </button>
          </form>
        </div>
        <section className="flex flex-col gap-4">
          <h2 className="font-medium">Change password</h2>
          <ChangePasswordForm />
        </section>
      </main>
    </div>
  );
}
