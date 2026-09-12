import { test, expect } from '@playwright/test';

import {
  activityOption,
  ageField,
  openProfile,
  fillReferenceProfile,
  heightField,
  overrideField,
  sexOption,
  weightField,
} from './support/profile-form';
import { control } from './support/sign-in';

/**
 * Ręczne kryteria **3.7–3.11 i 3.13** fazy 3 z
 * `context/changes/profile-and-calorie-target/plan.md`, zamienione na testy.
 *
 * Ryzyka z `context/foundation/test-plan.md`: #4 (cel pokazany rozjeżdża się z wyliczeniem),
 * #6 (serwer ufa klientowi), #3 (offline mylone z wylogowaniem).
 *
 * Wyrocznie — 1780, 1,55, 2759, 2200 — pochodzą z kryteriów planu, czyli z wymagania, nigdy
 * z uruchomienia modułu liczącego.
 *
 * **Separator tysięcy.** Plan zapisuje te liczby jako „1 780" i „2 759", ale `toLocaleString('pl-PL')`
 * **nie grupuje** liczb czterocyfrowych (`minimumGroupingDigits: 2` w danych locale dla polskiego),
 * więc na ekranie jest „1780" i „2759". Zachowanie jest poprawne typograficznie; to zapis kryterium
 * jest nieprecyzyjny. Asercje dopuszczają obie formy, żeby test pilnował arytmetyki, a nie literówki
 * w dokumencie — rozbieżność jest odnotowana w planie i w Dzienniku.
 */

/** Te testy piszą do profilu jednego konta testowego — równoległość dawałaby wyścig (jak w `profile-api`). */
test.describe.configure({ mode: 'serial' });

/** Liczba z opcjonalnym separatorem tysięcy (spacja zwykła lub wąska niełamliwa). */
function kcal(value: string): RegExp {
  return new RegExp(grouping(value));
}

/**
 * Dokładnie „<liczba> kcal" i nic więcej — forma z karty celu na Home.
 *
 * Potrzebna, bo **oba ekrany zakładek są zamontowane w DOM naraz**: nawigacja na Home nie
 * odmontowuje ekranu profilu, więc ta sama liczba stoi jednocześnie w karcie („2759 kcal")
 * i w podglądzie profilu („= 2759 kcal dziennie”). Dopasowanie luźne trafia w oba i Playwright
 * zgłasza naruszenie trybu ścisłego — co wygląda jak brak celu, a jest kolizją lokatora.
 */
function kcalCard(value: string): RegExp {
  return new RegExp(`^${grouping(value)} kcal$`);
}

function grouping(value: string): string {
  return value.replace(/^(\d)(\d{3})$/, '$1[\\s\\u00a0\\u202f]?$2');
}

