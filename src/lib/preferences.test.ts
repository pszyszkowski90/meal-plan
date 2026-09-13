/**
 * Testy walidacji preferencji — S-03 faza 1.
 *
 * Wyrocznie pochodzą z planu (`context/changes/dietary-preferences/plan.md`, „Strategia
 * testowania"): `mealsPerDay` poza 3–6, `maxPrepMinutes` poza zakresem, wykluczenie bez
 * identyfikatora, `kind` niezgodny z wypełnionym polem. Nigdy z uruchomienia modułu.
 */

/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  exclusionKey,
  PreferenceBounds,
  validatePreferences,
  type ExclusionInput,
} from './preferences.ts';

/** Poprawne ciało odniesienia — każdy test psuje w nim dokładnie jedną rzecz. */
function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    preferences: { maxPrepMinutes: 30, mealsPerDay: 4 },
    exclusions: [],
    ...overrides,
  };
}

function ingredientEntry(ingredientId: number): ExclusionInput {
  return { kind: 'ingredient', ingredientId, dishId: null, groupId: null };
}

describe('validatePreferences — ustawienia liczbowe', () => {
  test('przyjmuje poprawne ustawienia bez wykluczeń', () => {
    const result = validatePreferences(payload());

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.value.preferences, {
      maxPrepMinutes: 30,
      mealsPerDay: 4,
    });
    assert.deepEqual(result.ok && result.value.exclusions, []);
  });

  test('obie granice czasu przygotowania są WŁĄCZNIE', () => {
    for (const minutes of [PreferenceBounds.maxPrepMinutes.min, PreferenceBounds.maxPrepMinutes.max]) {
      const result = validatePreferences(
        payload({ preferences: { maxPrepMinutes: minutes, mealsPerDay: 3 } }),
      );

      assert.equal(result.ok, true, `${minutes} min powinno przejść`);
    }
  });

  test('minuta poniżej dolnej granicy i minuta powyżej górnej są odrzucone', () => {
    for (const minutes of [
      PreferenceBounds.maxPrepMinutes.min - 1,
      PreferenceBounds.maxPrepMinutes.max + 1,
    ]) {
      const result = validatePreferences(
        payload({ preferences: { maxPrepMinutes: minutes, mealsPerDay: 3 } }),
      );

      assert.equal(result.ok, false, `${minutes} min powinno odpaść`);
      assert.match(String(!result.ok && result.errors.maxPrepMinutes), /5–240/);
    }
  });

  test('czas przygotowania musi być liczbą całkowitą', () => {
    const result = validatePreferences(
      payload({ preferences: { maxPrepMinutes: 30.5, mealsPerDay: 3 } }),
    );

    assert.equal(result.ok, false);
    assert.match(String(!result.ok && result.errors.maxPrepMinutes), /pełnych minutach/);
  });

  test('brak czasu przygotowania to błąd pod polem, nie wyjątek', () => {
    const result = validatePreferences(payload({ preferences: { mealsPerDay: 3 } }));

    assert.equal(result.ok, false);
    assert.match(String(!result.ok && result.errors.maxPrepMinutes), /Podaj/);
  });

  test('liczba posiłków spoza 3–6 odpada po obu stronach', () => {
    for (const meals of [2, 7]) {
      const result = validatePreferences(
        payload({ preferences: { maxPrepMinutes: 30, mealsPerDay: meals } }),
      );

      assert.equal(result.ok, false, `${meals} posiłków powinno odpaść`);
      assert.match(String(!result.ok && result.errors.mealsPerDay), /3–6/);
    }
  });

  test('liczba posiłków musi być liczbą, nie napisem', () => {
    const result = validatePreferences(
      payload({ preferences: { maxPrepMinutes: 30, mealsPerDay: '4' } }),
    );

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.mealsPerDay);
  });
});

