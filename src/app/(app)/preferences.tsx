import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { ChoiceField } from '@/components/ui/choice-field';
import { TextField } from '@/components/ui/text-field';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuthedFetch } from '@/hooks/use-authed-fetch';
import { useTheme } from '@/hooks/use-theme';
import { NotSignedInError, OfflineError } from '@/lib/api';
import { parseNumberInput } from '@/lib/calorie-target';
import {
  exclusionKey,
  MealsPerDayOptions,
  PreferenceBounds,
  validatePreferences,
  type CatalogResponse,
  type ExclusionGroupOption,
  type ExclusionInput,
  type IngredientOption,
  type MealsPerDay,
  type PreferenceFieldErrors,
  type PreferencesResponse,
} from '@/lib/preferences';

/**
 * Ekran preferencji — czego użytkownik nie je, ile najwyżej chce gotować i na ile posiłków dzieli
 * dzień.
 *
 * Waliduje TEN SAM moduł, którego używa `src/app/api/preferences+api.ts` (`validatePreferences`),
 * więc błędy pod polami i odpowiedź serwera nie mają jak się rozjechać. Pole liczbowe żyje jako
 * TEKST aż do walidacji, a do modułu wchodzi przez `parseNumberInput` — wzorzec z `profile.tsx`.
 *
 * **Wykluczenie wskazuje identyfikator, nigdy wpisany tekst.** Stąd wyszukiwarka nad pulą
 * z `GET /api/catalog`, a nie pole tekstowe: „risotto z borowikami" nie musi wymieniać składnika
 * w nazwie, a nazwa może wymieniać składnik, którego w składzie nie ma.
 *
 * **Lista jest JEDNA, z oznaczeniem rodzaju** — nie trzy osobne sekcje. Wykluczenie grupowe
 * („grzyby") jest wpisem jak każdy inny, bo PRD wymaga jednego mechanizmu.
 */

const MealsOptions = MealsPerDayOptions.map((count) => ({
  value: count,
  label: String(count),
}));

/** Ile podpowiedzi pokazujemy naraz. Pełna pula pod polem byłaby ścianą, a nie wyszukiwarką. */
const MaxSuggestions = 8;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

type SaveNotice = { tone: 'ok' | 'danger'; text: string } | null;

/** Bez ogonków i wielkości liter — „Łosoś" ma się znaleźć po wpisaniu „losos". */
function fold(text: string): string {
  return text
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');
}

