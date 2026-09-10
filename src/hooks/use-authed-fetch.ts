import { useAuth } from '@clerk/expo';
import { ClerkOfflineError } from '@clerk/react/errors';

import { NotSignedInError, OfflineError, resolveUrl } from '@/lib/api';

/**
 * Zwraca `authedFetch(path, init)` — token z `getToken()` dokłada jako `Authorization: Bearer`.
 * To JEDYNY kanał żądań klienta do własnego API; kontrakt i typy błędów leżą w
 * [`@/lib/api`](../lib/api.ts).
 *
 * Trzy stany, nie dwa: brak sesji (`NotSignedInError`, żądanie w ogóle nie wychodzi), brak sieci
 * (`OfflineError`, z `getToken()` albo z samego `fetch`) i odpowiedź serwera — także 4xx/5xx,
 * którą oddajemy wywołującemu bez interpretacji. Sygnalizujemy wyjątkiem, bo zwracany typ to
 * `Response` i nie da się w nim uczciwie zakodować „nie wysłałem żądania".
 *
 * Hook, a nie zwykła funkcja, bo token bierze się z `useAuth()`. Bez `useCallback` — `reactCompiler`
 * jest włączony i memoizuje sam.
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

    // `new Headers(...)`, a nie spread: `RequestInit['headers']` dopuszcza obiekt, `Headers`
    // ORAZ tablicę par, a spread po dwóch ostatnich daje `{}` — nagłówki zniknęłyby bez błędu
    // i bez ostrzeżenia typów. Pierwszy `POST` z `Content-Type` wszedłby w to wprost.
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);

    try {
      return await fetch(resolveUrl(path), { ...init, headers });
    } catch {
      // `fetch` odrzuca obietnicę wyłącznie przy błędzie transportu — status HTTP nią nie jest.
      throw new OfflineError();
    }
  };
}
