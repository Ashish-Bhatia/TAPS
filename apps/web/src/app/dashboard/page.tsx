import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getMyQuizAttempts, UnauthorizedApiError } from '../../lib/api';
import { requireSessionToken, SESSION_COOKIE_NAME } from '../../lib/session';
import type { AccuracyTrendPoint, MyQuizAttemptsResult, QuizAttemptSummary } from '../../lib/types';

/**
 * TAPS-5.3's web half, unblocked by TAPS-5.0.5: reads apps/api's
 * `GET /quiz-attempts/me` (docs/api/quiz-attempts.md) and renders the
 * attempt list, accuracy trend, and weak-topic heatmap it returns.
 *
 * Protected via `requireSessionToken()` (src/lib/session.ts) — an
 * unauthenticated visitor is redirected to /login before this component
 * produces any output, so there is no client-side flash of a protected
 * page. `proxy.ts` also redirects unauthenticated visitors before the
 * request even reaches here; this check is the authoritative one that
 * doesn't depend on Proxy having run.
 */
export default async function DashboardPage() {
  const token = await requireSessionToken();

  let data: MyQuizAttemptsResult;
  try {
    data = await getMyQuizAttempts(token);
  } catch (error) {
    if (error instanceof UnauthorizedApiError) {
      // The cookie was present (requireSessionToken let us through) but
      // apps/api's UserJwtAuthGuard rejected the token itself — stale or
      // tampered. Clear it so the visitor isn't stuck bouncing between
      // /dashboard and /login forever, then send them to sign in again.
      (await cookies()).delete(SESSION_COOKIE_NAME);
      redirect('/login');
    }
    throw error;
  }

  const { attempts, accuracyTrend, weakTopicHeatmap } = data;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your progress</h1>

      {attempts.length === 0 ? (
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">
          You haven&apos;t completed any practice quizzes yet. Once you finish one, your attempt
          history, accuracy trend, and weak topics will show up here.
        </p>
      ) : (
        <>
          <AccuracyTrendSection trend={accuracyTrend} />
          <WeakTopicHeatmapSection heatmap={weakTopicHeatmap} />
          <AttemptListSection attempts={attempts} />
        </>
      )}
    </div>
  );
}

function AccuracyTrendSection({ trend }: { trend: AccuracyTrendPoint[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">Accuracy trend</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Oldest attempt first, so the trend reads left to right.
      </p>
      <div
        role="img"
        aria-label={`Accuracy trend across ${trend.length} completed attempts, from ${Math.round(
          trend[0].accuracy * 100,
        )}% to ${Math.round(trend[trend.length - 1].accuracy * 100)}%`}
        className="mt-4 flex h-40 items-end gap-2 rounded-md border border-black/10 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900"
      >
        {trend.map((point) => (
          <div
            key={point.attemptId}
            className="flex flex-1 flex-col items-center justify-end gap-1"
            title={`${Math.round(point.accuracy * 100)}% on ${new Date(
              point.completedAt,
            ).toLocaleDateString('en-IN')}`}
          >
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {Math.round(point.accuracy * 100)}%
            </span>
            <div
              className="w-full max-w-8 rounded-t-sm bg-black dark:bg-white"
              style={{ height: `${Math.max(point.accuracy * 100, 2)}%` }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function WeakTopicHeatmapSection({ heatmap }: { heatmap: Record<string, number> }) {
  const topics = Object.entries(heatmap).sort(([, a], [, b]) => b - a);
  const maxCount = Math.max(...topics.map(([, count]) => count), 1);

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">Weak topics</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Topics you&apos;ve gotten wrong most often, across every completed attempt. Darker means
        more incorrect answers.
      </p>
      {topics.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          No incorrect answers yet — nothing to flag as a weak topic.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {topics.map(([topic, count]) => (
            <div
              key={topic}
              className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10"
              style={{ backgroundColor: `rgba(220, 38, 38, ${(count / maxCount) * 0.6 + 0.1})` }}
            >
              <span className="font-medium">{topic}</span>{' '}
              <span className="text-zinc-700 dark:text-zinc-200">({count} incorrect)</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AttemptListSection({ attempts }: { attempts: QuizAttemptSummary[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">Attempt history</h2>
      <ul className="mt-4 divide-y divide-black/10 dark:divide-white/10">
        {attempts.map((attempt) => (
          <li key={attempt.id} className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="font-medium">Score: {attempt.score}</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {new Date(attempt.completedAt).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            {Object.keys(attempt.weakTopics).length > 0 && (
              <p className="text-right text-sm text-zinc-600 dark:text-zinc-400">
                Missed: {Object.keys(attempt.weakTopics).join(', ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
