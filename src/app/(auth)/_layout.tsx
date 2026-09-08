import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';

/**
 * Odwrotność bramki grupy `(app)`: ekrany logowania i rejestracji nie mają sensu dla kogoś, kto ma
 * już sesję. Bez tego zalogowany użytkownik wchodząc na `/sign-in` dostaje formularz, a Clerk
 * odrzuca próbę błędem „You're already signed in" — co widać było w testach rejestracji drugiego
 * konta w tej samej przeglądarce.
 *
 * Sekwencjonowanie stanu jak w `(app)/_layout.tsx`: dopóki `isLoaded` jest `false`, oddajemy stan
 * neutralny (pełny ekran w kolorze tła), bo web renderuje HTML przed odtworzeniem sesji przez
 * Clerka i pierwszy render nie może zakładać żadnego z dwóch stanów.
 */
export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <ThemedView type="background" style={styles.neutral} />;
  }

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  neutral: {
    flex: 1,
  },
});
