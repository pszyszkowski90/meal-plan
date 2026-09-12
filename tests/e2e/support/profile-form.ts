import type { Page } from '@playwright/test';

/**
 * Lokatory formularza profilu — jedno miejsce na obejścia braku dostępności.
 *
 * `ChoiceField` jest zrobiony dobrze: renderuje `radiogroup` z nazwanymi `radio`, więc płeć
 * i poziom aktywności bierzemy przez `getByRole` i nazwę, dokładnie tak, jak widzi je czytnik
 * ekranu.
 *
 * `TextField` nie ma nazw dostępnościowych — `input` nie dostaje `aria-label`, `id` ani
 * `aria-labelledby`, a etykieta jest osobnym tekstem obok. Czytnik ekranu przeczyta więc cztery
 * nienazwane pola. Do czasu naprawy rozróżniamy je po `inputmode` (intencja pola, nie jego wygląd)
 * i kolejności w formularzu. To obejście, nie wzorzec — patrz `tests/e2e/README.md`.
 */

/** Wiek — pierwsze pole numeryczne. */
export function ageField(page: Page) {
  return page.locator('input[inputmode="numeric"]').nth(0);
}

/** Waga — jedyne pole dziesiętne, bo przyjmuje „70,5". */
export function weightField(page: Page) {
  return page.locator('input[inputmode="decimal"]');
}

/** Wzrost — drugie pole numeryczne. */
export function heightField(page: Page) {
  return page.locator('input[inputmode="numeric"]').nth(1);
}

/** Własny cel (nadpisanie) — trzecie pole numeryczne. */
export function overrideField(page: Page) {
  return page.locator('input[inputmode="numeric"]').nth(2);
}

export function sexOption(page: Page, name: 'Kobieta' | 'Mężczyzna') {
  return page.getByRole('radio', { name });
}

export function activityOption(page: Page, level: 1 | 2 | 3 | 4 | 5) {
  return page.getByRole('radio', { name: new RegExp(`^Poziom ${level}`) });
}

/**
 * Otwiera Profil i czeka, aż POCZĄTKOWE pobranie profilu się dokona.
 *
 * Nie jest to kosmetyka. Ekran robi jedno `GET /api/profile` przy wejściu i wypełnia pola tym,
 * co wróci. Jeśli test (albo szybko piszący człowiek) zacznie wpisywać, zanim odpowiedź dojdzie,
 * **odpowiedź nadpisuje to, co już wpisano**. Objawiało się to losową czerwienią mniej więcej
 * raz na trzy przebiegi całego zestawu, zawsze w innym teście, i znikało przy uruchamianiu
 * pojedynczego pliku — czyli klasyczny wyścig, nie zepsuta asercja.
 *
 * Czekamy więc na STAN (odpowiedź serwera i gotowy formularz), nigdy na czas.
 *
 * Samo zachowanie aplikacji jest odnotowane jako obserwacja dla właściciela: na wolnym łączu
 * użytkownik może stracić pierwsze znaki, które zdążył wpisać.
 */
export async function openProfile(page: Page): Promise<void> {
  const loaded = page.waitForResponse(
    (r) => r.url().includes('/api/profile') && r.request().method() === 'GET',
  );
  await page.goto('/profile');
  await loaded;

  // Odpowiedź doszła; poczekaj jeszcze, aż formularz faktycznie się wyrenderuje.
  await page.locator('input[inputmode="decimal"]').waitFor({ state: 'visible' });
}

/**
 * Wypełnia formularz profilem odniesienia z kryterium 3.7 planu.
 *
 * Czyści też „Własny cel", i to jest istotne: profil żyje w D1 i **przeżywa przebieg testów**,
 * więc nadpisanie zapisane przez jeden test wraca do formularza przy następnym uruchomieniu
 * całego zestawu. Bez tego wiersz „Twój cel: … (wyliczone 2759)" pojawia się tam, gdzie test go
 * nie oczekuje, i psuje dopasowania — klasyczny brak sprzątania, tyle że po stronie serwera.
 * Helper ustala PEŁNY stan wejściowy, żeby każdy test startował z tego samego miejsca
 * niezależnie od tego, co zostawił poprzedni.
 */
export async function fillReferenceProfile(page: Page): Promise<void> {
  await ageField(page).fill('30');
  await weightField(page).fill('80');
  await heightField(page).fill('180');
  await sexOption(page, 'Mężczyzna').click();
  await activityOption(page, 3).click();
  await overrideField(page).fill('');
}
