/**
 * Jedyne miejsce z SQL-em do tabel `plan` i `plan_item`. Reguła warstwy — `userId` pierwszym
 * argumentem każdej funkcji dotykającej danych użytkownika i filtr po nim w SQL-u, bo D1 nie ma
 * RLS — jest opisana raz, w nagłówku `app-users.ts`; tutaj obowiązuje bez zmian.
 *
 * **MAKRA LICZY `src/lib/dish-macros.ts`, NIGDY ZAPYTANIE.** Żadna funkcja w tym pliku nie robi
 * `SUM()` po kaloriach. Kopia arytmetyki w SQL-u rozjechałaby się z generatorem przy pierwszej
 * korekcie gramatury, a guardrail ±10% liczy się z tego, co zastał — czyli sprawdzałby liczbę,
 * której ekran nigdy nie pokaże. Ten sam wzorzec ma `scripts/check-pool-feasibility.mjs`
 * i dlatego jego raport zgadza się z tym, co widzi użytkownik.
 *
 * **Odsiew wykluczeń jest PRZENIESIONY, nie przepisany.** Trzy warunki `NOT EXISTS` w
 * `POOL_FOR_GENERATOR_SQL` to te same trzy warunki, co w `listAllowedDishes`
 * (`preferences.ts`), przełożone na `case when` — bo generator potrzebuje flagi przy daniu,
 * a nie listy po odsiewie. Napisanie ich drugi raz w innym kształcie byłoby drugim mechanizmem
 * wykluczeń, czyli dokładnie tym, przed czym broni PRD i decyzja D21.
 */
import { computeDishMacros, type Macros } from '@/lib/dish-macros';
import type { MealSlot } from '@/lib/dish-validation';
import type { GeneratorDish, PlanDay } from '@/lib/plan-generator';
import { getWorkerEnv } from '@/server/env';

export interface PlanHeader {
  startDate: string;
  targetKcal: number;
  mealsPerDay: number;
  seed: string;
  createdAt: string;
}

export interface PlanRecipeIngredient {
  name: string;
  grams: number;
}

export interface PlanRecipeDish {
  id: number;
  name: string;
  prepMinutes: number;
  macros: Macros;
  ingredients: PlanRecipeIngredient[];
  steps: string[];
}

export interface PlanRecipeMeal {
  slotIndex: number;
  mealSlot: MealSlot;
  dish: PlanRecipeDish;
}

export interface PlanRecipeDay {
  dayIndex: number;
  totalKcal: number;
  meals: PlanRecipeMeal[];
}

interface PoolRow {
  dish_id: number;
  dish_name: string;
  prep_minutes: number;
  slots: string | null;
  passes_exclusions: number;
  ingredient_name: string | null;
  grams: number | null;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
}

interface PlanRow {
  start_date: string;
  target_kcal: number;
  meals_per_day: number;
  seed: string;
  created_at: string;
}

interface PlanIngredientRow {
  day_index: number;
  slot_index: number;
  meal_slot: string;
  dish_id: number;
  dish_name: string;
  prep_minutes: number;
  ingredient_name: string | null;
  grams: number | null;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
}

interface PlanStepRow {
  dish_id: number;
  position: number;
  text: string;
}

const PLAN_COLUMNS = 'start_date, target_kcal, meals_per_day, seed, created_at';

/**
 * CAŁA pula z porami, składnikami i flagą wykluczenia — JEDNYM zapytaniem.
 *
 * Trzy decyzje, każda z powodem:
 *
 * 1. **Zapytanie NIE stosuje limitu czasu przygotowania**, choć `listAllowedDishes` to robi.
 *    Diagnoza porażki generatora musi umieć odpowiedzieć „a ile dań wróciłoby po zdjęciu limitu?",
 *    więc potrzebuje dań ODRZUCONYCH przez limit. Odsiew czasowy robi moduł — tam jest darmowy.
 * 2. **Wykluczenia wchodzą jako FLAGA, nie jako filtr** — z tego samego powodu, plus jeden
 *    ważniejszy: gdyby pula wchodziła już odsiana, zbiór do diagnozy trzeba by pobrać drugim
 *    zapytaniem, na KAŻDYM żądaniu, także udanym. To jedyne miejsce w tym produkcie, gdzie limit
 *    10 ms CPU realnie grozi, a podwojony odczyt puli kosztowałby tam najwięcej.
 * 3. **Jeden wiersz na parę danie–składnik**, nie `GROUP_CONCAT` po składnikach. Pory sklejamy,
 *    bo to enum czterech wartości bez przecinków w środku; nazwy składników przecinki MAJĄ
 *    („pieczarki, świeże") i sklejanie ich rozsypałoby się przy pierwszym rozbiciu po separatorze.
 *    58 dań daje tu ~230 wierszy.
 *
 * `LEFT JOIN` przy składnikach jest celowy: danie bez składników to błąd danych, a nie powód,
 * żeby zniknęło z puli bez śladu — wejdzie z zerowymi makrami i odpadnie na guardrailu, zamiast
 * po cichu zmniejszyć pulę.
 */
