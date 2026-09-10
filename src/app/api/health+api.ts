import { getWorkerEnv } from '@/server/env';

/**
 * Smoke test wdrożenia, nie funkcja produktowa: potwierdza, że adapter workerd obsługuje trasy
 * API, że binding D1 dochodzi do trasy **i że schemat jest zastosowany**.
 *
 * Ta trzecia asercja jest tu od przeglądu fazy 3. Wcześniej zapytaniem było `select 1`, które
 * zwraca `d1: true` także na bazie bez tabel — więc smoke test przechodził również wtedy, gdy
 * migracja nie została zastosowana. Dopóki nie było czytelnika `app_user`, to była teoria; odkąd
 * `/api/account` czyta tę tabelę, jest to realny tryb awarii, a smoke test przed przebiegiem
 * produkcyjnym ma go wykrywać.
 *
 * `sqlite_master` z `count(*)` zamiast `select 1 from app_user limit 1`: to drugie zwraca zero
 * wierszy na PUSTEJ, ale istniejącej tabeli, więc mieszałoby „brak schematu" z „brak użytkowników".
 * Tu zawsze wraca dokładnie jeden wiersz, a `d1` mówi wyłącznie o obecności tabeli.
 *
 * To jedyna trasa API, która wolno jej sięgać po `getWorkerEnv()` i `prepare(` bezpośrednio —
 * cały dostęp do danych użytkownika idzie przez `src/server/repository/`.
 */
export async function GET(): Promise<Response> {
  const row = await getWorkerEnv()
    .DB.prepare(
      `select count(*) as tables from sqlite_master where type = 'table' and name = 'app_user'`
    )
    .first<{ tables: number }>();

  return Response.json({ ok: true, d1: row?.tables === 1, at: new Date().toISOString() });
}
