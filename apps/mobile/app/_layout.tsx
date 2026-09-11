import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// Root layout (TAPS-6.1) — Expo Router's entry point (package.json's `main`
// is now `expo-router/entry`, not the old App.tsx/index.ts registration).
// A plain Stack for now: index.tsx (exam board list) is the initial route,
// exam-boards/[id].tsx pushes on top of it. TAPS-6.2's login screen and any
// tab/drawer navigation for the authenticated area come later — kept out of
// this layout so this story stays scoped to public content browsing.
export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Exam Boards' }} />
        <Stack.Screen name="exam-boards/[id]" options={{ title: '' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
