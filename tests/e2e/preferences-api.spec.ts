import { test, expect } from '@playwright/test';

import { sessionToken } from './support/token';

/**
 * Kontrakt `GET`/`PUT /api/preferences` — kryteria **1.4, 1.5** fazy 1 z
 * `context/changes/dietary-preferences/plan.md` oraz dowód, że lista wykluczeń jest
 * KOLEKCJĄ: wpisy da się utworzyć i usunąć, a nie tylko nadpisać jedno pole.
 *
 * Żądania idą **z pominięciem formularza**: walidacja klienta nie może przesłaniać walidacji
 * serwera (ryzyko #6 z `context/foundation/test-plan.md`).
 *
 * Czego tu ŚWIADOMIE nie ma: wykluczeń wskazujących istniejący składnik. Tabela `ingredient` jest
 * na tym etapie pusta (pula dań powstaje w fazach 2-4 F-01), a klucz obcy nie pozwoli wskazać
 * czegoś, czego nie ma. Zachowanie odsiewu przy realnych składnikach jest sprawdzone na poziomie
 * bazy — patrz wpis C3 w `notes/cert-queue.md`. Tutaj sprawdzamy granicę danych i kontrakt trasy.
 */

/** Ustawienia odniesienia — mieszczą się w `PreferenceBounds` z `src/lib/preferences.ts`. */
const ReferencePreferences = { maxPrepMinutes: 30, mealsPerDay: 4 } as const;

/**
 * SZEREGOWO, i to jest świadome: wszystkie testy piszą do preferencji TEGO SAMEGO konta — mamy
 * jedno konto testowe, więc wiersz w D1 jest zasobem współdzielonym. Ten sam powód co
 * w `profile-api.spec.ts`.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Faza 1 S-03 — kontrakt preferencji po uwierzytelnieniu', () => {
  test('zapisane preferencje wracają tym samym kontraktem, z `no-store` (1.5)', async ({
    page,
    request,
  }) => {
    const token = await sessionToken(page);
    const auth = { Authorization: `Bearer ${token}` };

    const saved = await request.put('/api/preferences', {
      headers: auth,
      data: { preferences: ReferencePreferences, exclusions: [] },
    });
    expect(saved.status()).toBe(200);

    const savedBody = await saved.json();
    expect(savedBody.preferences).toMatchObject(ReferencePreferences);
    expect(savedBody.exclusions).toEqual([]);

    // Odczyt musi oddać to samo — inaczej zapis i odczyt opisują dane w dwóch miejscach.
    const read = await request.get('/api/preferences', { headers: auth });
    expect(read.status()).toBe(200);
    expect((await read.json()).preferences).toMatchObject(ReferencePreferences);

    // Wykluczenia żywieniowe mogą ujawnić wyznanie albo stan zdrowia — nie mają prawa wylądować
    // w cache przeglądarki (ustalenie F2 przeglądu S-02).
    expect(read.headers()['cache-control']).toContain('no-store');
  });

  test('serwer odrzuca ustawienia, których formularz by nie wypuścił', async ({
    page,
    request,
  }) => {
    const token = await sessionToken(page);
    const auth = { Authorization: `Bearer ${token}` };

    // Siedem posiłków — odrzucenie musi wskazać POLE, nie tylko zwrócić 400.
    const tooManyMeals = await request.put('/api/preferences', {
      headers: auth,
      data: { preferences: { maxPrepMinutes: 30, mealsPerDay: 7 }, exclusions: [] },
    });
    expect(tooManyMeals.status()).toBe(400);
    const tooManyBody = await tooManyMeals.json();
    expect(tooManyBody.error).toBe('invalid');
    expect(tooManyBody.fields).toHaveProperty('mealsPerDay');

    // Czas przygotowania poza zakresem z `PreferenceBounds` — granica żyje w module, nie w DDL,
    // więc to jedyne miejsce, które ją egzekwuje.
    const tooLong = await request.put('/api/preferences', {
      headers: auth,
      data: { preferences: { maxPrepMinutes: 999, mealsPerDay: 4 }, exclusions: [] },
    });
    expect(tooLong.status()).toBe(400);
    expect((await tooLong.json()).fields).toHaveProperty('maxPrepMinutes');

    // Wpis niezgodny sam ze sobą — `kind='ingredient'` bez `ingredientId`. Bez walidacji odbiłby
    // się dopiero od `CHECK` spójności w `0005`, czyli jako 500 zamiast 400.
    const brokenEntry = await request.put('/api/preferences', {
      headers: auth,
      data: {
        preferences: ReferencePreferences,
        exclusions: [{ kind: 'ingredient', dishId: 1 }],
      },
    });
    expect(brokenEntry.status()).toBe(400);
    expect((await brokenEntry.json()).fields).toHaveProperty('exclusions');

    // Odrzucenie musi być SKUTECZNE: poprzednie ustawienia zostają nietknięte.
    const afterReject = await request.get('/api/preferences', { headers: auth });
    expect((await afterReject.json()).preferences).toMatchObject(ReferencePreferences);
  });

  test('wykluczenie wskazujące nieistniejący byt to 400, nie 500', async ({ page, request }) => {
    const token = await sessionToken(page);
    const auth = { Authorization: `Bearer ${token}` };

    // Kształt poprawny, identyfikator wskazuje w próżnię. To błąd KLIENTA — komunikat „coś się
    // popsuło" byłby nieprawdą, a jednocześnie jedyną odpowiedzią bez tłumaczenia klucza obcego.
    const dangling = await request.put('/api/preferences', {
      headers: auth,
      data: {
        preferences: ReferencePreferences,
        exclusions: [{ kind: 'ingredient', ingredientId: 999_999, dishId: null, groupId: null }],
      },
    });

    expect(dangling.status()).toBe(400);
    const body = await dangling.json();
    expect(body.error).toBe('invalid');
    expect(body.fields).toHaveProperty('exclusions');
  });

  test('ciało, które nie jest JSON-em, to inny tryb awarii niż złe dane', async ({
    page,
    request,
  }) => {
    const token = await sessionToken(page);

    // Celowo `body`, nie `data`: `data` z łańcuchem znaków zostaje przez Playwrighta
    // ZSERIALIZOWANE do poprawnego JSON-a, więc parser trasy by go przyjął.
    const notJson = await request.put('/api/preferences', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{to nie jest json',
    });

    expect(notJson.status()).toBe(400);
    expect((await notJson.json()).error).toBe('invalid_json');
  });
});
