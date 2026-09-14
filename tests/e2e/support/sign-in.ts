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

/**
 * Klikalny element interfejsu o dokładnie tej etykiecie — dwiema drogami, bo repo jest w trakcie
 * naprawy dostępności.
 *
 * Od S-03 `ActionButton` ma `accessibilityRole="button"`, a React Native Web renderuje to jako
 * PRAWDZIWY element `<button>` — nie `div[tabindex]`, którego szukała poprzednia wersja tego
 * helpera. Zmierzone 13.09.2026: po dołożeniu roli logowanie przestawało się klikać, bo lokator
 * nie trafiał w nic.
 *
 * Droga pierwsza (`getByRole`) obsługuje prymitywy już naprawione; druga zostaje dla elementów,
 * które roli jeszcze nie mają — linków „Nie pamiętam hasła" i „Nie mam jeszcze konta". Gdy i one
 * dostaną role, zostanie sama pierwsza.
 */
export function control(page: Page, label: string) {
  const byRole = page.getByRole('button', { name: label, exact: true });
  const byText = page.locator('div[tabindex]').filter({ hasText: new RegExp(`^${label}$`) });

  return byRole.or(byText).first();
}

export function emailField(page: Page) {
  return page.locator('input[autocomplete="email"]');
}

export function passwordField(page: Page) {
  return page.locator('input[autocomplete="current-password"]');
}

/** Poświadczenia jednego konta testowego. Czytane ze środowiska — nigdy z pliku w repo. */
export type Credentials = { email: string; password: string; code: string };

/**
 * Konto **A** — domyślne dla całego harnessu. To nim jedzie zapisana sesja i wszystkie
 * specyfikacje poza dowodem izolacji.
 */
export function primaryCredentials(): Credentials {
  return {
    email: requireEnv('MEALPLAN_E2E_EMAIL'),
    password: requireEnv('MEALPLAN_E2E_PASSWORD'),
    code: requireEnv('MEALPLAN_E2E_CODE'),
  };
}

/**
 * Konto **B** — istnieje wyłącznie po to, żeby dało się dowieść izolacji między tożsamościami
 * (kryterium 1.6 S-03, 2.9 S-02). Jedno konto nie udowodni, że `WHERE user_id = ?` naprawdę
 * filtruje: zapytanie bez filtra oddałoby dokładnie te same dane.
 *
 * Kod weryfikacyjny jest wspólny, bo oba konta używają adresu `+clerk_test`, który w instancji
 * development Clerka przyjmuje **ten sam stały kod**. Osobna zmienna byłaby kopią tej samej
 * wartości i jeszcze jednym miejscem do rozjazdu.
 */
export function secondaryCredentials(): Credentials {
  return {
    email: requireEnv('MEALPLAN_E2E_EMAIL_B'),
    password: requireEnv('MEALPLAN_E2E_PASSWORD_B'),
    code: requireEnv('MEALPLAN_E2E_CODE'),
  };
}

/**
 * Loguje się kontem testowym i zostawia przeglądarkę w widoku produktowym.
 *
 * Instancja **development** Clerka żąda potwierdzenia nowego urządzenia kodem. Konto testowe
 * (`+clerk_test`) przyjmuje stały kod z `MEALPLAN_E2E_CODE`. Krok bywa pomijany, gdy Clerk uzna
 * urządzenie za znane, więc jest obsłużony warunkowo — bezwarunkowe czekanie na niego wywracałoby
 * test przy każdym przebiegu z zapisaną sesją.
 *
 * Domyślnie loguje konto A; dowód izolacji podaje poświadczenia konta B jawnie.
 */
export async function signIn(page: Page, credentials?: Credentials): Promise<void> {
  const { email, password, code } = credentials ?? primaryCredentials();

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
