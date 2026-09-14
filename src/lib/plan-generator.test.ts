/**
 * Testy generatora planu — faza 2 S-04.
 *
 * Import z jawnym rozszerzeniem `./plan-generator.ts` jest sankcjonowanym odstępstwem od reguły
 * „zero względnych importów": `npm test` to `node --test` z okrajaniem typów, a Node w ESM nie
 * zgaduje rozszerzeń ani nie zna aliasu `@/`.
 *
 * ZAKRES NIEZALEŻNOŚCI WYROCZNI. Do generatora wchodzą dania z JUŻ policzonym `kcal`, więc te
 * testy NIE dowodzą arytmetyki makr — tę pokrywa `dish-macros.test.ts` wyrocznią z tabeli USDA.
 * Dowodzą czego innego i to jest sedno tej fazy: że DOBÓR dań trafia w okno ±10%, że guardrail
 * nie przepuszcza dnia poza oknem i że porażka nazywa właściwe ograniczenie. Dlatego suma dnia
 * jest tu liczona przez `sumDay` — funkcję testu — a nie odczytywana z pola `totalKcal`, które
 * zwraca generator. Inaczej test dowodziłby, że generator równa się sam sobie.
 */

/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, test } from 'node:test';

import {
  CalorieTolerance,
  PlanDays,
  daySlots,
  generatePlan,
  type GeneratorDish,
  type GeneratorInput,
  type MealsPerDay,
  type PlanDay,
} from './plan-generator.ts';
import type { MealSlot } from './dish-validation.ts';

// ---------------------------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------------------------

let nextId = 1;

function dish(
  kcal: number,
  slots: readonly MealSlot[],
  overrides: Partial<GeneratorDish> = {},
): GeneratorDish {
  const id = nextId;
  nextId += 1;
  return {
    id,
    name: `danie-${id}`,
    prepMinutes: 20,
    mealSlots: slots,
    kcal,
    passesExclusions: true,
    ...overrides,
  };
}

/** `count` dań o tych samych kaloriach w tej samej porze. */
function many(count: number, kcal: number, slots: readonly MealSlot[], overrides: Partial<GeneratorDish> = {}) {
  return Array.from({ length: count }, () => dish(kcal, slots, overrides));
}

function input(overrides: Partial<GeneratorInput> & { pool: readonly GeneratorDish[] }): GeneratorInput {
  return {
    targetKcal: 2000,
    mealsPerDay: 3,
    maxPrepMinutes: 120,
    seed: 'ziarno-testowe',
    ...overrides,
  };
}

/** WYROCZNIA sumy dnia — liczona w teście z puli, nie odczytana z `totalKcal` generatora. */
function sumDay(day: PlanDay, pool: readonly GeneratorDish[]): number {
  let total = 0;
  for (const meal of day.meals) {
    const found = pool.find((entry) => entry.id === meal.dishId);
    assert.ok(found !== undefined, `danie ${meal.dishId} musi pochodzić z puli`);
    total += found.kcal;
  }
  return total;
}

function expectOk(result: ReturnType<typeof generatePlan>): readonly PlanDay[] {
  assert.ok(result.ok, `oczekiwano planu, dostano porażkę: ${JSON.stringify(result)}`);
  return result.days;
}

function expectFailure(result: ReturnType<typeof generatePlan>) {
  assert.ok(!result.ok, `oczekiwano porażki, dostano plan: ${JSON.stringify(result)}`);
  return result.failure;
}

/** Pula, w której KAŻDY cel z podanego zakresu da się złożyć — trzy pory po kilka dań. */
function roomyPool(): GeneratorDish[] {
  return [
    ...many(8, 400, ['breakfast']),
    ...many(8, 500, ['breakfast']),
    ...many(8, 700, ['lunch']),
    ...many(8, 800, ['lunch']),
    ...many(8, 600, ['dinner']),
    ...many(8, 900, ['dinner']),
    ...many(8, 300, ['snack']),
    ...many(8, 250, ['snack']),
  ];
}

// ---------------------------------------------------------------------------------------------
// 2.1 / 2.7 — kształt planu i guardrail liczony niezależnie
// ---------------------------------------------------------------------------------------------

