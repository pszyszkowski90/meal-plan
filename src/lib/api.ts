import { Platform } from 'react-native';

import { ProductionOrigin } from '@/constants/api';

/**
 * Kontrakt żądań klienta do WŁASNEGO API — odpowiednik `src/server/repository/` po drugiej stronie
 * granicy. Bez tego pliku reguła „klient wysyła token nagłówkiem `Authorization: Bearer`" istniałaby
 * wyłącznie w prozie `CLAUDE.md`, a każdy kolejny fragment wymyślałby ją od zera.
 *
 * Reguła dla S-02 i dalszych: ekran nie woła `fetch` do `/api/*` bezpośrednio — woła `authedFetch`
 * z [`useAuthedFetch()`](../hooks/use-authed-fetch.ts). Ciasteczka nie biorą w tym udziału na żadnej
 * platformie. Tu leżą części bez Reacta (adres i typy błędów), sam hook mieszka w `src/hooks/`,
 * bo tam repo trzyma hooki.
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
 * i `wrangler dev`, i produkcja. Klient natywny originu nie ma: w Expo Go pod adresem Metro leżą
 * co prawda trasy `+api.ts`, ale uruchomione w Node, gdzie `getWorkerEnv()` nie ma bindingów.
 * Telefon musi więc dostać adres jawnie.
 *
 * W trybie deweloperskim `EXPO_PUBLIC_API_URL` jest **wymagany** i to jest celowe: domyślne
 * celowanie w produkcję znaczyłoby, że `expo start` na telefonie pisze do produkcyjnej bazy bez
 * pytania. Dziś kosztowałoby to jeden `last_seen_at`, ale od S-02 w tych tabelach będą dane objęte
 * guardrailem prywatności z PRD — waga, wiek, płeć. Lepiej, żeby brak konfiguracji był krzykliwym
 * błędem teraz, niż cichym zapisem wtedy.
 */
function resolveNativeOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) {
    return configured;
  }

  if (__DEV__) {
    const message =
      'Brak EXPO_PUBLIC_API_URL. Klient natywny nie ma originu, a w trybie dev NIE celuje ' +
      'domyślnie w produkcję. Dopisz do .env.local adres Workera, np. ' +
      'EXPO_PUBLIC_API_URL=http://<ip-w-LAN>:8787 (wymaga `npx wrangler dev --ip 0.0.0.0`), ' +
      `albo ${ProductionOrigin}, jeśli świadomie chcesz produkcji. Potem zrestartuj expo start.`;
    console.error('[api]', message);
    throw new Error(message);
  }

  return ProductionOrigin;
}

/** Ścieżka względna na webie, absolutna na kliencie natywnym. */
export function resolveUrl(path: string): string {
  return Platform.OS === 'web' ? path : `${resolveNativeOrigin()}${path}`;
}
