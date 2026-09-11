import Link from 'next/link';

// Keyed by the `?error=` code the login route handler redirects back with
// (src/app/api/auth/login/route.ts) — kept as plain user-facing copy here
// rather than forwarding apps/api's own error message, so this page never
// has to change shape just because that message's wording does.
const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: 'Enter both an email and a password.',
  invalid_credentials: 'Incorrect email or password.',
  invalid_input: 'Enter a valid email and password.',
  unknown: 'Something went wrong. Please try again.',
};

export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams;
  const errorCode = typeof searchParams.error === 'string' ? searchParams.error : undefined;
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.unknown)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Log in to see your practice quiz history and progress.
      </p>

      {errorMessage && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}

      {/* Plain POST form — no client-side JS/fetch needed, same philosophy
          as the nav search box (Header.tsx). The route handler proxies
          this to apps/api and sets the session cookie itself; see
          src/app/api/auth/login/route.ts and
          docs/adr/016-web-session-cookie-strategy.md. */}
      <form action="/api/auth/login" method="POST" className="mt-6 flex flex-col gap-4">
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
            autoComplete="current-password"
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15 dark:focus:ring-white/20"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          Log in
        </button>
      </form>

      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium underline">
          Register
        </Link>
      </p>
    </div>
  );
}