describe('generatePlan — kształt planu i guardrail ±10%', () => {
  test('siedem dni, każdy z zadaną liczbą posiłków, każdy w oknie ±10%', () => {
    for (const mealsPerDay of [3, 4, 5, 6] as MealsPerDay[]) {
      const pool = roomyPool();
      // Cel dobrany tak, żeby mieścił się w zasięgu każdej liczby posiłków.
      const targetKcal = 400 + 700 + 600 + (mealsPerDay - 3) * 275;
      const days = expectOk(generatePlan(input({ pool, mealsPerDay, targetKcal })));

      assert.equal(days.length, PlanDays, `${mealsPerDay} posiłków: ma być ${PlanDays} dni`);
      const lower = Math.ceil(targetKcal * (1 - CalorieTolerance));
      const upper = Math.floor(targetKcal * (1 + CalorieTolerance));

      for (const day of days) {
        assert.equal(day.meals.length, mealsPerDay, `dzień ${day.dayIndex}: liczba posiłków`);
        const oracle = sumDay(day, pool);
        assert.ok(
          oracle >= lower && oracle <= upper,
          `dzień ${day.dayIndex} przy ${mealsPerDay} posiłkach: ${oracle} kcal poza [${lower}, ${upper}]`,
        );
        // Pole generatora musi zgadzać się z wyrocznią — gdyby się rozjechało, ekran kłamałby.
        assert.equal(day.totalKcal, oracle, `dzień ${day.dayIndex}: totalKcal wobec wyroczni`);
      }

      const indexes = days.map((day) => day.dayIndex);
      assert.deepEqual(indexes, [1, 2, 3, 4, 5, 6, 7], 'dni ponumerowane od 1 do 7');
    }
  });

  test('pozycje dnia mają kolejne slotIndex zaczynające się od 1', () => {
    const pool = roomyPool();
    const days = expectOk(generatePlan(input({ pool, mealsPerDay: 5, targetKcal: 2250 })));
    for (const day of days) {
      const slotIndexes = day.meals.map((meal) => meal.slotIndex);
      assert.deepEqual(slotIndexes, [1, 2, 3, 4, 5], `dzień ${day.dayIndex}: slotIndex`);
    }
  });

  test('pory dnia zgadzają się ze składem z daySlots', () => {
    const pool = roomyPool();
    const days = expectOk(generatePlan(input({ pool, mealsPerDay: 6, targetKcal: 2525 })));
    const expected = daySlots(6);
    for (const day of days) {
      assert.deepEqual(
        day.meals.map((meal) => meal.mealSlot),
        [...expected],
        `dzień ${day.dayIndex}: pory`,
      );
    }
  });
});

// ---------------------------------------------------------------------------------------------
// 2.2 — granice okna domknięte obustronnie
// ---------------------------------------------------------------------------------------------

describe('generatePlan — granice okna są domknięte obustronnie', () => {
  /**
   * WYROCZNIA. Cel 2000 kcal → okno [1800, 2200]. Pula ma dokładnie cztery możliwe sumy dnia,
   * bo każda pora ma jedno danie o zadanej wartości:
   *   dolna granica dokładnie : 600 + 600 + 600 = 1800  ← ma przejść
   *   o 1 kcal poniżej        : 599 + 600 + 600 = 1799  ← ma odpaść
   *   górna granica dokładnie : 800 + 700 + 700 = 2200  ← ma przejść
   *   o 1 kcal powyżej        : 801 + 700 + 700 = 2201  ← ma odpaść
   */
  function exactPool(breakfastKcal: number, lunchKcal: number, dinnerKcal: number) {
    return [
      dish(breakfastKcal, ['breakfast']),
      dish(lunchKcal, ['lunch']),
      dish(dinnerKcal, ['dinner']),
    ];
  }

  test('suma równa dokładnie 0,9 × cel jest akceptowana', () => {
    const pool = exactPool(600, 600, 600);
    const days = expectOk(generatePlan(input({ pool, targetKcal: 2000 })));
    assert.equal(sumDay(days[0], pool), 1800);
  });

  test('suma o 1 kcal poniżej dolnej granicy jest odrzucana', () => {
    const pool = exactPool(599, 600, 600);
    const failure = expectFailure(generatePlan(input({ pool, targetKcal: 2000 })));
    assert.equal(failure.reason, 'calories');
  });

  test('suma równa dokładnie 1,1 × cel jest akceptowana', () => {
    const pool = exactPool(800, 700, 700);
    const days = expectOk(generatePlan(input({ pool, targetKcal: 2000 })));
    assert.equal(sumDay(days[0], pool), 2200);
  });

  test('suma o 1 kcal powyżej górnej granicy jest odrzucana', () => {
    const pool = exactPool(801, 700, 700);
    const failure = expectFailure(generatePlan(input({ pool, targetKcal: 2000 })));
    assert.equal(failure.reason, 'calories');
  });
});

