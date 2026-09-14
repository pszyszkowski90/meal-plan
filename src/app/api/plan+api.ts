import { computeCalorieTarget } from '@/lib/calorie-target';
import { CalorieTolerance, generatePlan, type PlanFailure } from '@/lib/plan-generator';
import { requireUserId } from '@/server/auth';
import { ensureAppUser } from '@/server/repository/app-users';
import { getPreferences } from '@/server/repository/preferences';
import {
  getPlan,
  getPlanWithRecipes,
  listPoolForGenerator,
  savePlan,
  type PlanRecipeDay,
} from '@/server/repository/plans';
import { getUserProfile } from '@/server/repository/user-profile';

/**
 * Tygodniowy jadłospis — `GET` oddaje zapisany plan z przepisami, `POST` generuje nowy.
 *
 * Kształt jest ten sam co w `profile+api.ts`: `requireUserId` → funkcja repozytorium z `userId`
 * w pierwszym argumencie → JSON. Zero `prepare(`, zero `getWorkerEnv()`.
 *
 * **Dobór dań robi `@/lib/plan-generator`, nie ta trasa i nie zapytanie.** Trasa jest tu wyłącznie
 * granicą: sprawdza tożsamość, zbiera wejścia, oddaje wynik. Gdyby jakakolwiek reguła doboru —
 * okno ±10%, powtórzenia, kolejność diagnozy — trafiła tutaj, przestałaby być testowalna
 * `node --test` i musiałaby być sprawdzana przez bazę i HTTP.
 *
 * `GET` i `POST` zwracają IDENTYCZNY kontrakt (`PlanResponse`), żeby ekran po wygenerowaniu nie
 * musiał niczego scalać ani dociągać — bierze to, co wróciło.
 */

export interface PlanResponse {
  plan: {
    startDate: string;
    targetKcal: number;
    mealsPerDay: number;
    seed: string;
    days: PlanRecipeDay[];
    /**
     * Dni, których suma NIE mieści się już w ±10% `targetKcal` — normalnie pusta.
     *
     * Istnieje, bo plan jest zapisany jako WSKAZANIA na dania (`plan_item.dish_id`), a treść dań
     * żyje dalej: `seed-dishes.mjs` przy korekcie gramatury usuwa i wstawia wiersze
     * `dish_ingredient` na nowo. Zapisany plan może więc wyjechać poza okno **bez żadnej zmiany
     * w `plan` i `plan_item`** — i bez tego pola `GET` oddawałby go jako całkiem zwyczajny,
     * a ekran pokazywałby dzień na 2900 kcal obok celu 2200 jak gdyby nigdy nic.
     *
     * To jest inny rodzaj nieaktualności niż `currentTargetKcal`: tam zmienił się UŻYTKOWNIK,
     * tu zmieniła się PULA. Ekran ma o obu powiedzieć wprost, bo rada jest ta sama („wygeneruj
     * ponownie"), ale powód inny.
     */
    daysOutOfWindow: number[];
  } | null;
  /**
   * Cel BIEŻĄCY, liczony z profilu przy odczycie. Osobny od `plan.targetKcal`, który jest faktem
   * historycznym — przeciw jakiej liczbie ten plan ułożono. Gdy się różnią, plan nie jest wadliwy,
   * tylko nieaktualny, a ekran ma to powiedzieć wprost zamiast pokazywać sumy obok liczby,
   * względem której nigdy nie były liczone.
   */
  currentTargetKcal: number | null;
}