describe('validatePreferences — lista wykluczeń', () => {
  test('wykluczenie składnikowe przechodzi i zeruje pozostałe identyfikatory', () => {
    const result = validatePreferences(
      payload({ exclusions: [{ kind: 'ingredient', ingredientId: 7 }] }),
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.value.exclusions, [ingredientEntry(7)]);
  });

  test('wykluczenie grupowe przechodzi — to trzeci rodzaj wpisu, nie osobny mechanizm', () => {
    const result = validatePreferences(payload({ exclusions: [{ kind: 'group', groupId: 2 }] }));

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.value.exclusions, [
      { kind: 'group', ingredientId: null, dishId: null, groupId: 2 },
    ]);
  });

  test('wykluczenie bez żadnego identyfikatora jest odrzucone', () => {
    const result = validatePreferences(payload({ exclusions: [{ kind: 'ingredient' }] }));

    assert.equal(result.ok, false);
    assert.match(String(!result.ok && result.errors.exclusions), /nie wskazuje/);
  });

  test('`kind` niezgodny z wypełnionym polem jest odrzucony PRZED bazą', () => {
    // Dokładnie ten wiersz odbiłby się od `CHECK` spójności w `0005` jako 500. Ma być 400.
    const result = validatePreferences(
      payload({ exclusions: [{ kind: 'ingredient', dishId: 3 }] }),
    );

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.exclusions);
  });

  test('wpis z DWOMA identyfikatorami naraz jest odrzucony', () => {
    const result = validatePreferences(
      payload({ exclusions: [{ kind: 'ingredient', ingredientId: 7, groupId: 2 }] }),
    );

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.exclusions);
  });

  test('identyfikator musi być dodatnią liczbą całkowitą', () => {
    for (const id of [0, -1, 1.5, '7']) {
      const result = validatePreferences(
        payload({ exclusions: [{ kind: 'ingredient', ingredientId: id }] }),
      );

      assert.equal(result.ok, false, `identyfikator ${String(id)} powinien odpaść`);
    }
  });

  test('nieznany rodzaj wpisu jest odrzucony', () => {
    const result = validatePreferences(
      payload({ exclusions: [{ kind: 'kategoria', groupId: 2 }] }),
    );

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.exclusions);
  });

  test('duplikat NIE jest błędem — znika po cichu, bo to jedno wykluczenie, nie dwa', () => {
    const result = validatePreferences(
      payload({
        exclusions: [
          { kind: 'ingredient', ingredientId: 7 },
          { kind: 'ingredient', ingredientId: 7 },
          { kind: 'group', groupId: 7 },
        ],
      }),
    );

    assert.equal(result.ok, true);
    // Ten sam numer przy innym `kind` to INNY byt — nie wolno go zwinąć razem ze składnikiem.
    assert.equal(result.ok && result.value.exclusions.length, 2);
  });

  test('lista, która nie jest tablicą, to błąd kształtu', () => {
    const result = validatePreferences(payload({ exclusions: { kind: 'ingredient' } }));

    assert.equal(result.ok, false);
    assert.match(String(!result.ok && result.errors.exclusions), /kształt/);
  });

  test('brak ciała w ogóle daje komplet błędów, a nie wyjątek', () => {
    const result = validatePreferences(undefined);

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.maxPrepMinutes);
    assert.ok(!result.ok && result.errors.mealsPerDay);
    assert.ok(!result.ok && result.errors.exclusions);
  });
});

describe('exclusionKey — tożsamość wpisu', () => {
  test('ten sam składnik daje ten sam klucz', () => {
    assert.equal(exclusionKey(ingredientEntry(7)), exclusionKey(ingredientEntry(7)));
  });

  test('ten sam numer przy innym rodzaju daje INNY klucz', () => {
    const group: ExclusionInput = { kind: 'group', ingredientId: null, dishId: null, groupId: 7 };

    assert.notEqual(exclusionKey(ingredientEntry(7)), exclusionKey(group));
  });
});