// ---------------------------------------------------------------------------------------------
// 2.3 / 2.4 — diagnoza przeciwfaktyczna
// ---------------------------------------------------------------------------------------------

describe('generatePlan — porażka nazywa właściwe ograniczenie z dowodem', () => {
  test('wykluczenia opróżniające porę dają reason exclusions z liczbą dań bez wykluczeń', () => {
    const pool = [
      ...many(3, 500, ['breakfast'], { passesExclusions: false }),
      ...many(3, 700, ['lunch']),
      ...many(3, 800, ['dinner']),
    ];
    const failure = expectFailure(generatePlan(input({ pool, targetKcal: 2000 })));
    assert.equal(failure.reason, 'exclusions');
    assert.ok(failure.reason === 'exclusions');
    assert.equal(failure.slot, 'breakfast');
    assert.equal(failure.remaining, 0);
    // DOWÓD, nie etykieta: zdjęcie wykluczeń realnie przywraca dania.
    assert.equal(failure.withoutExclusions, 3);
    assert.ok(failure.withoutExclusions > failure.remaining);
  });

  test('limit czasu opróżniający porę daje reason prepTime z liczbą dań bez limitu', () => {
    const pool = [
      ...many(3, 500, ['breakfast'], { prepMinutes: 90 }),
      ...many(3, 700, ['lunch']),
      ...many(3, 800, ['dinner']),
    ];
    const failure = expectFailure(generatePlan(input({ pool, targetKcal: 2000, maxPrepMinutes: 30 })));
    assert.equal(failure.reason, 'prepTime');
    assert.ok(failure.reason === 'prepTime');
    assert.equal(failure.slot, 'breakfast');
    assert.equal(failure.remaining, 0);
    assert.equal(failure.limitMinutes, 30);
    assert.equal(failure.withoutLimit, 3);
  });

  test('TEN SAM zestaw dań z podniesionym limitem daje plan', () => {
    // Bez tego poprzedni test dowodziłby wyłącznie, że filtr filtruje — a nie, że filtr jest
    // jedyną przyczyną porażki. Lekcja z `lessons.md` o kryteriach przechodzących niezależnie
    // od tego, czy rzecz działa.
    const pool = [
      ...many(3, 500, ['breakfast'], { prepMinutes: 90 }),
      ...many(3, 700, ['lunch']),
      ...many(3, 800, ['dinner']),
    ];
    const days = expectOk(generatePlan(input({ pool, targetKcal: 2000, maxPrepMinutes: 120 })));
    assert.equal(days.length, PlanDays);
  });

  test('wykluczenia wygrywają nad limitem, gdy odpowiadają za większy ubytek', () => {
    // Pora pusta z obu powodów naraz. Diagnoza ma wskazać ten filtr, którego zdjęcie przywraca
    // WIĘCEJ dań — inaczej użytkownik dostaje radę, która nic nie da.
    const pool = [
      ...many(5, 500, ['breakfast'], { passesExclusions: false, prepMinutes: 20 }),
      ...many(1, 500, ['breakfast'], { prepMinutes: 90 }),
      ...many(3, 700, ['lunch']),
      ...many(3, 800, ['dinner']),
    ];
    const failure = expectFailure(generatePlan(input({ pool, targetKcal: 2000, maxPrepMinutes: 30 })));
    assert.equal(failure.reason, 'exclusions');
    assert.ok(failure.reason === 'exclusions');
    assert.equal(failure.withoutExclusions, 5);
  });
});