test.describe('Faza 3 — ekran profilu w przeglądarce', () => {
  test('3.7 podgląd liczy 1780 → × 1,55 → 2759 jeszcze przed zapisem', async ({ page }) => {
    const writes: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/profile') && r.method() !== 'GET') writes.push(r.method());
    });

    await openProfile(page);
    await fillReferenceProfile(page);

    // Rozbicie musi być widoczne BEZ zapisu — to jest sedno kryterium 3.7.
    await expect(page.getByText(kcal('1780'))).toBeVisible();
    await expect(page.getByText(/× 1[,.]55/)).toBeVisible();
    await expect(page.getByText(kcal('2759'))).toBeVisible();

    // „przed zapisem" znaczy: nic nie poszło do serwera.
    expect(writes).toEqual([]);
  });

  test('3.8 zapis potwierdza „Zapisano", a Home pokazuje ten sam cel', async ({ page }) => {
    await openProfile(page);
    await fillReferenceProfile(page);
    await overrideField(page).fill('');
    await control(page, 'Zapisz').click();

    await expect(page.getByText('Zapisano')).toBeVisible();

    // Karta na Home bierze cel z serwera przy wejściu w zakładkę.
    //
    // Czekamy na NAWIGACJĘ, zanim cokolwiek sprawdzimy. Bez tego asercja trafia jeszcze w ekran
    // profilu, gdzie ta sama liczba stoi i w podglądzie, i w wierszu nadpisania — Playwright
    // zgłasza wtedy naruszenie trybu ścisłego, a nie brak celu.
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await page.waitForURL((u) => u.pathname === '/');

    await expect(page.getByRole('link', { name: 'Zmień profil' })).toBeVisible();
    await expect(page.getByText(kcalCard('2759'))).toBeVisible();
  });

  test('3.9 „70,5" jest przyjęte, a wiek 17 i waga 7 zatrzymują zapis przed siecią', async ({ page }) => {
    await openProfile(page);

    // Polska klawiatura: przecinek dziesiętny musi przejść.
    await weightField(page).fill('70,5');
    await expect(weightField(page)).toHaveValue('70,5');

    const writes: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/profile') && r.method() !== 'GET') writes.push(r.method());
    });

    // Wartości poza granicami: walidacja ma zatrzymać żądanie, nie serwer.
    await ageField(page).fill('17');
    await weightField(page).fill('7');
    await heightField(page).fill('180');
    await sexOption(page, 'Mężczyzna').click();
    await activityOption(page, 3).click();
    await control(page, 'Zapisz').click();

    // Komunikaty pojawiają się dopiero PO próbie zapisu — i zapis nie wychodzi.
    await expect(page.getByText(/Wiek|wiek/).first()).toBeVisible();
    expect(writes).toEqual([]);
  });

  test('3.10 nadpisanie 2200 przeżywa edycję wagi, a „Wróć do wyliczenia" je czyści', async ({ page }) => {
    await openProfile(page);
    await fillReferenceProfile(page);
    await overrideField(page).fill('2200');

    // Oba cele w JEDNYM wierszu: obowiązujący i wyliczone w nawiasie. Asercja celuje w ten wiersz,
    // a nie w same liczby — „2759" stoi na tym ekranie także w podglądzie wyliczenia, więc luźne
    // dopasowanie trafiałoby w dwa elementy. Ten wiersz jest jednocześnie mocniejszym dowodem:
    // pokazuje, że nadpisanie NIE skasowało wyliczenia.
    await expect(
      page.getByText(/Twój cel:\s*2[\s  ]?200 kcal \(wyliczone\s*2[\s  ]?759\)/),
    ).toBeVisible();

    // Edycja innego pola NIE kasuje nadpisania — to jawny wymóg umowy planu.
    await weightField(page).fill('82');
    await expect(overrideField(page)).toHaveValue('2200');

    await control(page, 'Zapisz').click();
    await expect(page.getByText('Zapisano')).toBeVisible();

    // Home pokazuje cel nadpisany wraz z informacją, że jest nadpisany.
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await page.waitForURL((u) => u.pathname === '/');
    await expect(page.getByText(/cel nadpisany/)).toBeVisible();
    await expect(page.getByText(kcalCard('2200'))).toBeVisible();

    // Powrót do wyliczenia czyści pole.
    await page.getByRole('link', { name: 'Profil', exact: true }).click();
    await page.waitForURL((u) => u.pathname === '/profile');
    await page.getByText('Wróć do wyliczenia').click();
    await expect(overrideField(page)).toHaveValue('');
  });

  test('3.11 brak sieci komunikuje się bez wylogowania i nie kasuje wpisanych wartości', async ({
    page,
    context,
  }) => {
    await openProfile(page);
    await fillReferenceProfile(page);

    await context.setOffline(true);
    try {
      await control(page, 'Zapisz').click();

      // Komunikat o sieci — i ani śladu wyrzucenia z aplikacji.
      await expect(page.getByText(/Brak połączenia/)).toBeVisible();
      await expect(page).toHaveURL((u) => !u.pathname.includes('sign-in'));

      // Wartości zostają w polach: użytkownik nie przepisuje formularza od nowa.
      await expect(ageField(page)).toHaveValue('30');
      await expect(weightField(page)).toHaveValue('80');
      await expect(heightField(page)).toHaveValue('180');
    } finally {
      await context.setOffline(false);
    }
  });

  test('3.13 zakładki to MealPlan, Home i Profil — bez Docs', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('MealPlan').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Profil', exact: true })).toBeVisible();

    // Starter zniknął: żadnego „Docs", żadnego „Explore".
    await expect(page.getByRole('link', { name: 'Docs' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Explore' })).toHaveCount(0);
  });
});