/** Jedyny sposób oddania `PlanResponse` — i jedyne miejsce, które pamięta o `no-store`. */
function planJson(body: PlanResponse, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * `console.error` bez `userId` i bez treści planu: plan ujawnia preferencje żywieniowe i cel
 * kaloryczny, czyli dane objęte guardrailem prywatności z PRD, a log Workera widzi każdy, kto ma
 * dostęp do konta Cloudflare.
 */
function internalError(error: unknown): Response {
  console.error('[api/plan] zapytanie do D1 nie powiodło się:', error);

  return Response.json({ error: 'internal' }, { status: 500 });
}

/**
 * Plan wskazujący `dish_id`, którego już nie ma — przeseedowanie puli usunęło danie — jest błędem
 * DANYCH, a nie awarią. 400 zamiast 500, wzorzec z `preferences+api.ts`.
 */
function foreignKeyViolation(error: unknown): boolean {
  return error instanceof Error && /FOREIGN KEY constraint failed/i.test(error.message);
}

/**
 * Porażka generatora dostaje 422, nie 400: żądanie było poprawne, a niewykonalne jest ZADANIE.
 *
 * Ciało niesie DANE, nie gotowe zdanie. Tekst składa klient, żeby jedno źródło słów obsłużyło
 * ekran i przyszłe tłumaczenie — i żeby komunikat dało się przetestować bez parsowania prozy.
 */
function infeasible(failure: PlanFailure): Response {
  return Response.json(
    { error: 'infeasible', failure },
    { status: 422, headers: { 'Cache-Control': 'no-store' } }
  );
}

async function readPlan(userId: string): Promise<PlanResponse> {
  const [header, profile] = await Promise.all([getPlan(userId), getUserProfile(userId)]);
  const currentTargetKcal = profile ? computeCalorieTarget(profile).effectiveKcal : null;

  if (!header) {
    return { plan: null, currentTargetKcal };
  }

  const days = await getPlanWithRecipes(userId);
  const lower = Math.ceil(header.targetKcal * (1 - CalorieTolerance));
  const upper = Math.floor(header.targetKcal * (1 + CalorieTolerance));

  return {
    plan: {
      startDate: header.startDate,
      targetKcal: header.targetKcal,
      mealsPerDay: header.mealsPerDay,
      seed: header.seed,
      days,
      // Okno liczone tą samą stałą, której użył generator — `CalorieTolerance` z `@/lib`.
      // Drugie miejsce z liczbą 0,1 byłoby dokładnie tym rozjazdem, przed którym ta stała powstała.
      daysOutOfWindow: days
        .filter((day) => day.totalKcal < lower || day.totalKcal > upper)
        .map((day) => day.dayIndex),
    },
    currentTargetKcal,
  };
}

/** Brak planu to STAN, nie błąd — 200 z `plan: null`, nigdy 404. */
export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await requireUserId(request);
    if (auth instanceof Response) {
      return auth;
    }

    return planJson(await readPlan(auth.userId));
  } catch (error) {
    return internalError(error);
  }
}

/**
 * Generuje plan i ZASTĘPUJE poprzedni.
 *
 * Bez profilu albo bez preferencji odmawia z 409, zamiast generować „na wartościach domyślnych":
 * bez profilu nie ma celu kalorycznego, bez preferencji nie ma liczby posiłków ani limitu czasu,
 * a zgadnięcie ich za użytkownika dałoby plan, który wygląda na dopasowany i nie jest.
 *
 * `POST` nie czyta ciała żądania — wszystkie wejścia pochodzą z profilu i preferencji tego konta.
 * Ziarno jest losowane po stronie serwera, więc dwa wywołania dają dwa różne tygodnie, a zgłoszony
 * błąd da się odtworzyć co do dania.
 */
export async function POST(request: Request): Promise<Response> {
  let auth: Awaited<ReturnType<typeof requireUserId>>;
  try {
    auth = await requireUserId(request);
  } catch (error) {
    return internalError(error);
  }
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const [profile, preferences] = await Promise.all([
      getUserProfile(auth.userId),
      getPreferences(auth.userId),
    ]);

    if (!profile) {
      return Response.json({ error: 'profile_missing' }, { status: 409 });
    }
    if (!preferences) {
      return Response.json({ error: 'preferences_missing' }, { status: 409 });
    }

    // Ziarno losowane RAZ i to samo idzie do generatora oraz do zapisu. Dwa wywołania
    // `randomUUID()` zapisałyby ziarno, które nie odtwarza planu — kolumna wyglądałaby na
    // użyteczną i kłamałaby przy pierwszej próbie odtworzenia zgłoszonego błędu.
    const seed = crypto.randomUUID();
    const targetKcal = computeCalorieTarget(profile).effectiveKcal;

    const result = generatePlan({
      targetKcal,
      mealsPerDay: preferences.mealsPerDay,
      maxPrepMinutes: preferences.maxPrepMinutes,
      seed,
      pool: await listPoolForGenerator(auth.userId),
    });

    if (!result.ok) {
      // Zero planu częściowego: przy porażce nic nie jest zapisywane.
      return infeasible(result.failure);
    }

    // Klucz obcy `plan.user_id → app_user.id` wymaga wiersza konta, a powstaje on leniwie.
    await ensureAppUser(auth.userId);

    // DATA KALENDARZOWA UTC i to jest świadomy kontrakt, nie przeoczenie. Dla użytkownika
    // w Polsce `POST` między lokalną północą a 01:00/02:00 zapisze datę wczorajszą — dlatego
    // ekran etykietuje dni numerem (`Dzień 1`…`Dzień 7`), a nie datą wyprowadzoną z tego pola.
    // `start_date` służy do powiedzenia, KIEDY plan powstał, a nie do wyliczania etykiet.
    const startDate = new Date().toISOString().slice(0, 10);
    await savePlan(
      auth.userId,
      { startDate, targetKcal, mealsPerDay: preferences.mealsPerDay, seed },
      result.days
    );

    return planJson(await readPlan(auth.userId), 201);
  } catch (error) {
    if (foreignKeyViolation(error)) {
      return Response.json(
        { error: 'invalid', fields: { plan: 'Pula dań zmieniła się w trakcie generowania.' } },
        { status: 400 }
      );
    }

    return internalError(error);
  }
}
