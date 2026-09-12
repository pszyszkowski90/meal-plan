/**
 * JEDYNE miejsce w repo, które wie, czym jest profil użytkownika i jak liczy się dzienne
 * zapotrzebowanie kaloryczne. Używają go dwie strony granicy danych:
 * - formularz w `src/app/(app)/profile.tsx` — podgląd na żywo i błędy pod polami,
 * - trasa `src/app/api/profile+api.ts` — walidacja ciała `PUT` i wyliczenie w odpowiedzi.
 *
 * Wynik jest wejściem ograniczenia ±10% generatora (S-04), dlatego wzór i jego stałe są przypięte
 * testem w `calorie-target.test.ts`, a cel NIE jest utrwalany w D1 — liczy się przy odczycie tym
 * samym modułem. Zero dryfu między ekranem, trasą i generatorem.
 *
 * Moduł celowo nie importuje NICZEGO: ani Reacta, ani React Native, ani Clerka, ani `@/server/*`.
 * Wchodzi do bundla klienta i do `dist/server`, a test uruchamia go natywny runner Node ze
 * zdejmowaniem typów (strip-only) — stąd też brak `enum`, `namespace` i parameter properties,
 * których Node nie zdejmie, a `tsc` tego nie zgłosi.
 */

export type Sex = 'female' | 'male';

export type ActivityLevel = 1 | 2 | 3 | 4 | 5;

/** Wejścia wzoru plus opcjonalne nadpisanie celu. `targetKcalOverride: null` = obowiązuje wyliczenie. */
export interface ProfileInput {
  age: number;
  weightKg: number;
  heightCm: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  targetKcalOverride: number | null;
}

/**
 * Granice włącznie. Decyzje S-02: dorośli 18–100 lat, waga 30–300 kg (do 0,1 kg), wzrost
 * 100–250 cm, własny cel 1000–6000 kcal. Poniżej 18 lat wzór Mifflin-St Jeor nie jest zwalidowany.
 */
export const ProfileBounds = {
  age: { min: 18, max: 100 },
  weightKg: { min: 30, max: 300 },
  heightCm: { min: 100, max: 250 },
  targetKcal: { min: 1000, max: 6000 },
} as const;

export const ActivityLevels: readonly ActivityLevel[] = [1, 2, 3, 4, 5];

/** Współczynniki aktywności (PAL) — konwencja kalkulatorów TDEE oparta na Harris-Benedict. */
export const ActivityMultiplier: Record<ActivityLevel, number> = {
  1: 1.2,
  2: 1.375,
  3: 1.55,
  4: 1.725,
  5: 1.9,
} as const;

/**
 * Etykiety poziomów żyją tu, nie w ekranie: wyjaśnienie w odpowiedzi API i w podglądzie na żywo
 * ma brzmieć identycznie.
 */
export const ActivityLabel: Record<ActivityLevel, string> = {
  1: 'siedzący',
  2: 'lekko aktywny',
  3: 'umiarkowanie aktywny',
  4: 'bardzo aktywny',
  5: 'wyczynowo aktywny',
} as const;

export type ProfileFieldErrors = Partial<Record<keyof ProfileInput, string>>;

export type ProfileValidation =
  | { ok: true; value: ProfileInput }
  | { ok: false; errors: ProfileFieldErrors };

/** Rozbicie celu — każda liczba jest sprawdzalna ręcznie na kalkulatorze. */
export interface CalorieTarget {
  /** Podstawowa przemiana materii (Mifflin-St Jeor), zaokrąglona do pełnych kcal. */
  bmrKcal: number;
  multiplier: number;
  activityLevel: ActivityLevel;
  /** `round(bmrKcal × multiplier)` — liczone z ZAOKRĄGLONEGO BMR, żeby zgadzało się z wyjaśnieniem. */
  computedKcal: number;
  overrideKcal: number | null;
  /** Cel obowiązujący: nadpisanie, a gdy go nie ma — wyliczenie. To bierze generator. */
  effectiveKcal: number;
}

/** Kontrakt przewodowy `GET` i `PUT /api/profile` — jeden kształt, klient niczego nie scala. */
export interface ProfileResponse {
  profile: (ProfileInput & { updatedAt: string }) | null;
  target: CalorieTarget | null;
}

/**
 * Tekst z pola formularza → liczba. Przecinek dziesiętny („70,5”) jest normalny na polskiej
 * klawiaturze. Pusty albo nieliczbowy tekst → `null`, żeby `validateProfile` zgłosiło „Podaj …”.
 */
