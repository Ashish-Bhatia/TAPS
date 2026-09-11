import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../src/lib/AuthContext';
import type { LoginError } from '../src/lib/auth';

// Login screen (TAPS-6.2) — POST /user-auth/login (docs/api/user-auth.md)
// via useAuth().login(), which persists the returned token through
// expo-secure-store (src/lib/auth.ts, docs/adr/023-mobile-auth-token-storage.md)
// on success. Error copy is keyed off the same error codes
// apps/web/src/app/login/page.tsx uses for its own login page, for the
// same reason: kept as plain user-facing copy here rather than forwarding
// apps/api's own error message, so this screen never has to change shape
// just because that message's wording does.
const ERROR_MESSAGES: Record<LoginError, string> = {
  invalid_credentials: 'Incorrect email or password.',
  invalid_input: 'Enter a valid email and password.',
  unknown: 'Something went wrong. Check your connection and try again.',
};

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email || !password) {
      setError('Enter both an email and a password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(ERROR_MESSAGES[result.error]);
      return;
    }
    router.replace('/account');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Text style={styles.title}>Log in</Text>
      <Text style={styles.subtitle}>Log in to see your practice quiz history and progress.</Text>

      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          testID="login-email-input"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          testID="login-password-input"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          style={styles.input}
        />
      </View>

      <Pressable
        testID="login-submit-button"
        onPress={onSubmit}
        disabled={submitting}
        style={[styles.button, submitting && styles.buttonDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Log in</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    color: '#52525b',
    marginTop: 4,
    marginBottom: 16,
  },
  error: {
    fontSize: 14,
    color: '#b91c1c',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  button: {
    backgroundColor: '#18181b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
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
});
