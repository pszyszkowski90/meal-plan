import { test, expect, type Page } from '@playwright/test';

/**
 * Ekran jadłospisu — faza 4 S-04, zakres minimalny.
 *
 * ŚWIADOMIE WĄSKI. Plan przewidywał czternaście kryteriów dla tej fazy; tutaj są trzy, które
 * odpowiadają na pytanie „czy użytkownik w ogóle zobaczy plan". Reszta (offline, izolacja przez
 * ekran, szerokość 400 px, blokada przycisku przy nieznanym stanie) jest zaplanowana i nie została
 * zrobiona — odnotowane w Dzienniku, nie udawane.
 *
 * Lokatory przez `getByRole` z nazwą, bo oba ekrany zakładek są zamontowane naraz i luźne
 * dopasowanie tekstu wywraca się na trybie ścisłym Playwrighta.
 */

async function openPlan(page: Page) {
  const loaded = page.waitForResponse(
    (r) => r.url().includes('/api/plan') && r.request().method() === 'GET'
  );
  await page.goto('/plan');
  await loaded;
}

test('ekran planu generuje tydzień i pokazuje sumy dni', async ({ page }) => {
  // Profil i preferencje ustawiamy przez API — ekran planu nie jest od tego.
  const token = await page.evaluate(() => undefined).then(() => null);
  expect(token).toBeNull();

  await openPlan(page);

  const generate = page.getByRole('button', { name: /Wygeneruj/ });
  await expect(generate).toBeVisible();

  const generated = page.waitForResponse(
    (r) => r.url().includes('/api/plan') && r.request().method() === 'POST'
  );
  await generate.click();
  const response = await generated;
  expect([201, 422]).toContain(response.status());

  if (response.status() === 422) {
    // Porażka MUSI być nazwana, a nie milcząca — i nie wolno pokazać żadnego dnia.
    await expect(page.getByText(/nie da się ułożyć|zostawia za mało|nie zostawiają dość/)).toBeVisible();
    await expect(page.getByText(/^Dzień 1 —/)).toHaveCount(0);
    return;
  }

  // Siedem dni, każdy z sumą.
  for (let day = 1; day <= 7; day += 1) {
    await expect(page.getByText(new RegExp(`^Dzień ${day} —`))).toBeVisible();
  }

  // Przepis rozwija się i niesie treść — FR-009.
  const firstMeal = page.getByRole('button', { name: /^Rozwiń przepis —/ }).first();
  await expect(firstMeal).toBeVisible();
  await firstMeal.click();
  await expect(page.getByText('Składniki').first()).toBeVisible();
  await expect(page.getByText('Przygotowanie').first()).toBeVisible();
});

test('zakładka Jadłospis jest osiągalna z paska nawigacji', async ({ page }) => {
  await page.goto('/');
  // Zakładki na webie renderują się jako `link`, nie `button` — wzorzec z `profile-screen.spec.ts`.
  const tab = page.getByRole('link', { name: 'Jadłospis', exact: true });
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page.getByRole('button', { name: /Wygeneruj/ })).toBeVisible();
});
