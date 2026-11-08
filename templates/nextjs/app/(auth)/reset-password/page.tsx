import Link from 'next/link';
import { Suspense } from 'react';
import { ResetPasswordForm } from '../forms';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function ResetPassword({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;
  if (typeof token === 'string' && token) return <ResetPasswordForm token={token} />;
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      This link is missing its token.{' '}
      <Link className="underline" href="/forgot-password">
        Request a new one
      </Link>
      .
    </p>
  );
}

export default function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <Suspense>
        <ResetPassword searchParams={searchParams} />
      </Suspense>
    </>
  );
}
