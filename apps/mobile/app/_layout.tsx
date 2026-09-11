import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import { AuthProvider } from '../src/lib/AuthContext';

// Root layout (TAPS-6.1, wrapped in AuthProvider by TAPS-6.2) — Expo
// Router's entry point (package.json's `main` is now `expo-router/entry`,
// not the old App.tsx/index.ts registration). AuthProvider wraps the whole
// Stack so every screen (including TAPS-6.3/6.4's, once built) can read
// login state via useAuth() without each one re-reading
// expo-secure-store itself — see src/lib/AuthContext.tsx.
export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTitleStyle: { fontWeight: '600' },
          // Visible on every screen — the one entry point into the
          // authenticated area for now. A tab bar or drawer (once
          // TAPS-6.3/6.4 give the authenticated area more than one screen)
          // is a decision for later, not this story.
          headerRight: () => (
            <Link href="/account">
              <Text style={{ fontSize: 15, fontWeight: '500' }}>Account</Text>
            </Link>
          ),
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Exam Boards' }} />
        <Stack.Screen name="exam-boards/[id]" options={{ title: '' }} />
        <Stack.Screen name="account" options={{ title: 'Account', headerRight: undefined }} />
        <Stack.Screen name="login" options={{ title: 'Log in', headerRight: undefined }} />
      </Stack>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
