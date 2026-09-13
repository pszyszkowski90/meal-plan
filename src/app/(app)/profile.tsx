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
import {
  ActivityLabel,
  ActivityLevels,
  computeCalorieTarget,
  parseNumberInput,
  ProfileBounds,
  validateProfile,
  type ActivityLevel,
  type ProfileFieldErrors,
  type ProfileInput,
  type ProfileResponse,
  type Sex,
} from '@/lib/calorie-target';

/**
 * Ekran profilu — wejścia wzoru, podgląd wyliczenia na żywo i nadpisanie celu.
 *
 * Liczy TEN SAM moduł, którego używa `src/app/api/profile+api.ts` (`validateProfile`,
 * `computeCalorieTarget`), więc podgląd przed zapisem i odpowiedź serwera nie mają jak się
 * rozjechać. Pola liczbowe żyją jako TEKST aż do walidacji — inaczej nie da się wpisać „70,”
 * ani „70,5” — a do modułu wchodzą dopiero przez `parseNumberInput`, bo `validateProfile`
 * przyjmuje wyłącznie skończone liczby.
 */

const SexOptions: readonly { value: Sex; label: string }[] = [
  { value: 'female', label: 'Kobieta' },
  { value: 'male', label: 'Mężczyzna' },
];

const ActivityOptions = ActivityLevels.map((level) => ({
  value: level,
  label: `Poziom ${level}`,
  hint: ActivityLabel[level],
}));

/**
 * Stan pierwszego `GET /api/profile`. `offline` jest osobnym przypadkiem, nie odmianą błędu:
 * brak sieci NIE oznacza braku sesji i nie wolno go zamieniać na wylogowanie.
 */
type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

/** Wynik ostatniej próby zapisu — pokazywany pod przyciskiem. */
type SaveNotice = { tone: 'ok' | 'danger'; text: string } | null;

function formatKcal(value: number): string {
  return value.toLocaleString('pl-PL');
}