const POOL_FOR_GENERATOR_SQL = `select
       d.id   as dish_id,
       d.name as dish_name,
       d.prep_minutes,
       (select group_concat(meal_slot) from dish_meal_slot where dish_id = d.id) as slots,
       case when
            not exists (
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
       then 1 else 0 end as passes_exclusions,
       i.name              as ingredient_name,
       di.grams            as grams,
       i.kcal_per_100g,
       i.protein_per_100g,
       i.carbs_per_100g,
       i.fat_per_100g
     from dish d
     left join dish_ingredient di on di.dish_id = d.id
     left join ingredient i on i.id = di.ingredient_id
     order by d.id`;

function toMacroItem(row: {
  grams: number | null;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
}) {
  return {
    grams: row.grams ?? 0,
    per100g: {
      kcal: row.kcal_per_100g ?? 0,
      protein: row.protein_per_100g ?? 0,
      carbs: row.carbs_per_100g ?? 0,
      fat: row.fat_per_100g ?? 0,
    },
  };
}

/**
 * Pula dla generatora. Zwraca dania z policzonymi kaloriami i flagą wykluczenia — odsiew czasowy
 * i wykluczeniowy robi `generatePlan`.
 */
export async function listPoolForGenerator(userId: string): Promise<GeneratorDish[]> {
  const { results } = await getWorkerEnv()
    .DB.prepare(POOL_FOR_GENERATOR_SQL)
    .bind(userId)
    .all<PoolRow>();

  const byDish = new Map<number, { row: PoolRow; items: ReturnType<typeof toMacroItem>[] }>();
  for (const row of results) {
    const entry = byDish.get(row.dish_id);
    if (entry) {
      if (row.ingredient_name !== null) {
        entry.items.push(toMacroItem(row));
      }
      continue;
    }
    byDish.set(row.dish_id, {
      row,
      items: row.ingredient_name !== null ? [toMacroItem(row)] : [],
    });
  }

  return [...byDish.values()].map(({ row, items }) => ({
    id: row.dish_id,
    name: row.dish_name,
    prepMinutes: row.prep_minutes,
    mealSlots: (row.slots ?? '').split(',').filter(Boolean) as MealSlot[],
    // Makra z modułu, nie z `SUM()` — patrz nagłówek pliku.
    kcal: computeDishMacros(items).kcal,
    passesExclusions: row.passes_exclusions === 1,
  }));
}

/** Nagłówek planu konta albo `null`, gdy planu jeszcze nie ma. Brak planu to STAN, nie błąd. */
export async function getPlan(userId: string): Promise<PlanHeader | null> {
  const row = await getWorkerEnv()
    .DB.prepare(`select ${PLAN_COLUMNS} from plan where user_id = ?1`)
    .bind(userId)
    .first<PlanRow>();

  if (!row) {
    return null;
  }

  return {
    startDate: row.start_date,
    targetKcal: row.target_kcal,
    mealsPerDay: row.meals_per_day,
    seed: row.seed,
    createdAt: row.created_at,
  };
}

/**
 * Plan z treścią przepisów — składniki z gramaturami, kroki w kolejności i komplet makr.
 *
 * **To pierwsza ścieżka odczytu `dish_step` w tym repo.** FR-009 wymaga dla każdego dania
 * składników, instrukcji i makr; do tej pory pula dań istniała wyłącznie po to, żeby generator
 * miał z czego wybierać, więc nikt jej treści nie czytał.
 *
 * Dwa zapytania, nie jedno: składniki i kroki mają różną krotność, więc jedno złączenie dałoby
 * iloczyn kartezjański (danie o 5 składnikach i 4 krokach → 20 wierszy zamiast 9) i trzeba by go
 * odsiewać w kodzie. Dwa zapytania są tańsze i czytelniejsze niż `DISTINCT` po iloczynie.
 */
