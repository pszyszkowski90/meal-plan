import { expect, type Page } from '@playwright/test';

/**
 * Wspólna ścieżka logowania — jedno miejsce, bo lokatory tego ekranu są nietypowe.
 *
 * **Dlaczego nie `getByRole`:** ekran logowania renderuje React Native Web. Pola `input` nie mają
 * ani `id`, ani `name`, ani `placeholder`, ani `aria-label` — jedynym stabilnym rozróżnikiem jest
 * `autocomplete`. Przyciski to `div`-y z `tabindex`, bez `role="button"`, więc `getByRole('button')`
 * nie znajduje niczego. Nagłówków (`h1`/`role=heading`) na ekranie nie ma wcale.
 *
 * Użyte lokatory są więc najmocniejsze z dostępnych: semantyczny atrybut formularza (`autocomplete`,
 * niosący intencję pola, nie jego wygląd) i widoczny tekst przycisku. Żaden nie zależy od układu
 * ani od klas CSS, więc przetrwa refaktor stylów.
 *
 * To obejście braku dostępności, nie wzorzec do naśladowania — patrz wpis o brakujących nazwach
 * dostępnościowych w `tests/e2e/README.md`. Gdy komponenty dostaną role i nazwy, ten plik jest
 * jedynym miejscem do zmiany.
 */

/** Klikalny element interfejsu o dokładnie tej etykiecie. */
export function control(page: Page, label: string) {
  return page.locator('div[tabindex]').filter({ hasText: new RegExp(`^${label}$`) }).first();
}

export function emailField(page: Page) {
  return page.locator('input[autocomplete="email"]');
}

export function passwordField(page: Page) {
  return page.locator('input[autocomplete="current-password"]');
}

/**
 * Loguje się kontem testowym i zostawia przeglądarkę w widoku produktowym.
 *
 * Instancja **development** Clerka żąda potwierdzenia nowego urządzenia kodem. Konto testowe
 * (`+clerk_test`) przyjmuje stały kod z `MEALPLAN_E2E_CODE`. Krok bywa pomijany, gdy Clerk uzna
 * urządzenie za znane, więc jest obsłużony warunkowo — bezwarunkowe czekanie na niego wywracałoby
 * test przy każdym przebiegu z zapisaną sesją.
 */
export async function signIn(page: Page): Promise<void> {
  const email = requireEnv('MEALPLAN_E2E_EMAIL');
  const password = requireEnv('MEALPLAN_E2E_PASSWORD');
  const code = requireEnv('MEALPLAN_E2E_CODE');

  await page.goto('/sign-in');
  await emailField(page).fill(email);
  await passwordField(page).fill(password);
  await control(page, 'Zaloguj się').click();

  // Krok weryfikacji urządzenia ALBO od razu aplikacja — czekamy na stan, nie na czas.
  const deviceStep = page.getByText('Potwierdź urządzenie');
  const raceResult = await Promise.race([
    deviceStep.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'device' as const),
    page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30_000 }).then(() => 'app' as const),
  ]);

  if (raceResult === 'device') {
    await page.locator('input[autocomplete="one-time-code"]').fill(code);
    await control(page, 'Potwierdź kod').click();
    await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30_000 });
  }

  // Bramka `(app)` zamontowała widok produktowy — dopiero to znaczy „zalogowany".
  await expect(control(page, 'Wyloguj się')).toBeVisible();
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Brak zmiennej ${name}. Poświadczenia trzymamy POZA repozytorium — uzupełnij plik .env ` +
        'w katalogu harnessu (patrz tests/e2e/README.md). Nie dopisuj ich do żadnego pliku w repo.',
    );
  }
  return value;
}
