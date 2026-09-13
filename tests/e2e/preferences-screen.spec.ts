import { test, expect } from '@playwright/test';

/**
 * Kryteria **2.5–2.8** fazy 2 z `context/changes/dietary-preferences/plan.md`.
 *
 * **Każdy lokator w tym pliku idzie przez `getByRole` z nazwą** — i to jest jednocześnie dowód
 * kryterium 2.8. Poprzednie specyfikacje musiały rozróżniać pola po `inputmode` i kolejności
 * w formularzu, bo `TextField` nie nadawał nazw dostępnościowych (ustalenie F6 przeglądu S-02).
 * Ta zmiana naprawiła to u źródła; obejścia pozycyjne w `support/profile-form.ts` zostają na razie
 * nietknięte, bo dotyczą innego ekranu i ich wymiana jest osobną zmianą.
 *
 * Ryzyka z `context/foundation/test-plan.md`: #3 (offline mylone z wylogowaniem) i regresja
 * wyścigu z S-02 (odpowiedź `GET` kasuje to, co użytkownik wpisał).
 */

/** Wykluczenie odniesienia — składnik z seeda, którego nazwa niesie stan produktu. */
const Ingredient = 'pieczarki, świeże';
const Group = 'grzyby';

/**
 * SZEREGOWO: wszystkie testy piszą do preferencji TEGO SAMEGO konta — mamy jedno konto testowe,
 * więc wiersz w D1 jest zasobem współdzielonym. Ten sam powód co w `profile-screen.spec.ts`.
 */
test.describe.configure({ mode: 'serial' });

function prepField(page: import('@playwright/test').Page) {
  return page.getByRole('textbox', { name: 'Maksymalny czas przygotowania (min)' });
}

function searchField(page: import('@playwright/test').Page) {
  return page.getByRole('textbox', { name: 'Szukaj składnika' });
}

/** Otwiera ekran i czeka, aż POCZĄTKOWE pobranie się dokona — czekamy na STAN, nie na czas. */
async function openPreferences(page: import('@playwright/test').Page): Promise<void> {
  const loaded = page.waitForResponse(
    (r) => r.url().includes('/api/preferences') && r.request().method() === 'GET',
  );
  await page.goto('/preferences');
  await loaded;
  await expect(prepField(page)).toBeVisible();
}

