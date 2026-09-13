import type { CatalogResponse } from '@/lib/preferences';
import { requireUserId } from '@/server/auth';
import { listCatalog } from '@/server/repository/preferences';

/**
 * Pula do wyboru na ekranie preferencji: składniki i grupy wykluczeniowe.
 *
 * Istnieje, bo wykluczenie wskazuje `ingredient_id`, a nigdy tekst — ekran musi mieć z czego
 * wybierać. Nazwa `catalog`, a nie `ingredients`, bo trasa oddaje OBA słowniki: rozbicie na dwie
 * trasy kosztowałoby drugą rundę sieciową po dane, które ekran i tak pobiera razem.
 *
 * **Uwierzytelniona, choć nie oddaje danych osobowych.** Nie ma powodu wystawiać składu bazy
 * anonimowo, a jednolita reguła („każda trasa danych wymaga tożsamości") jest tańsza w utrzymaniu
 * niż wyjątek, o którym trzeba pamiętać.
 */

/**
 * `private, max-age` zamiast `no-store` — świadome odstępstwo od `profile+api.ts`
 * i `preferences+api.ts`.
 *
 * Tamte trasy oddają dane użytkownika, których nie wolno zostawić w cache na współdzielonej
 * maszynie. Tutaj wraca słownik: te same 35 składników dla każdego konta, zmieniany wyłącznie
 * skryptem seedującym. `no-store` kazałby pobierać go przy każdym wejściu w zakładkę bez żadnego
 * zysku. `private` trzyma odpowiedź poza cache pośredników, a pięć minut to tyle, ile wolno się
 * mylić po zasianiu nowego składnika.
 */
function catalogJson(body: CatalogResponse): Response {
  return Response.json(body, { headers: { 'Cache-Control': 'private, max-age=300' } });
}

function internalError(error: unknown): Response {
  console.error('[api/catalog] zapytanie do D1 nie powiodło się:', error);

  return Response.json({ error: 'internal' }, { status: 500 });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await requireUserId(request);
    if (auth instanceof Response) {
      return auth;
    }

    return catalogJson(await listCatalog());
  } catch (error) {
    return internalError(error);
  }
}
