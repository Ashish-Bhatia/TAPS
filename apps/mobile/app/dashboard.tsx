import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/lib/AuthContext';
import { getMyQuizAttempts, type MyQuizAttemptsResult } from '../src/lib/dashboard';
import { UnauthorizedApiError } from '../src/lib/auth';

// Progress dashboard screen (TAPS-6.4) — GET /quiz-attempts/me
// (docs/api/quiz-attempts.md, TAPS-5.3), mirroring
// apps/web/src/app/dashboard/page.tsx's three sections (accuracy trend,
// weak-topic heatmap, attempt history) and its empty-state copy. React
// Native has no built-in charting — the accuracy trend is a plain View-bar
// row rather than a canvas/SVG chart, same information, no new dependency.
export default function DashboardScreen() {
  const { status, token, logout } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<MyQuizAttemptsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Every setState call lives inside .then/.catch, not synchronously in
  // the effect body (react-hooks's set-state-in-effect rule — see
  // app/index.tsx's fuller comment). A 401 here means the token itself was
  // rejected (stale/tampered, not "never logged in" — that's `status`) —
  // same distinction apps/web's UnauthorizedApiError/
  // clearSessionAndRedirectToLogin makes.
  useEffect(() => {
    if (status !== 'authenticated' || !token) {
      return;
    }
    let cancelled = false;
    getMyQuizAttempts(token)
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        if (err instanceof UnauthorizedApiError) {
          logout().then(() => router.replace('/login'));
          return;
        }
        setError('Could not load your progress. Check your connection and try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [status, token, logout, router]);

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Log in to see your progress.</Text>
        <Link href="/login" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Log in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (data.attempts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>
          You haven&apos;t completed any practice quizzes yet. Once you finish one, your attempt
          history, accuracy trend, and weak topics will show up here.
        </Text>
      </View>
    );
  }

  const weakTopics = Object.entries(data.weakTopicHeatmap).sort(([, a], [, b]) => b - a);
  const maxWeakCount = Math.max(...weakTopics.map(([, count]) => count), 1);

  return (
    <FlatList
      data={data.attempts}
      keyExtractor={(attempt) => attempt.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <Text style={styles.sectionTitle}>Accuracy trend</Text>
          <Text style={styles.sectionSubtitle}>Oldest attempt first, reading left to right.</Text>
          <View style={styles.trendChart}>
            {data.accuracyTrend.map((point) => (
              <View key={point.attemptId} style={styles.trendBarColumn}>
                <Text style={styles.trendBarLabel}>{Math.round(point.accuracy * 100)}%</Text>
                <View style={styles.trendBarTrack}>
                  <View
                    style={[
                      styles.trendBarFill,
                      { height: `${Math.max(point.accuracy * 100, 4)}%` },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Weak topics</Text>
          <Text style={styles.sectionSubtitle}>
            Topics you&apos;ve gotten wrong most often, across every completed attempt.
          </Text>
          {weakTopics.length === 0 ? (
            <Text style={styles.sectionSubtitle}>
              No incorrect answers yet — nothing to flag as a weak topic.
            </Text>
          ) : (
            <View style={styles.weakTopicChips}>
              {weakTopics.map(([topic, count]) => (
                <View
                  key={topic}
                  style={[styles.weakTopicChip, { opacity: 0.4 + (count / maxWeakCount) * 0.6 }]}
                >
                  <Text style={styles.weakTopicChipText}>
                    {topic} ({count} incorrect)
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Attempt history</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.attemptRow}>
          <View>
            <Text style={styles.attemptScore}>Score: {item.score}</Text>
            <Text style={styles.attemptDate}>
              {new Date(item.completedAt).toLocaleDateString()}
            </Text>
          </View>
          {Object.keys(item.weakTopics).length > 0 && (
            <Text style={styles.attemptMissed}>
              Missed: {Object.keys(item.weakTopics).join(', ')}
            </Text>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  list: {
    padding: 16,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#52525b',
  },
  errorText: {
    fontSize: 15,
    color: '#b91c1c',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#18181b',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#71717a',
    marginTop: 4,
  },
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 140,
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    backgroundColor: '#fafafa',
  },
  trendBarColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  trendBarLabel: {
    fontSize: 10,
    color: '#71717a',
    marginBottom: 4,
  },
  trendBarTrack: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
  },
  trendBarFill: {
    width: '100%',
    backgroundColor: '#18181b',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  weakTopicChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  weakTopicChip: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#dc2626',
  },
  weakTopicChipText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  attemptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e7',
  },
  attemptScore: {
    fontSize: 15,
    fontWeight: '600',
  },
  attemptDate: {
    fontSize: 13,
    color: '#71717a',
    marginTop: 2,
  },
  attemptMissed: {
    fontSize: 13,
    color: '#52525b',
    flexShrink: 1,
    textAlign: 'right',
  },
});