test.describe('Faza 2 S-03 — ekran preferencji w przeglądarce', () => {
  test('2.8 pola formularza są adresowalne przez getByRole', async ({ page }) => {
    await openPreferences(page);

    await expect(prepField(page)).toBeVisible();
    await expect(searchField(page)).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Posiłków dziennie' })).toBeVisible();
    await expect(page.getByRole('radio', { name: '4', exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: Group, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zapisz', exact: true })).toBeVisible();
  });

  test('wybór OGŁASZA swój stan, a nie tylko go koloruje', async ({ page }) => {
    // React Native Web nie tłumaczy `accessibilityState` na `aria-checked` — zmierzone sondą
    // 13.09.2026: chipy i opcje radio miały role, ale ŻADNEGO atrybutu stanu. Dla czytnika
    // ekranu jedynym sygnałem wyboru zostawał kolor tła. Ten test pilnuje, żeby nie wróciło.
    await openPreferences(page);

    const chip = page.getByRole('checkbox', { name: Group, exact: true });
    const before = await chip.getAttribute('aria-checked');
    expect(before).not.toBeNull();

    await chip.click();
    await expect(chip).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');

    // To samo dla wyboru jednokrotnego — `ChoiceField` miał tę lukę od S-02.
    await page.getByRole('radio', { name: '5', exact: true }).click();
    await expect(page.getByRole('radio', { name: '5', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('radio', { name: '3', exact: true })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('2.5 wykluczenie przeżywa zapis i przeładowanie strony', async ({ page }) => {
    await openPreferences(page);

    await prepField(page).fill('45');
    await page.getByRole('radio', { name: '4', exact: true }).click();

    // Wykluczenie SKŁADNIKOWE wybierane z puli, nie wpisywane — wskazuje `ingredient_id`.
    await searchField(page).fill('pieczar');
    await page.getByRole('button', { name: `Wyklucz ${Ingredient}` }).click();

    // Wykluczenie GRUPOWE to wpis jak każdy inny na tej samej liście.
    await page.getByRole('checkbox', { name: Group, exact: true }).click();

    await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
    await expect(page.getByText('Zapisano')).toBeVisible();

    // Przeładowanie: dane muszą przyjść z D1, a nie ze stanu komponentu.
    await openPreferences(page);
    await expect(prepField(page)).toHaveValue('45');
    await expect(page.getByRole('button', { name: `Usuń ${Ingredient}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `Usuń ${Group}` })).toBeVisible();
  });

  test('usunięcie wykluczenia też przeżywa przeładowanie', async ({ page }) => {
    await openPreferences(page);

    // Stan wejściowy ustawia sam test — nie polega na tym, co zostawił poprzedni.
    if ((await page.getByRole('button', { name: `Usuń ${Ingredient}` }).count()) === 0) {
      await searchField(page).fill('pieczar');
      await page.getByRole('button', { name: `Wyklucz ${Ingredient}` }).click();
      await prepField(page).fill('45');
      await page.getByRole('radio', { name: '4', exact: true }).click();
      await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
      await expect(page.getByText('Zapisano')).toBeVisible();
      await openPreferences(page);
    }

    await page.getByRole('button', { name: `Usuń ${Ingredient}` }).click();
    await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
    await expect(page.getByText('Zapisano')).toBeVisible();

    await openPreferences(page);
    await expect(page.getByRole('button', { name: `Usuń ${Ingredient}` })).toHaveCount(0);
  });

  test('2.6 opóźniony GET nie kasuje tego, co użytkownik zdążył wpisać', async ({ page }) => {
    // Regresja z S-02: odpowiedź początkowego pobrania dochodziła PO pierwszych znakach
    // i nadpisywała je wartością z bazy. Strażnik `touched` ma to zatrzymać.
    await page.route('**/api/preferences', async (route) => {
      if (route.request().method() === 'GET') {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      await route.continue();
    });

    const loaded = page.waitForResponse(
      (r) => r.url().includes('/api/preferences') && r.request().method() === 'GET',
    );
    await page.goto('/preferences');

    // Piszemy, ZANIM odpowiedź dojdzie — dokładnie to robi człowiek na wolnym łączu.
    await prepField(page).fill('17');
    await loaded;
    await page.waitForTimeout(500);

    // 17 nie pochodzi z bazy: poprzedni test zapisał 45. Gdyby strażnik nie działał, byłoby 45.
    await expect(prepField(page)).toHaveValue('17');
  });

  test('2.7 offline przy zapisie — komunikat, sesja zachowana, wartości zostają', async ({
    page,
  }) => {
    await openPreferences(page);

    await prepField(page).fill('33');
    await page.getByRole('radio', { name: '5', exact: true }).click();

    // Zrywamy TRANSPORT, nie sesję: `fetch` odrzuca obietnicę, a `authedFetch` zamienia to
    // na `OfflineError`. „Offline" to nie „wylogowany" — ryzyko #3.
    await page.route('**/api/preferences', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.abort('internetdisconnected');
        return;
      }
      await route.continue();
    });

    await page.getByRole('button', { name: 'Zapisz', exact: true }).click();

    await expect(page.getByText(/Brak połączenia/)).toBeVisible();
    // Wartości ZOSTAJĄ — użytkownik nie wybiera ich drugi raz.
    await expect(prepField(page)).toHaveValue('33');
    // Sesja jest zachowana: bramka nie wyrzuciła nas na ekran logowania.
    await expect(page).toHaveURL(/\/preferences$/);
    await expect(page.getByRole('button', { name: 'Zapisz', exact: true })).toBeVisible();
  });
});
