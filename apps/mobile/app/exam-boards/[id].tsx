import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { getExamBoard, getPostsByExamBoard } from '../../src/lib/api';
import { useAuth } from '../../src/lib/AuthContext';
import type { ExamBoard, Post } from '../../src/lib/types';

// Exam board detail screen (TAPS-6.1) — GET /public/exam-boards/:id +
// GET /public/posts?examBoardId=:id (docs/api/public-content.md), mirroring
// apps/web/src/app/exam-boards/[id]/page.tsx (TAPS-3.3). Sub-sections
// (Syllabus/Exam Pattern/Previous Papers/Study Material/Eligibility, TAPS-
// 3.6's web equivalent) are out of scope for this story — this screen shows
// the board's own info plus its published posts only.
export default function ExamBoardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status } = useAuth();

  const [examBoard, setExamBoard] = useState<ExamBoard | null | undefined>(undefined);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch (and every setState call) lives entirely inside .then/.catch/
  // .finally, not synchronously in the effect body — react-hooks's
  // set-state-in-effect rule flags a direct/synchronous setState call in an
  // effect (see app/index.tsx's identical comment for the fuller reasoning).
  useEffect(() => {
    let cancelled = false;
    Promise.all([getExamBoard(id), getPostsByExamBoard(id)])
      .then(([board, boardPosts]) => {
        if (!cancelled) {
          setExamBoard(board);
          setPosts(boardPosts);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load this exam board. Check your connection and try again.');
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
  }, [id]);

  if (loading && examBoard === undefined) {
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
      </View>
    );
  }

  if (examBoard === null) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text style={styles.emptyText}>No exam board with this id.</Text>
      </View>
    );
  }

  if (!examBoard) {
    return null;
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(post) => post.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Stack.Screen options={{ title: examBoard.name }} />
          <Text style={styles.type}>{examBoard.type === 'TEACHING' ? 'Teaching Exam' : 'TET'}</Text>
          <Text style={styles.title}>{examBoard.name}</Text>
          <Text style={styles.description}>{examBoard.description}</Text>
          {status === 'authenticated' ? (
            <Link
              href={{ pathname: '/quiz/[examBoardId]', params: { examBoardId: examBoard.id } }}
              asChild
            >
              <Pressable testID="start-quiz-button" style={styles.quizButton}>
                <Text style={styles.quizButtonText}>Practice quiz</Text>
              </Pressable>
            </Link>
          ) : status === 'unauthenticated' ? (
            <Link href="/login" asChild>
              <Pressable testID="start-quiz-button" style={styles.quizButton}>
                <Text style={styles.quizButtonText}>Log in to take a practice quiz</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No posts published for this board yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.postCard}>
          <Text style={styles.postTitle}>{item.title}</Text>
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
  },
  list: {
    padding: 16,
    gap: 12,
  },
  header: {
    marginBottom: 20,
  },
  type: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717a',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  description: {
    fontSize: 15,
    color: '#52525b',
    marginTop: 8,
  },
  quizButton: {
    marginTop: 16,
    backgroundColor: '#18181b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quizButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  postCard: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
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
});
