import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { StyleSheet } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { ThemedView } from '@/components/themed-view';

/**
 * Jedyne miejsce decydujące, czy widok produktowy w ogóle się montuje. Na webie `output: "server"`
 * renderuje HTML bez sesji — Clerk odtwarza ją dopiero po hydracji — więc pierwszy render nie może
 * zakładać ani „zalogowany", ani „niezalogowany". Dopóki `isLoaded` jest `false`, oddajemy stan
 * neutralny: pełny ekran w kolorze tła, bez przekierowania, zakładek i wskaźnika ładowania.
 * Bez tego przy każdym wejściu mignąłby ekran logowania.
 */
export default function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <ThemedView type="background" style={styles.neutral} />;
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  return <AppTabs />;
}

const styles = StyleSheet.create({
  neutral: {
    flex: 1,
  },
});
