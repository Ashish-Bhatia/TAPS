import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/lib/AuthContext';
import {
  startQuiz,
  submitQuiz,
  type StartQuizQuestion,
  type SubmitQuizResult,
} from '../../src/lib/quiz';

// Quiz-taking screen (TAPS-6.3) — POST /quiz-attempts/start +
// POST /quiz-attempts/:id/submit (docs/api/quiz-attempts.md), gated behind
// TAPS-6.2's auth. No apps/web equivalent to mirror (apps/web never built a
// quiz-taking UI, only the API + TAPS-5.3's read-only dashboard) — this
// screen's shape is new, not ported.
//
// There's no GET /quiz-attempts/:id to re-fetch an in-progress attempt, so
// the questions `start` returns are held in this screen's own state
// (`phase`) for the life of the attempt rather than re-fetched — a
// deliberate consequence of the API's shape (docs/adr/015-quiz-attempt-
// data-shape.md), not an oversight here.
type Phase =
  | { kind: 'starting' }
  | { kind: 'error'; message: string }
  | { kind: 'answering'; attemptId: string; questions: StartQuizQuestion[] }
  | { kind: 'submitting'; attemptId: string; questions: StartQuizQuestion[] }
  | { kind: 'submitted'; result: SubmitQuizResult };

export default function QuizScreen() {
  const { examBoardId } = useLocalSearchParams<{ examBoardId: string }>();
  const { status, token } = useAuth();

  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });
  const [answers, setAnswers] = useState<Record<string, number>>({});

  // Only fires once auth has actually resolved to a real token — every
  // setState call lives inside .then/.catch, not synchronously in the
  // effect body (react-hooks's set-state-in-effect rule; see
  // app/index.tsx's fuller comment on this pattern).
  useEffect(() => {
    if (status !== 'authenticated' || !token) {
      return;
    }
    let cancelled = false;
    startQuiz(examBoardId, token)
      .then((result) => {
        if (!cancelled) {
          setPhase({ kind: 'answering', attemptId: result.attemptId, questions: result.questions });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhase({
            kind: 'error',
            message:
              'Could not start a quiz for this exam board. Check your connection and try again.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status, token, examBoardId]);

  const selectOption = useCallback((questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }, []);

  // A plain event handler (Pressable's onPress), not an effect — the
  // synchronous setPhase() below is fine here.
  const onSubmit = useCallback(() => {
    if (phase.kind !== 'answering' || !token) {
      return;
    }
    const { attemptId, questions } = phase;
    setPhase({ kind: 'submitting', attemptId, questions });
    submitQuiz(attemptId, answers, token)
      .then((result) => setPhase({ kind: 'submitted', result }))
      .catch(() =>
        setPhase({
          kind: 'error',
          message: 'Could not submit your answers. Check your connection and try again.',
        }),
      );
  }, [phase, answers, token]);

  // Order matters: `status === 'unauthenticated'` must be checked before
  // `phase.kind === 'starting'` — the start-quiz effect above deliberately
  // returns early without ever changing `phase` when logged out, so
  // `phase` would stay 'starting' forever and this screen would spin
  // indefinitely if the loading check ran first.
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
        <Text style={styles.message}>Log in to take a practice quiz.</Text>
        <Link href="/login" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Log in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  if (phase.kind === 'starting') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (phase.kind === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{phase.message}</Text>
      </View>
    );
  }

  if (phase.kind === 'submitted') {
    const { result } = phase;
    const weakTopicEntries = Object.entries(result.weakTopics);
    return (
      <FlatList
        data={result.questions}
        keyExtractor={(question) => question.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Stack.Screen options={{ title: 'Results' }} />
            <Text style={styles.score}>
              {result.score} / {result.totalQuestions}
            </Text>
            <Text style={styles.scoreLabel}>correct</Text>
            {weakTopicEntries.length > 0 && (
              <View style={styles.weakTopics}>
                <Text style={styles.weakTopicsTitle}>Topics to review</Text>
                <View style={styles.weakTopicChips}>
                  {weakTopicEntries.map(([topic, count]) => (
                    <View key={topic} style={styles.weakTopicChip}>
                      <Text style={styles.weakTopicChipText}>
                        {topic} ({count})
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.questionCard,
              item.isCorrect ? styles.correctCard : styles.incorrectCard,
            ]}
          >
            <Text style={styles.questionText}>{item.questionText}</Text>
            <Text style={styles.resultLine}>
              {item.isCorrect ? 'Correct' : 'Incorrect'} — answer:{' '}
              {item.options[item.correctOption]}
            </Text>
            <Text style={styles.explanation}>{item.explanation}</Text>
          </View>
        )}
      />
    );
  }

  // 'answering' or 'submitting'
  const { questions } = phase;
  const answeredCount = questions.filter((question) => answers[question.id] !== undefined).length;
  const submitting = phase.kind === 'submitting';

  return (
    <FlatList
      data={questions}
      keyExtractor={(question) => question.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Stack.Screen options={{ title: 'Practice Quiz' }} />
          <Text style={styles.progress}>
            {answeredCount} of {questions.length} answered
          </Text>
        </View>
      }
      renderItem={({ item: question, index }) => (
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>
            {index + 1}. {question.questionText}
          </Text>
          {question.options.map((option, optionIndex) => {
            const selected = answers[question.id] === optionIndex;
            return (
              <Pressable
                key={optionIndex}
                testID={`option-${question.id}-${optionIndex}`}
                onPress={() => selectOption(question.id, optionIndex)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      ListFooterComponent={
        <Pressable
          testID="quiz-submit-button"
          onPress={onSubmit}
          disabled={submitting}
          style={[styles.button, styles.submitButton, submitting && styles.buttonDisabled]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Submit</Text>
          )}
        </Pressable>
      }
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
    gap: 12,
  },
  header: {
    marginBottom: 12,
  },
  progress: {
    fontSize: 14,
    color: '#52525b',
    fontWeight: '600',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#b91c1c',
    textAlign: 'center',
  },
  questionCard: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  option: {
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionSelected: {
    borderColor: '#18181b',
    backgroundColor: '#18181b',
  },
  optionText: {
    fontSize: 14,
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#18181b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButton: {
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  score: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#52525b',
    textAlign: 'center',
    marginBottom: 12,
  },
  weakTopics: {
    marginTop: 8,
  },
  weakTopicsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  weakTopicChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weakTopicChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  weakTopicChipText: {
    fontSize: 13,
    color: '#b91c1c',
    fontWeight: '600',
  },
  correctCard: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  incorrectCard: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  resultLine: {
    fontSize: 14,
    fontWeight: '600',
  },
  explanation: {
    fontSize: 14,
    color: '#52525b',
  },
});
