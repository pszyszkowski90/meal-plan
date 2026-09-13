/**
 * Jedyne miejsce z SQL-em do tabel `user_preferences`, `exclusion`, `exclusion_group`
 * i `ingredient_group`. Reguła warstwy — `userId` pierwszym argumentem każdej funkcji dotykającej
 * danych użytkownika i filtr po nim w SQL-u, bo D1 nie ma RLS — jest opisana raz, w nagłówku
 * `app-users.ts`; tutaj obowiązuje bez zmian i bez powtórzenia.
 *
 * Kształty (`PreferencesInput`, `ExclusionInput`, `Exclusion`) przychodzą z `src/lib/preferences.ts`
 * i nie są tu redefiniowane: ta sama definicja waliduje ciało `PUT`, opisuje wiersz w bazie
 * i zasila ekran.
 *
 * **`exclusion_group` i `ingredient_group` NIE mają `user_id` i to jest celowe** — to słownik
 * i przypisanie, dane współdzielone jak pula dań, a nie druga lista wykluczeń. Funkcje, które je
 * czytają, przyjmują więc `userId` tylko wtedy, gdy naprawdę filtrują po użytkowniku; reguła
 * warstwy mówi o DANYCH UŻYTKOWNIKA, a nie o każdym zapytaniu.
 */
import type {
  Exclusion,
  ExclusionGroupOption,
  ExclusionInput,
  ExclusionKind,
  ExclusionSource,
  IngredientOption,
  MealsPerDay,
  PreferencesInput,
} from '@/lib/preferences';
import { getWorkerEnv } from '@/server/env';

export interface UserPreferences extends PreferencesInput {
  createdAt: string;
  updatedAt: string;
}

interface UserPreferencesRow {
  max_prep_minutes: number;
  meals_per_day: number;
  created_at: string;
  updated_at: string;
}

interface ExclusionRow {
  id: number;
  kind: string;
  ingredient_id: number | null;
  dish_id: number | null;
  group_id: number | null;
  source: string;
  created_at: string;
}

export interface AllowedDish {
  id: number;
  slug: string;
  name: string;
  prepMinutes: number;
}

interface AllowedDishRow {
  id: number;
  slug: string;
  name: string;
  prep_minutes: number;
}

/**
 * Wolno interpolować WYŁĄCZNIE identyfikatory ze stałych tego modułu, nigdy wartości — te wchodzą
 * przez `bind(...)` bez wyjątku. Reguła spisana w nagłówku `user-profile.ts`.
 */
const PREFERENCES_COLUMNS = `max_prep_minutes, meals_per_day, created_at, updated_at`;

const EXCLUSION_COLUMNS = `id, kind, ingredient_id, dish_id, group_id, source, created_at`;

/**
 * Rzutowania na `MealsPerDay`, `ExclusionKind` i `ExclusionSource` są bezpieczne dzięki
 * ograniczeniom `CHECK` z migracji `0005`: do tabel nie wejdzie ani inna liczba posiłków, ani
 * nieznany rodzaj wpisu, ani nieznane źródło.
 */
