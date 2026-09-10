import { verifyToken } from '@clerk/backend';

import { ProductionOrigin } from '@/constants/api';
import { getWorkerEnv } from '@/server/env';

/**
 * Jedyne miejsce, w którym żądanie zamienia się w `userId`. Worker nie hashuje haseł, nie trzyma
 * sesji i nie woła Backend API Clerka — sprawdza wyłącznie podpis tokenu kluczem publicznym PEM
 * (`CLERK_JWT_KEY`). Weryfikacja jest bezsieciowa, bo `jwtKey` jest podany jawnie.
 *
 * Klient — web i native — wysyła token nagłówkiem `Authorization: Bearer`. Ciasteczek nie czytamy
 * nigdzie: jedna ścieżka do zaimplementowania i jedna do przetestowania.
 */

/**
 * Origin klienta, z którego token ma prawo pochodzić (roszczenie `azp`). Lista jest wyliczona,
 * nie „przykładowa": produkcyjny Worker, `wrangler dev` i `expo start --web`. Trzeci wpis jest
 * potrzebny, bo przepływy Clerka ćwiczymy właśnie na `expo start --web` — token z originu poza
 * listą wróciłby jako 401 nieodróżnialne od zepsutej weryfikacji.
 */
const AUTHORIZED_PARTIES = [ProductionOrigin, 'http://localhost:8787', 'http://localhost:8081'];

/**
 * Wydawca tokenu. `verifyToken` z samym `jwtKey` **nie sprawdza `iss`** (potwierdzone w `verifyJwt`
 * SDK 3.17.1: asercje obejmują `sub`, `exp`, `nbf`, `iat`, `typ` i algorytm, a `aud` i `azp` tylko
 * gdy je podasz). Bez tej linii każdy JWT podpisany kluczem tej instancji — również z custom JWT
 * template — przechodziłby jako token sesji. Podpis mówi „to nasza instancja", `iss` mówi „to jej
 * Frontend API", i to drugie jest tu przypięciem prowenancji.
 */
const ISSUER = 'https://flying-dove-9587.clerk.accounts.dev';

/**
 * `azp` sprawdzamy sami, zamiast przekazywać `authorizedParties` do `verifyToken`. Powód jest
 * zmierzony na zainstalowanym SDK (`@clerk/backend` 3.17.1, `assertAuthorizedPartiesClaim`):
 * przy niepustej liście warunek to `!azp || !authorizedParties.includes(azp)`, więc token **bez**
 * roszczenia `azp` zostaje odrzucony. Klienci natywni (Expo Go, aplikacja na telefonie) nie mają
 * originu przeglądarki, więc nie mają też `azp` — oddanie tego SDK wywaliłoby cały ruch z telefonu.
 *
 * Dlatego: jest `azp` → musi być na liście (tu leży ochrona przeglądarki); nie ma `azp` → pomijamy
 * sprawdzenie świadomie, bo to klient natywny. Plan przewidział tę rozwidlenie w kroku 3 fazy 3.
 */
function hasAllowedParty(azp: unknown): boolean {
  // Tylko FAKTYCZNY brak roszczenia znaczy „klient natywny". Roszczenie obecne, ale nie-stringowe,
  // to nie brak — Clerk takiego nie wystawia, więc jest niezgodnością, nie przepustką.
  if (azp === undefined || azp === null) {
    return true;
  }
  return typeof azp === 'string' && AUTHORIZED_PARTIES.includes(azp);
}

function unauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}

/**
 * Awaria po NASZEJ stronie, nie odrzucenie tożsamości. Rozdzielenie tych dwóch klas jest istotne
 * operacyjnie: nieudany `wrangler secret put` sprawia, że `verifyToken` rzuca `jwk-local-missing`
 * dla KAŻDEGO żądania. Wpuszczone w tę samą ścieżkę co zły token dałoby 401 wszystkim użytkownikom,
 * nieodróżnialne od wygasłej sesji — czyli awarię wdrożenia przebraną za problem użytkownika.
 */
function misconfigured(): Response {
  return Response.json({ error: 'internal' }, { status: 500 });
}

/** `TokenVerificationError` niesie `reason`; zwykły `Error` już nie. */
function rejectionReason(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const reason = Reflect.get(error, 'reason');
  return typeof reason === 'string' ? reason : error.message;
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header) {
    return null;
  }

  const match = /^Bearer (.+)$/.exec(header.trim());
  return match ? match[1].trim() || null : null;
}

/**
 * Zwraca `{ userId }` albo gotową odpowiedź 401. Zwracanie `Response` zamiast rzucania wyjątkiem
 * jest zamierzone: trasa musi jawnie zdecydować, co z brakiem tożsamości robi, a nie odziedziczyć
 * to po globalnym handlerze błędów, którego w tym repo nie ma.
 */
export async function requireUserId(request: Request): Promise<{ userId: string } | Response> {
  const token = readBearerToken(request);
  if (!token) {
    return unauthorized();
  }

  const jwtKey = getWorkerEnv().CLERK_JWT_KEY;
  if (!jwtKey) {
    console.error('[auth] brak sekretu CLERK_JWT_KEY — sprawdź `wrangler secret list`.');
    return misconfigured();
  }

  try {
    const payload = await verifyToken(token, { jwtKey });

    if (!payload.sub || payload.iss !== ISSUER || !hasAllowedParty(payload.azp)) {
      console.warn('[auth] token odrzucony: roszczenia niezgodne (sub / iss / azp)');
      return unauthorized();
    }

    return { userId: payload.sub };
  } catch (error) {
    // Do środka idzie powód: 401 bez śladu jest nie do zdiagnozowania, a `observability`
    // w `wrangler.jsonc` jest włączone. Loguje się wyłącznie powód, nigdy token.
    const reason = rejectionReason(error);

    // Zniekształcony PEM to awaria konfiguracji, nie zły token — patrz `misconfigured()`.
    if (reason === 'jwk-local-missing') {
      console.error('[auth] CLERK_JWT_KEY nie daje się wczytać jako klucz PEM.');
      return misconfigured();
    }

    // Wygasanie jest rutynowe, nie wyjątkowe, a `head_sampling_rate` to 1 — stąd niższy poziom.
    if (reason === 'token-expired') {
      console.debug('[auth] token odrzucony:', reason);
    } else {
      console.warn('[auth] token odrzucony:', reason);
    }

    // Podpis, `exp`, `nbf`, `typ`, algorytm — każdy powód wygląda z zewnątrz tak samo.
    return unauthorized();
  }
}
