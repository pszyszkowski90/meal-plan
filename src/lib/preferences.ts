/**
 * JEDYNE miejsce w repo, które wie, czym są preferencje żywieniowe i co znaczy poprawne
 * wykluczenie. Używają go dwie strony granicy danych:
 * - ekran preferencji (faza 2 S-03) — błędy pod polami i podgląd listy,
 * - trasa `src/app/api/preferences+api.ts` — walidacja ciała `PUT`.
 *
 * Ten sam układ co `calorie-target.ts` i z tego samego powodu: ekran i trasa nie mają jak
 * rozjechać się w interpretacji, bo pytają ten sam moduł.
 *
 * **Tu, a nie w DDL, żyją ZAKRESY liczbowe** (`PreferenceBounds.maxPrepMinutes`). Migracja `0005`
 * ma wyłącznie niezmienniki wyliczeniowe i strukturalne — powód wyłożony w jej nagłówku
 * i w `0002:24-34`: SQLite nie ma `ALTER TABLE … DROP CONSTRAINT`, a kopia granicy w bazie
 * rozjeżdża się przy pierwszej korekcie i wychodzi użytkownikowi jako 500 zamiast błędu pod polem.
 *
 * Moduł celowo nie importuje NICZEGO: wchodzi do bundla klienta i do `dist/server`, a test
 * uruchamia go natywny runner Node ze zdejmowaniem typów (strip-only) — stąd brak `enum`,
 * `namespace` i parameter properties, których Node nie zdejmie, a `tsc` tego nie zgłosi.
 */

/** Rodzaj wpisu na JEDNEJ liście wykluczeń. `kind` rozstrzyga, który identyfikator jest wypełniony. */
export type ExclusionKind = 'ingredient' | 'dish' | 'group';

export const ExclusionKinds: readonly ExclusionKind[] = ['ingredient', 'dish', 'group'];

/**
 * Skąd wpis się wziął: z ekranu preferencji (FR-004) czy z oznaczenia dania w planie (FR-011).
 *
 * Służy WYŁĄCZNIE prezentacji i **nigdy** nie wpływa na dobór dań — inaczej z jednego mechanizmu
 * wymaganego przez PRD zrobiłyby się dwa (`options.md` §4). Odsiew tej kolumny nie czyta.
 */
export type ExclusionSource = 'preferences' | 'plan';

/** Liczba posiłków dziennie. Enumeracja, nie zakres — dlatego jako jedyna ma odbicie w `CHECK`. */
export type MealsPerDay = 3 | 4 | 5 | 6;

export const MealsPerDayOptions: readonly MealsPerDay[] = [3, 4, 5, 6];

/**
 * Granice włącznie.
 *
 * `maxPrepMinutes` 5–240: poniżej 5 minut nie ma czego ugotować, powyżej 240 limit przestaje
 * cokolwiek wiązać. Górna granica jest ŚWIADOMIE wyższa niż planowane 5–120 dla pojedynczego
 * dania (F-01 faza 2): preferencja jest sufitem dnia, nie dania, a sufit, który nigdy nie zwiąże,
 * jest nieszkodliwy — w odróżnieniu od sufitu, który odcina użytkownikowi połowę puli.
 */
export const PreferenceBounds = {
  maxPrepMinutes: { min: 5, max: 240 },
} as const;

/** Ustawienia liczbowe — jeden wiersz na konto. */
export interface PreferencesInput {
  maxPrepMinutes: number;
  mealsPerDay: MealsPerDay;
}

/**
 * Jeden wpis listy wykluczeń.
 *
 * DOKŁADNIE JEDEN z trzech identyfikatorów jest wypełniony, zgodnie z `kind`. Ten sam niezmiennik
 * pilnuje `CHECK` spójności w migracji `0005` — celowo w dwóch miejscach, bo to niezmiennik
 * STRUKTURALNY (nie zakres): baza jest jedynym miejscem, które może zagwarantować, że wiersz nie
 * wszedł inną drogą, a moduł jedynym, które zamieni to na błąd 400 zamiast 500.
 */
export interface ExclusionInput {
  kind: ExclusionKind;
  ingredientId: number | null;
  dishId: number | null;
  groupId: number | null;
}

/** Wpis odesłany klientowi — wejście plus to, czego klient nie wymyśla. */
export interface Exclusion extends ExclusionInput {
  id: number;
  source: ExclusionSource;
  createdAt: string;
}

/**
 * Składnik na liście wyboru. Kontrakt `GET /api/catalog`.
 *
 * Ekran POTRZEBUJE tej listy, bo wykluczenie wskazuje `ingredient_id`, nigdy tekst — użytkownik
 * musi wybrać z puli, a nie wpisać nazwę. Makra nie wchodzą: ekran preferencji ich nie pokazuje,
 * a każde pole wysłane „na zapas" jest polem, które trzeba potem utrzymywać.
 */
export interface IngredientOption {
  id: number;
  name: string;
  category: string;
}

/** Grupa wykluczeniowa na liście wyboru — słownik współdzielony, ten sam dla wszystkich kont. */
export interface ExclusionGroupOption {
  id: number;
  slug: string;
  name: string;
}

/** Kontrakt przewodowy `GET /api/catalog` — to, z czego ekran preferencji pozwala wybierać. */
export interface CatalogResponse {
  ingredients: IngredientOption[];
  groups: ExclusionGroupOption[];
}

