import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuthedFetch } from '@/hooks/use-authed-fetch';
import { useTheme } from '@/hooks/use-theme';
import { NotSignedInError, OfflineError } from '@/lib/api';
import type { PlanFailure } from '@/lib/plan-generator';

/**
 * Tygodniowy jadłospis — faza 4 S-04.
 *
 * `missing` jest STANEM, nie błędem: trasa oddaje `plan: null` ze statusem 200, bo konto bez planu
 * to normalny początek, a nie awaria. `offline` też jest osobnym przypadkiem — brak sieci nie
 * oznacza braku sesji i nie wolno go zamieniać na wylogowanie.
 */

type PlanMeal = {
  slotIndex: number;
  mealSlot: string;
  dish: {
    id: number;
    name: string;
    prepMinutes: number;
    macros: { kcal: number; protein: number; carbs: number; fat: number };
    ingredients: { name: string; grams: number }[];
    steps: string[];
  };
};

type PlanDay = { dayIndex: number; totalKcal: number; meals: PlanMeal[] };

type Plan = {
  startDate: string;
  targetKcal: number;
  mealsPerDay: number;
  seed: string;
  days: PlanDay[];
  daysOutOfWindow: number[];
};

type PlanState =
  | { kind: 'loading' }
  | { kind: 'ready'; plan: Plan; currentTargetKcal: number | null }
  | { kind: 'missing' }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

const SlotLabel: Record<string, string> = {
  breakfast: 'Śniadanie',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  snack: 'Przekąska',
};

function formatKcal(value: number): string {
  return value.toLocaleString('pl-PL');
}

/**
 * Komunikat porażki składany z DANYCH, nie z gotowego zdania przysłanego przez serwer.
 *
 * Trasa oddaje `PlanFailure` jako strukturę właśnie po to: jedno źródło słów obsługuje ekran
 * i przyszłe tłumaczenie, a treść da się przetestować bez parsowania prozy. Przy `calories`
 * radzimy zmienić liczbę posiłków, a NIE „usunąć wykluczenie" — przy tym powodzie żadne
 * wykluczenie nie jest winne i rada byłaby nieprawdziwa.
 */
function failureText(failure: PlanFailure): string {
  if (failure.reason === 'exclusions') {
    return (
      `Twoje wykluczenia nie zostawiają dość dań na porę „${SlotLabel[failure.slot] ?? failure.slot}" — ` +
      `zostało ${failure.remaining}, a bez wykluczeń byłoby ${failure.withoutExclusions}. ` +
      'Usuń któreś wykluczenie.'
    );
  }
  if (failure.reason === 'prepTime') {
    return (
      `Limit ${failure.limitMinutes} minut zostawia za mało dań na porę ` +
      `„${SlotLabel[failure.slot] ?? failure.slot}" — zostało ${failure.remaining}, ` +
      `a bez limitu byłoby ${failure.withoutLimit}. Zwiększ maksymalny czas przygotowania.`
    );
  }
  if (failure.reason === 'calories') {
    return (
      `Przy ${failure.mealsPerDay} posiłkach dziennie nie da się ułożyć dnia w granicy ±10% od ` +
      `${formatKcal(failure.targetKcal)} kcal — z dostępnych dań wychodzi najwyżej ` +
      `${formatKcal(failure.achievableMaxKcal)} kcal. Zwiększ liczbę posiłków w preferencjach.`
    );
  }
  if (failure.reason === 'combination') {
    return (
      `Dania są, ale żaden ich zestaw nie trafia w granicę ±10% od ` +
      `${formatKcal(failure.targetKcal)} kcal. Poluzuj limit czasu albo wykluczenia, żeby ` +
      'wpuścić do puli inne dania.'
    );
  }
  return 'Dobieranie dań trwało za długo i zostało przerwane. Spróbuj jeszcze raz.';
}