// ---------------------------------------------------------------------------------------------
// 2.6 — twarde ograniczenia sprawdzone NA ŚCIEŻCE SUKCESU
// ---------------------------------------------------------------------------------------------

describe('generatePlan — plan, który POWSTAŁ, nie łamie wykluczeń ani limitu czasu', () => {
  test('żadne danie w planie nie jest wykluczone i żadne nie przekracza limitu', () => {
    // To jest kryterium, bez którego cały zestaw testów przepuściłby literówkę w odsiewie:
    // dotąd wykluczenia i limit czasu występowały wyłącznie w scenariuszach porażki.
    //
    // KSZTAŁT PULI JEST CELOWY. Dania odrzucone mają te SAME kalorie co dopuszczone i niższe
    // `id`, więc po sortowaniu (kcal, potem id) stoją w liście PIERWSZE. Gdyby odsiew przestał
    // działać, przeszukiwanie sięgnęłoby po nie natychmiast i test by się zaczerwienił.
    // Pula, w której dania odrzucone są cięższe albo lżejsze, tego nie złapie — generator
    // ominąłby je sam, bo nie mieszczą się w oknie, i zepsuty filtr przeszedłby na zielono.
    // Sprawdzone zepsuciem 14.09: wersja z różnymi kaloriami NIE łapała zdjętego odsiewu.
    const pool = [
      // Najpierw odrzucone — dostają niższe `id`, czyli pierwsze miejsce przy remisie kalorii.
      ...many(4, 400, ['breakfast'], { passesExclusions: false }),
      ...many(4, 700, ['lunch'], { prepMinutes: 200 }),
      ...many(4, 600, ['dinner'], { passesExclusions: false, prepMinutes: 200 }),
      ...many(4, 300, ['snack'], { passesExclusions: false }),
      // Dopuszczone — te same kalorie, wyższe `id`.
      ...many(4, 400, ['breakfast']),
      ...many(4, 700, ['lunch']),
      ...many(4, 600, ['dinner']),
      ...many(4, 300, ['snack']),
    ];
    const maxPrepMinutes = 30;
    const days = expectOk(
      generatePlan(input({ pool, mealsPerDay: 4, targetKcal: 2000, maxPrepMinutes })),
    );

    let checked = 0;
    for (const day of days) {
      for (const meal of day.meals) {
        const found = pool.find((entry) => entry.id === meal.dishId);
        assert.ok(found !== undefined);
        assert.equal(found.passesExclusions, true, `dzień ${day.dayIndex}: danie wykluczone w planie`);
        assert.ok(
          found.prepMinutes <= maxPrepMinutes,
          `dzień ${day.dayIndex}: danie ${found.prepMinutes} min ponad limit ${maxPrepMinutes}`,
        );
        checked += 1;
      }
    }
    assert.equal(checked, PlanDays * 4, 'sprawdzone wszystkie pozycje tygodnia');
  });
});

// ---------------------------------------------------------------------------------------------
// 2.7 — zero planu częściowego
// ---------------------------------------------------------------------------------------------

