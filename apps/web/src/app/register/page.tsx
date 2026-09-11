import Link from 'next/link';

// Keyed by the `?error=` code the register route handler redirects back
// with (src/app/api/auth/register/route.ts).
const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: 'Enter an email and a password.',
  invalid_input: 'Enter a valid email and a password of at least 8 characters.',
  email_taken: 'An account with that email already exists.',
  unknown: 'Something went wrong. Please try again.',
};

export default async function RegisterPage(props: PageProps<'/register'>) {
  const searchParams = await props.searchParams;
  const errorCode = typeof searchParams.error === 'string' ? searchParams.error : undefined;
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.unknown)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Register</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Create an account to track your practice quiz progress.
      </p>

      {errorMessage && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}

      {/* Plain POST form — see src/app/login/page.tsx's comment. */}
      <form action="/api/auth/register" method="POST" className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name (optional)
          <input
            type="text"
            name="name"
            autoComplete="name"
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15 dark:focus:ring-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15 dark:focus:ring-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15 dark:focus:ring-white/20"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          Register
        </button>
      </form>

      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{' '}
        <Link href="/login" className="font-medium underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
