/**
 * WARSTWA REPOZYTORIUM — WZORZEC ODNIESIENIA DLA S-02 I DALSZYCH FRAGMENTÓW.
 *
 * Reguła, od której nie ma odstępstwa: **każda funkcja dotykająca danych użytkownika przyjmuje
 * `userId` jako pierwszy argument i filtruje po nim w SQL-u.** D1 nie ma RLS, więc ta warstwa jest
 * jedynym mechanizmem izolacji danych między kontami — guardrail prywatności z PRD stoi na niej
 * i na niczym innym.
 *
 * Konsekwencje, które obowiązują też w plikach, które powstaną później:
 * - żadnej funkcji zwracającej listę wszystkich użytkowników ani wiersz bez warunku po `userId`;
 * - SQL — `prepare(` — żyje WYŁĄCZNIE w tym katalogu; trasy `+api.ts` go nie widzą (jedyny
 *   wyjątek to `api/health+api.ts`, smoke test wdrożenia sprzed schematu). `getWorkerEnv()`
 *   poza tym katalogiem czyta wyłącznie sekret (`src/server/auth.ts` → `CLERK_JWT_KEY`), nigdy `DB`;
 * - wartości wchodzą przez `bind(...)`, nigdy przez sklejanie stringów.
 */
import { getWorkerEnv } from '@/server/env';

export interface AppUser {
  id: string;
  createdAt: string;
  lastSeenAt: string;
}

interface AppUserRow {
  id: string;
  created_at: string;
  last_seen_at: string;
}

/**
 * Wstawia wiersz przy pierwszym kontakcie z kontem i aktualizuje `last_seen_at` przy kolejnych.
 * Tabela `app_user` powstaje leniwie, właśnie tutaj — nie ma webhooka z Clerka, który by ją zasilał.
 *
 * `RETURNING` oddaje stan po zapisie, więc jedno zapytanie zamiast dwóch rund do D1.
 */
export async function touchAppUser(userId: string): Promise<AppUser> {
  const now = new Date().toISOString();

  const row = await getWorkerEnv()
    .DB.prepare(
      `insert into app_user (id, created_at, last_seen_at)
       values (?1, ?2, ?2)
       on conflict(id) do update set last_seen_at = ?2
       where app_user.id = ?1
       returning id, created_at, last_seen_at`
    )
    .bind(userId, now)
    .first<AppUserRow>();

  if (!row) {
    throw new Error('Zapis app_user nie zwrócił wiersza — nieoczekiwany stan D1.');
  }

  return { id: row.id, createdAt: row.created_at, lastSeenAt: row.last_seen_at };
}
