import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Odczyt z LOKALNEJ bazy D1 dla testów, które muszą sprawdzić STAN BAZY, a nie tylko odpowiedź
 * trasy.
 *
 * Istnieje, bo część kryteriów fazy 3 S-04 jest nie do udowodnienia przez HTTP. „Po odmowie
 * z 409 **żaden wiersz nie powstaje**" i „każdy z siedmiu dni mieści się w ±10%, sprawdzone
 * **odczytem z bazy**, nie odpowiedzią trasy" to asercje o bazie. Gdyby liczyć je z JSON-a
 * zwróconego przez tę samą trasę, którą testujemy, test dowodziłby, że trasa zgadza się sama
 * ze sobą — czyli dokładnie tautologii, przed którą ostrzega `context/foundation/lessons.md`.
 *
 * **TYLKO DO ODCZYTU.** Żaden test nie pisze do bazy z pominięciem API: dane powstają wyłącznie
 * tą drogą, którą chodzi użytkownik, inaczej testowalibyśmy stan, którego produkt nie potrafi
 * wytworzyć.
 *
 * Dwie pułapki, obie zmierzone i obie kosztowne, gdy się o nich zapomni:
 *
 * 1. **Zapytanie musi być JEDNĄ LINIĄ.** Znak nowej linii urywa polecenie powłoki, a objawem jest
 *    kod wyjścia 1 z PUSTYM `stderr` — wygląda jak awaria wranglera, jest łamaniem wiersza.
 *    `oneLine()` sprowadza je do jednej linii przed wysłaniem.
 * 2. **`npx` na Windowsie to plik `.cmd`**, którego Node odmawia uruchomić bez `shell: true`
 *    (EINVAL, skutek poprawki CVE-2024-27980). `execSync` używa powłoki z definicji, więc ten
 *    wariant jest tu bezpieczny — ale `spawnSync` bez `shell` już nie, i to jest ta sama pułapka,
 *    którą opisuje `context/foundation/lessons.md` przy bramkach.
 *
 * Wrangler poprzedza wynik własną diagnostyką, więc JSON parsujemy od pierwszego `[`. Ten sam
 * wzorzec ma `scripts/check-pool-feasibility.mjs` i stamtąd jest przeniesiony.
 */

/**
 * Katalog główny repozytorium, wyprowadzony z położenia TEGO pliku
 * (`<repo>/tests/e2e/support/d1.ts` → trzy poziomy w górę).
 *
 * Konieczny, bo harness Playwrighta mieszka POZA repozytorium i jego katalogiem roboczym jest
 * `~/.mealplan-e2e` — a `wrangler d1 execute` szuka `wrangler.jsonc` w katalogu roboczym
 * i bez niego nie wie, o którą bazę chodzi. Objaw bez tego `cwd`: każde zapytanie kończy się
 * błędem, choć baza istnieje i jest zmigrowana.
 *
 * Ścieżka jest wyprowadzana, a nie wpisana na sztywno: testy w repo nie mogą znać ścieżek hosta
 * (ta sama zasada, dla której `playwright.config.ts` przekazuje `MEALPLAN_AUTH_STATE` zmienną
 * środowiskową zamiast wpisywać ją do testu).
 */
const RepoRoot = resolve(__dirname, '..', '..', '..');

function oneLine(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

export function queryD1<T = Record<string, unknown>>(sql: string): T[] {
  const command = `npx wrangler d1 execute mealplan --local --json --command "${oneLine(sql).replace(/"/g, '\\"')}"`;

  let stdout: string;
  try {
    stdout = execSync(command, {
      cwd: RepoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Zapytanie do lokalnej D1 nie powiodło się. Sprawdź, czy zapytanie jest JEDNĄ linią ` +
        `i czy baza istnieje (npx wrangler d1 migrations apply mealplan --local).\n${detail}`
    );
  }

  const start = stdout.indexOf('[');
  if (start === -1) {
    throw new Error(`Wrangler nie oddał JSON-a. Wyjście:\n${stdout}`);
  }

  const parsed = JSON.parse(stdout.slice(start)) as { results?: T[] }[];
  const results = parsed[0]?.results;
  if (results === undefined) {
    // NIE `?? []`. Puste wyjście znaczy „nie zmierzyłem", a nie „nic nie znalazłem" — a te testy
    // opierają najmocniejsze asercje guardraila na `toBe(0)`. Cicha pustka czytałaby się jako
    // DOWÓD ZGODNOŚCI. To ta sama klasa awarii, co `FAIL eslint (0.0s)` z `lessons.md`:
    // narzędzie, które się nie uruchomiło, nie ma prawa wyglądać jak narzędzie, które nic nie
    // znalazło.
    throw new Error(
      `Wrangler oddał JSON bez pola "results" — zapytanie się nie wykonało. Wyjście:
${stdout}`
    );
  }
  return results;
}

/**
 * Liczba wierszy pasujących do warunku — najczęstsze pytanie tych testów.
 *
 * Rzuca, gdy zapytanie nie oddało wiersza. Zapytanie zliczające ZAWSZE oddaje dokładnie jeden
 * wiersz, więc brak wiersza znaczy, że policzone nie zostało nic — i wtedy `0` byłoby kłamstwem
 * po stronie bezpiecznej dla testu, a niebezpiecznej dla produktu.
 */
export function countD1(sql: string): number {
  const rows = queryD1<{ n: number }>(sql);
  if (rows.length === 0 || typeof rows[0]?.n !== 'number') {
    throw new Error(
      `Zapytanie zliczające nie oddało liczby — helper nic nie policzył, to NIE jest zero.
${sql}`
    );
  }
  return rows[0].n;
}