/** Kontrakt przewodowy `GET` i `PUT /api/preferences` — jeden kształt, klient niczego nie scala. */
export interface PreferencesResponse {
  preferences: (PreferencesInput & { updatedAt: string }) | null;
  exclusions: Exclusion[];
}

/** Ciało `PUT`: ustawienia plus PEŁNA lista wykluczeń, którą ekran ma po zapisie widzieć. */
export interface PreferencesPayload {
  preferences: PreferencesInput;
  exclusions: ExclusionInput[];
}

export type PreferenceFieldErrors = Partial<
  Record<'maxPrepMinutes' | 'mealsPerDay' | 'exclusions', string>
>;

export type PreferencesValidation =
  | { ok: true; value: PreferencesPayload }
  | { ok: false; errors: PreferenceFieldErrors };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isMealsPerDay(value: unknown): value is MealsPerDay {
  return value === 3 || value === 4 || value === 5 || value === 6;
}

function isExclusionKind(value: unknown): value is ExclusionKind {
  return value === 'ingredient' || value === 'dish' || value === 'group';
}

/** Identyfikator wiersza w D1: dodatnia liczba całkowita albo nic. */
function isRowId(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value > 0;
}

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

/**
 * Klucz tożsamości wpisu — para (rodzaj, wskazany byt).
 *
 * Ten sam wykluczony składnik wskazany dwa razy to JEDEN wpis, nie dwa; identycznie widzi to
 * unikalny indeks `idx_exclusion_unique` w `0005`. Duplikaty odsiewamy już tutaj, żeby ekran
 * nie musiał czekać na `INSERT OR IGNORE`, żeby się o tym dowiedzieć.
 */
export function exclusionKey(entry: ExclusionInput): string {
  return `${entry.kind}:${entry.ingredientId ?? 0}:${entry.dishId ?? 0}:${entry.groupId ?? 0}`;
}

/**
 * Normalizuje jeden wpis: zostawia identyfikator pasujący do `kind`, pozostałe zeruje.
 *
 * Zwraca `null`, gdy wpis jest niespójny — `kind` bez swojego identyfikatora albo z cudzym.
 * Wywołujący zamienia to na jeden komunikat pod listą, a nie na 500 z bazy.
 */
function normalizeExclusion(input: unknown): ExclusionInput | null {
  const source = asRecord(input);
  const { kind, ingredientId, dishId, groupId } = source;

  if (!isExclusionKind(kind)) {
    return null;
  }

  // Pola nieużywane muszą być PUSTE, a nie „jakiekolwiek" — wpis z `kind='ingredient'`
  // i wypełnionym `dish_id` odbiłby się od `CHECK` spójności jako 500, gdyby przeszedł dalej.
  if (kind === 'ingredient') {
    return isRowId(ingredientId) && dishId == null && groupId == null
      ? { kind, ingredientId, dishId: null, groupId: null }
      : null;
  }

  if (kind === 'dish') {
    return isRowId(dishId) && ingredientId == null && groupId == null
      ? { kind, ingredientId: null, dishId, groupId: null }
      : null;
  }

  return isRowId(groupId) && ingredientId == null && dishId == null
    ? { kind, ingredientId: null, dishId: null, groupId }
    : null;
}

/**
 * Waliduje nieznany kształt (ciało `PUT` albo kandydat z formularza) i zwraca albo czysty
 * `PreferencesPayload`, albo polskie komunikaty pod właściwe pola.
 *
 * Lista wykluczeń jest odchudzana o duplikaty, ale ich obecność NIE jest błędem: użytkownik,
 * który dwa razy kliknął ten sam składnik, ma zobaczyć jeden wpis, a nie komunikat o pomyłce.
 */
export function validatePreferences(input: unknown): PreferencesValidation {
  const source = asRecord(input);
  const preferences = asRecord(source.preferences);
  const errors: PreferenceFieldErrors = {};

  const { maxPrepMinutes, mealsPerDay } = preferences;

  if (!isFiniteNumber(maxPrepMinutes)) {
    errors.maxPrepMinutes = 'Podaj maksymalny czas przygotowania.';
  } else if (!Number.isInteger(maxPrepMinutes)) {
    errors.maxPrepMinutes = 'Czas przygotowania podaj w pełnych minutach.';
  } else if (
    maxPrepMinutes < PreferenceBounds.maxPrepMinutes.min ||
    maxPrepMinutes > PreferenceBounds.maxPrepMinutes.max
  ) {
    errors.maxPrepMinutes = `Czas przygotowania musi mieścić się w przedziale ${PreferenceBounds.maxPrepMinutes.min}–${PreferenceBounds.maxPrepMinutes.max} minut.`;
  }

  if (!isMealsPerDay(mealsPerDay)) {
    errors.mealsPerDay = 'Wybierz liczbę posiłków (3–6).';
  }

  const rawExclusions = source.exclusions;
  const exclusions: ExclusionInput[] = [];

  if (!Array.isArray(rawExclusions)) {
    errors.exclusions = 'Lista wykluczeń ma niepoprawny kształt.';
  } else {
    const seen = new Set<string>();

    for (const raw of rawExclusions) {
      const entry = normalizeExclusion(raw);
      if (!entry) {
        errors.exclusions = 'Któreś wykluczenie nie wskazuje składnika, dania ani grupy.';
        break;
      }

      const key = exclusionKey(entry);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      exclusions.push(entry);
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      preferences: {
        maxPrepMinutes: maxPrepMinutes as number,
        mealsPerDay: mealsPerDay as MealsPerDay,
      },
      exclusions,
    },
  };
}
