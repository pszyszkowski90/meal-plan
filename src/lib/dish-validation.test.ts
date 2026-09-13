/**
 * Testy walidacji dania — faza 2 F-01.
 *
 * Każde sito ma własny test, bo każde łapie INNĄ klasę błędu i regres jednego z nich nie może
 * chować się za zielenią pozostałych.
 */

/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { Macros } from './dish-macros.ts';
import {
  DishBounds,
  validateDish,
  type DishInput,
  type KnownIngredient,
} from './dish-validation.ts';

const Oats: Macros = { kcal: 379, protein: 13.2, carbs: 67.7, fat: 6.5 };
const Milk2: Macros = { kcal: 50, protein: 3.3, carbs: 4.8, fat: 2 };
/** Oliwa z oliwek, USDA: 884 kcal | 0 B | 0 W | 100 T. Atwater = 900, odchylenie 1,8%. */
const OliveOil: Macros = { kcal: 884, protein: 0, carbs: 0, fat: 100 };
/** Syntetyczny bulion: 4×1 + 4×4 = 20 — domyka się dokładnie, ale jest bardzo rzadki. */
const Broth: Macros = { kcal: 20, protein: 1, carbs: 4, fat: 0 };

const KnownIngredients: KnownIngredient[] = [
  { name: 'płatki owsiane, suche', per100g: Oats },
  { name: 'mleko 2%, płynne', per100g: Milk2 },
  { name: 'oliwa z oliwek', per100g: OliveOil },
  { name: 'bulion warzywny', per100g: Broth },
];

/** Danie odniesienia — to samo, na którym stoi wyrocznia w `dish-macros.test.ts`. */
function oatmeal(overrides: Partial<DishInput> = {}): DishInput {
  return {
    slug: 'owsianka-na-mleku',
    name: 'Owsianka na mleku',
    prepMinutes: 10,
    mealSlots: ['breakfast'],
    ingredients: [
      { ingredientName: 'płatki owsiane, suche', grams: 60 },
      { ingredientName: 'mleko 2%, płynne', grams: 200 },
    ],
    steps: ['Zagotuj mleko.', 'Wsyp płatki i gotuj 5 minut.'],
    ...overrides,
  };
}

/** Wyciąga błędy albo wywraca test — żeby asercje niżej nie musiały zawężać typu. */
function expectRejected(input: unknown): string[] {
  const result = validateDish(input, KnownIngredients);
  assert.equal(result.ok, false, 'danie miało zostać odrzucone, a przeszło');
  return result.ok ? [] : result.errors;
}

function expectAccepted(input: unknown) {
  const result = validateDish(input, KnownIngredients);
  assert.equal(
    result.ok,
    true,
    `danie miało przejść, a odrzucono je: ${result.ok ? '' : result.errors.join(' | ')}`,
  );
  assert.ok(result.ok);
  return result.value;
}

describe('validateDish — danie poprawne', () => {
  test('owsianka przechodzi i dostaje policzone makra', () => {
    const value = expectAccepted(oatmeal());

    // Ta sama wyrocznia, co w teście modułu makr — policzona ręcznie z USDA.
    assert.deepEqual(value.macros, { kcal: 327, protein: 14.5, carbs: 50.2, fat: 7.9 });
  });

  test('granice czasu przygotowania są włączne', () => {
    expectAccepted(oatmeal({ prepMinutes: DishBounds.prepMinutes.min }));
    expectAccepted(oatmeal({ prepMinutes: DishBounds.prepMinutes.max }));
  });
});