export default function ProfileScreen() {
  const theme = useTheme();
  const authedFetch = useAuthedFetch();
  const safeAreaInsets = useSafeAreaInsets();

  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [ageText, setAgeText] = useState('');
  const [weightText, setWeightText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [overrideText, setOverrideText] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<SaveNotice>(null);
  // Błędy pod polami nie mogą wyskakiwać przy pierwszej wpisanej cyfrze: pokazujemy je po próbie
  // zapisu (`submitted`) albo po opuszczeniu konkretnego pola (`blurred`).
  const [submitted, setSubmitted] = useState(false);
  const [blurred, setBlurred] = useState<Partial<Record<keyof ProfileInput, boolean>>>({});
  // Odpowiedź 400 `invalid` z trasy. Klient waliduje tym samym modułem, więc w praktyce tu nie
  // trafia — poza rozjazdem wersji klienta i Workera, którego nie wolno zamieść pod dywan.
  const [serverFieldErrors, setServerFieldErrors] = useState<ProfileFieldErrors | null>(null);

  const requested = useRef(false);
  /**
   * Czy użytkownik zdążył już dotknąć formularza (albo zapisać).
   *
   * Chroni przed wyścigiem, który realnie gubił dane: ekran robi jedno `GET /api/profile` przy
   * wejściu i wypełnia pola tym, co wróci. Na wolnym łączu odpowiedź potrafi dojść PO tym, jak
   * użytkownik zaczął pisać — i wtedy kasowała wpisane znaki. Ten sam strażnik zamyka drugi
   * przebieg: `PUT` wraca przed zaległym `GET`, po czym stary profil nadpisywał świeżo zapisane
   * wartości, a ekran pokazywał nieaktualne liczby pod komunikatem „Zapisano".
   *
   * Celowo NIE jest to flaga `cancelled` z cleanupu efektu: `requested` żyje przez cały czas życia
   * komponentu, więc flaga z domknięcia jednego przebiegu rozjechałaby się z nim tak samo, jak to
   * się stało na Home (patrz komentarz w `index.tsx`).
   */
  const touched = useRef(false);

  // Jedno żądanie przy wejściu — wzorzec z `index.tsx`: o „raz" decyduje ref, nie tożsamość
  // `authedFetch`. Stan ustawiany wyłącznie w callbackach obietnicy (`react-hooks/set-state-in-effect`).
  useEffect(() => {
    if (requested.current) {
      return;
    }
    requested.current = true;

    authedFetch('/api/profile')
      .then(async (response) => {
        if (!response.ok) {
          setLoad({ kind: 'error', message: `Serwer odrzucił żądanie (${response.status}).` });
          return;
        }

        const body = (await response.json()) as ProfileResponse;
        // Nie nadpisuj tego, co użytkownik zdążył wpisać albo zapisać.
        if (body.profile && !touched.current) {
          applyProfile(body.profile);
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
        setLoad({ kind: 'error', message: 'Nie udało się pobrać profilu.' });
      });
  }, [authedFetch]);

  /**
   * Wiersz D1 → pola formularza. Liczby wchodzą jako `String(...)`, nie `toLocaleString`:
   * separator tysięcy („2 200”) nie przeszedłby z powrotem przez `parseNumberInput`.
   */
  function applyProfile(profile: ProfileInput) {
    setAgeText(String(profile.age));
    setWeightText(String(profile.weightKg));
    setHeightText(String(profile.heightCm));
    setSex(profile.sex);
    setActivityLevel(profile.activityLevel);
    setOverrideText(profile.targetKcalOverride === null ? '' : String(profile.targetKcalOverride));
  }

  // Kandydat budowany przy każdym renderze: pola tekstowe przez `parseNumberInput`, wybory jako
  // `null` dopóki nic nie wybrano. `validateProfile` nigdy nie dostaje surowych stringów.
  const candidate = {
    age: parseNumberInput(ageText),
    weightKg: parseNumberInput(weightText),
    heightCm: parseNumberInput(heightText),
    sex,
    activityLevel,
    targetKcalOverride: parseNumberInput(overrideText),
  };
  const validation = validateProfile(candidate);
  const target = validation.ok ? computeCalorieTarget(validation.value) : null;

  function errorFor(field: keyof ProfileInput): string | null {
    const fromServer = serverFieldErrors?.[field];
    if (fromServer) {
      return fromServer;
    }
    if (validation.ok) {
      return null;
    }
    if (!submitted && !blurred[field]) {
      return null;
    }
    return validation.errors[field] ?? null;
  }

  function markBlurred(field: keyof ProfileInput) {
    setBlurred((current) => ({ ...current, [field]: true }));
  }

  /** Każda zmiana unieważnia werdykt serwera i komunikat o zapisie — inaczej wiszą nad nowym stanem. */
  function clearNotices() {
    setServerFieldErrors(null);
    setSaveNotice(null);
  }

  /** Każda zmiana pola przez użytkownika: czyści komunikaty i blokuje nadpisanie z zaległego `GET`. */
  function markEdited() {
    touched.current = true;
    clearNotices();
  }

  async function handleSave() {
    touched.current = true;
    setSubmitted(true);
    setServerFieldErrors(null);
    setSaveNotice(null);

    if (!validation.ok) {
      // Żądanie nie wychodzi: błędy są już pod polami, a serwer powiedziałby dokładnie to samo.
      return;
    }

    setSaving(true);
    try {
      const response = await authedFetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.value),
      });

      if (response.status === 400) {
        const body = (await response.json()) as { error?: string; fields?: ProfileFieldErrors };
        setServerFieldErrors(body.fields ?? null);
        setSaveNotice({ tone: 'danger', text: 'Popraw zaznaczone pola i spróbuj ponownie.' });
        return;
      }

      if (!response.ok) {
        setSaveNotice({ tone: 'danger', text: 'Nie udało się zapisać profilu.' });
        return;
      }

      // `PUT` oddaje ten sam kontrakt co `GET`, więc ekran bierze to, co wróciło — bez scalania.
      const body = (await response.json()) as ProfileResponse;
      if (body.profile) {
        applyProfile(body.profile);
      }
      setLoad({ kind: 'ready' });
      setSaveNotice({ tone: 'ok', text: 'Zapisano' });
    } catch (error: unknown) {
      if (error instanceof OfflineError) {
        // Wartości zostają w formularzu — użytkownik nie przepisuje ich drugi raz.
        setSaveNotice({ tone: 'danger', text: 'Brak połączenia — zmiany nie zostały zapisane.' });
        return;
      }
      if (error instanceof NotSignedInError) {
        setSaveNotice({ tone: 'danger', text: 'Sesja wygasła.' });
        return;
      }
      setSaveNotice({ tone: 'danger', text: 'Nie udało się zapisać profilu.' });
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

  const overrideKcal = target?.overrideKcal ?? null;

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">Profil</ThemedText>

        {load.kind === 'loading' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Pobieram profil…
          </ThemedText>
        ) : null}

        {load.kind === 'offline' ? (
          <ThemedText type="small" themeColor="textDanger">
            Brak połączenia — profil nie został pobrany, odśwież ekran, gdy sieć wróci. Sesja jest
            zachowana.
          </ThemedText>
        ) : null}

        {load.kind === 'error' ? (
          <ThemedText type="small" themeColor="textDanger">
            {load.message}
          </ThemedText>
        ) : null}

        <TextField
          label="Wiek (lata)"
          value={ageText}
          onChangeText={(text) => {
            markEdited();
            setAgeText(text);
          }}
          onBlur={() => markBlurred('age')}
          error={errorFor('age')}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="30"
        />

        <TextField
          label="Waga (kg)"
          value={weightText}
          onChangeText={(text) => {
            markEdited();
            setWeightText(text);
          }}
          onBlur={() => markBlurred('weightKg')}
          error={errorFor('weightKg')}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="70,5"
        />

        <TextField
          label="Wzrost (cm)"
          value={heightText}
          onChangeText={(text) => {
            markEdited();
            setHeightText(text);
          }}
          onBlur={() => markBlurred('heightCm')}
          error={errorFor('heightCm')}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="180"
        />

        <ChoiceField
          label="Płeć (do wyliczenia)"
          value={sex}
          options={SexOptions}
          onChange={(value) => {
            markEdited();
            setSex(value);
          }}
          error={errorFor('sex')}
        />

        <ChoiceField
          label="Poziom aktywności"
          value={activityLevel}
          options={ActivityOptions}
          onChange={(value) => {
            markEdited();
            setActivityLevel(value);
          }}
          error={errorFor('activityLevel')}
        />

        <ThemedView type="backgroundElement" style={styles.card}>
          {target ? (
            <>
              <ThemedText type="small">
                Podstawowa przemiana materii: {formatKcal(target.bmrKcal)} kcal (Mifflin-St Jeor)
              </ThemedText>
              <ThemedText type="small">
                × {target.multiplier.toLocaleString('pl-PL')} za aktywność{' '}
                {ActivityLabel[target.activityLevel]} (poziom {target.activityLevel})
              </ThemedText>
              <ThemedText type="smallBold">
                = {formatKcal(target.computedKcal)} kcal dziennie
              </ThemedText>
              {/*
                Gdy wzór wyszedł poza bezpieczny przedział, cel obowiązujący jest przycięty.
                Ekran MUSI to powiedzieć: inaczej wyjaśnienie („= 317 kcal") kłóciłoby się po cichu
                z liczbą, którą produkt faktycznie przyjmuje i od której liczy ograniczenie ±10%.
              */}
              {target.clampedTo ? (
                <ThemedText type="small" themeColor="textDanger">
                  {target.clampedTo === 'min'
                    ? `To mniej niż bezpieczne minimum ${formatKcal(ProfileBounds.targetKcal.min)} kcal — ` +
                      `przyjmujemy ${formatKcal(target.effectiveKcal)} kcal dziennie.`
                    : `To więcej niż przyjmowane maksimum ${formatKcal(ProfileBounds.targetKcal.max)} kcal — ` +
                      `przyjmujemy ${formatKcal(target.effectiveKcal)} kcal dziennie.`}
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Tyle utrzymuje obecną wagę. Jeśli chcesz inny cel, wpisz go poniżej.
                </ThemedText>
              )}
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Uzupełnij pola, żeby policzyć zapotrzebowanie.
            </ThemedText>
          )}
        </ThemedView>

        <TextField
          label="Własny cel (kcal), opcjonalnie"
          value={overrideText}
          onChangeText={(text) => {
            markEdited();
            setOverrideText(text);
          }}
          onBlur={() => markBlurred('targetKcalOverride')}
          error={errorFor('targetKcalOverride')}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="2200"
        />

        {target && overrideKcal !== null ? (
          <ThemedView style={styles.overrideRow}>
            <ThemedText type="small">
              Twój cel: {formatKcal(overrideKcal)} kcal (wyliczone{' '}
              {formatKcal(target.computedKcal)})
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                markEdited();
                setOverrideText('');
              }}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="linkPrimary">Wróć do wyliczenia</ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        <ActionButton label="Zapisz" busy={saving} busyLabel="Zapisuję…" onPress={handleSave} />

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
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  card: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  overrideRow: {
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
