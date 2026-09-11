import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/lib/AuthContext';

// Account screen (TAPS-6.2) — the one screen this story adds that isn't
// the login form itself, so there's somewhere for "logged in as X" / "log
// out" to live, and somewhere for /login to redirect back to. TAPS-6.3/
// 6.4's screens (quiz-taking, progress dashboard) are the real
// authenticated content; this screen doesn't try to anticipate their UI.
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
