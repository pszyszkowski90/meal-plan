/**
 * Przypina stałe wzoru Mifflin-St Jeor, mnożniki aktywności, regułę zaokrąglania z zaokrąglonego
 * BMR, granice profilu i kształt walidacji. Zmiana którejkolwiek z tych rzeczy ma być widoczna —
 * błąd we wzorze przenosi się na każdy plan (mapa drogowa, S-02).
 *
 * Uruchamiane przez `npm test` natywnym runnerem Node ze zdejmowaniem typów. Import sąsiada
 * z jawnym `.ts` jest wymagany przez Node (ESM nie zgaduje rozszerzeń) i jest świadomym wyjątkiem
 * od reguły importów w repo — tylko w plikach `src/lib/*.test.ts`.
 *
 * `/// <reference types="node" />` jest tu, a nie w `tsconfig.json`: TypeScript 6 nie dołącza już
 * automatycznie paczek z `node_modules/@types` (`types` domyślnie `[]`), a typy `node:test` są
 * potrzebne wyłącznie plikom testów. `@types/node` jest w drzewie tranzytywnie — bez nowej zależności.
 */
/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  ActivityLevels,
  ActivityMultiplier,
  computeCalorieTarget,
  parseNumberInput,
  validateProfile,
  type ActivityLevel,
  type ProfileInput,
} from './calorie-target.ts';

const maleProfile: ProfileInput = {
  age: 30,
  weightKg: 80,
  heightCm: 180,
  sex: 'male',
  activityLevel: 3,
  targetKcalOverride: null,
};

const femaleProfile: ProfileInput = {
  age: 30,
  weightKg: 60,
  heightCm: 165,
  sex: 'female',
  activityLevel: 3,
  targetKcalOverride: null,
};

function expectValid(input: unknown): ProfileInput {
  const result = validateProfile(input);
  assert.equal(result.ok, true, `oczekiwano ok:true, dostano ${JSON.stringify(result)}`);
  return result.ok ? result.value : (undefined as never);
}

function expectInvalidOn(input: unknown, field: keyof ProfileInput): void {
  const result = validateProfile(input);
  assert.equal(result.ok, false, `oczekiwano ok:false dla ${JSON.stringify(input)}`);
  if (!result.ok) {
    assert.equal(
      typeof result.errors[field],
      'string',
      `oczekiwano błędu na polu ${field}, dostano ${JSON.stringify(result.errors)}`,
    );
  }
}

describe('computeCalorieTarget — wzór Mifflin-St Jeor', () => {
  test('BMR mężczyzny 80 kg / 180 cm / 30 lat = 1780', () => {
    assert.equal(computeCalorieTarget(maleProfile).bmrKcal, 1780);
  });

  test('BMR kobiety 60 kg / 165 cm / 30 lat = 1320 (surowe 1320.25)', () => {
    assert.equal(computeCalorieTarget(femaleProfile).bmrKcal, 1320);
  });

  test('mnożniki poziomów 1–5 są przypięte', () => {
    assert.deepEqual(ActivityMultiplier, { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9 });
    assert.deepEqual([...ActivityLevels], [1, 2, 3, 4, 5]);
  });

  test('poziomy 1–5 dla BMR 1780 dają 2136, 2448, 2759, 3071, 3382', () => {
    const expected: Record<ActivityLevel, number> = { 1: 2136, 2: 2448, 3: 2759, 4: 3071, 5: 3382 };
    for (const level of ActivityLevels) {
      const target = computeCalorieTarget({ ...maleProfile, activityLevel: level });
      assert.equal(target.computedKcal, expected[level], `poziom ${level}`);
      assert.equal(target.multiplier, ActivityMultiplier[level]);
      assert.equal(target.activityLevel, level);
      assert.equal(target.effectiveKcal, expected[level]);
      assert.equal(target.overrideKcal, null);
    }
  });

  test('wynik liczy się z ZAOKRĄGLONEGO BMR: kobieta 61,3 kg / 170 cm / 45 lat, poziom 3', () => {
    const target = computeCalorieTarget({
      age: 45,
      weightKg: 61.3,
      heightCm: 170,
      sex: 'female',
      activityLevel: 3,
      targetKcalOverride: null,
    });
    // surowe BMR 1289.5 → 1290; 1290 × 1.55 = 1999.5 → 2000 (z surowego wyszłoby 1998.7 → 1999)
    assert.equal(target.bmrKcal, 1290);
    assert.equal(target.computedKcal, 2000);
  });

  test('nadpisanie 2200 ustawia effectiveKcal, a computedKcal zostaje', () => {
    const target = computeCalorieTarget({ ...maleProfile, targetKcalOverride: 2200 });
    assert.equal(target.effectiveKcal, 2200);
    assert.equal(target.overrideKcal, 2200);
    assert.equal(target.computedKcal, 2759);
    assert.equal(target.bmrKcal, 1780);
  });
});

