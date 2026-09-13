/**
 * Bindingi Cloudflare (D1, sekrety) istnieją wyłącznie wewnątrz `fetch(request, env, ctx)`.
 *
 * Adapter workerd z expo-server ich nie przekazuje: `createWorkerdRequestScope` przyjmuje
 * `_env` i go ignoruje, a request scope wystawia tylko origin / requestHeaders / waitUntil /
 * deferTask / setResponseHeaders. `worker.ts` idzie przez esbuild wranglera, a trasy `+api.ts`
 * przez Metro do `dist/server` — to dwa osobne bundle, więc ten moduł istnieje w dwóch kopiach,
 * ale obie czytają ten sam `globalThis[ENV_KEY]`. `env` jest jednym obiektem na Workera, więc
 * współbieżne żądania w izolacie są bezpieczne.
 *
 * To jedyne miejsce w repo, które dotyka `globalThis`. Cały dostęp do danych użytkownika ma iść
 * przez warstwę repozytorium przyjmującą `userId` jako pierwszy argument — D1 nie ma RLS.
 */
const ENV_KEY = '__MEALPLAN_WORKER_ENV__';

/**
 * Typy D1 deklarowane ręcznie i wyłącznie w zakresie, którego repo faktycznie używa. `@cloudflare/
 * workers-types` nie wchodzi: wciągnęłoby drugi zestaw typów globalnych obok React Native.
 */
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
  /**
   * Odczyt WIELU wierszy. Dołożone dla puli dań (F-01), która z definicji nie mieści się
   * w `first()`. Kształt `{ results }` jest kontraktem D1, nie naszym wyborem — runtime zwraca
   * obiekt z metadanymi, a `results` jest jego jedynym polem, którego to repo używa.
   */
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  /**
   * Wiele zapytań w JEDNEJ transakcji. Dołożone dla listy wykluczeń (S-03), którą zapis
   * doprowadza do stanu: najpierw kasuje wpisy z ekranu preferencji, potem wstawia nadesłane.
   * Bez transakcji nieudane wstawienie zostawiłoby konto z pustą listą — czyli bez guardraila,
   * o którym użytkownik nie wie, że zniknął.
   *
   * Zwracany kształt jest zadeklarowany jako `unknown[]`, bo repo z niego nie korzysta —
   * ta sama zasada co przy `run()`.
   */
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

export interface WorkerEnv {
  DB: D1Database;
  /** Klucz publiczny PEM z dashboardu Clerka — weryfikacja podpisu JWT bez rundy sieciowej. */
  CLERK_JWT_KEY: string;
}

export function setWorkerEnv(env: unknown): void {
  (globalThis as Record<string, unknown>)[ENV_KEY] = env;
}

export function getWorkerEnv(): WorkerEnv {
  const env = (globalThis as Record<string, unknown>)[ENV_KEY];
  if (!env) {
    throw new Error('Bindingi Workera niedostępne — trasa uruchomiona poza runtime workerd.');
  }
  return env as WorkerEnv;
}