function MealRow({ meal }: { meal: PlanMeal }) {
  const [open, setOpen] = useState(false);
  const label = `${SlotLabel[meal.mealSlot] ?? meal.mealSlot}: ${meal.dish.name}, ${formatKcal(meal.dish.macros.kcal)} kcal`;

  return (
    <ThemedView type="backgroundElement" style={styles.meal}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        // Stan idzie DWIEMA drogami: `accessibilityState` działa natywnie, `aria-expanded` na webie.
        // React Native Web nie tłumaczy `accessibilityState` — zmierzone w S-03.
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        accessibilityLabel={`${open ? 'Zwiń' : 'Rozwiń'} przepis — ${label}`}
        aria-label={`${open ? 'Zwiń' : 'Rozwiń'} przepis — ${label}`}
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
        <ThemedText type="smallBold">{SlotLabel[meal.mealSlot] ?? meal.mealSlot}</ThemedText>
        <ThemedText>{meal.dish.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatKcal(meal.dish.macros.kcal)} kcal · {meal.dish.prepMinutes} min · B{' '}
          {meal.dish.macros.protein} g · W {meal.dish.macros.carbs} g · T {meal.dish.macros.fat} g
        </ThemedText>
      </Pressable>

      {open ? (
        <ThemedView type="background" style={styles.recipe}>
          <ThemedText type="smallBold">Składniki</ThemedText>
          {meal.dish.ingredients.map((item) => (
            <ThemedText key={item.name} type="small">
              {item.name} — {item.grams} g
            </ThemedText>
          ))}

          <ThemedText type="smallBold">Przygotowanie</ThemedText>
          {meal.dish.steps.map((step, index) => (
            <ThemedText key={step} type="small">
              {index + 1}. {step}
            </ThemedText>
          ))}
        </ThemedView>
      ) : null}
    </ThemedView>
  );
}

