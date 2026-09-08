import { isClerkAPIResponseError } from '@clerk/expo';
import { useSSO } from '@clerk/expo/experimental';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { Spacing } from '@/constants/theme';

/**
 * Logowanie i rejestracja przez Google idą tym samym przepływem — Clerk sam rozpoznaje, czy konto
 * o tym adresie już istnieje — więc oba ekrany używają tego komponentu i różnią się tylko etykietą.
 *
 * `startSSOFlow` pochodzi z `@clerk/expo/experimental`, bo tylko ta wersja hooka stoi na zasobach
 * Core 3 (tych samych, których używa `signIn.password`). Wariant z `@clerk/expo` woła w środku
 * `@clerk/react/legacy` i wprowadziłby do aplikacji drugi, niezgodny model sesji.
 *
 * Hook domyka sesję sam (`finalize()` w środku), a gdy `isSignedIn` przejdzie na `true`, bramka
 * grupy `(auth)` odsyła na `/` — tutaj nie zostaje żadna nawigacja. Zamknięcie okna przez
 * użytkownika to nie błąd: sesja nie powstaje i po prostu zostajemy na formularzu.
 */
export function GoogleSignInButton({ label }: { label: string }) {
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);

    try {
      await startSSOFlow({ strategy: 'oauth_google' });
    } catch (cause) {
      // Błędy API Clerka mają `longMessage` pisane dla użytkownika; wszystko inne (brak zależności,
      // brak URL przekierowania, wyjątek sieci) to komunikaty techniczne — nie pokazujemy ich.
      const apiMessage = isClerkAPIResponseError(cause)
        ? (cause.errors[0]?.longMessage ?? cause.errors[0]?.message)
        : undefined;
      setError(apiMessage ?? 'Logowanie przez Google nie powiodło się. Spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ActionButton
        label={label}
        busyLabel="Otwieram Google…"
        busy={busy}
        onPress={start}
        type="backgroundElement"
      />

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
});
