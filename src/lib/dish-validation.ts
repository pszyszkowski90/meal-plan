/**
 * Walidacja dania przed seedem — faza 2 F-01.
 *
 * Zadanie tego modułu jest podwójne: sprawdzić KSZTAŁT (to, co widać gołym okiem) oraz wyłapać
 * BŁĘDY MAKR, których człowiek przeglądający gramatury nie ma szans zobaczyć. Drugie jest
 * ważniejsze: przegląd gramatur przez człowieka jest w decyzji D14 jedyną bramką jakości treści,
 * a człowiek patrzący na „ryż 60 g" nie wykryje, że wiersz USDA pod spodem opisuje ryż UGOTOWANY
 * zamiast suchego. Różnica to ~180% kalorii — wielokrotność całego budżetu ±10%.
 *
 * Tu mieszka też zakres `prep_minutes` 5–120. Migracja `0003` świadomie NIE ma go w `CHECK`
 * (komentarz :18-21): SQLite nie ma `ALTER TABLE … DROP CONSTRAINT`, więc korekta progu
 * kosztowałaby przebudowę tabeli, a rozjazd wychodziłby użytkownikowi jako 500 zamiast błędu
 * pod polem. W bazie zostaje wyłącznie niezmiennik strukturalny `prep_minutes > 0`.
 *
 * Import rodzeństwa przez `./dish-macros.ts` z jawnym rozszerzeniem jest tym samym odstępstwem,
 * co w `calorie-target.test.ts` i z tego samego powodu: `npm test` to `node --test` z okrajaniem
 * typów, a Node w ESM nie zgaduje rozszerzeń ani nie zna aliasu `@/`. Alias złamałby `npm test`.
 */

import {
  atwaterDeviation,
  atwaterWithinTolerance,
  computeDishMacros,
  type DishMacroItem,
  type Macros,
} from './dish-macros.ts';

/** Pory posiłku — enum zgodny z `CHECK` na `dish_meal_slot` w migracji `0003`. */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MealSlots: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * Granice sit energetycznych. Jedno źródło prawdy — komunikaty błędów interpolują te wartości,
 * żeby treść i próg nie mogły się rozjechać (ta sama zasada, co `ProfileBounds`).
 */
export const DishBounds = {
  prepMinutes: { min: 5, max: 120 },
  /** Na PORCJĘ. Konwencja `0003`: każdy przepis jest na jedną porcję. */
  portionKcal: { min: 150, max: 1500 },
  /** kcal na gram gotowego dania. Czysty tłuszcz ≈ 9, warzywa ≈ 0,2. */
  energyDensity: { min: 0.3, max: 5 },
  /** Dopuszczalne odchylenie od energii Atwatera, jako ułamek. */
  atwaterTolerance: 0.1,
  /**
   * Próg BEZWZGLĘDNY dla tego samego sita, w kcal na 100 g. Bez niego warzywa bogate w błonnik
   * są odrzucane na prawdziwych liczbach USDA — uzasadnienie i pomiary w `dish-macros.ts`
   * przy `atwaterWithinTolerance`. Decyzja D20 z 13.09.2026.
   */
  atwaterFloorKcal: 12,
} as const;

/** Składnik znany bazie: nazwa z `ingredient.name` plus makra na 100 g. */
export interface KnownIngredient {
  name: string;
  per100g: Macros;
}

export interface DishIngredientInput {
  ingredientName: string;
  grams: number;
}

export interface DishInput {
  slug: string;
  name: string;
  prepMinutes: number;
  mealSlots: MealSlot[];
  ingredients: DishIngredientInput[];
  steps: string[];
}

/** Danie przyjęte do seeda: wejście plus policzone makra. */
export interface ValidatedDish extends DishInput {
  macros: Macros;
}