export default function PlanScreen() {
  const authedFetch = useAuthedFetch();
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const [state, setState] = useState<PlanState>({ kind: 'loading' });
  const [failure, setFailure] = useState<PlanFailure | null>(null);
  const [generating, setGenerating] = useState(false);
  const isFocused = useIsFocused();
  const fetchedForFocus = useRef(false);
  const runId = useRef(0);

  /**
   * Odczyt przy KAŻDYM wejściu w zakładkę — plan zależy od profilu i preferencji, które
   * użytkownik zmienia na sąsiednich ekranach. O „raz na wejście" decyduje ref, a nieaktualność
   * odpowiedzi rozstrzyga LICZNIK PRZEBIEGÓW, nie flaga z cleanupu: te dwa czasy życia rozjechały
   * się już raz w `index.tsx` i zawiesiły kartę na „ładowanie" na zawsze.
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

    authedFetch('/api/plan')
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled()) {
            setState({ kind: 'error', message: `Serwer odrzucił żądanie (${response.status}).` });
          }
          return;
        }
        const body = (await response.json()) as {
          plan: Plan | null;
          currentTargetKcal: number | null;
        };
        if (cancelled()) {
          return;
        }
        setState(
          body.plan
            ? { kind: 'ready', plan: body.plan, currentTargetKcal: body.currentTargetKcal }
            : { kind: 'missing' }
        );
      })
      .catch((error: unknown) => {
        if (cancelled()) {
          return;
        }
        if (error instanceof OfflineError) {
          setState({ kind: 'offline' });
          return;
        }
        if (error instanceof NotSignedInError) {
          // Bramka grupy `(app)` odeśle na `/sign-in` sama — tu tylko nie udajemy, że mamy dane.
          setState({ kind: 'error', message: 'Sesja wygasła.' });
          return;
        }
        setState({ kind: 'error', message: 'Nie udało się pobrać planu.' });
      });
  }, [authedFetch, isFocused]);

  /**
   * Generowanie ZASTĘPUJE poprzedni plan, więc jest zablokowane, dopóki stan jest nieznany —
   * inaczej wysłalibyśmy zapis kasujący coś, czego użytkownik nie zobaczył. Przyczyna blokady
   * jest widoczna na przycisku, a nie domyślna (wzorzec `saveBlockedReason` z preferencji).
   */
  const blockedReason =
    state.kind === 'loading'
      ? 'Poczekaj, aż plan się wczyta — generowanie zastąpiłoby plan, którego jeszcze nie znamy.'
      : state.kind === 'offline'
        ? 'Brak połączenia — nie wiadomo, co jest zapisane, więc generowanie jest wstrzymane.'
        : state.kind === 'error'
          ? 'Plan nie został pobrany, więc generowanie jest wstrzymane. Odśwież ekran.'
          : null;

  async function generate() {
    setFailure(null);
    setGenerating(true);
    try {
      const response = await authedFetch('/api/plan', { method: 'POST' });

      if (response.status === 422) {
        const body = (await response.json()) as { failure: PlanFailure };
        setFailure(body.failure);
        return;
      }
      if (response.status === 409) {
        setState({
          kind: 'error',
          message: 'Uzupełnij najpierw profil i preferencje — bez nich nie ma z czego liczyć planu.',
        });
        return;
      }
      if (!response.ok) {
        setState({ kind: 'error', message: `Serwer odrzucił żądanie (${response.status}).` });
        return;
      }

      const body = (await response.json()) as {
        plan: Plan | null;
        currentTargetKcal: number | null;
      };
      setState(
        body.plan
          ? { kind: 'ready', plan: body.plan, currentTargetKcal: body.currentTargetKcal }
          : { kind: 'missing' }
      );
    } catch (error: unknown) {
      if (error instanceof OfflineError) {
        setState({ kind: 'offline' });
        return;
      }
      setState({ kind: 'error', message: 'Nie udało się wygenerować planu.' });
    } finally {
      setGenerating(false);
    }
  }

  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: { paddingTop: Spacing.six, paddingBottom: Spacing.four },
  });

  const plan = state.kind === 'ready' ? state.plan : null;
  const stale =
    state.kind === 'ready' &&
    state.currentTargetKcal !== null &&
    state.currentTargetKcal !== state.plan.targetKcal;

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">Jadłospis</ThemedText>

        {state.kind === 'loading' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Pobieram plan…
          </ThemedText>
        ) : null}

        {state.kind === 'offline' ? (
          <ThemedText type="small" themeColor="textDanger">
            Brak połączenia — plan nie został pobrany, odśwież ekran, gdy sieć wróci. Sesja jest
            zachowana.
          </ThemedText>
        ) : null}

        {state.kind === 'error' ? (
          <ThemedText type="small" themeColor="textDanger">
            {state.message}
          </ThemedText>
        ) : null}

        {state.kind === 'missing' ? (
          <ThemedText type="small">
            Nie masz jeszcze planu. Wygeneruj go na podstawie profilu i preferencji.
          </ThemedText>
        ) : null}

        {failure ? (
          <ThemedText type="small" themeColor="textDanger">
            {failureText(failure)}
          </ThemedText>
        ) : null}

        <ActionButton
          label={plan ? 'Wygeneruj ponownie' : 'Wygeneruj plan'}
          busy={generating || blockedReason !== null}
          busyLabel={generating ? 'Generuję…' : 'Generowanie wstrzymane'}
          onPress={generate}
        />

        {blockedReason ? (
          <ThemedText type="small" themeColor="textSecondary">
            {blockedReason}
          </ThemedText>
        ) : null}

        {plan ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Cel {formatKcal(plan.targetKcal)} kcal · {plan.mealsPerDay} posiłki dziennie
            </ThemedText>

            {stale ? (
              <ThemedText type="small" themeColor="textDanger">
                Twój cel zmienił się od czasu ułożenia planu. Wygeneruj plan ponownie.
              </ThemedText>
            ) : null}

            {plan.daysOutOfWindow.length > 0 ? (
              <ThemedText type="small" themeColor="textDanger">
                Przepisy zmieniły się od czasu ułożenia planu i {plan.daysOutOfWindow.length}{' '}
                {plan.daysOutOfWindow.length === 1 ? 'dzień nie mieści' : 'dni nie mieści'} się już
                w granicy ±10%. Wygeneruj plan ponownie.
              </ThemedText>
            ) : null}

            {plan.days.map((day) => (
              <ThemedView key={day.dayIndex} style={styles.day}>
                <ThemedText
                  type="smallBold"
                  accessibilityLabel={`Dzień ${day.dayIndex}, suma ${formatKcal(day.totalKcal)} kcal`}
                  aria-label={`Dzień ${day.dayIndex}, suma ${formatKcal(day.totalKcal)} kcal`}>
                  Dzień {day.dayIndex} — {formatKcal(day.totalKcal)} kcal
                </ThemedText>
                {day.meals.map((meal) => (
                  <MealRow key={`${day.dayIndex}-${meal.slotIndex}`} meal={meal} />
                ))}
              </ThemedView>
            ))}
          </>
        ) : null}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  contentContainer: { flexDirection: 'row', justifyContent: 'center' },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    // Bez `flexShrink` i `minWidth` ta kolumna jest na WEBIE obcinana z obu stron poniżej ~750 px
    // (zmierzone 14.09.2026 na ekranie preferencji). Natywnie defekt nie występuje.
    flexShrink: 1,
    minWidth: 0,
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  day: { gap: Spacing.two },
  meal: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  recipe: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  pressed: { opacity: 0.7 },
});