describe('validateDish — kształt', () => {
  test('wejście, które nie jest obiektem', () => {
    assert.deepEqual(expectRejected(null).length, 1);
    assert.deepEqual(expectRejected([]).length, 1);
    assert.deepEqual(expectRejected('owsianka').length, 1);
  });

  test('nieznany składnik', () => {
    const errors = expectRejected(
      oatmeal({ ingredients: [{ ingredientName: 'kasza gryczana', grams: 60 }] }),
    );
    assert.ok(errors.some((e) => e.includes('Nieznany składnik')));
  });

  test('gramatura 0 i ujemna', () => {
    for (const grams of [0, -60]) {
      const errors = expectRejected(
        oatmeal({ ingredients: [{ ingredientName: 'płatki owsiane, suche', grams }] }),
      );
      assert.ok(errors.some((e) => e.includes('większa od zera')));
    }
  });

  test('zero składników', () => {
    const errors = expectRejected(oatmeal({ ingredients: [] }));
    assert.ok(errors.some((e) => e.includes('co najmniej jeden składnik')));
  });

  test('zero kroków', () => {
    const errors = expectRejected(oatmeal({ steps: [] }));
    assert.ok(errors.some((e) => e.includes('co najmniej jeden krok')));
  });

  test('krok pusty', () => {
    const errors = expectRejected(oatmeal({ steps: ['Zagotuj mleko.', '   '] }));
    assert.ok(errors.some((e) => e.includes('Krok 2')));
  });

  test('zła pora posiłku i brak pory', () => {
    const bad = expectRejected(oatmeal({ mealSlots: ['brunch'] as never }));
    assert.ok(bad.some((e) => e.includes('Nieznana pora posiłku')));

    const none = expectRejected(oatmeal({ mealSlots: [] }));
    assert.ok(none.some((e) => e.includes('co najmniej jedną porę')));
  });

  test('czas przygotowania poza zakresem 5–120', () => {
    for (const prepMinutes of [DishBounds.prepMinutes.min - 1, DishBounds.prepMinutes.max + 1]) {
      const errors = expectRejected(oatmeal({ prepMinutes }));
      assert.ok(errors.some((e) => e.includes('Czas przygotowania')));
    }
  });

  test('czas przygotowania niecałkowity', () => {
    const errors = expectRejected(oatmeal({ prepMinutes: 10.5 }));
    assert.ok(errors.some((e) => e.includes('pełnych minutach')));
  });

  test('brak `slug` i brak nazwy', () => {
    const errors = expectRejected(oatmeal({ slug: '', name: '' }));
    assert.equal(errors.length, 2);
  });

  test('błędy są akumulowane, nie zwracane po pierwszym', () => {
    const errors = expectRejected(oatmeal({ slug: '', steps: [], mealSlots: [] }));
    assert.ok(errors.length >= 3, `spodziewano się wielu błędów, dostano: ${errors.join(' | ')}`);
  });
});

describe('validateDish — sito 1: niezmiennik Atwatera', () => {
  test('składnik z rozjechanym wierszem USDA jest odrzucany', () => {
    // Ryż UGOTOWANY (130 kcal) podpięty pod nazwę ryżu suchego — klasyczny błąd mapowania,
    // którego przegląd gramatur przez człowieka nie wychwyci. Makra zostają „suche".
    const misMapped: KnownIngredient[] = [
      { name: 'ryż biały, suchy', per100g: { kcal: 130, protein: 7.1, carbs: 79.9, fat: 0.7 } },
    ];

    const result = validateDish(
      oatmeal({ ingredients: [{ ingredientName: 'ryż biały, suchy', grams: 80 }] }),
      misMapped,
    );

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((e) => e.includes('Atwater')));
  });

  test('składnik zmapowany na wodę wychodzi jako naruszenie', () => {
    const asWater: KnownIngredient[] = [
      { name: 'płatki owsiane, suche', per100g: { kcal: 0, protein: 13.2, carbs: 67.7, fat: 6.5 } },
    ];

    const result = validateDish(
      oatmeal({ ingredients: [{ ingredientName: 'płatki owsiane, suche', grams: 60 }] }),
      asWater,
    );

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((e) => e.includes('Atwater')));
  });
});

