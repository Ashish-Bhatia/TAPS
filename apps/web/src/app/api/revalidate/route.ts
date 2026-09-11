import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * TAPS-3.7 (docs/adr/019-tag-based-cache-revalidation.md): apps/api's admin
 * write endpoints on ExamBoard/Post call this route server-to-server after
 * a successful write, so apps/web's tagged caches (`lib/api.ts`) stay
 * correct without a blind time-based revalidate window — the exact kind of
 * caching docs/adr/007-nav-data-sourcing.md's follow-up note already found
 * unsafe once.
 *
 * Auth: a shared secret (`REVALIDATION_SECRET`), set identically on this
 * app (Vercel) and apps/api (Fly) — never the admin JWT, which apps/api's
 * caller has no reason to hold, and never unauthenticated (anyone on the
 * internet could otherwise force-expire this app's cache on demand).
 *
 * `revalidateTag(tag, { expire: 0 })` — not the two-arg `'max'` profile
 * example in Next's own docs — this call happens outside a Server Action
 * (a Route Handler invoked by another service), where `updateTag` isn't
 * available, and `{ expire: 0 }` is exactly what the docs recommend for
 * that case: expire immediately rather than serve stale-while-revalidate.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.REVALIDATION_SECRET;
  if (!secret) {
    // Misconfiguration, not a bad request — fail loudly rather than
    // silently accepting revalidation calls with no real auth check,
    // matching AuthService's ADMIN_PASSWORD_HASH-missing pattern.
    return NextResponse.json({ error: 'REVALIDATION_SECRET is not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const tags =
    body !== null && typeof body === 'object' && 'tags' in body
      ? (body as { tags: unknown }).tags
      : undefined;

  if (!Array.isArray(tags) || tags.length === 0 || !tags.every((tag) => typeof tag === 'string')) {
    return NextResponse.json({ error: 'Body must be { tags: string[] }' }, { status: 400 });
  }

  for (const tag of tags as string[]) {
    revalidateTag(tag, { expire: 0 });
  }

  return NextResponse.json({ revalidated: true, tags });
}