export type DishValidation =
  | { ok: true; value: ValidatedDish }
  | { ok: false; errors: string[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isMealSlot(value: unknown): value is MealSlot {
  return typeof value === 'string' && (MealSlots as readonly string[]).includes(value);
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/**
 * Orzeka, czy danie nadaje się do seeda.
 *
 * Błędy są AKUMULOWANE, nie zwracane przy pierwszym potknięciu: autor przepisu ma zobaczyć pełną
 * listę do poprawienia w jednym przebiegu, a nie odkrywać ją po jednym błędzie na uruchomienie
 * (kryterium 3.1 planu wymaga „pełnej listy błędów").
 */
export function validateDish(
  input: unknown,
  knownIngredients: readonly KnownIngredient[],
): DishValidation {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['Danie musi być obiektem.'] };
  }

  // --- kształt ---

  if (!isNonEmptyString(input.slug)) {
    errors.push('Danie musi mieć `slug` — to jego tożsamość, nie nazwa wyświetlana.');
  }

  if (!isNonEmptyString(input.name)) {
    errors.push('Danie musi mieć nazwę.');
  }

  if (!isFiniteNumber(input.prepMinutes) || !Number.isInteger(input.prepMinutes)) {
    errors.push('Czas przygotowania podaj w pełnych minutach.');
  } else if (
    input.prepMinutes < DishBounds.prepMinutes.min ||
    input.prepMinutes > DishBounds.prepMinutes.max
  ) {
    errors.push(
      `Czas przygotowania musi mieścić się w przedziale ` +
        `${DishBounds.prepMinutes.min}–${DishBounds.prepMinutes.max} minut.`,
    );
  }

  const mealSlots = Array.isArray(input.mealSlots) ? input.mealSlots : [];
  if (mealSlots.length === 0) {
    errors.push('Danie musi mieć co najmniej jedną porę posiłku.');
  }
  for (const slot of mealSlots) {
    if (!isMealSlot(slot)) {
      errors.push(`Nieznana pora posiłku: ${JSON.stringify(slot)}.`);
    }
  }

  const steps = Array.isArray(input.steps) ? input.steps : [];
  if (steps.length === 0) {
    errors.push('Danie musi mieć co najmniej jeden krok przygotowania (FR-016).');
  }
  for (const [index, step] of steps.entries()) {
    if (!isNonEmptyString(step)) {
      errors.push(`Krok ${index + 1} jest pusty.`);
    }
  }

  // --- składniki ---

  const byName = new Map(knownIngredients.map((ingredient) => [ingredient.name, ingredient]));
  const rawIngredients = Array.isArray(input.ingredients) ? input.ingredients : [];
  const items: DishMacroItem[] = [];

  if (rawIngredients.length === 0) {
    errors.push('Danie musi mieć co najmniej jeden składnik.');
  }

  for (const entry of rawIngredients) {
    if (!isObject(entry) || !isNonEmptyString(entry.ingredientName)) {
      errors.push('Każdy składnik musi wskazywać nazwę z tabeli `ingredient`.');
      continue;
    }

    const known = byName.get(entry.ingredientName);
    if (!known) {
      // Nazwa spoza bazy to najczęstszy błąd autora — i jedyny, którego nie da się naprawić
      // samym przeliczeniem, bo nie wiadomo, co człowiek miał na myśli.
      errors.push(`Nieznany składnik: „${entry.ingredientName}".`);
      continue;
    }

    if (!isFiniteNumber(entry.grams) || entry.grams <= 0) {
      errors.push(`Gramatura składnika „${entry.ingredientName}" musi być większa od zera.`);
      continue;
    }

    // Sito 1a — Atwater NA SKŁADNIKU. Wiersz USDA, który nie domyka się na współczynnikach,
    // jest prawie zawsze źle zmapowany; łapiemy go zanim rozejdzie się po wszystkich daniach.
    if (
      !atwaterWithinTolerance(
        known.per100g,
        DishBounds.atwaterTolerance,
        DishBounds.atwaterFloorKcal,
      )
    ) {
      errors.push(
        `Składnik „${known.name}" nie domyka się na współczynnikach Atwatera ` +
          `(odchylenie ${percent(atwaterDeviation(known.per100g))} przy dopuszczalnych ` +
          `${percent(DishBounds.atwaterTolerance)} albo ${DishBounds.atwaterFloorKcal} kcal) — ` +
          `wiersz USDA jest prawdopodobnie źle zmapowany.`,
      );
    }

    items.push({ per100g: known.per100g, grams: entry.grams });
  }

  // Sit energetycznych na daniu nie ma sensu liczyć, gdy któryś składnik odpadł — wynik byłby
  // policzony z niepełnej listy i wyprodukował drugi, mylący błąd.
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const macros = computeDishMacros(items);
  const totalGrams = items.reduce((sum, item) => sum + item.grams, 0);

  // Sito 1b — Atwater NA DANIU. Ten sam próg bezwzględny: danie złożone głównie z warzyw
  // dziedziczy ich nadwyżkę błonnikową i bez progu byłoby odrzucane tak samo jak składniki.
  if (!atwaterWithinTolerance(macros, DishBounds.atwaterTolerance, DishBounds.atwaterFloorKcal)) {
    errors.push(
      `Makra dania nie domykają się na współczynnikach Atwatera ` +
        `(odchylenie ${percent(atwaterDeviation(macros))}).`,
    );
  }

  // Sito 2 — próg na porcję. Sam próg górny łapie wyłącznie błąd ×1000; dolny łapie ×0,1
  // i składnik zmapowany na wodę.
  if (macros.kcal < DishBounds.portionKcal.min || macros.kcal > DishBounds.portionKcal.max) {
    errors.push(
      `Porcja ma ${macros.kcal} kcal, poza przedziałem ` +
        `${DishBounds.portionKcal.min}–${DishBounds.portionKcal.max} kcal.`,
    );
  }

  // Sito 3 — gęstość energetyczna.
  if (totalGrams > 0) {
    const density = macros.kcal / totalGrams;
    if (density < DishBounds.energyDensity.min || density > DishBounds.energyDensity.max) {
      errors.push(
        `Gęstość energetyczna ${density.toFixed(2)} kcal/g jest poza przedziałem ` +
          `${DishBounds.energyDensity.min}–${DishBounds.energyDensity.max} kcal/g.`,
      );
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      slug: input.slug as string,
      name: input.name as string,
      prepMinutes: input.prepMinutes as number,
      mealSlots: mealSlots as MealSlot[],
      ingredients: rawIngredients as DishIngredientInput[],
      steps: steps as string[],
      macros,
    },
  };
}
