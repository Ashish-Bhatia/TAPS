import Link from 'next/link';
import type { ExamBoard } from '../../lib/types';
import { staticNavItems } from '../../lib/nav-config';

interface HeaderProps {
  examBoards: ExamBoard[];
  // Whether the visitor has a session cookie (TAPS-5.0.5) — presence-only,
  // same "optimistic" check as proxy.ts/requireSessionToken, computed once
  // by the root layout (src/app/layout.tsx) via getSessionToken() and
  // passed down, so this stays a plain sync component rather than needing
  // its own async cookie read.
  hasSession: boolean;
}

/**
 * Mega-menu primary nav (TAPS-3.2), structural parity with
 * docs/project-knowledge/03-SOURCE-SITE-CONTENT-INVENTORY.md's "Primary
 * Navigation" list. Dropdowns are native <details>/<summary> — accessible
 * and keyboard-operable by default, and needs no client-side JS/hydration
 * for a header that renders on every single page.
 */
export function Header({ examBoards, hasSession }: HeaderProps) {
  const teachingBoards = examBoards.filter((board) => board.type === 'TEACHING');
  const tetBoards = examBoards.filter((board) => board.type === 'TET');

  return (
    <header className="border-b border-black/10 bg-white dark:border-white/10 dark:bg-black">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6"
      >
        <Link href="/" className="text-lg font-semibold tracking-tight">
          TAPS
        </Link>

        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <li>
            <Link href="/" className="hover:underline">
              Home
            </Link>
          </li>
          <NavDropdown label="Teaching Exams" boards={teachingBoards} />
          <NavDropdown label="TET-Exams" boards={tetBoards} />
          {staticNavItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="hover:underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Plain GET form — navigates to /search?q=... on submit, no
            client-side JS/hydration needed (TAPS-3.4). */}
        <form action="/search" role="search" className="ml-auto flex items-center gap-2 sm:ml-0">
          <label htmlFor="nav-search" className="sr-only">
            Search
          </label>
          <input
            id="nav-search"
            type="search"
            name="q"
            placeholder="Search…"
            className="w-36 rounded-md border border-black/10 bg-transparent px-3 py-1.5 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-black/20 sm:w-48 dark:border-white/15 dark:focus:ring-white/20"
          />
          <button
            type="submit"
            className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            Search
          </button>
        </form>

        {/* TAPS-5.0.5: session-aware auth links. Logged out shows
            Login/Register; logged in shows Dashboard + a logout form
            (plain POST, no client JS — src/app/api/auth/logout/route.ts). */}
        {hasSession ? (
          <div className="flex items-center gap-3 text-sm">
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="rounded-md border border-black/10 px-3 py-1.5 font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                Log out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="hover:underline">
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-md border border-black/10 px-3 py-1.5 font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              Register
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

function NavDropdown({ label, boards }: { label: string; boards: ExamBoard[] }) {
  return (
    <li>
      <details className="group relative">
        <summary className="cursor-pointer list-none hover:underline [&::-webkit-details-marker]:hidden">
          {label} <span aria-hidden="true">▾</span>
        </summary>
        <ul className="absolute z-10 mt-2 min-w-48 rounded-md border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-zinc-900">
          {boards.length === 0 ? (
            <li className="px-4 py-2 text-zinc-500">No exam boards available yet</li>
          ) : (
            boards.map((board) => (
              <li key={board.id}>
                <Link
                  href={`/exam-boards/${board.id}`}
                  className="block px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {board.name}
                </Link>
              </li>
            ))
          )}
        </ul>
      </details>
    </li>
  );
}