describe('validateProfile — granice włącznie', () => {
  test('wiek 17 / 101 odrzucone, 18 / 100 przyjęte', () => {
    expectInvalidOn({ ...maleProfile, age: 17 }, 'age');
    expectInvalidOn({ ...maleProfile, age: 101 }, 'age');
    assert.equal(expectValid({ ...maleProfile, age: 18 }).age, 18);
    assert.equal(expectValid({ ...maleProfile, age: 100 }).age, 100);
  });

  test('waga 29.9 / 300.1 odrzucone, 30 / 300 przyjęte', () => {
    expectInvalidOn({ ...maleProfile, weightKg: 29.9 }, 'weightKg');
    expectInvalidOn({ ...maleProfile, weightKg: 300.1 }, 'weightKg');
    assert.equal(expectValid({ ...maleProfile, weightKg: 30 }).weightKg, 30);
    assert.equal(expectValid({ ...maleProfile, weightKg: 300 }).weightKg, 300);
  });

  test('wzrost 99 / 251 odrzucone, 100 / 250 przyjęte', () => {
    expectInvalidOn({ ...maleProfile, heightCm: 99 }, 'heightCm');
    expectInvalidOn({ ...maleProfile, heightCm: 251 }, 'heightCm');
    assert.equal(expectValid({ ...maleProfile, heightCm: 100 }).heightCm, 100);
    assert.equal(expectValid({ ...maleProfile, heightCm: 250 }).heightCm, 250);
  });

  test('cel 999 / 6001 odrzucone, 1000 / 6000 przyjęte', () => {
    expectInvalidOn({ ...maleProfile, targetKcalOverride: 999 }, 'targetKcalOverride');
    expectInvalidOn({ ...maleProfile, targetKcalOverride: 6001 }, 'targetKcalOverride');
    assert.equal(expectValid({ ...maleProfile, targetKcalOverride: 1000 }).targetKcalOverride, 1000);
    assert.equal(expectValid({ ...maleProfile, targetKcalOverride: 6000 }).targetKcalOverride, 6000);
  });
});

describe('validateProfile — całkowitość i normalizacja', () => {
  test('wiek 30.5, wzrost 180.2 i cel 2000.5 są odrzucone', () => {
    expectInvalidOn({ ...maleProfile, age: 30.5 }, 'age');
    expectInvalidOn({ ...maleProfile, heightCm: 180.2 }, 'heightCm');
    expectInvalidOn({ ...maleProfile, targetKcalOverride: 2000.5 }, 'targetKcalOverride');
  });

  test('waga 70.55 jest przyjęta i znormalizowana do 70.6', () => {
    assert.equal(expectValid({ ...maleProfile, weightKg: 70.55 }).weightKg, 70.6);
  });
});

describe('validateProfile — kształt wejścia', () => {
  test('null i {} dają ok:false z błędami na wymaganych polach, bez wyjątku', () => {
    for (const input of [null, {}, undefined, 'tekst', 42]) {
      const result = validateProfile(input);
      assert.equal(result.ok, false);
      if (!result.ok) {
        for (const field of ['age', 'weightKg', 'heightCm', 'sex', 'activityLevel'] as const) {
          assert.equal(typeof result.errors[field], 'string', `pole ${field} dla ${String(input)}`);
        }
        assert.equal(result.errors.targetKcalOverride, undefined);
      }
    }
  });

  test('sex: "x" → błąd na sex', () => {
    expectInvalidOn({ ...maleProfile, sex: 'x' }, 'sex');
  });

  test('activityLevel: 6 i 0 → błąd na activityLevel', () => {
    expectInvalidOn({ ...maleProfile, activityLevel: 6 }, 'activityLevel');
    expectInvalidOn({ ...maleProfile, activityLevel: 0 }, 'activityLevel');
  });

  test('age: "30" (string) i age: NaN → błąd na age — moduł nie przyjmuje stringów liczbowych', () => {
    expectInvalidOn({ ...maleProfile, age: '30' }, 'age');
    expectInvalidOn({ ...maleProfile, age: Number.NaN }, 'age');
    expectInvalidOn({ ...maleProfile, age: Number.POSITIVE_INFINITY }, 'age');
  });

  test('błędne pole nie zaraża pozostałych', () => {
    const result = validateProfile({ ...maleProfile, age: 17 });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(Object.keys(result.errors), ['age']);
    }
  });

  test('ok:true zwraca czysty ProfileInput bez nadmiarowych kluczy', () => {
    const value = expectValid({ ...maleProfile, extra: 'nie powinno przejść' });
    assert.deepEqual(value, maleProfile);
  });
});

describe('validateProfile — brak nadpisania', () => {
  test('profil bez klucza targetKcalOverride → ok:true z targetKcalOverride: null', () => {
    const { targetKcalOverride: _omitted, ...withoutKey } = maleProfile;
    assert.equal(expectValid(withoutKey).targetKcalOverride, null);
  });

  test('profil z targetKcalOverride: null → ok:true z targetKcalOverride: null', () => {
    assert.equal(expectValid({ ...maleProfile, targetKcalOverride: null }).targetKcalOverride, null);
  });

  test('targetKcalOverride: "2200" (string) → błąd na polu', () => {
    expectInvalidOn({ ...maleProfile, targetKcalOverride: '2200' }, 'targetKcalOverride');
  });
});

describe('parseNumberInput — wejście z polskiej klawiatury', () => {
  test('"70,5" → 70.5', () => {
    assert.equal(parseNumberInput('70,5'), 70.5);
  });

  test('" 80 " → 80', () => {
    assert.equal(parseNumberInput(' 80 '), 80);
  });

  test('"" → null', () => {
    assert.equal(parseNumberInput(''), null);
  });

  test('"abc" → null', () => {
    assert.equal(parseNumberInput('abc'), null);
  });

  test('"70," (w trakcie pisania) i "1e3" → null', () => {
    assert.equal(parseNumberInput('70,'), null);
    assert.equal(parseNumberInput('1e3'), null);
  });
});