describe('validateDish — sito 2: próg kaloryczny na porcję', () => {
  test('porcja zbyt uboga', () => {
    // 300 g bulionu to 60 kcal — poniżej progu 150.
    const errors = expectRejected(
      oatmeal({ ingredients: [{ ingredientName: 'bulion warzywny', grams: 300 }] }),
    );
    assert.ok(errors.some((e) => e.includes('kcal, poza przedziałem')));
  });

  test('błąd ×1000 w gramaturze wychodzi jako porcja ponad górnym progiem', () => {
    const errors = expectRejected(
      oatmeal({ ingredients: [{ ingredientName: 'płatki owsiane, suche', grams: 60000 }] }),
    );
    assert.ok(errors.some((e) => e.includes('kcal, poza przedziałem')));
  });
});

describe('validateDish — sito 3: gęstość energetyczna', () => {
  test('danie z samego tłuszczu przekracza górną granicę gęstości', () => {
    // 100 g oliwy: 884 kcal przy 100 g → 8,84 kcal/g, czyli powyżej 5,0.
    const errors = expectRejected(
      oatmeal({ ingredients: [{ ingredientName: 'oliwa z oliwek', grams: 100 }] }),
    );
    assert.ok(errors.some((e) => e.includes('Gęstość energetyczna')));
  });

  test('danie wodniste spada poniżej dolnej granicy gęstości', () => {
    // 1000 g bulionu: 200 kcal przy 1000 g → 0,2 kcal/g, czyli poniżej 0,3.
    // Próg kaloryczny (200 kcal) jest spełniony, więc test izoluje SITO 3.
    const errors = expectRejected(
      oatmeal({ ingredients: [{ ingredientName: 'bulion warzywny', grams: 1000 }] }),
    );
    assert.ok(errors.some((e) => e.includes('Gęstość energetyczna')));
    assert.ok(!errors.some((e) => e.includes('kcal, poza przedziałem')));
  });
});

describe('ZNANE OGRANICZENIE — sito Atwatera odrzuca warzywa bogate w błonnik', () => {
  /**
   * To NIE jest test pożądanego zachowania. Przypina zachowanie **obecne**, żeby ograniczenie
   * było widoczne, zanim zacznie się seedowanie puli (faza 3), a nie odkryte w jej trakcie.
   *
   * USDA liczy kalorie wielu warzyw **swoimi** współczynnikami, z odjęciem błonnika. Ogólne
   * współczynniki Atwatera (4/4/9) zawyżają wtedy energię o ~20%, bo traktują cały błonnik jak
   * przyswajalne węglowodany. Przy tolerancji ±10% na poziomie składnika oznacza to odrzucenie
   * produktów, które są całkowicie poprawne.
   *
   * Liczby z USDA, brokuł surowy: 34 kcal | 2,82 B | 6,64 W | 0,37 T.
   * Atwater = 4×2,82 + 4×6,64 + 9×0,37 = 11,28 + 26,56 + 3,33 = 41,17.
   * Odchylenie = |34 − 41,17| / 34 ≈ 21% — ponad dwukrotność tolerancji.
   *
   * Do rozstrzygnięcia przez właściciela przed fazą 3 (patrz Dziennik, wpis A3).
   */
  test('brokuł z prawdziwymi liczbami USDA nie przechodzi sita składnikowego', () => {
    const broccoli: KnownIngredient[] = [
      { name: 'brokuł, surowy', per100g: { kcal: 34, protein: 2.82, carbs: 6.64, fat: 0.37 } },
    ];

    const result = validateDish(
      oatmeal({ ingredients: [{ ingredientName: 'brokuł, surowy', grams: 200 }] }),
      broccoli,
    );

    assert.equal(result.ok, false, 'jeśli to przeszło, ograniczenie zostało naprawione — zaktualizuj test');
    assert.ok(!result.ok && result.errors.some((e) => e.includes('Atwater')));
  });
});
