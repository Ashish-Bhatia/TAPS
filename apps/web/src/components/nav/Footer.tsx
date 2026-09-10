import Link from 'next/link';

const legalLinks = [
  { label: 'About Us', href: '/about' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Disclaimer', href: '/disclaimer' },
  { label: 'Privacy Policy', href: '/privacy' },
];

/**
 * Static/legal page links per the PRD's MVP static-pages scope
 * (02-PRODUCT-VISION-AND-PRD.md §3). Social links (Facebook/YouTube/
 * Telegram/Instagram, per 03-SOURCE-SITE-CONTENT-INVENTORY.md's
 * cross-cutting features) are deliberately omitted for now — TAPS has no
 * real social accounts yet, and fabricated placeholder URLs would be worse
 * than no link at all.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-black/10 py-8 dark:border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm text-zinc-600 sm:flex-row sm:justify-between sm:px-6 dark:text-zinc-400">
        <p>© {new Date().getFullYear()} TAPS. All rights reserved.</p>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {legalLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:underline">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