export default function PreferencesScreen() {
  const theme = useTheme();
  const authedFetch = useAuthedFetch();
  const safeAreaInsets = useSafeAreaInsets();

  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [maxPrepText, setMaxPrepText] = useState('');
  const [mealsPerDay, setMealsPerDay] = useState<MealsPerDay | null>(null);
  const [entries, setEntries] = useState<ExclusionInput[]>([]);

  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [groups, setGroups] = useState<ExclusionGroupOption[]>([]);
  const [query, setQuery] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<SaveNotice>(null);
  const [submitted, setSubmitted] = useState(false);
  const [blurredPrep, setBlurredPrep] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<PreferenceFieldErrors | null>(null);

  const requested = useRef(false);
  /**
   * Strażnik przed wyścigiem z S-02 — **osobny dla pól liczbowych i osobny dla listy wykluczeń**.
   *
   * Ekran robi jedno `GET /api/preferences` przy wejściu i wypełnia sobą to, co wróci. Na wolnym
   * łączu odpowiedź potrafi dojść PO tym, jak użytkownik zaczął wpisywać — i wtedy skasowałaby to,
   * co wpisał. W S-02 ten wyścig realnie gubił dane.
   *
   * **Dlaczego DWA refy, a nie jeden.** Jeden wspólny strażnik wyglądał na poprawny i był
   * defektem utraty danych: wpisanie czasu przygotowania blokowało zastosowanie odpowiedzi
   * W CAŁOŚCI, więc lista wykluczeń zostawała pusta — mimo że użytkownik jej nie dotknął.
   * Zapis wysyłał wtedy `exclusions: []`, a `replaceExclusions` kasuje i wstawia całą listę,
   * więc wszystkie wykluczenia znikały bez śladu, pod komunikatem „Zapisano".
   *
   * Strażnik ma chronić TO, CO UŻYTKOWNIK ZMIENIŁ, a nie wszystko, czego dotyczy ten sam ekran.
   * Kto wpisał czas, nie wyraził żadnego zdania o liście wykluczeń — jego lista ma przyjść
   * z serwera normalnie.
   *
   * Refy, nie flagi z domknięcia efektu: mają żyć tak długo, co komponent.
   */
  const touchedPreferences = useRef(false);
  const touchedExclusions = useRef(false);

  // Jedno żądanie przy wejściu — o „raz" decyduje ref, nie tożsamość `authedFetch`. Stan
  // ustawiany wyłącznie w callbackach obietnicy (`react-hooks/set-state-in-effect`).
  useEffect(() => {
    if (requested.current) {
      return;
    }
    requested.current = true;

    Promise.all([authedFetch('/api/preferences'), authedFetch('/api/catalog')])
      .then(async ([preferencesResponse, catalogResponse]) => {
        if (!preferencesResponse.ok || !catalogResponse.ok) {
          const status = preferencesResponse.ok ? catalogResponse.status : preferencesResponse.status;
          setLoad({ kind: 'error', message: `Serwer odrzucił żądanie (${status}).` });
          return;
        }

        const catalog = (await catalogResponse.json()) as CatalogResponse;
        setIngredients(catalog.ingredients);
        setGroups(catalog.groups);

        const body = (await preferencesResponse.json()) as PreferencesResponse;
        // Nie nadpisuj tego, co użytkownik zdążył zmienić — ale osobno dla pól i osobno dla listy.
        if (!touchedPreferences.current && body.preferences) {
          setMaxPrepText(String(body.preferences.maxPrepMinutes));
          setMealsPerDay(body.preferences.mealsPerDay);
        }
        if (!touchedExclusions.current) {
          setEntries(
            body.exclusions.map((entry) => ({
              kind: entry.kind,
              ingredientId: entry.ingredientId,
              dishId: entry.dishId,
              groupId: entry.groupId,
            })),
          );
        }
        setLoad({ kind: 'ready' });
      })
      .catch((error: unknown) => {
        if (error instanceof OfflineError) {
          setLoad({ kind: 'offline' });
          return;
        }
        if (error instanceof NotSignedInError) {
          // Bramka grupy `(app)` odeśle na `/sign-in` sama — tu tylko nie udajemy, że mamy dane.
          setLoad({ kind: 'error', message: 'Sesja wygasła.' });
          return;
        }
        setLoad({ kind: 'error', message: 'Nie udało się pobrać preferencji.' });
      });
  }, [authedFetch]);

  const candidate = {
    preferences: {
      maxPrepMinutes: parseNumberInput(maxPrepText),
      mealsPerDay,
    },
    exclusions: entries,
  };
  const validation = validatePreferences(candidate);

  function errorFor(field: keyof PreferenceFieldErrors): string | null {
    const fromServer = serverFieldErrors?.[field];
    if (fromServer) {
      return fromServer;
    }
    if (validation.ok) {
      return null;
    }
    if (!submitted && !(field === 'maxPrepMinutes' && blurredPrep)) {
      return null;
    }
    return validation.errors[field] ?? null;
  }

  /** Każda zmiana unieważnia werdykt serwera i komunikat o zapisie — inaczej wiszą nad nowym stanem. */
  function clearNotices() {
    setServerFieldErrors(null);
    setSaveNotice(null);
  }

  /** Zmiana POLA LICZBOWEGO: blokuje nadpisanie pól z zaległego `GET`, ale nie listy. */
  function markEdited() {
    touchedPreferences.current = true;
    clearNotices();
  }

  /** Zmiana LISTY: blokuje nadpisanie listy z zaległego `GET`, ale nie pól. */
  function markListEdited() {
    touchedExclusions.current = true;
    clearNotices();
  }

  const chosen = new Set(entries.map(exclusionKey));

  function addEntry(entry: ExclusionInput) {
    markListEdited();
    setQuery('');
    // Duplikat nie jest błędem — po prostu nie ma czego dodawać drugi raz.
    if (chosen.has(exclusionKey(entry))) {
      return;
    }
    setEntries((current) => [...current, entry]);
  }

  function removeEntry(entry: ExclusionInput) {
    markListEdited();
    const key = exclusionKey(entry);
    setEntries((current) => current.filter((item) => exclusionKey(item) !== key));
  }

  function toggleGroup(group: ExclusionGroupOption) {
    const entry: ExclusionInput = {
      kind: 'group',
      ingredientId: null,
      dishId: null,
      groupId: group.id,
    };

    if (chosen.has(exclusionKey(entry))) {
      removeEntry(entry);
      return;
    }
    addEntry(entry);
  }

  const needle = fold(query.trim());
  const suggestions =
    needle.length === 0
      ? []
      : ingredients
          .filter((item) => fold(item.name).includes(needle))
          .filter(
            (item) =>
              !chosen.has(
                exclusionKey({
                  kind: 'ingredient',
                  ingredientId: item.id,
                  dishId: null,
                  groupId: null,
                }),
              ),
          )
          .slice(0, MaxSuggestions);

  /** Nazwa wpisu na liście. Dania nie ma w puli tego ekranu — wtedy zostaje sam identyfikator. */
  function describe(entry: ExclusionInput): { label: string; kind: string } {
    if (entry.kind === 'ingredient') {
      const found = ingredients.find((item) => item.id === entry.ingredientId);
      return { label: found?.name ?? `składnik #${entry.ingredientId}`, kind: 'składnik' };
    }
    if (entry.kind === 'group') {
      const found = groups.find((item) => item.id === entry.groupId);
      return { label: found?.name ?? `grupa #${entry.groupId}`, kind: 'grupa' };
    }
    return { label: `danie #${entry.dishId}`, kind: 'danie' };
  }

  /**
   * Dlaczego zapis jest zablokowany, dopóki początkowe pobranie się nie dokona — `null` znaczy
   * „wolno zapisywać".
   *
   * To NIE jest kosmetyka. Lista wykluczeń zaczyna jako pusta i wypełnia ją dopiero odpowiedź
   * `GET`, a strażnik `touched` (słusznie) blokuje to wypełnienie, gdy użytkownik zdążył już coś
   * zmienić. Zapis w tym oknie wysyła `exclusions: []`, a `replaceExclusions` kasuje całą listę
   * i wstawia nic — użytkownik traci wszystkie wykluczenia i widzi „Zapisano".
   *
   * Stany `offline` i `error` blokują tak samo i z tego samego powodu: nie wiadomo, co jest
   * w bazie, więc nie ma czego bezpiecznie nadpisać.
   */
  const saveBlockedReason =
    load.kind === 'loading'
      ? 'Poczekaj, aż preferencje się wczytają — inaczej zapis nadpisałby listę, której jeszcze nie znamy.'
      : load.kind === 'offline'
        ? 'Brak połączenia — nie wiadomo, co jest zapisane, więc zapis jest wstrzymany.'
        : load.kind === 'error'
          ? 'Preferencje nie zostały pobrane, więc zapis jest wstrzymany. Odśwież ekran.'
          : null;

  async function handleSave() {
    // Strażnik PRZED czymkolwiek innym. Przycisk jest już zablokowany, więc w normalnej ścieżce
    // tu nie wejdziemy — to druga warstwa, bo cena pomyłki to cicha utrata danych użytkownika.
    if (saveBlockedReason) {
      setSaveNotice({ tone: 'danger', text: saveBlockedReason });
      return;
    }

    touchedPreferences.current = true;
    touchedExclusions.current = true;
    setSubmitted(true);
    setServerFieldErrors(null);
    setSaveNotice(null);

    if (!validation.ok) {
      // Żądanie nie wychodzi: błędy są już pod polami, a serwer powiedziałby dokładnie to samo.
      return;
    }

    setSaving(true);
    try {
      const response = await authedFetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.value),
      });

      if (response.status === 400) {
        const body = (await response.json()) as { error?: string; fields?: PreferenceFieldErrors };
        setServerFieldErrors(body.fields ?? null);
        setSaveNotice({ tone: 'danger', text: 'Popraw zaznaczone pola i spróbuj ponownie.' });
        return;
      }

      if (!response.ok) {
        setSaveNotice({ tone: 'danger', text: 'Nie udało się zapisać preferencji.' });
        return;
      }

      // `PUT` oddaje ten sam kontrakt co `GET`, więc ekran bierze to, co wróciło — bez scalania.
      // W szczególności lista wraca z identyfikatorami wierszy, których klient nie wymyśla.
      const body = (await response.json()) as PreferencesResponse;
      setEntries(
        body.exclusions.map((entry) => ({
          kind: entry.kind,
          ingredientId: entry.ingredientId,
          dishId: entry.dishId,
          groupId: entry.groupId,
        })),
      );
      setSaveNotice({ tone: 'ok', text: 'Zapisano' });
    } catch (error: unknown) {
      if (error instanceof OfflineError) {
        // Wartości zostają w formularzu — użytkownik nie wybiera ich drugi raz.
        setSaveNotice({ tone: 'danger', text: 'Brak połączenia — zmiany nie zostały zapisane.' });
        return;
      }
      if (error instanceof NotSignedInError) {
        setSaveNotice({ tone: 'danger', text: 'Sesja wygasła.' });
        return;
      }
      setSaveNotice({ tone: 'danger', text: 'Nie udało się zapisać preferencji.' });
    } finally {
      setSaving(false);
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
    web: {
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
    },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      /*
       * Bez tego wyszukiwarka składników jest NATYWNIE nieużywalna, choć na webie działa —
       * zmierzone na emulatorze 14.09.2026 (kryterium 2.9). Domyślne `keyboardShouldPersistTaps`
       * to `'never'`: pierwsze dotknięcie przy otwartej klawiaturze **chowa klawiaturę i nie
       * dociera do elementu**. Podpowiedzi renderują się pod polem, czyli dokładnie tam, gdzie
       * klawiatura je zasłania — użytkownik musiał więc przewinąć, dotknąć (klawiatura znika,
       * nic się nie dzieje) i dotknąć drugi raz. Na webie klawiatury nie ma, więc cały defekt
       * był niewidoczny dla harnessu.
       *
       * `'handled'`, nie `'always'`: klawiatura ma dalej znikać przy dotknięciu tła, ale nie
       * kosztem dotknięcia, które trafia w podpowiedź.
       */
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">Preferencje</ThemedText>

        {load.kind === 'loading' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Pobieram preferencje…
          </ThemedText>
        ) : null}

        {load.kind === 'offline' ? (
          <ThemedText type="small" themeColor="textDanger">
            Brak połączenia — preferencje nie zostały pobrane, odśwież ekran, gdy sieć wróci. Sesja
            jest zachowana.
          </ThemedText>
        ) : null}

        {load.kind === 'error' ? (
          <ThemedText type="small" themeColor="textDanger">
            {load.message}
          </ThemedText>
        ) : null}

        <TextField
          label="Maksymalny czas przygotowania (min)"
          value={maxPrepText}
          onChangeText={(text) => {
            markEdited();
            setMaxPrepText(text);
          }}
          onBlur={() => setBlurredPrep(true)}
          error={errorFor('maxPrepMinutes')}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="30"
        />

        <ChoiceField
          label="Posiłków dziennie"
          value={mealsPerDay}
          options={MealsOptions}
          onChange={(value) => {
            markEdited();
            setMealsPerDay(value);
          }}
          error={errorFor('mealsPerDay')}
        />

        <ThemedText type="smallBold">Czego nie jesz</ThemedText>

        {/*
          Grupy są przełącznikami, nie wyborem jednej opcji — stąd `checkbox`, a nie `ChoiceField`.
          Jedno kliknięcie w „grzyby" wyklucza KAŻDY składnik grupy, także dopisany do niej później.
        */}
        <ThemedView style={styles.groupRow} accessibilityRole="none">
          {groups.map((group) => {
            const entry: ExclusionInput = {
              kind: 'group',
              ingredientId: null,
              dishId: null,
              groupId: group.id,
            };
            const checked = chosen.has(exclusionKey(entry));

            return (
              <Pressable
                key={group.slug}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                // Jak w `ChoiceField`: `aria-checked` trzeba podać wprost, inaczej chip nie
                // ogłasza stanu i zostaje sam kolor tła.
                aria-checked={checked}
                accessibilityLabel={group.name}
                aria-label={group.name}
                onPress={() => toggleGroup(group)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView
                  type={checked ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedText type={checked ? 'smallBold' : 'small'}>{group.name}</ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
        </ThemedView>

        <TextField
          label="Szukaj składnika"
          value={query}
          onChangeText={setQuery}
          placeholder="borowiki"
          autoCorrect={false}
          error={errorFor('exclusions')}
        />

        {suggestions.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`Wyklucz ${item.name}`}
            aria-label={`Wyklucz ${item.name}`}
            onPress={() =>
              addEntry({
                kind: 'ingredient',
                ingredientId: item.id,
                dishId: null,
                groupId: null,
              })
            }
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.suggestion}>
              <ThemedText type="small">{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.category}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}

        {needle.length > 0 && suggestions.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Nic takiego nie ma w puli składników.
          </ThemedText>
        ) : null}

        {/* JEDNA lista, wszystkie trzy rodzaje wpisu — nie trzy osobne sekcje. */}
        {entries.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Nic nie jest wykluczone.
          </ThemedText>
        ) : (
          entries.map((entry) => {
            const described = describe(entry);

            return (
              <ThemedView key={exclusionKey(entry)} type="backgroundElement" style={styles.row}>
                <ThemedText type="small" style={styles.rowLabel}>
                  {described.label}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {described.kind}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Usuń ${described.label}`}
                  aria-label={`Usuń ${described.label}`}
                  onPress={() => removeEntry(entry)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedText type="linkPrimary">Usuń</ThemedText>
                </Pressable>
              </ThemedView>
            );
          })
        )}

        <ThemedText type="small" themeColor="textSecondary">
          Limit czasu dotyczy pojedynczego posiłku i mieści się w przedziale{' '}
          {PreferenceBounds.maxPrepMinutes.min}–{PreferenceBounds.maxPrepMinutes.max} minut.
        </ThemedText>

        {/*
          Przycisk jest WIDOCZNIE zablokowany, dopóki nie wiadomo, co jest w bazie. Sam cichy
          `return` w `handleSave` zamieniłby utratę danych na przycisk, który nic nie robi.
        */}
        <ActionButton
          label="Zapisz"
          busy={saving || saveBlockedReason !== null}
          busyLabel={saving ? 'Zapisuję…' : 'Zapis wstrzymany'}
          onPress={handleSave}
        />

        {saveNotice ? (
          <ThemedText
            type="small"
            themeColor={saveNotice.tone === 'ok' ? 'textSecondary' : 'textDanger'}>
            {saveNotice.text}
          </ThemedText>
        ) : null}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
  /*
   * `flexShrink` i `minWidth` NIE są ozdobą: bez nich ta kolumna jest na WEBIE obcinana
   * z obu stron poniżej ~750 px. `contentContainer` jest wierszem z `justifyContent: 'center'`,
   * a dziecko z samym `flexGrow: 1` ma na webie domyślne `min-width: auto`, czyli nie zejdzie
   * poniżej szerokości swojej treści — wyśrodkowana kolumna 743 px w oknie 400 px traci po
   * ~170 px z każdej strony (zmierzone 14.09.2026 przy 20 wykluczeniach). Natywnie defekt nie
   * występuje, a harness jeździ na `Desktop Chrome` 1280 px, więc nikt go nie widział.
   */
    flexShrink: 1,
    minWidth: 0,
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  suggestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  rowLabel: {
    flexGrow: 1,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
