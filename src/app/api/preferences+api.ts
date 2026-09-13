import {
  validatePreferences,
  type Exclusion,
  type PreferencesResponse,
} from '@/lib/preferences';
import { requireUserId } from '@/server/auth';
import { ensureAppUser } from '@/server/repository/app-users';
import {
  getPreferences,
  listExclusions,
  replaceExclusions,
  savePreferences,
  type UserPreferences,
} from '@/server/repository/preferences';

/**
 * Preferencje żywieniowe — wykluczenia, limit czasu gotowania i liczba posiłków.
 *
 * Kształt jest ten sam co w `profile+api.ts`, celowo jeden do jednego: `requireUserId` →
 * funkcje repozytorium z `userId` w pierwszym argumencie → JSON. Zero `prepare(`, zero
 * `getWorkerEnv()`.
 *
 * `GET` i `PUT` zwracają IDENTYCZNY kontrakt (`PreferencesResponse`), żeby ekran po zapisie nie
 * musiał niczego scalać — bierze to, co wróciło. W szczególności lista wykluczeń wraca
 * z identyfikatorami wierszy, których klient nie wymyśla.
 */

function toResponse(
  preferences: UserPreferences | null,
  exclusions: Exclusion[]
): PreferencesResponse {
  return {
    preferences: preferences
      ? {
          maxPrepMinutes: preferences.maxPrepMinutes,
          mealsPerDay: preferences.mealsPerDay,
          updatedAt: preferences.updatedAt,
        }
      : null,
    exclusions,
  };
}

/**
 * Jedyny sposób oddania `PreferencesResponse` klientowi — i jedyne miejsce, które pamięta
 * o `no-store`.
 *
 * Wykluczenia żywieniowe są daną wrażliwą w mocniejszym sensie niż profil: lista bez wieprzowiny
 * albo bez glutenu potrafi ujawnić wyznanie lub stan zdrowia. Bez tej dyrektywy cache przeglądarki
 * może ją zatrzymać na dysku wg reguł heurystycznych RFC 9111 — czytelną po wylogowaniu i na
 * współdzielonej maszynie (ustalenie F2 przeglądu S-02).
 */
function preferencesJson(body: PreferencesResponse): Response {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * `console.error` bez `userId` i bez ciała żądania: log Workera jest widoczny w `wrangler tail`
 * dla każdego, kto ma dostęp do konta Cloudflare, a ciało niesie tu właśnie te dane wrażliwe.
 */
function internalError(error: unknown): Response {
  console.error('[api/preferences] zapytanie do D1 nie powiodło się:', error);

  return Response.json({ error: 'internal' }, { status: 500 });
}

/**
 * Wykluczenie wskazujące składnik, danie albo grupę, których nie ma, to błąd KLIENTA, nie awaria.
 *
 * `validatePreferences` sprawdza KSZTAŁT identyfikatora, ale nie może sprawdzić jego istnienia —
 * to wiedza bazy. Bez tego tłumaczenia jedyną odpowiedzią byłoby 500 `internal`, czyli komunikat
 * „coś się popsuło" na sytuację, w której nic się nie popsuło. Klucz obcy może tu paść WYŁĄCZNIE
 * na jednym z trzech identyfikatorów wykluczenia: `user_id` jest gwarantowane przez `ensureAppUser`
 * wywołane linijkę wyżej.
 */
function foreignKeyViolation(error: unknown): boolean {
  return error instanceof Error && /FOREIGN KEY constraint failed/i.test(error.message);
}

/**
 * Brak preferencji to STAN, nie błąd — 200 z `preferences: null` i pustą listą, nie 404.
 *
 * `requireUserId` jest W ŚRODKU `try` z tego samego powodu co w `profile+api.ts`: woła
 * `getWorkerEnv()`, które rzuca przy braku bindingów, a wtedy odrzucenie wychodziłoby z handlera
 * bez wpisu `[api/preferences]` i z generycznym 500 od runtime'u.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await requireUserId(request);
    if (auth instanceof Response) {
      return auth;
    }

    const [preferences, exclusions] = await Promise.all([
      getPreferences(auth.userId),
      listExclusions(auth.userId),
    ]);

    return preferencesJson(toResponse(preferences, exclusions));
  } catch (error) {
    return internalError(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  // Osobny `try` niż ścieżka danych (patrz `GET`): tamten nie może objąć całości, bo połknąłby
  // 400 za zepsute ciało i za niepoprawne preferencje.
  let auth: Awaited<ReturnType<typeof requireUserId>>;
  try {
    auth = await requireUserId(request);
  } catch (error) {
    return internalError(error);
  }

  if (auth instanceof Response) {
    return auth;
  }

  // Ciało czytane osobno od ścieżki danych: zepsuty JSON to błąd KLIENTA (400), a nie awaria
  // serwera (500), i tylko tutaj da się te dwa przypadki rozdzielić.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const validation = validatePreferences(body);
  if (!validation.ok) {
    return Response.json({ error: 'invalid', fields: validation.errors }, { status: 400 });
  }

  try {
    // Klucze obce `user_preferences.user_id` i `exclusion.user_id` wymagają istniejącego wiersza
    // tożsamości — konto zapisujące preferencje przed wejściem na trasę czytającą `app_user`
    // padłoby tu na `FOREIGN KEY constraint failed`. `ensureAppUser`, nie `touchAppUser`: zapisowi
    // potrzebne jest samo ISTNIENIE wiersza.
    await ensureAppUser(auth.userId);

    // Kolejność ma znaczenie: gdyby wykluczenia wchodziły pierwsze, a zapis ustawień padł na
    // kluczu obcym, konto zostałoby z listą wykluczeń bez limitu czasu — stan, którego ekran
    // nie potrafi pokazać.
    const preferences = await savePreferences(auth.userId, validation.value.preferences);
    const exclusions = await replaceExclusions(auth.userId, validation.value.exclusions);

    return preferencesJson(toResponse(preferences, exclusions));
  } catch (error) {
    if (foreignKeyViolation(error)) {
      return Response.json(
        {
          error: 'invalid',
          fields: {
            exclusions: 'Któreś wykluczenie wskazuje nieistniejący składnik, danie albo grupę.',
          },
        },
        { status: 400 }
      );
    }

    return internalError(error);
  }
}