export async function getPlanWithRecipes(userId: string): Promise<PlanRecipeDay[]> {
  const db = getWorkerEnv().DB;

  const [ingredients, steps] = await Promise.all([
    db
      .prepare(
        `select pi.day_index, pi.slot_index, pi.meal_slot,
                d.id as dish_id, d.name as dish_name, d.prep_minutes,
                i.name as ingredient_name, di.grams,
                i.kcal_per_100g, i.protein_per_100g, i.carbs_per_100g, i.fat_per_100g
           from plan_item pi
           join dish d on d.id = pi.dish_id
           left join dish_ingredient di on di.dish_id = d.id
           left join ingredient i on i.id = di.ingredient_id
          where pi.user_id = ?1
          order by pi.day_index, pi.slot_index, i.name`
      )
      .bind(userId)
      .all<PlanIngredientRow>(),
    db
      .prepare(
        `select distinct s.dish_id, s.position, s.text
           from plan_item pi
           join dish_step s on s.dish_id = pi.dish_id
          where pi.user_id = ?1
          order by s.dish_id, s.position`
      )
      .bind(userId)
      .all<PlanStepRow>(),
  ]);

  const stepsByDish = new Map<number, string[]>();
  for (const row of steps.results) {
    const existing = stepsByDish.get(row.dish_id);
    if (existing) {
      existing.push(row.text);
    } else {
      stepsByDish.set(row.dish_id, [row.text]);
    }
  }

  const days = new Map<number, Map<number, { meal: PlanRecipeMeal; items: ReturnType<typeof toMacroItem>[] }>>();
  for (const row of ingredients.results) {
    let day = days.get(row.day_index);
    if (!day) {
      day = new Map();
      days.set(row.day_index, day);
    }
    let slot = day.get(row.slot_index);
    if (!slot) {
      slot = {
        meal: {
          slotIndex: row.slot_index,
          mealSlot: row.meal_slot as MealSlot,
          dish: {
            id: row.dish_id,
            name: row.dish_name,
            prepMinutes: row.prep_minutes,
            macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
            ingredients: [],
            steps: stepsByDish.get(row.dish_id) ?? [],
          },
        },
        items: [],
      };
      day.set(row.slot_index, slot);
    }
    if (row.ingredient_name !== null) {
      slot.meal.dish.ingredients.push({ name: row.ingredient_name, grams: row.grams ?? 0 });
      slot.items.push(toMacroItem(row));
    }
  }

  return [...days.entries()]
    .sort(([left], [right]) => left - right)
    .map(([dayIndex, slots]) => {
      const meals = [...slots.values()]
        .sort((left, right) => left.meal.slotIndex - right.meal.slotIndex)
        .map(({ meal, items }) => {
          meal.dish.macros = computeDishMacros(items);
          return meal;
        });

      return {
        dayIndex,
        // Suma dnia liczona z makr policzonych przez moduł — nigdy `SUM()` w SQL-u.
        totalKcal: meals.reduce((sum, meal) => sum + meal.dish.macros.kcal, 0),
        meals,
      };
    });
}

/**
 * Zapisuje plan, ZASTĘPUJĄC poprzedni.
 *
 * Wszystko w jednym `batch()`, czyli w jednej transakcji D1. Bez tego nieudane wstawienie pozycji
 * zostawiłoby konto z nagłówkiem planu bez treści albo — gorzej — z połową tygodnia, czyli planem
 * CZĘŚCIOWYM. `CLAUDE.md` zakazuje go w generatorze; zakaz nie może kończyć się na granicy
 * modułu, skoro baza potrafi ten sam stan wytworzyć zapisem.
 *
 * Kasowanie idzie od strony zależnej (`plan_item`, potem `plan`), choć klucz obcy ma kaskadę —
 * jawna kolejność nie zależy od tego, czy D1 ma w danej chwili włączone klucze obce.
 */
export async function savePlan(
  userId: string,
  header: { startDate: string; targetKcal: number; mealsPerDay: number; seed: string },
  days: readonly PlanDay[]
): Promise<void> {
  const db = getWorkerEnv().DB;
  const nowIso = new Date().toISOString();

  const statements = [
    db.prepare(`delete from plan_item where user_id = ?1`).bind(userId),
    db.prepare(`delete from plan where user_id = ?1`).bind(userId),
    db
      .prepare(
        `insert into plan (user_id, start_date, target_kcal, meals_per_day, seed, created_at)
         values (?1, ?2, ?3, ?4, ?5, ?6)`
      )
      .bind(userId, header.startDate, header.targetKcal, header.mealsPerDay, header.seed, nowIso),
    ...days.flatMap((day) =>
      day.meals.map((meal) =>
        db
          .prepare(
            `insert into plan_item (user_id, day_index, slot_index, meal_slot, dish_id)
             values (?1, ?2, ?3, ?4, ?5)`
          )
          .bind(userId, day.dayIndex, meal.slotIndex, meal.mealSlot, meal.dishId)
      )
    ),
  ];

  await db.batch(statements);
}
