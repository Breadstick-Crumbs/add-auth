import { Suspense } from 'react';
import { SignInForm } from '../forms';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Reading searchParams sits inside <Suspense> so the page builds with
// cacheComponents on (the Next 16 default) as well as off.
async function SignIn({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  return <SignInForm next={typeof next === 'string' ? next : undefined} />;
}

export default function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <Suspense fallback={<SignInForm />}>
        <SignIn searchParams={searchParams} />
      </Suspense>
    </>
  );
}
