import { computeCalorieTarget, validateProfile, type ProfileResponse } from '@/lib/calorie-target';
import { requireUserId } from '@/server/auth';
import { ensureAppUser } from '@/server/repository/app-users';
import { getUserProfile, saveUserProfile } from '@/server/repository/user-profile';
import type { UserProfile } from '@/server/repository/user-profile';

/**
 * Profil użytkownika — pierwsza trasa produktowa repo i pierwsza, która czyta ciało żądania.
 *
 * Kształt jest ten sam co w `account+api.ts`: `requireUserId` → funkcja repozytorium z `userId`
 * w pierwszym argumencie → JSON. Zero `prepare(`, zero `getWorkerEnv()`.
 *
 * `GET` i `PUT` zwracają IDENTYCZNY kontrakt (`ProfileResponse`), żeby ekran po zapisie nie musiał
 * niczego scalać ani przeliczać — bierze to, co wróciło. Wyliczenie robi po obu stronach granicy
 * ten sam moduł `@/lib/calorie-target`, więc podgląd na żywo i odpowiedź serwera nie mają jak się
 * rozjechać.
 */

/** Odpowiedź jest tym samym kształtem dla obu metod; `target` liczy się przy każdym odczycie. */
function toResponse(profile: UserProfile | null): ProfileResponse {
  if (!profile) {
    return { profile: null, target: null };
  }

  return {
    profile: {
      age: profile.age,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      sex: profile.sex,
      activityLevel: profile.activityLevel,
      targetKcalOverride: profile.targetKcalOverride,
      updatedAt: profile.updatedAt,
    },
    target: computeCalorieTarget(profile),
  };
}

/**
 * Jedyny sposób oddania `ProfileResponse` klientowi — i jedyne miejsce, które pamięta o `no-store`.
 *
 * Wiek, waga, wzrost i płeć są objęte guardrailem prywatności z PRD. Bez tej dyrektywy cache
 * przeglądarki może je zatrzymać na dysku wg reguł heurystycznych RFC 9111 (odpowiedź nie ma
 * `Last-Modified`, ale i tak kwalifikuje się do przechowania) — czytelne po wylogowaniu i na
 * współdzielonej maszynie. Cloudflare uwierzytelnionych `/api/*` nie cache'uje, więc to warstwa
 * klienta jest tu jedynym ryzykiem.
 */
function profileJson(body: ProfileResponse): Response {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * `console.error` bez `userId` i bez ciała żądania: wiek, waga i wzrost są objęte guardrailem
 * prywatności z PRD, a log Workera jest widoczny w `wrangler tail` dla każdego, kto ma dostęp
 * do konta Cloudflare.
 */
function internalError(error: unknown): Response {
  console.error('[api/profile] zapytanie do D1 nie powiodło się:', error);

  return Response.json({ error: 'internal' }, { status: 500 });
}

/** Brak profilu to STAN, nie błąd — stąd 200 z `profile: null`, nie 404. Klient nie ma tego mylić z awarią. */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireUserId(request);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const profile = await getUserProfile(auth.userId);

    return profileJson(toResponse(profile));
  } catch (error) {
    return internalError(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  const auth = await requireUserId(request);
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

  const validation = validateProfile(body);
  if (!validation.ok) {
    return Response.json({ error: 'invalid', fields: validation.errors }, { status: 400 });
  }

  try {
    // Klucz obcy `user_profile.user_id → app_user.id` wymaga istniejącego wiersza tożsamości.
    // Konto, które zapisuje profil przed wejściem na jakąkolwiek trasę czytającą `app_user`,
    // padłoby tu na `FOREIGN KEY constraint failed`. `ensureAppUser`, nie `touchAppUser`: zapisowi
    // potrzebne jest samo ISTNIENIE wiersza, a tamto przy świeżym `last_seen_at` kosztuje drugą
    // rundę do D1 na odczyt, którego wynik i tak byśmy wyrzucili.
    await ensureAppUser(auth.userId);

    const profile = await saveUserProfile(auth.userId, validation.value);

    return profileJson(toResponse(profile));
  } catch (error) {
    return internalError(error);
  }
}
