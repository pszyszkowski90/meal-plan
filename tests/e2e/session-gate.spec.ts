import { test, expect } from '@playwright/test';

import { control, signIn } from './support/sign-in';

/**
 * Ryzyko #2 z `context/foundation/test-plan.md`: bramka sesji wpuszcza niezalogowanego do widoku
 * produktowego albo wyrzuca zalogowanego przy odświeżeniu strony.
 *
 * Dlaczego to musi być test przeglądarkowy, a nie sprawdzenie kodu HTTP: web renderuje HTML
 * po stronie serwera **bez sesji**, a Clerk odtwarza ją dopiero po hydracji. `GET /` zwraca
 * więc 200 niezależnie od tego, czy bramka działa. Awaria istnieje wyłącznie w wyrenderowanym,
 * zhydratowanym interfejsie — czyli dokładnie tam, gdzie sięga tylko przeglądarka.
 *
 * Cały plik jedzie na **czystym kontekście**: testy bramki muszą same decydować o tym,
 * czy sesja istnieje.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Ryzyko #2 — bramka sesji', () => {
  test('niezalogowany użytkownik nie wchodzi do widoku produktowego', async ({ page }) => {
    await page.goto('/');

    // Kontrakt: ląduje na logowaniu i NIE widzi niczego produktowego.
    await page.waitForURL((u) => u.pathname.includes('sign-in'));
    await expect(page.locator('input[autocomplete="email"]')).toBeVisible();
    await expect(control(page, 'Wyloguj się')).toHaveCount(0);
  });

  test('po zalogowaniu bramka wpuszcza, a sesja przeżywa przeładowanie strony', async ({ page }) => {
    await signIn(page);

    // Widok produktowy jest zamontowany.
    await expect(page).toHaveURL((u) => !u.pathname.includes('sign-in'));
    await expect(control(page, 'Wyloguj się')).toBeVisible();

    // Sedno ryzyka: przeładowanie to moment, w którym serwer renderuje bez sesji.
    await page.reload();

    // Po hydracji użytkownik nadal jest w aplikacji — nie został odesłany na logowanie…
    await expect(control(page, 'Wyloguj się')).toBeVisible();
    await expect(page).toHaveURL((u) => !u.pathname.includes('sign-in'));

    // …a jego tożsamość realnie doszła do serwera. To odróżnia „bramka wpuściła" od
    // „bramka wpuściła, ale każde uwierzytelnione żądanie dostaje 401".
    await expect(page.getByText(/^userId: user_/)).toBeVisible();
  });

  test('wylogowanie odsyła na ekran logowania', async ({ page }) => {
    await signIn(page);

    await control(page, 'Wyloguj się').click();

    await page.waitForURL((u) => u.pathname.includes('sign-in'));
    await expect(page.locator('input[autocomplete="email"]')).toBeVisible();
    await expect(control(page, 'Wyloguj się')).toHaveCount(0);
  });
});
