interface ComingSoonProps {
  title: string;
  note?: string;
}

/**
 * Placeholder for nav/footer targets that don't have real content or a
 * public API yet (TAPS-3.2) — a working page, not a silent 404, so the
 * primary nav's structural parity with the source site
 * (03-SOURCE-SITE-CONTENT-INVENTORY.md) doesn't dead-end on click.
 */
export function ComingSoon({ title, note }: ComingSoonProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        This section is coming soon.
        {note ? ` ${note}` : ''}
      </p>
    </div>
  );
}
