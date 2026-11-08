export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="flex w-full max-w-sm flex-col gap-6 rounded-xl bg-white p-8 shadow-sm dark:bg-zinc-950">
        {children}
      </main>
    </div>
  );
}