describe('generatePlan — nigdy nie oddaje planu częściowego', () => {
  test('porażka nie niesie pola days', () => {
    const pool = [dish(100, ['breakfast']), dish(100, ['lunch']), dish(100, ['dinner'])];
    const result = generatePlan(input({ pool, targetKcal: 3000 }));
    assert.equal(result.ok, false);
    assert.equal('days' in result, false, 'wynik porażki nie może nieść planu');
  });

  test('sukces nie ma dnia z niepełną liczbą posiłków', () => {
    const pool = roomyPool();
    const days = expectOk(generatePlan(input({ pool, mealsPerDay: 6, targetKcal: 2525 })));
    for (const day of days) {
      assert.equal(day.meals.length, 6, `dzień ${day.dayIndex} niepełny`);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// 2.8 / 2.9 / 2.10 — powtórzenia
// ---------------------------------------------------------------------------------------------

describe('generatePlan — powtórzenia', () => {
  test('to samo danie nie występuje dwa razy w jednym dniu, także przy sześciu posiłkach', () => {
    const pool = roomyPool();
    const days = expectOk(generatePlan(input({ pool, mealsPerDay: 6, targetKcal: 2525 })));
    for (const day of days) {
      const ids = day.meals.map((meal) => meal.dishId);
      assert.equal(new Set(ids).size, ids.length, `dzień ${day.dayIndex}: danie powtórzone w dniu`);
      // Przy sześciu posiłkach dzień potrzebuje TRZECH różnych przekąsek.
      const snacks = day.meals.filter((meal) => meal.mealSlot === 'snack');
      assert.equal(snacks.length, 3);
      assert.equal(new Set(snacks.map((meal) => meal.dishId)).size, 3);
    }
  });

  test('limit liczy się od LICZBY WYBORÓW, nie od liczby dni — 15 przekąsek przy 6 posiłkach', () => {
    // To jest scenariusz, który wywracał pierwszą wersję reguły: 7 × 3 = 21 wyborów z puli 15,
    // a limit liczony od liczby dni dopuszczał tylko 15 użyć łącznie. Plan MUSI powstać.
    const pool = [
      ...many(7, 400, ['breakfast']),
      ...many(7, 700, ['lunch']),
      ...many(7, 600, ['dinner']),
      ...many(15, 275, ['snack']),
    ];
    const days = expectOk(generatePlan(input({ pool, mealsPerDay: 6, targetKcal: 2525 })));
    assert.equal(days.length, PlanDays);

    const snackUses = new Map<number, number>();
    for (const day of days) {
      for (const meal of day.meals.filter((entry) => entry.mealSlot === 'snack')) {
        snackUses.set(meal.dishId, (snackUses.get(meal.dishId) ?? 0) + 1);
      }
    }
    const totalSnackPicks = [...snackUses.values()].reduce((sum, value) => sum + value, 0);
    assert.equal(totalSnackPicks, 21, '7 dni × 3 przekąski');
    // ceil(21 / 15) = 2 — żadna przekąska nie może być użyta częściej.
    for (const [id, uses] of snackUses) {
      assert.ok(uses <= 2, `przekąska ${id} użyta ${uses} razy, limit to 2`);
    }
  });

  test('przy puli większej niż liczba wyborów żadne danie się nie powtarza', () => {
    const pool = [
      ...many(12, 400, ['breakfast']),
      ...many(12, 700, ['lunch']),
      ...many(12, 600, ['dinner']),
    ];
    const days = expectOk(generatePlan(input({ pool, mealsPerDay: 3, targetKcal: 1700 })));
    const uses = new Map<number, number>();
    for (const day of days) {
      for (const meal of day.meals) {
        uses.set(meal.dishId, (uses.get(meal.dishId) ?? 0) + 1);
      }
    }
    for (const [id, count] of uses) {
      assert.equal(count, 1, `danie ${id} powtórzone mimo puli 12 na 7 wyborów`);
    }
  });

  test('pula dwóch śniadań na siedem dni daje plan, nie błąd', () => {
    // Zmierzone 14.09: wykluczenie nabiału przy limicie 30 minut zostawia DWA śniadania.
    // Zakaz powtórzeń zamieniłby ten zwyczajny profil w „nie da się ułożyć planu".
    const pool = [
      ...many(2, 400, ['breakfast']),
      ...many(12, 700, ['lunch']),
      ...many(12, 600, ['dinner']),
    ];
    const days = expectOk(generatePlan(input({ pool, mealsPerDay: 3, targetKcal: 1700 })));
    assert.equal(days.length, PlanDays);
    const breakfastUses = new Map<number, number>();
    for (const day of days) {
      for (const meal of day.meals.filter((entry) => entry.mealSlot === 'breakfast')) {
        breakfastUses.set(meal.dishId, (breakfastUses.get(meal.dishId) ?? 0) + 1);
      }
    }
    // ceil(7 / 2) = 4.
    for (const [id, count] of breakfastUses) {
      assert.ok(count <= 4, `śniadanie ${id} użyte ${count} razy, limit to 4`);
    }
  });

  test('relaksacja działa: rozmaitość ustępuje guardrailowi, a nie odwrotnie', () => {
    // Jedno śniadanie w puli, siedem dni. Bazowy limit to ceil(7/1) = 7, więc mieści się bez
    // relaksacji — ale test pilnuje sedna: plan POWSTAJE, zamiast paść na limicie powtórzeń.
    const pool = [
      dish(400, ['breakfast']),
      ...many(12, 700, ['lunch']),
      ...many(12, 600, ['dinner']),
    ];
    const days = expectOk(generatePlan(input({ pool, mealsPerDay: 3, targetKcal: 1700 })));
    assert.equal(days.length, PlanDays);
    for (const day of days) {
      assert.equal(day.meals.filter((meal) => meal.mealSlot === 'breakfast').length, 1);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// 2.11 — determinizm względem ziarna, bez klauzuli ucieczki
// ---------------------------------------------------------------------------------------------

describe('generatePlan — determinizm względem ziarna', () => {
  test('to samo ziarno daje plan identyczny we WSZYSTKICH pozycjach', () => {
    const pool = roomyPool();
    const first = expectOk(generatePlan(input({ pool, mealsPerDay: 4, targetKcal: 1975, seed: 'a' })));
    const second = expectOk(generatePlan(input({ pool, mealsPerDay: 4, targetKcal: 1975, seed: 'a' })));
    assert.equal(first.length, second.length);
    let compared = 0;
    for (let index = 0; index < first.length; index += 1) {
      assert.deepEqual(
        first[index].meals.map((meal) => meal.dishId),
        second[index].meals.map((meal) => meal.dishId),
        `dzień ${index + 1} rozjechał się przy tym samym ziarnie`,
      );
      compared += first[index].meals.length;
    }
    assert.equal(compared, PlanDays * 4, 'porównane wszystkie 7 × 4 pozycji');
  });

  test('inne ziarno daje plan różniący się co najmniej jedną pozycją', () => {
    const pool = roomyPool();
    const first = expectOk(generatePlan(input({ pool, mealsPerDay: 4, targetKcal: 1975, seed: 'a' })));
    const second = expectOk(generatePlan(input({ pool, mealsPerDay: 4, targetKcal: 1975, seed: 'b' })));
    const flatten = (days: readonly PlanDay[]) =>
      days.flatMap((day) => day.meals.map((meal) => meal.dishId)).join(',');
    assert.notEqual(
      flatten(first),
      flatten(second),
      'generator ignorujący ziarno przeszedłby poprzedni test i ten — ten ma go złapać',
    );
  });
});

// ---------------------------------------------------------------------------------------------
// 2.12 / 2.13 — wyczerpana przestrzeń kontra wyczerpany budżet
// ---------------------------------------------------------------------------------------------

describe('generatePlan — combination i searchBudget to dwie różne rzeczy', () => {
  test('wyczerpana przestrzeń przy nietkniętym budżecie daje combination, nie calories', () => {
    // WYROCZNIA. Trzy pory po {200, 800} kcal, cel 1500 → okno [1350, 1650].
    // Osiągalne sumy: 600, 1200, 1800, 2400 — żadna nie trafia.
    // Granice (600 i 2400) okno OBEJMUJĄ, więc krok „dowiedziona niemożliwość" przepuszcza,
    // a przeszukiwanie wyczerpuje osiem złożeń i nic nie znajduje.
    const pool = [
      dish(200, ['breakfast']),
      dish(800, ['breakfast']),
      dish(200, ['lunch']),
      dish(800, ['lunch']),
      dish(200, ['dinner']),
      dish(800, ['dinner']),
    ];
    const failure = expectFailure(generatePlan(input({ pool, targetKcal: 1500 })));
    assert.equal(failure.reason, 'combination');
    assert.ok(failure.reason === 'combination');
    assert.equal(failure.lowerKcal, 1350);
    assert.equal(failure.upperKcal, 1650);
    assert.ok(failure.visitedNodes > 0, 'przeszukiwanie faktycznie ruszyło');
  });

  test('cel poza zasięgiem puli daje calories z osiągalnym maksimum poniżej dolnej granicy', () => {
    const pool = [
      ...many(4, 300, ['breakfast']),
      ...many(4, 400, ['lunch']),
      ...many(4, 400, ['dinner']),
    ];
    const failure = expectFailure(generatePlan(input({ pool, targetKcal: 3200 })));
    assert.equal(failure.reason, 'calories');
    assert.ok(failure.reason === 'calories');
    assert.equal(failure.achievableMaxKcal, 1100);
    assert.ok(failure.achievableMaxKcal < failure.lowerKcal);
    assert.equal(failure.mealsPerDay, 3);
  });

  test('przekroczony budżet węzłów daje searchBudget, nie zawieszenie ani plan częściowy', () => {
    const pool = roomyPool();
    const result = generatePlan(input({ pool, mealsPerDay: 4, targetKcal: 1975, nodeBudget: 3 }));
    const failure = expectFailure(result);
    assert.equal(failure.reason, 'searchBudget');
    assert.ok(failure.reason === 'searchBudget');
    assert.equal(failure.budget, 3);
    assert.equal('days' in result, false);
  });
});

// ---------------------------------------------------------------------------------------------
// 2.14 — granica liczona z RÓŻNYCH dań
// ---------------------------------------------------------------------------------------------

describe('generatePlan — osiągalne maksimum liczone z różnych dań', () => {
  test('pora występująca trzykrotnie sumuje trzy NAJWIĘKSZE dania, nie trzykrotność jednego', () => {
    // WYROCZNIA. Przekąski: 500, 100, 100. Przy sześciu posiłkach dzień bierze trzy RÓŻNE,
    // więc ich wkład to 500 + 100 + 100 = 700, a nie 3 × 500 = 1500.
    // Reszta: śniadanie 300, obiad 300, kolacja 300 → osiągalne maksimum = 900 + 700 = 1600.
    const pool = [
      dish(300, ['breakfast']),
      dish(300, ['lunch']),
      dish(300, ['dinner']),
      dish(500, ['snack']),
      dish(100, ['snack']),
      dish(100, ['snack']),
    ];
    // Cel 2000 → dolna granica 1800 > 1600, więc niemożliwość jest DOWIEDZIONA.
    // Gdyby granicę liczyć jako 3 × 500, wyszłoby 2400 i krok 2 błędnie by przepuścił.
    const failure = expectFailure(
      generatePlan(input({ pool, mealsPerDay: 6, targetKcal: 2000 })),
    );
    assert.equal(failure.reason, 'calories');
    assert.ok(failure.reason === 'calories');
    assert.equal(failure.achievableMaxKcal, 1600);
  });
});

// ---------------------------------------------------------------------------------------------
// 2.5 — scenariusz na REALNEJ puli z `seed/`
// ---------------------------------------------------------------------------------------------

describe('generatePlan — realna pula z seed/', () => {
  /**
   * Wczytanie `seed/` przez `node:fs` dzieje się w PLIKU TESTU, nie w module. Zakaz importów
   * dotyczy `plan-generator.ts`, który ma zostać czysty. Przepisanie liczb do testu rozjechałoby
   * się z `seed/` przy pierwszej korekcie gramatury — a wtedy test mówiłby o puli, której nie ma.
   */
  function realPool(): GeneratorDish[] {
    const ingredientsFile = JSON.parse(readFileSync('seed/ingredients.json', 'utf8')) as {
      ingredients: { name: string; fdcId: number }[];
    };
    const usda = JSON.parse(readFileSync('seed/usda-subset.json', 'utf8')) as {
      items: { fdcId: number; per100g: { kcal: number } }[];
    };
    const kcalPer100g = new Map(usda.items.map((item) => [item.fdcId, item.per100g.kcal]));
    const fdcByName = new Map(ingredientsFile.ingredients.map((item) => [item.name, item.fdcId]));

    return readdirSync('seed/dishes')
      .filter((file) => file.endsWith('.json'))
      .map((file, index) => {
        const raw = JSON.parse(readFileSync(`seed/dishes/${file}`, 'utf8')) as {
          name: string;
          mealSlots: MealSlot[];
          prepMinutes: number;
          ingredients: { ingredientName: string; grams: number }[];
        };
        let kcal = 0;
        for (const item of raw.ingredients) {
          const fdcId = fdcByName.get(item.ingredientName);
          assert.ok(fdcId !== undefined, `składnik „${item.ingredientName}" musi być w katalogu`);
          const per100g = kcalPer100g.get(fdcId);
          assert.ok(per100g !== undefined, `fdcId ${fdcId} musi być w destylacie USDA`);
          kcal += (per100g * item.grams) / 100;
        }
        return {
          id: index + 1,
          name: raw.name,
          prepMinutes: raw.prepMinutes,
          mealSlots: raw.mealSlots,
          // Zaokrąglenie takie samo, jak w `computeDishMacros` — sumy dnia są sumami liczb
          // całkowitych, dokładnie jak w raporcie `seed/FEASIBILITY.md`.
          kcal: Math.round(kcal),
          passesExclusions: true,
        };
      });
  }

  test('trzy posiłki i cel 3200 kcal są NIEOSIĄGALNE — sufit puli, nie wykluczenia', () => {
    // Zmierzone 14.09: przy trzech posiłkach maksimum dnia to 2542 kcal, a dolna granica
    // ±10% od 3200 wynosi 2880. `seed/FEASIBILITY.md` potwierdza: zero trafień.
    const pool = realPool();
    assert.ok(pool.length >= 50, `pula z seed/ ma ${pool.length} dań`);

    const failure = expectFailure(
      generatePlan(input({ pool, mealsPerDay: 3, targetKcal: 3200, maxPrepMinutes: 30 })),
    );
    assert.equal(failure.reason, 'calories');
    assert.ok(failure.reason === 'calories');
    assert.ok(
      failure.achievableMaxKcal < failure.lowerKcal,
      `sufit ${failure.achievableMaxKcal} musi być poniżej dolnej granicy ${failure.lowerKcal}`,
    );
  });

  test('TEN SAM zestaw przy sześciu posiłkach daje plan', () => {
    // Bez tego poprzedni test dowodziłby tylko, że pula jest mała. Sześć posiłków to jedyna
    // konfiguracja, w której 3200 kcal jest osiągalne (`seed/FEASIBILITY.md`, 33% złożeń).
    const pool = realPool();
    const days = expectOk(
      generatePlan(input({ pool, mealsPerDay: 6, targetKcal: 3200, maxPrepMinutes: 30 })),
    );
    assert.equal(days.length, PlanDays);
    const lower = Math.ceil(3200 * 0.9);
    const upper = Math.floor(3200 * 1.1);
    for (const day of days) {
      const oracle = sumDay(day, pool);
      assert.ok(oracle >= lower && oracle <= upper, `dzień ${day.dayIndex}: ${oracle} kcal poza oknem`);
    }
  });

  test('realna pula przy typowym profilu — 4 posiłki, 2200 kcal, limit 30 minut', () => {
    const pool = realPool();
    const days = expectOk(
      generatePlan(input({ pool, mealsPerDay: 4, targetKcal: 2200, maxPrepMinutes: 30 })),
    );
    const lower = Math.ceil(2200 * 0.9);
    const upper = Math.floor(2200 * 1.1);
    for (const day of days) {
      const oracle = sumDay(day, pool);
      assert.ok(oracle >= lower && oracle <= upper, `dzień ${day.dayIndex}: ${oracle} kcal poza oknem`);
      for (const meal of day.meals) {
        const found = pool.find((entry) => entry.id === meal.dishId);
        assert.ok(found !== undefined && found.prepMinutes <= 30, 'danie ponad limitem czasu');
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// daySlots — skład dnia
// ---------------------------------------------------------------------------------------------

describe('daySlots', () => {
  test('trzy posiłki to śniadanie, obiad i kolacja bez przekąsek', () => {
    assert.deepEqual([...daySlots(3)], ['breakfast', 'lunch', 'dinner']);
  });

  test('każdy posiłek ponad trzy to przekąska', () => {
    assert.deepEqual([...daySlots(4)], ['breakfast', 'lunch', 'dinner', 'snack']);
    assert.deepEqual([...daySlots(6)], ['breakfast', 'lunch', 'dinner', 'snack', 'snack', 'snack']);
  });
});