function toPreferences(row: UserPreferencesRow): UserPreferences {
  return {
    maxPrepMinutes: row.max_prep_minutes,
    mealsPerDay: row.meals_per_day as MealsPerDay,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toExclusion(row: ExclusionRow): Exclusion {
  return {
    id: row.id,
    kind: row.kind as ExclusionKind,
    ingredientId: row.ingredient_id,
    dishId: row.dish_id,
    groupId: row.group_id,
    source: row.source as ExclusionSource,
    createdAt: row.created_at,
  };
}

export async function getPreferences(userId: string): Promise<UserPreferences | null> {
  const row = await getWorkerEnv()
    .DB.prepare(`select ${PREFERENCES_COLUMNS} from user_preferences where user_id = ?1`)
    .bind(userId)
    .first<UserPreferencesRow>();

  return row ? toPreferences(row) : null;
}

/**
 * Wykluczenia jednego konta — WSZYSTKIE, niezależnie od `source`.
 *
 * Ekran preferencji pokazuje JEDNĄ listę, także wpisy, które przyjdą z oznaczania dań w planie
 * (FR-011, S-05). Filtrowanie po `source` przy odczycie zrobiłoby z jednego mechanizmu dwa —
 * dokładnie to, czego zakazuje PRD.
 */
export async function listExclusions(userId: string): Promise<Exclusion[]> {
  const { results } = await getWorkerEnv()
    .DB.prepare(
      `select ${EXCLUSION_COLUMNS} from exclusion where user_id = ?1 order by created_at, id`
    )
    .bind(userId)
    .all<ExclusionRow>();

  return results.map(toExclusion);
}

export async function savePreferences(
  userId: string,
  input: PreferencesInput
): Promise<UserPreferences> {
  const nowIso = new Date().toISOString();

  const row = await getWorkerEnv()
    .DB.prepare(
      `insert into user_preferences (user_id, max_prep_minutes, meals_per_day, created_at, updated_at)
       values (?1, ?2, ?3, ?4, ?4)
       on conflict(user_id) do update set
         max_prep_minutes = ?2,
         meals_per_day = ?3,
         updated_at = ?4
       returning ${PREFERENCES_COLUMNS}`
    )
    .bind(userId, input.maxPrepMinutes, input.mealsPerDay, nowIso)
    .first<UserPreferencesRow>();

  if (!row) {
    throw new Error('Zapis preferencji nie oddał wiersza — nieoczekiwany stan D1.');
  }

  return toPreferences(row);
}

/**
 * Doprowadza listę wykluczeń konta do stanu `entries` — to jest Create i Delete tej zmiany.
 *
 * **Rusza WYŁĄCZNIE wpisy z `source = 'preferences'`.** Wpisy oznaczone przy planie (`'plan'`,
 * FR-011) należą do innego ekranu i zniknęłyby po cichu przy pierwszym zapisie preferencji —
 * cicha utrata danych użytkownika, najgorszy rodzaj usterki, bo nikt jej nie zgłasza. To NIE jest
 * złamanie zasady „`source` nie wpływa na dobór dań": tu rozstrzyga o WŁASNOŚCI wiersza, a nie
 * o odsiewie; `listAllowedDishes` tej kolumny nadal nie czyta.
 *
 * `INSERT OR IGNORE` opiera się na `idx_exclusion_unique`, więc wyścig dwóch kart nie tworzy
 * duplikatu nawet wtedy, gdy obie przejdą walidację.
 *
 * Kasowanie idzie PRZED wstawianiem i obejmuje wszystko, czego nie ma w nadesłanej liście —
 * `NOT IN` po kluczu złożonym byłoby nieczytelne, więc kasujemy komplet wpisów `preferences`
 * i wstawiamy nadesłane. Koszt to kilka zapisów więcej przy zapisie formularza; zysk to brak
 * osobnej ścieżki „co usunąć", która musiałaby powtórzyć logikę tożsamości wpisu.
 */
export async function replaceExclusions(
  userId: string,
  entries: ExclusionInput[]
): Promise<Exclusion[]> {
  const db = getWorkerEnv().DB;
  const nowIso = new Date().toISOString();

  const statements = [
    db.prepare(`delete from exclusion where user_id = ?1 and source = 'preferences'`).bind(userId),
    ...entries.map((entry) =>
      db
        .prepare(
          `insert or ignore into exclusion (user_id, kind, ingredient_id, dish_id, group_id, source, created_at)
           values (?1, ?2, ?3, ?4, ?5, 'preferences', ?6)`
        )
        .bind(userId, entry.kind, entry.ingredientId, entry.dishId, entry.groupId, nowIso)
    ),
  ];

  // `batch` jest jedną transakcją D1 — bez tego nieudane wstawienie zostawiłoby konto z pustą
  // listą wykluczeń, czyli bez guardraila, o którym użytkownik nie wie, że zniknął.
  await db.batch(statements);

  return listExclusions(userId);
}

/**
 * Dania, które wolno podać temu użytkownikowi — odsiew wykluczeń WSZYSTKICH TRZECH rodzajów
 * i limitu czasu przygotowania.
 *
 * **To jedyna funkcja tej zmiany, którą przejmie generator planu (S-04).** Powstaje teraz, żeby
 * model wykluczeń był dowiedziony, ZANIM coś na nim stanie.
 *
 * Trzy rzeczy, które czynią ten odsiew poprawnym, a każda z nich była osobnym błędem do popełnienia:
 *
 * 1. **Złączenie po `ingredient_id`, nigdy po nazwie.** Danie „risotto z borowikami" nie musi
 *    wymieniać wykluczonego składnika w nazwie — i odwrotnie, nazwa może wymieniać składnik,
 *    którego w składzie nie ma.
 * 2. **Wykluczenie grupowe rozwija się PRZY ZAPYTANIU, nie przy zapisie.** Gdyby ekran zapisywał
 *    listę składników należących w danej chwili do grupy, składnik dodany do puli później nie
 *    zostałby objęty wykluczeniem i nikt by się o tym nie dowiedział (odrzucone przy decyzji D21).
 * 3. **Brak wiersza preferencji NIE jest limitem zero minut.** `COALESCE` cofa warunek do
 *    `prep_minutes <= prep_minutes`, czyli przepuszcza wszystko — konto bez zapisanych preferencji
 *    dostaje pełną pulę, a nie pustą listę wyglądającą jak awaria puli.
 */
const ALLOWED_DISHES_SQL = `select d.id, d.slug, d.name, d.prep_minutes
     from dish d
     where d.prep_minutes <= coalesce(
             (select max_prep_minutes from user_preferences where user_id = ?1),
             d.prep_minutes
           )
       and not exists (
             select 1 from exclusion e
             where e.user_id = ?1 and e.kind = 'dish' and e.dish_id = d.id
           )
       and not exists (
             select 1
             from dish_ingredient di
             join exclusion e
               on e.user_id = ?1 and e.kind = 'ingredient' and e.ingredient_id = di.ingredient_id
             where di.dish_id = d.id
           )
       and not exists (
             select 1
             from dish_ingredient di
             join ingredient_group ig on ig.ingredient_id = di.ingredient_id
             join exclusion e
               on e.user_id = ?1 and e.kind = 'group' and e.group_id = ig.group_id
             where di.dish_id = d.id
           )
     order by d.name`;

export async function listAllowedDishes(userId: string): Promise<AllowedDish[]> {
  const { results } = await getWorkerEnv()
    .DB.prepare(ALLOWED_DISHES_SQL)
    .bind(userId)
    .all<AllowedDishRow>();

  return results.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    prepMinutes: row.prep_minutes,
  }));
}

/**
 * Pula, z której ekran preferencji pozwala wybierać — składniki i grupy.
 *
 * **Bez `userId` i to jest celowe.** Obie tabele są danymi WSPÓŁDZIELONYMI, jak pula dań w `0003`:
 * nie należą do żadnego konta, wypełnia je skrypt seedujący, a czytają wszyscy. Reguła warstwy
 * mówi o danych użytkownika; tu nie ma czego filtrować, a udawany parametr `userId` sugerowałby
 * izolację, której nie ma.
 *
 * Sortowanie po nazwie, a nie po `id`: kolejność wstawiania przez seed nie jest kolejnością,
 * w której człowiek szuka składnika.
 */
export async function listCatalog(): Promise<{
  ingredients: IngredientOption[];
  groups: ExclusionGroupOption[];
}> {
  const db = getWorkerEnv().DB;

  const [ingredients, groups] = await Promise.all([
    db
      .prepare(`select id, name, category from ingredient order by name`)
      .all<{ id: number; name: string; category: string }>(),
    db
      .prepare(`select id, slug, name from exclusion_group order by name`)
      .all<{ id: number; slug: string; name: string }>(),
  ]);

  return { ingredients: ingredients.results, groups: groups.results };
}
