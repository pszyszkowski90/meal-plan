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

interface D1PreparedStatement {
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface WorkerEnv {
  DB: D1Database;
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
