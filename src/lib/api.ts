import { useAuth } from '@clerk/expo';
import { ClerkOfflineError } from '@clerk/react/errors';
import { Platform } from 'react-native';

/**
 * JEDYNY KANAŁ ŻĄDAŃ KLIENTA DO WŁASNEGO API — odpowiednik `src/server/repository/` po drugiej
 * stronie granicy. Bez tego pliku kontrakt „klient wysyła token nagłówkiem `Authorization: Bearer`"
 * istniałby wyłącznie w prozie `CLAUDE.md`, a każdy kolejny fragment wymyślałby go od zera.
 *
 * Reguła dla S-02 i dalszych: ekran nie woła `fetch` do `/api/*` bezpośrednio — woła `authedFetch`
 * z tego pliku. Ciasteczka nie biorą w tym udziału na żadnej platformie.
 */

/** `getToken()` oddał `null` — sesji nie ma. Wyrzucenie z aplikacji należy do bramki `(app)`. */
export class NotSignedInError extends Error {
  constructor() {
    super('Brak sesji — żądanie nie zostało wysłane.');
    this.name = 'NotSignedInError';
  }
}

/**
 * Sieci nie ma. Osobny typ, bo **„offline" to nie „wylogowany"**: pomylenie ich znaczy wyrzucenie
 * zalogowanego użytkownika z aplikacji tylko dlatego, że zniknął zasięg. Core 3 pomaga to
 * rozróżnić — przy braku połączenia `getToken()` rzuca `ClerkOfflineError` zamiast zwracać `null`.
 */
export class OfflineError extends Error {
  constructor() {
    super('Brak połączenia z siecią.');
    this.name = 'OfflineError';
  }
}

/**
 * Na webie żądanie idzie na ten sam origin, co dokument — tak działa i `expo start --web`,
 * i `wrangler dev`, i produkcja. Klient natywny nie ma originu: w Expo Go pod adresem Metro leżą
 * co prawda trasy `+api.ts`, ale uruchomione w Node, gdzie `getWorkerEnv()` nie ma bindingów —
 * więc telefon celuje w produkcyjnego Workera. `EXPO_PUBLIC_API_URL` nadpisuje to na czas
 * ćwiczeń z tunelem do `wrangler dev`.
 */
const NATIVE_API_ORIGIN =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://meal-plan.kurs-ai-szysza.workers.dev';

function resolveUrl(path: string): string {
  return Platform.OS === 'web' ? path : `${NATIVE_API_ORIGIN}${path}`;
}

/**
 * Zwraca `authedFetch(path, init)` — token z `getToken()` dokłada jako `Authorization: Bearer`.
 *
 * Trzy stany, nie dwa: brak sesji (`NotSignedInError`, żądanie w ogóle nie wychodzi), brak sieci
 * (`OfflineError`, z `getToken()` albo z samego `fetch`) i odpowiedź serwera — także 4xx/5xx,
 * którą oddajemy wywołującemu bez interpretacji. Sygnalizujemy wyjątkiem, bo zwracany typ to
 * `Response` i nie da się w nim uczciwie zakodować „nie wysłałem żądania".
 */
export function useAuthedFetch() {
  const { getToken } = useAuth();

  return async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
    let token: string | null;
    try {
      token = await getToken();
    } catch (error) {
      if (ClerkOfflineError.is(error)) {
        throw new OfflineError();
      }
      throw error;
    }

    if (!token) {
      throw new NotSignedInError();
    }

    try {
      return await fetch(resolveUrl(path), {
        ...init,
        headers: { ...init?.headers, Authorization: `Bearer ${token}` },
      });
    } catch {
      // `fetch` odrzuca obietnicę wyłącznie przy błędzie transportu — status HTTP nią nie jest.
      throw new OfflineError();
    }
  };
}
