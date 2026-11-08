'use client';
// The auth forms. Plain Tailwind classes; swap in the project's own components.
import Link from 'next/link';
import { useActionState } from 'react';
import { changePassword, forgotPassword, resetPassword, signIn, signUp, type FormState } from './actions';

type Action = (state: FormState, form: FormData) => Promise<FormState>;

const inputClass =
  'w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-400';
const buttonClass =
  'w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';
const mutedClass = 'text-sm text-zinc-600 dark:text-zinc-400';

function Field(props: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className={mutedClass}>{props.label}</span>
      <input
        className={inputClass}
        name={props.name}
        type={props.type ?? 'text'}
        autoComplete={props.autoComplete}
        required={props.required ?? true}
        defaultValue={props.defaultValue}
      />
    </label>
  );
}

// React clears a form after its action runs; the action hands the email back
// so it can be filled in again instead of retyped.
function Form(props: { action: Action; submit: string; children: (state: FormState) => React.ReactNode }) {
  const [state, formAction, pending] = useActionState(props.action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {props.children(state)}
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-green-700 dark:text-green-400" role="status">
          {state.success}
        </p>
      )}
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? 'Please wait...' : props.submit}
      </button>
    </form>
  );
}

export function SignInForm({ next }: { next?: string }) {
  return (
    <>
      <Form action={signIn} submit="Sign in">
        {(s) => (
          <>
            <input type="hidden" name="next" value={next ?? '/account'} />
            <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={s.email} />
            <Field label="Password" name="password" type="password" autoComplete="current-password" />
          </>
        )}
      </Form>
      <p className={mutedClass}>
        <Link className="underline" href="/forgot-password">
          Forgot password?
        </Link>{' '}
        ·{' '}
        <Link className="underline" href="/sign-up">
          Create an account
        </Link>
      </p>
    </>
  );
}

export function SignUpForm() {
  return (
    <>
      <Form action={signUp} submit="Create account">
        {(s) => (
          <>
            <input type="hidden" name="next" value="/account" />
            <Field label="Name" name="name" autoComplete="name" required={false} />
            <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={s.email} />
            <Field label="Password" name="password" type="password" autoComplete="new-password" />
          </>
        )}
      </Form>
      <p className={mutedClass}>
        Have an account?{' '}
        <Link className="underline" href="/sign-in">
          Sign in
        </Link>
      </p>
    </>
  );
}

export function ForgotPasswordForm() {
  return (
    <>
      <Form action={forgotPassword} submit="Send reset link">
        {(s) => <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={s.email} />}
      </Form>
      <p className={mutedClass}>
        <Link className="underline" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  return (
    <>
      <Form action={resetPassword} submit="Set new password">
        {() => (
          <>
            <input type="hidden" name="token" value={token} />
            <Field label="New password" name="newPassword" type="password" autoComplete="new-password" />
          </>
        )}
      </Form>
      <p className={mutedClass}>
        <Link className="underline" href="/sign-in">
          Sign in
        </Link>
      </p>
    </>
  );
}

export function ChangePasswordForm() {
  return (
    <Form action={changePassword} submit="Change password">
      {() => (
        <>
          <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" />
          <Field label="New password" name="newPassword" type="password" autoComplete="new-password" />
        </>
      )}
    </Form>
  );
}
