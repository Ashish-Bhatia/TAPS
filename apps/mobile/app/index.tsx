import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { getExamBoards } from '../src/lib/api';
import type { ExamBoard } from '../src/lib/types';

// Exam board list screen (TAPS-6.1) — GET /public/exam-boards
// (docs/api/public-content.md), mirroring apps/web's nav/hub-page data
// source (TAPS-3.1/3.2). Unlike apps/web/src/lib/api.ts's
// getExamBoardsForNav, this does NOT fail soft to an empty list: this
// screen's entire purpose is the exam board list, so a real API error
// should surface as a real, retryable error state rather than a page that
// looks fine but is silently empty.
export default function ExamBoardsScreen() {
  const [examBoards, setExamBoards] = useState<ExamBoard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped by the retry button to re-run the effect below. The fetch itself
  // (and its setState calls) lives entirely inside .then/.catch/.finally,
  // not synchronously in the effect body — react-hooks's set-state-in-effect
  // rule flags a direct/synchronous setState call in an effect, which is
  // why `loading`/`error` are reset in the retry handler (a plain event
  // handler) rather than at the top of a shared load() called from here.
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getExamBoards()
      .then((boards) => {
        if (!cancelled) {
          setExamBoards(boards);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load exam boards. Check your connection and try again.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setRetryKey((key) => key + 1);
  }, []);

  if (loading && examBoards === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={retry} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (examBoards !== null && examBoards.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No exam boards yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={examBoards ?? []}
      keyExtractor={(board) => board.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Link href={{ pathname: '/exam-boards/[id]', params: { id: item.id } }} asChild>
          <Pressable style={styles.card}>
            <Text style={styles.cardType}>
              {item.type === 'TEACHING' ? 'Teaching Exam' : 'TET'}
            </Text>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardDescription} numberOfLines={2}>
              {item.description}
            </Text>
          </Pressable>
        </Link>
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
    gap: 12,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  cardType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717a',
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#52525b',
    marginTop: 6,
  },
  errorText: {
    fontSize: 15,
    color: '#b91c1c',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#71717a',
  },
  retryButton: {
    backgroundColor: '#18181b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
