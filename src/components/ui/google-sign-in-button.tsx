import { useSSO } from '@clerk/expo/experimental';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/**
 * Logowanie i rejestracja przez Google idą tym samym przepływem — Clerk sam rozpoznaje, czy konto
 * o tym adresie już istnieje — więc oba ekrany używają tego komponentu i różnią się tylko etykietą.
 *
 * `startSSOFlow` pochodzi z `@clerk/expo/experimental`, bo tylko ta wersja hooka stoi na zasobach
 * Core 3 (tych samych, których używa `signIn.password`). Wariant z `@clerk/expo` woła w środku
 * `@clerk/react/legacy` i wprowadziłby do aplikacji drugi, niezgodny model sesji.
 *
 * Hook domyka sesję sam (`finalize()` w środku), więc tutaj zostaje wyłącznie nawigacja. Zamknięcie
 * okna przez użytkownika to nie błąd: `authSessionResult.type` jest wtedy inny niż `success`
 * i po prostu wracamy na formularz.
 */
export function GoogleSignInButton({ label }: { label: string }) {
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);

    try {
      const { authSessionResult } = await startSSOFlow({ strategy: 'oauth_google' });

      if (authSessionResult?.type !== 'success') {
        return;
      }

      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Logowanie przez Google nie powiodło się.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Pressable
        disabled={busy}
        onPress={start}
        style={({ pressed }) => [styles.action, (pressed || busy) && styles.actionMuted]}>
        <ThemedView type="backgroundElement" style={styles.actionSurface}>
          <ThemedText type="small">{busy ? 'Otwieram Google…' : label}</ThemedText>
        </ThemedView>
      </Pressable>

      {error ? (
        <ThemedText type="small" themeColor="textDanger">
          {error}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    gap: Spacing.one,
  },
  action: {
    alignSelf: 'stretch',
  },
  actionMuted: {
    opacity: 0.7,
  },
  actionSurface: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
