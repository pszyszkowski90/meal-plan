/**
 * Testy modułu makr — faza 2 F-01.
 *
 * Import z jawnym rozszerzeniem `./dish-macros.ts` jest sankcjonowanym odstępstwem od reguły
 * „zero względnych importów": `npm test` to `node --test` z okrajaniem typów, a Node w ESM nie
 * zgaduje rozszerzeń ani nie zna aliasu `@/`. Tak samo robi `calorie-target.test.ts`.
 */

/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  atwaterDeviation,
  atwaterKcal,
  computeDishMacros,
  type Macros,
} from './dish-macros.ts';

/**
 * WYROCZNIA — policzona ręcznie z tabeli USDA, nigdy odczytana z implementacji.
 *
 * Danie: owsianka na mleku — 60 g płatków owsianych (suchych) + 200 g mleka 2%.
 *
 * Wartości USDA na 100 g:
 *   płatki owsiane, suche : 379 kcal | 13,2 B | 67,7 W | 6,5 T
 *   mleko 2%              :  50 kcal |  3,3 B |  4,8 W | 2,0 T
 *
 * Rachunek (udział = gramatura / 100):
 *   kcal    : 379 × 0,60 = 227,4  +  50 × 2,00 = 100,0  →  327,4  → 327
 *   białko  : 13,2 × 0,60 =  7,92 + 3,3 × 2,00 =   6,60 →   14,52 →  14,5
 *   węgle   : 67,7 × 0,60 = 40,62 + 4,8 × 2,00 =   9,60 →   50,22 →  50,2
 *   tłuszcz :  6,5 × 0,60 =  3,90 + 2,0 × 2,00 =   4,00 →    7,90 →   7,9
 */
const Oats: Macros = { kcal: 379, protein: 13.2, carbs: 67.7, fat: 6.5 };
const Milk2: Macros = { kcal: 50, protein: 3.3, carbs: 4.8, fat: 2 };

const OatmealOracle: Macros = { kcal: 327, protein: 14.5, carbs: 50.2, fat: 7.9 };

describe('computeDishMacros — wyrocznia z tabeli USDA', () => {
  test('owsianka na mleku: 60 g płatków + 200 g mleka', () => {
    const result = computeDishMacros([
      { per100g: Oats, grams: 60 },
      { per100g: Milk2, grams: 200 },
    ]);

    assert.deepEqual(result, OatmealOracle);
  });

  test('kolejność składników nie zmienia wyniku', () => {
    const reversed = computeDishMacros([
      { per100g: Milk2, grams: 200 },
      { per100g: Oats, grams: 60 },
    ]);

    assert.deepEqual(reversed, OatmealOracle);
  });
});

describe('computeDishMacros — przypadki brzegowe', () => {
  test('pusta lista daje same zera, a nie NaN', () => {
    assert.deepEqual(computeDishMacros([]), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  test('składnik o gramaturze 0 nie wnosi nic', () => {
    const withZero = computeDishMacros([
      { per100g: Oats, grams: 60 },
      { per100g: Milk2, grams: 200 },
      { per100g: Milk2, grams: 0 },
    ]);

    assert.deepEqual(withZero, OatmealOracle);
  });

  test('pojedynczy składnik w gramaturze 100 g oddaje tabelę bez zmian', () => {
    assert.deepEqual(computeDishMacros([{ per100g: Milk2, grams: 100 }]), {
      kcal: 50,
      protein: 3.3,
      carbs: 4.8,
      fat: 2,
    });
  });

  test('wiele drobnych składników nie kumuluje błędu zaokrąglenia', () => {
    // Dziesięć razy po 10 g mleka to dokładnie 100 g mleka. Gdyby moduł zaokrąglał KAŻDY
    // składnik z osobna, te dwa wyniki by się rozjechały.
    const split = computeDishMacros(
      Array.from({ length: 10 }, () => ({ per100g: Milk2, grams: 10 })),
    );

    assert.deepEqual(split, computeDishMacros([{ per100g: Milk2, grams: 100 }]));
  });
});

describe('computeDishMacros — zaokrąglanie jest częścią kontraktu', () => {
  test('kalorie do pełnych jednostek, makra do 0,1 g, „pół w górę"', () => {
    const result = computeDishMacros([
      { per100g: { kcal: 100.5, protein: 0.25, carbs: 0.24, fat: 0 }, grams: 100 },
    ]);

    // 100,5 → 101 (a nie 100): zaokrąglenie „pół w górę", nie „do parzystej".
    assert.equal(result.kcal, 101);
    // 0,25 → 0,3 (pół w górę na pierwszym miejscu po przecinku).
    assert.equal(result.protein, 0.3);
    // 0,24 → 0,2 (w dół, bo poniżej połowy).
    assert.equal(result.carbs, 0.2);
  });
});

describe('atwaterKcal i atwaterDeviation', () => {
  test('współczynniki to 4 / 4 / 9', () => {
    assert.equal(atwaterKcal({ kcal: 0, protein: 1, carbs: 1, fat: 1 }), 17);
  });

  test('płatki owsiane z USDA domykają się poniżej 1%', () => {
    // 4×13,2 + 4×67,7 + 9×6,5 = 52,8 + 270,8 + 58,5 = 382,1 wobec deklarowanych 379.
    assert.ok(atwaterDeviation(Oats) < 0.01);
  });

  test('produkt bezkaloryczny o zerowych makrach nie daje NaN', () => {
    // Woda i większość przypraw w gramaturze przepisu. 0/0 musi znaczyć „zgadza się".
    assert.equal(atwaterDeviation({ kcal: 0, protein: 0, carbs: 0, fat: 0 }), 0);
  });

  test('zero kilokalorii przy niezerowych makrach to nieskończone odchylenie', () => {
    // Realny błąd mapowania — składnik podpięty pod wiersz „woda". Nie wolno go przepuścić
    // jako „0% odchylenia".
    assert.equal(
      atwaterDeviation({ kcal: 0, protein: 5, carbs: 5, fat: 1 }),
      Number.POSITIVE_INFINITY,
    );
  });

  test('błąd ×10 w kaloriach wychodzi jako ogromne odchylenie', () => {
    const misread: Macros = { ...Oats, kcal: 3790 };
    assert.ok(atwaterDeviation(misread) > 0.8);
  });
});