export function parseNumberInput(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }
  // `Number('')` to 0, `Number('1e3')` to 1000 — pierwsze wykluczone wyżej, drugie odrzuca regex,
  // bo użytkownik nie wpisuje wagi w notacji naukowej.
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSex(value: unknown): value is Sex {
  return value === 'female' || value === 'male';
}

function isActivityLevel(value: unknown): value is ActivityLevel {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/**
 * Do 0,1 kg — więcej nie ma sensu ani na wadze łazienkowej, ani we wzorze.
 *
 * Kolejność jest celowa i jest częścią kontraktu: waga normalizuje się PRZED sprawdzeniem granic,
 * więc faktycznie przyjmowany surowy przedział to `[29,95; 300,05)`, a nie `[30; 300]`. Kto wpisze
 * „29,95” zobaczy „30,0 kg”, a nie błąd zakresu dla wartości, którą ekran i tak zaokrągli. Zapisana
 * wartość zawsze mieści się w `ProfileBounds.weightKg`, więc `CHECK` w migracji może mówić 30–300.
 * Pozostałe trzy pola idą odwrotnie — całkowitość sprawdzana przed granicą — bo tam nie ma czego
 * zaokrąglać. Test przypina obie skrajnie szczeliny.
 */
function normalizeWeight(weightKg: number): number {
  return Math.round(weightKg * 10) / 10;
}

/**
 * Waliduje nieznany kształt (ciało żądania albo kandydat z formularza) i zwraca albo czysty
 * `ProfileInput`, albo polskie komunikaty pod właściwe pola. Nie rzuca dla wejścia pochodzącego
 * z `JSON.parse` ani z formularza — czyli dla obu realnych wywołujących. Obietnica nie jest
 * bezwarunkowa: odczyt sześciu pól przejdzie przez getter albo pułapkę `Proxy`, więc obiekt
 * spreparowany ręcznie może wyjątek wypuścić. Tą drogą nic tu nie wchodzi.
 *
 * Pola liczbowe przyjmują WYŁĄCZNIE skończony `number` — stringi liczbowe formularz zamienia
 * wcześniej przez `parseNumberInput`, żeby ekran i trasa nie rozjechały się w interpretacji
 * („70,5” to liczba dla ekranu, ale nie dla `JSON.parse`).
 */
export function validateProfile(input: unknown): ProfileValidation {
  // `!Array.isArray` domyka klasę: tablica niosąca nazwane właściwości jest `typeof 'object'`
  // i bez tego zwalidowałaby się na `ok: true`. Z `JSON.parse` nieosiągalne, ale moduł jest
  // granicą zaufania trasy `PUT /api/profile`, więc kształt odrzucamy tu, a nie u wywołującego.
  const source: Record<string, unknown> =
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: ProfileFieldErrors = {};

  const { age, weightKg, heightCm, sex, activityLevel, targetKcalOverride } = source;

  if (!isFiniteNumber(age)) {
    errors.age = 'Podaj wiek.';
  } else if (!Number.isInteger(age)) {
    errors.age = 'Wiek podaj w pełnych latach.';
  } else if (age < ProfileBounds.age.min || age > ProfileBounds.age.max) {
    errors.age = `Wiek musi mieścić się w przedziale ${ProfileBounds.age.min}–${ProfileBounds.age.max} lat.`;
  }

  let normalizedWeight: number | null = null;
  if (!isFiniteNumber(weightKg)) {
    errors.weightKg = 'Podaj wagę.';
  } else {
    normalizedWeight = normalizeWeight(weightKg);
    if (
      normalizedWeight < ProfileBounds.weightKg.min ||
      normalizedWeight > ProfileBounds.weightKg.max
    ) {
      errors.weightKg = `Waga musi mieścić się w przedziale ${ProfileBounds.weightKg.min}–${ProfileBounds.weightKg.max} kg.`;
    }
  }

  if (!isFiniteNumber(heightCm)) {
    errors.heightCm = 'Podaj wzrost.';
  } else if (!Number.isInteger(heightCm)) {
    errors.heightCm = 'Wzrost podaj w pełnych centymetrach.';
  } else if (heightCm < ProfileBounds.heightCm.min || heightCm > ProfileBounds.heightCm.max) {
    errors.heightCm = `Wzrost musi mieścić się w przedziale ${ProfileBounds.heightCm.min}–${ProfileBounds.heightCm.max} cm.`;
  }

  if (!isSex(sex)) {
    errors.sex = 'Wybierz płeć.';
  }

  if (!isActivityLevel(activityLevel)) {
    errors.activityLevel = 'Wybierz poziom aktywności.';
  }

  // Brak klucza (`undefined`) i `null` znaczą to samo: obowiązuje wyliczenie.
  let override: number | null = null;
  if (targetKcalOverride !== undefined && targetKcalOverride !== null) {
    if (!isFiniteNumber(targetKcalOverride)) {
      errors.targetKcalOverride = 'Własny cel podaj jako liczbę kcal.';
    } else if (!Number.isInteger(targetKcalOverride)) {
      errors.targetKcalOverride = 'Własny cel podaj w pełnych kcal.';
    } else if (
      targetKcalOverride < ProfileBounds.targetKcal.min ||
      targetKcalOverride > ProfileBounds.targetKcal.max
    ) {
      errors.targetKcalOverride = `Własny cel musi mieścić się w przedziale ${ProfileBounds.targetKcal.min}–${ProfileBounds.targetKcal.max} kcal.`;
    } else {
      override = targetKcalOverride;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      // Po sprawdzeniach wyżej typy są zawężone; rzutowania tylko tam, gdzie TS nie widzi
      // zawężenia przez destrukturyzację.
      age: age as number,
      weightKg: normalizedWeight as number,
      heightCm: heightCm as number,
      sex: sex as Sex,
      activityLevel: activityLevel as ActivityLevel,
      targetKcalOverride: override,
    },
  };
}

/**
 * Zaokrąglenie do pełnych kcal z buforem na artefakty zmiennoprzecinkowe: gdyby iloczyn wyszedł
 * jako `1999.4999…`, samo `Math.round` dałoby `1999`, a użytkownik na kalkulatorze widzi `2000`.
 *
 * Dla OBECNYCH stałych bufor nigdy się nie uruchamia — sprawdzone wyczerpująco na całej dziedzinie
 * (wagi 30–300 co 0,1 kg × wzrosty 100–250 × wiek 18–100 × obie płcie dla BMR, oraz całkowite BMR
 * 500–4000 × pięć mnożników dla TDEE): zero przypadków, w których wynik różni się od gołego
 * `Math.round`. Wbrew wcześniejszemu komentarzowi `1290 × 1.55` jest w IEEE754 dokładnie `1999.5`.
 * Bufor zostaje na wypadek zmiany mnożników, granic albo kroku normalizacji wagi — nie jest
 * reakcją na zaobserwowany błąd.
 */
function roundKcal(value: number): number {
  return Math.round(Math.round(value * 1e6) / 1e6);
}

/**
 * Mifflin-St Jeor (1990): `10·kg + 6.25·cm − 5·lata`, `+5` dla mężczyzn, `−161` dla kobiet.
 * Wynik dnia liczony z ZAOKRĄGLONEGO BMR — to część kontraktu, nie detal: wyjaśnienie na ekranie
 * („1 320 × 1.375 = 1 815”) ma się zgadzać z tym, co użytkownik policzy sam.
 */
export function computeCalorieTarget(profile: ProfileInput): CalorieTarget {
  const sexTerm = profile.sex === 'male' ? 5 : -161;
  const rawBmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + sexTerm;
  const bmrKcal = roundKcal(rawBmr);
  const multiplier = ActivityMultiplier[profile.activityLevel];
  const computedKcal = roundKcal(bmrKcal * multiplier);
  const overrideKcal = profile.targetKcalOverride;
  // Świadomie NIE `overrideKcal ?? computedKcal`: `??` cofa się wyłącznie przy `null`/`undefined`,
  // więc `0` przeszłoby jako obowiązujący cel. `validateProfile` broni tej drogi (granica 1000 kcal),
  // ale `computeCalorieTarget` bywa wołane bez niej — na profilu odtworzonym z wiersza D1. Cel 0 kcal
  // zasiliłby ograniczenie ±10% generatora (S-04), więc guard siedzi tutaj, przy samym wzorze.
  const overrideApplies = typeof overrideKcal === 'number' && overrideKcal > 0;

  return {
    bmrKcal,
    multiplier,
    activityLevel: profile.activityLevel,
    computedKcal,
    overrideKcal,
    effectiveKcal: overrideApplies ? overrideKcal : computedKcal,
  };
}
