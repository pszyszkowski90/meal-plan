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
 * Jak stary musi być `last_seen_at`, żeby warto go było przepisać. Trasa `GET` nie ma prawa
 * zapisywać przy KAŻDYM żądaniu: plan darmowy D1 limituje zapisy (100 tys./dobę), nie odczyty,
 * a na ścieżce uwierzytelnionej nie ma żadnego ograniczenia częstości — pętla renderów po stronie
 * klienta generowałaby zapisy 1:1. Godzina wystarcza do tego, po co `last_seen_at` istnieje.
 */
const STALE_AFTER_MS = 60 * 60 * 1000;

function toAppUser(row: AppUserRow): AppUser {
  return { id: row.id, createdAt: row.created_at, lastSeenAt: row.last_seen_at };
}

/**
 * Wstawia wiersz przy pierwszym kontakcie z kontem i odświeża `last_seen_at`, ale **tylko gdy jest
 * starszy niż `STALE_AFTER_MS`**. Tabela `app_user` powstaje leniwie, właśnie tutaj — nie ma
 * webhooka z Clerka, który by ją zasilał.
 *
 * Dwa zapytania, nie jedno, i to jest świadomy koszt. `RETURNING` oddaje wiersz, gdy zapis
 * faktycznie zaszedł — czyli przy pierwszym kontakcie (INSERT) albo przy przeterminowanym
 * `last_seen_at` (UPDATE); wtedy wystarcza jedna runda. Gdy predykat `DO UPDATE … WHERE` jest
 * fałszywy, SQLite traktuje konflikt jak `DO NOTHING` i `RETURNING` oddaje **pustkę** (zmierzone
 * na D1, nie założone), więc świeży wiersz trzeba doczytać. Alternatywa „najpierw SELECT" byłaby
 * gorsza: kosztowałaby dwie rundy także przy zakładaniu konta.
 */
export async function touchAppUser(userId: string): Promise<AppUser> {
  const now = new Date();
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS).toISOString();
  const db = getWorkerEnv().DB;

  const written = await db
    .prepare(
      `insert into app_user (id, created_at, last_seen_at)
       values (?1, ?2, ?2)
       on conflict(id) do update set last_seen_at = ?2
       where app_user.last_seen_at < ?3
       returning id, created_at, last_seen_at`
    )
    .bind(userId, nowIso, staleBefore)
    .first<AppUserRow>();

  if (written) {
    return toAppUser(written);
  }

  const fresh = await db
    .prepare(`select id, created_at, last_seen_at from app_user where id = ?1`)
    .bind(userId)
    .first<AppUserRow>();

  if (!fresh) {
    throw new Error('Wiersz app_user ani nie powstał, ani nie istnieje — nieoczekiwany stan D1.');
  }

  return toAppUser(fresh);
}
