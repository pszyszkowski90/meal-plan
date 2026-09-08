import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

/**
 * `publishableKey` musi być przekazany jawnie: zmienne środowiskowe wewnątrz `node_modules` nie
 * są wstawiane do produkcyjnych buildów React Native, więc Clerk nie odczyta jej sam. Wartość
 * wchodzi do bundla przy `expo export`, nie w runtime — dlatego jest zmienną buildu w Workers
 * Builds, a nie sekretem Workera.
 */
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </ClerkProvider>
  );
}
