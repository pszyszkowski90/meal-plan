import type { Page } from '@playwright/test';

/**
 * Przechwytuje żywy token sesji z prawdziwego żądania, które aplikacja i tak wysyła.
 *
 * Po co token: część kontraktu serwera (odrzucenie złych danych, nadpisanie celu) da się sprawdzić
 * wyłącznie uwierzytelnionym żądaniem, a jednocześnie **nie** powinna jechać przez formularz —
 * walidacja klienta nie może przesłaniać walidacji serwera. To ryzyko #6 z planu testów:
 * „serwer ufa klientowi". Żądanie z pominięciem UI jest jedynym sposobem, żeby je zobaczyć.
 *
 * Dlaczego z żądania, a nie z `window.Clerk`: `@clerk/expo` nie wystawia instancji Clerka jako
 * globalnej zmiennej przeglądarki (robi to clerk-js, nie SDK Expo), więc `window.Clerk.session`
 * jest tu `undefined` — sprawdzone. Podrabianie tokenu własnym kluczem też odpada: testowałoby
 * nasz generator, a nie prawdziwą ścieżkę weryfikacji podpisu. Zostaje token, który aplikacja
 * naprawdę wysyła — ten sam, który dostaje produkcja.
 */
export async function sessionToken(page: Page): Promise<string> {
  // Nasłuch uzbrajamy PRZED nawigacją, inaczej żądanie zdąży przelecieć niezauważone.
  const authorized = page.waitForRequest(
    (request) => request.url().includes('/api/') && Boolean(request.headers()['authorization']),
    { timeout: 30_000 },
  );

  await page.goto('/');

  const header = (await authorized).headers()['authorization'];
  const token = header?.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    throw new Error(
      'Nie udało się przechwycić tokenu sesji. Czy zapisana sesja jest ważna i czy widok ' +
        'produktowy faktycznie woła API?',
    );
  }
  return token;
}
