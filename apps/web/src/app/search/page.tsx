import Link from 'next/link';
import { search } from '../../lib/api';
import type { SearchResult } from '../../lib/types';

function resultHref(result: SearchResult): string | undefined {
  if (result.type === 'exam-board') {
    return `/exam-boards/${result.id}`;
  }
  // A post's own public detail page doesn't exist in apps/web yet — link
  // to its parent board's hub page (where the post already appears in the
  // Notifications list, TAPS-3.3) when it has one; otherwise not a link at
  // all rather than a broken one. See docs/api/public-content.md.
  return result.examBoardId ? `/exam-boards/${result.examBoardId}` : undefined;
}

function resultTypeLabel(type: SearchResult['type']): string {
  return type === 'exam-board' ? 'Exam Board' : 'Notification';
}

export default async function SearchPage(props: PageProps<'/search'>) {
  const { q } = await props.searchParams;
  const query = typeof q === 'string' ? q.trim() : '';

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>

      {!query ? (
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Use the search box above to find exam boards and notifications.
        </p>
      ) : (
        <SearchResults query={query} />
      )}
    </div>
  );
}

async function SearchResults({ query }: { query: string }) {
  const results = await search(query);

  if (results.data.length === 0) {
    return (
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">No results for &quot;{query}&quot;.</p>
    );
  }

  return (
    <ul className="mt-6 divide-y divide-black/10 dark:divide-white/10">
      {results.data.map((result) => {
        const href = resultHref(result);
        return (
          <li key={`${result.type}-${result.id}`} className="py-4">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {resultTypeLabel(result.type)}
            </p>
            {href ? (
              <Link href={href} className="font-medium hover:underline">
                {result.title}
              </Link>
            ) : (
              <p className="font-medium">{result.title}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
