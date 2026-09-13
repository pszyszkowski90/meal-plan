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

describe('sito Atwatera — warzywa bogate w błonnik przechodzą, błędy mapowania nie', () => {
  /**
   * Decyzja D20 (13.09.2026). Wcześniej ten blok nazywał się „ZNANE OGRANICZENIE" i przypinał
   * zachowanie, w którym brokuł z PRAWDZIWYMI liczbami USDA był ODRZUCANY.
   *
   * Przyczyna: sama tolerancja względna załamuje się blisko zera. Ogólne współczynniki (4/4/9)
   * liczą cały błonnik jak węglowodany przyswajalne, a USDA odejmuje go własnymi współczynnikami.
   * Zmierzone odchylenia: brokuł 21%, ogórek 21%, szpinak 28%, pieczarka 29% — przy nadwyżce
   * rzędu 3–7 kcal, czyli w kilokaloriach żadnej.
   *
   * Lekarstwem jest próg BEZWZGLĘDNY obok względnego, nie podniesienie procentu.
   */
  const vegetables: KnownIngredient[] = [
    { name: 'brokuł, surowy', per100g: { kcal: 34, protein: 2.82, carbs: 6.64, fat: 0.37 } },
    { name: 'szpinak, surowy', per100g: { kcal: 23, protein: 2.86, carbs: 3.63, fat: 0.39 } },
    { name: 'pieczarki, świeże', per100g: { kcal: 22, protein: 3.09, carbs: 3.26, fat: 0.34 } },
    { name: 'ogórek, surowy', per100g: { kcal: 15, protein: 0.65, carbs: 3.63, fat: 0.11 } },
  ];

  for (const vegetable of vegetables) {
    test(`${vegetable.name} przechodzi sito składnikowe`, () => {
      // Dobrana gramatura tak, żeby danie mieściło się w progu kalorycznym i gęstości —
      // testujemy sito Atwatera, nie pozostałe dwa.
      const result = validateDish(
        oatmeal({
          ingredients: [
            { ingredientName: vegetable.name, grams: 200 },
            { ingredientName: 'oliwa z oliwek', grams: 20 },
            { ingredientName: 'płatki owsiane, suche', grams: 40 },
          ],
        }),
        [...KnownIngredients, vegetable],
      );

      assert.equal(
        result.ok,
        true,
        `odrzucono: ${result.ok ? '' : result.errors.join(' | ')}`,
      );
    });
  }

  test('próg bezwzględny NIE przepuszcza błędu mapowania — ryż ugotowany pod nazwą suchego', () => {
    // Różnica 224 kcal, o rząd wielkości powyżej progu 12 kcal.
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

  test('próg bezwzględny NIE przepuszcza błędu x10 na produkcie niskokalorycznym', () => {
    // 20 kcal zadeklarowane wobec 186 z makr — różnica 166 kcal.
    const inflated: KnownIngredient[] = [
      { name: 'sos niskokaloryczny', per100g: { kcal: 20, protein: 12, carbs: 30, fat: 2 } },
    ];

    const result = validateDish(
      oatmeal({ ingredients: [{ ingredientName: 'sos niskokaloryczny', grams: 100 }] }),
      inflated,
    );

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((e) => e.includes('Atwater')));
  });

  test('zero kcal przy niezerowych makrach zostaje ostre — próg bezwzględny tu NIE działa', () => {
    // Składnik podpięty pod „wodę". Gdyby próg 12 kcal obowiązywał, produkt o makrach
    // dających <= 12 kcal przeszedłby jako bezkaloryczny.
    const asWater: KnownIngredient[] = [
      { name: 'przyprawa, zmapowana na wodę', per100g: { kcal: 0, protein: 0.5, carbs: 2, fat: 0 } },
    ];

    const result = validateDish(
      oatmeal({ ingredients: [{ ingredientName: 'przyprawa, zmapowana na wodę', grams: 100 }] }),
      asWater,
    );

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((e) => e.includes('Atwater')));
  });
});
