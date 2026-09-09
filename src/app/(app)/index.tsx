import { useClerk } from '@clerk/expo';
import * as Device from 'expo-device';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NotSignedInError, OfflineError, useAuthedFetch } from '@/lib/api';

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

/**
 * Stan granicy danych na tym ekranie. `offline` jest osobnym przypadkiem, a nie odmianą błędu:
 * brak sieci NIE oznacza braku sesji i nie wolno go zamieniać na wylogowanie.
 */
type AccountState =
  | { kind: 'loading' }
  | { kind: 'ready'; userId: string }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

function AccountRow({ state }: { state: AccountState }) {
  if (state.kind === 'loading') {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Pobieram konto…
      </ThemedText>
    );
  }

  if (state.kind === 'ready') {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        userId: <ThemedText type="code">{state.userId}</ThemedText>
      </ThemedText>
    );
  }

  if (state.kind === 'offline') {
    return (
      <ThemedText type="small" themeColor="textDanger">
        Brak połączenia — konto pobierzemy, gdy sieć wróci. Sesja jest zachowana.
      </ThemedText>
    );
  }

  return (
    <ThemedText type="small" themeColor="textDanger">
      {state.message}
    </ThemedText>
  );
}

export default function HomeScreen() {
  const { signOut } = useClerk();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const authedFetch = useAuthedFetch();
  const [account, setAccount] = useState<AccountState>({ kind: 'loading' });
  const requested = useRef(false);

  // Jedno żądanie przy wejściu — dowód, że transport tokenu i granica danych działają end-to-end.
  // Ref, nie tablica zależności, decyduje o „raz": tożsamość `authedFetch` nie jest kontraktem.
  useEffect(() => {
    if (requested.current) {
      return;
    }
    requested.current = true;

    authedFetch('/api/account')
      .then(async (response) => {
        if (!response.ok) {
          setAccount({ kind: 'error', message: `Serwer odrzucił żądanie (${response.status}).` });
          return;
        }

        const body = (await response.json()) as { userId?: string };
        setAccount(
          body.userId
            ? { kind: 'ready', userId: body.userId }
            : { kind: 'error', message: 'Odpowiedź bez `userId`.' }
        );
      })
      .catch((error: unknown) => {
        if (error instanceof OfflineError) {
          setAccount({ kind: 'offline' });
          return;
        }
        if (error instanceof NotSignedInError) {
          // Bramka grupy `(app)` odeśle na `/sign-in` sama — tu tylko nie udajemy, że mamy dane.
          setAccount({ kind: 'error', message: 'Sesja wygasła.' });
          return;
        }
        setAccount({ kind: 'error', message: 'Nie udało się pobrać konta.' });
      });
  }, [authedFetch]);

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await signOut();
    } catch {
      setSignOutError('Nie udało się wylogować. Sprawdź połączenie i spróbuj ponownie.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Welcome to&nbsp;Expo
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          get started
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title="Try editing"
            hint={<ThemedText type="code">src/app/(app)/index.tsx</ThemedText>}
          />
          <HintRow title="Dev tools" hint={getDevMenuHint()} />
        </ThemedView>

        {/*
          Granica danych widoczna z ekranu: `userId` pochodzi z `/api/account`, czyli z tokenu
          zweryfikowanego przez Workera — nie z klienta Clerka. To odciąg dla kryterium 3.13.
        */}
        <AccountRow state={account} />

        {/*
          Wylogowanie nie potrzebuje przekierowania: layout grupy `(app)` przestaje widzieć sesję
          i sam odsyła na `/sign-in`.
        */}
        <ActionButton label="Wyloguj się" onPress={handleSignOut} type="backgroundElement" />

        {signOutError ? (
          <ThemedText type="small" themeColor="textDanger">
            {signOutError}
          </ThemedText>
        ) : null}

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
