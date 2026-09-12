import { useClerk } from '@clerk/expo';
import { Link, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuthedFetch } from '@/hooks/use-authed-fetch';
import { NotSignedInError, OfflineError } from '@/lib/api';
import type { CalorieTarget, ProfileResponse } from '@/lib/calorie-target';

/**
 * Stan karty celu. `offline` jest osobnym przypadkiem, a nie odmianą błędu: brak sieci NIE oznacza
 * braku sesji i nie wolno go zamieniać na wylogowanie. `missing` też nie jest błędem — trasa
 * oddaje `profile: null` ze statusem 200, bo brak profilu to stan, nie awaria.
 */
type TargetState =
  | { kind: 'loading' }
  | { kind: 'ready'; target: CalorieTarget }
  | { kind: 'missing' }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

function formatKcal(value: number): string {
  return value.toLocaleString('pl-PL');
}

function TargetCard({ state }: { state: TargetState }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {state.kind === 'loading' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Sprawdzam profil…
        </ThemedText>
      ) : null}

      {state.kind === 'offline' ? (
        // Tekst mówi dokładnie to, co kod robi: żądanie idzie przy wejściu w zakładkę, więc ponowna
        // próba to wyjście i powrót. Obiecywanie „pobierzemy, gdy sieć wróci" byłoby nieprawdą.
        <ThemedText type="small" themeColor="textDanger">
          Brak połączenia — odśwież ekran, gdy sieć wróci. Sesja jest zachowana.
        </ThemedText>
      ) : null}

      {state.kind === 'error' ? (
        <ThemedText type="small" themeColor="textDanger">
          {state.message}
        </ThemedText>
      ) : null}

      {state.kind === 'missing' ? (
        <>
          <ThemedText type="small">Uzupełnij profil, żeby policzyć zapotrzebowanie.</ThemedText>
          <Link href="/profile">
            <ThemedText type="linkPrimary">Przejdź do profilu</ThemedText>
          </Link>
        </>
      ) : null}

      {state.kind === 'ready' ? (
        <>
          <ThemedText type="subtitle">{formatKcal(state.target.effectiveKcal)} kcal</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            dziennie
          </ThemedText>
          {state.target.overrideKcal !== null ? (
            <ThemedText type="small" themeColor="textSecondary">
              cel nadpisany, wyliczone {formatKcal(state.target.computedKcal)} kcal
            </ThemedText>
          ) : null}
          <Link href="/profile">
            <ThemedText type="linkPrimary">Zmień profil</ThemedText>
          </Link>
        </>
      ) : null}
    </ThemedView>
  );
}

export default function HomeScreen() {
  const { signOut } = useClerk();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const authedFetch = useAuthedFetch();
  const [target, setTarget] = useState<TargetState>({ kind: 'loading' });
  const isFocused = useIsFocused();
  const fetchedForFocus = useRef(false);
  const runId = useRef(0);

  /**
   * Karta ma być aktualna po zapisie w Profilu, więc odczyt idzie przy KAŻDYM wejściu w zakładkę.
   * Sygnałem jest boolean z `useIsFocused()`, nie `useFocusEffect`: ten drugi wykonuje callback
   * synchronicznie przy każdej zmianie jego tożsamości, a `useCallback` jest w tym repo zakazany.
   *
   * O „raz na wejście" decyduje `fetchedForFocus`, nie tablica zależności — pętla żądań jest
   * niemożliwa niezależnie od tego, co zmemoizuje React Compiler. Stan ustawiany wyłącznie
   * w callbackach obietnicy (reguła `react-hooks/set-state-in-effect`).
   *
   * Nieaktualność odpowiedzi pilnuje LICZNIK PRZEBIEGÓW, nie flaga `cancelled` z cleanupu.
   * Powód jest konkretny: `cancelled` żyje w domknięciu jednego przebiegu, a `fetchedForFocus`
   * żyje przez cały czas życia komponentu. Przy zmianie tożsamości `authedFetch` w locie te dwa
   * czasy życia się rozjeżdżały — cleanup poprzedniego przebiegu ustawiał `cancelled = true`,
   * nowy przebieg widział `fetchedForFocus.current === true` i NIE startował żądania, więc
   * odpowiedź w locie była odrzucana, a karta zostawała na „Sprawdzam profil…" **na zawsze**
   * (jedynym wyjściem było przełączenie zakładki). Licznik ma ten sam czas życia co ref:
   * unieważnia odpowiedź tylko wtedy, gdy naprawdę wystartował NOWSZY przebieg.
   */
  useEffect(() => {
    if (!isFocused) {
      fetchedForFocus.current = false;
      return;
    }
    if (fetchedForFocus.current) {
      return;
    }
    fetchedForFocus.current = true;

    const run = ++runId.current;
    const cancelled = () => run !== runId.current;

    authedFetch('/api/profile')
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled()) {
            setTarget({ kind: 'error', message: `Serwer odrzucił żądanie (${response.status}).` });
          }
          return;
        }

        const body = (await response.json()) as ProfileResponse;
        if (cancelled()) {
          return;
        }
        setTarget(body.target ? { kind: 'ready', target: body.target } : { kind: 'missing' });
      })
      .catch((error: unknown) => {
        if (cancelled()) {
          return;
        }
        if (error instanceof OfflineError) {
          setTarget({ kind: 'offline' });
          return;
        }
        if (error instanceof NotSignedInError) {
          // Bramka grupy `(app)` odeśle na `/sign-in` sama — tu tylko nie udajemy, że mamy dane.
          setTarget({ kind: 'error', message: 'Sesja wygasła.' });
          return;
        }
        setTarget({ kind: 'error', message: 'Nie udało się pobrać celu.' });
      });

  }, [authedFetch, isFocused]);

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
            MealPlan
          </ThemedText>
        </ThemedView>

        {/*
          Granica danych widoczna z ekranu: cel pochodzi z `/api/profile`, czyli z tokenu
          zweryfikowanego przez Workera — nie z klienta Clerka.
        */}
        <TargetCard state={target} />

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
  card: {
    gap: Spacing.one,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
