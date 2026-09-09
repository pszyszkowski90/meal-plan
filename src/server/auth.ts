import { verifyToken } from '@clerk/backend';

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
const AUTHORIZED_PARTIES = [
  'https://meal-plan.kurs-ai-szysza.workers.dev',
  'http://localhost:8787',
  'http://localhost:8081',
];

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
  if (typeof azp !== 'string' || azp === '') {
    return true;
  }
  return AUTHORIZED_PARTIES.includes(azp);
}

function unauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
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

  try {
    const payload = await verifyToken(token, { jwtKey: getWorkerEnv().CLERK_JWT_KEY });

    if (!payload.sub || !hasAllowedParty(payload.azp)) {
      return unauthorized();
    }

    return { userId: payload.sub };
  } catch (error) {
    // Podpis, `exp`, `nbf`, `typ`, algorytm — każdy powód odrzucenia wygląda z zewnątrz tak samo.
    // Do środka idzie powód: 401 bez śladu jest nie do zdiagnozowania, a `observability` w
    // `wrangler.jsonc` jest włączone. Loguje się wyłącznie powód, nigdy token.
    const reason = error instanceof Error ? (Reflect.get(error, 'reason') ?? error.message) : error;
    console.warn('[auth] token odrzucony:', reason);
    return unauthorized();
  }
}
