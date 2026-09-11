import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/lib/AuthContext';

// Account screen (TAPS-6.2) — "logged in as X" / "log out", and somewhere
// for /login to redirect back to. Also the entry point to the progress
// dashboard (TAPS-6.4) — the quiz-taking flow (TAPS-6.3) is reached from
// an exam board's own detail screen instead, not from here.
export default function AccountScreen() {
  const { status, email, logout } = useAuth();

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
        <Text style={styles.message}>You&apos;re not logged in.</Text>
        <Link href="/login" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Log in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.centered}>
      <Text style={styles.message}>Logged in as {email}</Text>
      <Link href="/dashboard" asChild>
        <Pressable testID="dashboard-link-button" style={styles.button}>
          <Text style={styles.buttonText}>Your progress</Text>
        </Pressable>
      </Link>
      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </View>
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
  message: {
    fontSize: 16,
    color: '#18181b',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#18181b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
