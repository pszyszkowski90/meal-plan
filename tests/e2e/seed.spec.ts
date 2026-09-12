import { test, expect } from '@playwright/test';

/**
 * WZORZEC — na tym teście modelowany jest każdy kolejny test E2E w tym repo.
 * Co pokażesz, to dostaniesz: jeśli ten plik użyje `waitForTimeout`, odziedziczy to każdy
 * następny test. Cztery rzeczy, które ten plik demonstruje celowo:
 *
 *  1. **Lokatory po tym, co widzi użytkownik** — tekst i semantyczne atrybuty formularza,
 *     nigdy klasy CSS ani `nth-child`. Przeżywają refaktor układu.
 *  2. **Niezależność** — test robi własną konfigurację, akcję, asercję i sprzątanie w jednym
 *     bloku. Playwright uruchamia testy równolegle, w losowej kolejności.
 *  3. **Czekanie na STAN, nie na czas** — `expect(...).toBeVisible()` i `waitForURL` same
 *     ponawiają próbę. `waitForTimeout` przechodzi na tym laptopie i sypie się w CI.
 *  4. **Nazwa wiążąca test z ryzykiem** z `context/foundation/test-plan.md` — nie `test('test 1')`.
 *
 * Ryzyko: #7 — zmiana przechodzi lokalnie i pada po wdrożeniu na Workers.
 */

// Ten test celowo NIE korzysta z zapisanej sesji: sprawdza kontrakt serwera, nie widok użytkownika.
test.use({ storageState: { cookies: [], origins: [] } });

test('serwer oddaje HTML, żywe D1 i 404 dla nieznanej ścieżki', async ({ page, request }) => {
  // Dokument główny renderuje się po stronie serwera i wraca jako HTML.
  const document = await request.get('/');
  expect(document.status()).toBe(200);
  expect(document.headers()['content-type']).toContain('text/html');

  // `d1:true` znaczy „tabela app_user istnieje", nie tylko „binding jest podpięty".
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ ok: true, d1: true });

  // Nieznana ścieżka musi być 404, a nie cicho serwowanym HTML-em aplikacji.
  const missing = await request.get('/nie-ma-takiej-strony');
  expect(missing.status()).toBe(404);

  // Ten sam kontrakt widziany przez przeglądarkę — dokument faktycznie się renderuje.
  await page.goto('/');
  await expect(page.getByText('Zaloguj się').first()).toBeVisible();

  // Sprzątanie: ten test nie tworzy żadnego stanu po stronie serwera, więc nie ma czego usuwać.
  // Gdy test tworzy dane, sprząta je tutaj — albo używa unikalnych identyfikatorów.
});
