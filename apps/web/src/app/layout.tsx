import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Footer } from '../components/nav/Footer';
import { Header } from '../components/nav/Header';
import { getExamBoardsForNav } from '../lib/api';
import { getSessionToken } from '../lib/session';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TAPS — Teacher Assessment and Preparation System',
  description:
    'Discover recruitment notifications, syllabus, previous papers, and study material for teaching and TET-level exams.',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Fetched once per request in the root layout, so it's available to the
  // header's nav dropdowns on every page — fails soft (empty list) rather
  // than ever taking the whole site down; see getExamBoardsForNav in
  // lib/api.ts and docs/adr/007-nav-data-sourcing.md.
  const examBoards = await getExamBoardsForNav();
  // Presence-only check (TAPS-5.0.5) — just enough to decide which links
  // the header shows; see src/lib/session.ts and Header.tsx's HeaderProps.
  const hasSession = Boolean(await getSessionToken());

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Header examBoards={examBoards} hasSession={hasSession} />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
