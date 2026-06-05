import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';

function AuthGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const isRedirecting = useRef(false);

  useEffect(() => {
    if (loading) return;
    const inTabs = segments[0] === '(tabs)';

    if (!user && inTabs && !isRedirecting.current) {
      isRedirecting.current = true;
      const t = setTimeout(() => router.replace('/auth/login'), 0);
      return () => clearTimeout(t);
    } else if (user) {
      isRedirecting.current = false;
    }
  }, [user, loading, segments]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthGuard />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="auth/login" options={{ headerShown: false }} />
          <Stack.Screen name="auth/register" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="parking-map" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
