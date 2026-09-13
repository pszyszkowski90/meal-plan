import { test, expect } from '@playwright/test';

/**
 * Ryzyko #1 z `context/foundation/test-plan.md`: konto A odczytuje lub nadpisuje dane profilu
 * konta B. D1 nie ma RLS, więc filtrowanie po `userId` w zapytaniu jest **jedyną** izolacją
 * między kontami — nie ma drugiej warstwy, która złapałaby błąd.
 *
 * Ten plik pilnuje warstwy zewnętrznej: żadna trasa danych nie oddaje niczego bez tożsamości
 * i nie przyjmuje tożsamości podrobionej. Pełny dowód izolacji wymaga drugiego konta i należy
 * do fazy 3 wdrożenia z planu testów (§3) — tutaj jest to odnotowane, a nie udawane.
 *
 * Cały plik jedzie na czystym kontekście: sprawdzamy kontrakt odmowy, nie widok zalogowanego.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const DataRoutes = ['/api/account', '/api/profile', '/api/preferences'] as const;

test.describe('Ryzyko #1 — granica danych', () => {
  for (const route of DataRoutes) {
    test(`${route} bez nagłówka Authorization odmawia i nie oddaje danych`, async ({ request }) => {
      const response = await request.get(route);

      expect(response.status()).toBe(401);

      // Odmowa musi być pusta: 401 z danymi w ciele byłoby wyciekiem mimo poprawnego kodu.
      const body = await response.text();
      expect(body).not.toMatch(/user_/);
      expect(body).not.toMatch(/"(weight|height|age|sex)"/);
      // Wykluczenia żywieniowe potrafią ujawnić wyznanie albo stan zdrowia — 401 nie ma prawa
      // przepuścić ani listy, ani ustawień.
      expect(body).not.toMatch(/"(exclusions|maxPrepMinutes|mealsPerDay)"/);
    });

    test(`${route} z podrobionym tokenem odmawia`, async ({ request }) => {
      // Poprawny kształt JWT, podpis nie nasz — trasa nie może ufać samemu kształtowi.
      const forged =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJzdWIiOiJ1c2VyX3BvZHJvYmlvbnkiLCJleHAiOjQ4ODc2NTQzMjF9.' +
        'podpis-ktorego-nie-da-sie-zweryfikowac';

      const response = await request.get(route, {
        headers: { Authorization: `Bearer ${forged}` },
      });

      expect(response.status()).toBe(401);
      expect(await response.text()).not.toMatch(/user_podrobiony/);
    });
  }

  test('PUT /api/profile bez tożsamości nie zapisuje', async ({ request }) => {
    const response = await request.put('/api/profile', {
      data: { weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 3 },
    });

    expect(response.status()).toBe(401);
  });

  test('PUT /api/preferences bez tożsamości nie zapisuje', async ({ request }) => {
    const response = await request.put('/api/preferences', {
      data: { preferences: { maxPrepMinutes: 30, mealsPerDay: 4 }, exclusions: [] },
    });

    expect(response.status()).toBe(401);
  });
});
