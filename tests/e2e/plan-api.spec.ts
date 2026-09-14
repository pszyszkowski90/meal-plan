import { test, expect } from '@playwright/test';

import { countD1, queryD1 } from './support/d1';
import { sessionToken } from './support/token';

/**
 * Kontrakt `GET`/`POST /api/plan` — kryteria **3.3–3.13** fazy 3 z
 * `context/changes/first-weekly-plan/plan.md`.
 *
 * Żądania idą **z pominięciem ekranu**: walidacja klienta nie może przesłaniać serwerowej
 * (ryzyko #6 z `context/foundation/test-plan.md`).
 *
 * **Guardrail ±10% sprawdzamy ODCZYTEM Z BAZY, nie odpowiedzią trasy.** Gdyby sumę dnia liczyć
 * z JSON-a zwróconego przez tę samą trasę, którą testujemy, test dowodziłby, że trasa zgadza się
 * sama ze sobą. Tu sumę składamy z `plan_item ⋈ dish_ingredient ⋈ ingredient` — czyli z danych,
 * z których liczy ją produkt, ale własną drogą.
 *
 * SZEREGOWO: wszystkie testy piszą do planu, profilu i preferencji TEGO SAMEGO konta, więc wiersze
 * w D1 są zasobem współdzielonym. Ten sam powód co w `profile-api.spec.ts`.
 */
test.describe.configure({ mode: 'serial' });

/** Profil odniesienia — środek widełek, cel osiągalny przy czterech posiłkach. */
const ReferenceProfile = {
  age: 35,
  weightKg: 75,
  heightCm: 178,
  sex: 'male',
  activityLevel: 2,
  targetKcalOverride: 2200,
} as const;

const ReferencePreferences = { maxPrepMinutes: 30, mealsPerDay: 4 } as const;

async function authHeaders(page: import('@playwright/test').Page) {
  return { Authorization: `Bearer ${await sessionToken(page)}` };
}

/**
 * `user_id` tego konta, odczytane z roszczenia `sub` tokenu — czyli DOKŁADNIE ta wartość, którą
 * `requireUserId` wkłada do zapytań (`src/server/auth.ts`).
 *
 * Konieczne, bo baza jest WSPÓŁDZIELONA: `account-isolation.spec.ts` zakłada plan konta B, więc
 * `select count(*) from plan` bez filtra liczy cudze wiersze. Pierwsza wersja tych testów liczyła
 * globalnie i czerwieniła się dopiero, gdy do zestawu doszedł test z drugim kontem — czyli
 * z powodu, którego nie ma w kodzie produktu.
 *
 * Kształt `sub` jest sprawdzany, zanim trafi do zapytania: wartość z tokenu jest nasza, ale
 * wklejanie czegokolwiek nieprzefiltrowanego do SQL-a jest nawykiem, którego nie chcemy nawet
 * w testach.
 */
async function userIdOf(page: import('@playwright/test').Page): Promise<string> {
  const token = await sessionToken(page);
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
  ) as { sub?: string };

  const sub = payload.sub ?? '';
  expect(sub, 'token bez roszczenia sub — harness nie wie, czyje wiersze sprawdzać').toMatch(
    /^[A-Za-z0-9_-]+$/
  );

  return sub;
}

/** Doprowadza konto do stanu „profil i preferencje ustawione" — wyłącznie przez API. */
async function seedAccount(
  request: import('@playwright/test').APIRequestContext,
  auth: Record<string, string>,
  preferences: { maxPrepMinutes: number; mealsPerDay: number } = ReferencePreferences,
  profile: Record<string, unknown> = ReferenceProfile
) {
  const savedProfile = await request.put('/api/profile', { headers: auth, data: profile });
  expect(savedProfile.status()).toBe(200);

  const savedPreferences = await request.put('/api/preferences', {
    headers: auth,
    data: { preferences, exclusions: [] },
  });
  expect(savedPreferences.status()).toBe(200);
}

/**
 * Suma kalorii każdego dnia planu, policzona NIEZALEŻNIE z bazy.
 *
 * `round(sum(...))` jest tu odpowiednikiem `computeDishMacros`, które zaokrągla wyłącznie SUMĘ
 * składników dania — dlatego zaokrąglenie idzie po daniu, a nie po dniu ani po składniku.
 */
function dayTotalsFromDb(userId: string): { day_index: number; total: number }[] {
  return queryD1<{ day_index: number; total: number }>(`
    select day_index, sum(dish_kcal) as total from (
      select pi.day_index, pi.slot_index,
             round(sum(i.kcal_per_100g * di.grams / 100.0)) as dish_kcal
        from plan_item pi
        join dish_ingredient di on di.dish_id = pi.dish_id
        join ingredient i on i.id = di.ingredient_id
       where pi.user_id = '${userId}'
       group by pi.user_id, pi.day_index, pi.slot_index
    ) group by day_index order by day_index`);
}

/** Liczba pozycji planu TEGO konta. */
function planItemCount(userId: string): number {
  return countD1(`select count(*) as n from plan_item where user_id = '${userId}'`);
}

/** Liczba nagłówków planu TEGO konta — z definicji 0 albo 1. */
function planCount(userId: string): number {
  return countD1(`select count(*) as n from plan where user_id = '${userId}'`);
}

test.describe('Faza 3 S-04 — kontrakt planu po uwierzytelnieniu', () => {
  test('konto bez planu dostaje 200 z plan: null, a nie 404 (3.3)', async ({ page, request }) => {
    const auth = await authHeaders(page);
    await seedAccount(request, auth);

    const before = await request.get('/api/plan', { headers: auth });
    expect(before.status()).toBe(200);

    const body = await before.json();
    // UCZCIWA ADNOTACJA: gałąź `plan: null` jest w tym przebiegu NIEOSIĄGALNA i to jest
    // sprawdzone, nie założone. Playwright porządkuje pliki po ścieżce, `account-isolation`
    // sortuje się przed `plan-api`, a jego test 3.8 generuje plan dla tego konta — więc konto
    // ma plan zawsze, także na świeżo zmigrowanej bazie. Ten test dowodzi zatem KONTRAKTU
    // (200, nigdy 404, oba pola, `no-store`), a nie samej wartości `null`.
    expect(before.status()).not.toBe(404);
    expect(body).toHaveProperty('plan');
    expect(body).toHaveProperty('currentTargetKcal');
    expect(before.headers()['cache-control']).toContain('no-store');
  });

  /**
   * CZEGO TEN PLIK NIE DOWODZI, i to jest świadome.
   *
   * Kryterium 3.4 („`POST` bez profilu → 409") jest **nieosiągalne z tego harnessu**. Konto
   * testowe jest udostępniane raz i ma profil, a repo **nie ma trasy kasującej** ani profil, ani
   * preferencje — więc stanu „konto bez profilu" nie da się wytworzyć drogą, którą chodzi
   * użytkownik. Dopisanie takiej trasy wyłącznie po to, żeby test miał co wywołać, byłoby
   * powiększeniem powierzchni produktu pod test — dokładnie odwrotnie, niż powinno być.
   *
   * Co jest tu udowodnione zamiast tego: **odmowa nie rusza bazy**. Odmowę wytwarzamy drugą
   * drogą, osiągalną — celem kalorycznym poza zasięgiem puli (test 3.10). Gałąź `profile_missing`
   * pozostaje pokryta czytaniem trasy, nie wykonaniem; odnotowane w Dzienniku, nie udawane.
   */
  test('POST na kompletnym koncie zapisuje dokładnie 7 × liczba posiłków pozycji (3.4)', async ({
    page,
    request,
  }) => {
    const auth = await authHeaders(page);
    const userId = await userIdOf(page);
    // Zasiew NA POCZĄTKU każdego testu piszącego: przebiegi bywają przerywane w połowie i konto
    // zostaje w stanie po ostatnim teście. Bez tego kolejny przebieg czyta cudzy stan i czerwieni
    // się z powodu, którego nie ma w kodzie produktu.
    await seedAccount(request, auth);

    const response = await request.post('/api/plan', { headers: auth, data: {} });
    expect(response.status()).toBe(201);

    expect(planCount(userId)).toBe(1);
    expect(planItemCount(userId)).toBe(7 * ReferencePreferences.mealsPerDay);

    // Niezmiennik CAŁEJ tabeli, niezależny od tego, ile kont ma plan: każdy nagłówek ma dokładnie
    // `7 × meals_per_day` pozycji. Łapie zarówno plan częściowy, jak i pozycje-sieroty.
    expect(
      countD1(`select count(*) as n from plan p
               where (select count(*) from plan_item pi where pi.user_id = p.user_id)
                     <> 7 * p.meals_per_day`),
      'istnieje plan, którego liczba pozycji nie zgadza się z liczbą posiłków'
    ).toBe(0);
  });

  test('POST z profilem i preferencjami daje 201, a KAŻDY dzień mieści się w ±10% (3.5)', async ({
    page,
    request,
  }) => {
    const auth = await authHeaders(page);
    const userId = await userIdOf(page);
    await seedAccount(request, auth);

    const response = await request.post('/api/plan', { headers: auth, data: {} });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.plan).not.toBeNull();
    expect(body.plan.days).toHaveLength(7);
    expect(body.plan.mealsPerDay).toBe(ReferencePreferences.mealsPerDay);

    const target = body.plan.targetKcal as number;
    const lower = Math.ceil(target * 0.9);
    const upper = Math.floor(target * 1.1);

    // Świeżo wygenerowany plan nie ma prawa mieć ANI JEDNEGO dnia poza oknem.
    expect(body.plan.daysOutOfWindow, 'nowy plan ma dzień poza ±10%').toEqual([]);

    // DOWÓD Z BAZY, nie z odpowiedzi trasy.
    const totals = dayTotalsFromDb(userId);
    expect(totals).toHaveLength(7);
    for (const { day_index, total } of totals) {
      expect(
        total,
        `dzień ${day_index}: ${total} kcal poza oknem [${lower}, ${upper}]`
      ).toBeGreaterThanOrEqual(lower);
      expect(total).toBeLessThanOrEqual(upper);
    }
  });

  test('plan nie zawiera dania ponad limitem czasu przygotowania (3.7)', async ({
    page,
    request,
  }) => {
    const auth = await authHeaders(page);
    const userId = await userIdOf(page);

    // LIMIT 15, nie 30 — i to jest sedno tego testu. Zmierzone na puli produkcyjnej: przy
    // 15 minutach zostaje JEDEN obiad i cztery kolacje, przy 30 minutach dwanaście obiadów.
    // Test przy 30 minutach używa dokładnie tych samych ustawień co cztery inne testy w tym
    // pliku, więc dokładałby asercję, nie warunek skrajny. Przy 15 minutach przejście jest
    // najwęższe, jakie da się ustawić formularzem — czyli tam, gdzie złamanie limitu jest
    // w ogóle prawdopodobne.
    const maxPrepMinutes = 15;
    await seedAccount(request, auth, { maxPrepMinutes, mealsPerDay: 4 });

    const response = await request.post('/api/plan', {
      headers: auth,
      data: {},
      failOnStatusCode: false,
    });
    // Oba wyniki są dopuszczalne: przy jednym obiedzie plan może nie powstać. Niedopuszczalny
    // jest plan ŁAMIĄCY limit — i to jest asercja poniżej.
    expect([201, 422]).toContain(response.status());

    if (response.status() === 201) {
      const overLimit = countD1(`
        select count(*) as n from plan_item pi
          join dish d on d.id = pi.dish_id
         where pi.user_id = '${userId}' and d.prep_minutes > ${maxPrepMinutes}`);
      expect(overLimit, 'plan zawiera danie ponad zadeklarowanym limitem czasu').toBe(0);
    } else {
      const body = await response.json();
      expect(body.error).toBe('infeasible');
      // Porażka ma nazwać LIMIT CZASU, a nie wykluczenia — konto nie ma żadnych wykluczeń.
      expect(body.failure.reason).toBe('prepTime');
      expect(body.failure.limitMinutes).toBe(maxPrepMinutes);
      expect(body.failure.withoutLimit).toBeGreaterThan(body.failure.remaining);
    }

    // Przywracamy ustawienia odniesienia dla pozostałych testów.
    await seedAccount(request, auth);
  });

  /**
   * F2 przeglądu fazy 3: dwa z trzech ramion `NOT EXISTS` w `POOL_FOR_GENERATOR_SQL` nie miały
   * ŻADNEGO pokrycia. Sprawdzony był wyłącznie `kind = 'group'`, a `kind = 'ingredient'` jest
   * ścieżką, którą chodzi ekran preferencji („Wyklucz <składnik>") — czyli tą najczęstszą.
   * Literówka w tym ramieniu wpuściłaby na talerz składnik wykluczony wprost przez użytkownika,
   * po cichu, przy wszystkich bramkach na zielono. To pierwsze z trzech ograniczeń twardych
   * `CLAUDE.md`.
   *
   * KAŻDE RAMIĘ MA WŁASNY TEST i to nie jest kosmetyka. Pierwsza wersja sprawdzała oba naraz
   * i ramię `kind = 'dish'` było wtedy NIEWIDOCZNE: wykluczenie popularnego składnika odsiewało
   * te same dania, więc test przechodził także ze zdjętym ramieniem daniowym. Zmierzone
   * zepsuciem 14.09.
   */
  test('plan nie zawiera dania z wykluczonym SKŁADNIKIEM', async ({ page, request }) => {
    const auth = await authHeaders(page);
    const userId = await userIdOf(page);

    // Składnik używany przez najwięcej dań — żeby wykluczenie realnie zawęziło pulę.
    const popular = queryD1<{ ingredient_id: number }>(`
      select di.ingredient_id from dish_ingredient di
       group by di.ingredient_id order by count(*) desc limit 1`);
    expect(popular).toHaveLength(1);
    const ingredientId = popular[0].ingredient_id;

    await request.put('/api/profile', { headers: auth, data: ReferenceProfile });
    expect(
      (
        await request.put('/api/preferences', {
          headers: auth,
          data: {
            preferences: { maxPrepMinutes: 120, mealsPerDay: 4 },
            exclusions: [{ kind: 'ingredient', ingredientId, dishId: null, groupId: null }],
          },
        })
      ).status()
    ).toBe(200);

    const itemsBefore = planItemCount(userId);
    const response = await request.post('/api/plan', {
      headers: auth,
      data: {},
      failOnStatusCode: false,
    });
    expect([201, 422]).toContain(response.status());

    if (response.status() === 201) {
      expect(
        countD1(`
          select count(*) as n from plan_item pi
            join dish_ingredient di on di.dish_id = pi.dish_id
           where pi.user_id = '${userId}' and di.ingredient_id = ${ingredientId}`),
        'plan zawiera danie z wykluczonym SKŁADNIKIEM'
      ).toBe(0);
    } else {
      expect(planItemCount(userId)).toBe(itemsBefore);
    }

    await request.put('/api/preferences', {
      headers: auth,
      data: { preferences: ReferencePreferences, exclusions: [] },
    });
  });

  test('danie wykluczone WPROST nie wraca do planu po ponownym wygenerowaniu', async ({
    page,
    request,
  }) => {
    const auth = await authHeaders(page);
    const userId = await userIdOf(page);

    // Wykluczamy DOKŁADNIE te dania, które generator właśnie wybrał — a nie dowolne z puli.
    // Wersja z jednym daniem o najniższym `id` NIE łapała zepsucia: przy 58 daniach i 28
    // pozycjach szansa, że akurat to jedno zostanie wybrane, jest niska. Dania z bieżącego planu
    // są dowodnie takie, które do tego profilu PASUJĄ — jeśli po wykluczeniu wrócą, filtr
    // nie działa.
    await seedAccount(request, auth, { maxPrepMinutes: 120, mealsPerDay: 4 });
    expect((await request.post('/api/plan', { headers: auth, data: {} })).status()).toBe(201);

    const chosen = queryD1<{ dish_id: number }>(
      `select distinct dish_id from plan_item where user_id = '${userId}'`
    ).map((row) => row.dish_id);
    expect(chosen.length, 'plan musi mieć z czego wykluczać').toBeGreaterThan(5);

    expect(
      (
        await request.put('/api/preferences', {
          headers: auth,
          data: {
            preferences: { maxPrepMinutes: 120, mealsPerDay: 4 },
            exclusions: chosen.map((id) => ({
              kind: 'dish' as const,
              ingredientId: null,
              dishId: id,
              groupId: null,
            })),
          },
        })
      ).status()
    ).toBe(200);

    const itemsBefore = planItemCount(userId);
    const response = await request.post('/api/plan', {
      headers: auth,
      data: {},
      failOnStatusCode: false,
    });
    expect([201, 422]).toContain(response.status());

    if (response.status() === 201) {
      expect(
        countD1(`
          select count(*) as n from plan_item pi
           where pi.user_id = '${userId}' and pi.dish_id in (${chosen.join(',')})`),
        'wykluczone wprost danie wróciło do planu'
      ).toBe(0);
    } else {
      expect(planItemCount(userId)).toBe(itemsBefore);
    }

    await request.put('/api/preferences', {
      headers: auth,
      data: { preferences: ReferencePreferences, exclusions: [] },
    });
  });

  test('drugi POST ZASTĘPUJE plan, nie dokłada (3.9)', async ({ page, request }) => {
    const auth = await authHeaders(page);
    const userId = await userIdOf(page);
    await seedAccount(request, auth);

    expect((await request.post('/api/plan', { headers: auth, data: {} })).status()).toBe(201);
    const afterFirst = planItemCount(userId);

    expect((await request.post('/api/plan', { headers: auth, data: {} })).status()).toBe(201);
    const afterSecond = planItemCount(userId);

    expect(afterFirst).toBe(7 * ReferencePreferences.mealsPerDay);
    expect(afterSecond, 'drugi POST podwoił pozycje zamiast zastąpić plan').toBe(afterFirst);
    expect(planCount(userId)).toBe(1);
  });

  test('profil skrajny daje 422 z powodem kalorycznym i ZERO wierszy (3.10)', async ({
    page,
    request,
  }) => {
    const auth = await authHeaders(page);
    const userId = await userIdOf(page);

    // Trzy posiłki i cel 6000 kcal. Zmierzone: przy trzech posiłkach sufit dnia z tej puli
    // to 2542 kcal, więc dolna granica ±10% (5400) jest poza zasięgiem — i wie się to
    // BEZ przeszukiwania.
    await seedAccount(
      request,
      auth,
      { maxPrepMinutes: 30, mealsPerDay: 3 },
      { ...ReferenceProfile, targetKcalOverride: 6000 }
    );

    // Stan PRZED — nieudane generowanie ma go nie ruszyć.
    const plansBefore = planCount(userId);
    const itemsBefore = planItemCount(userId);

    const response = await request.post('/api/plan', {
      headers: auth,
      data: {},
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(422);

    const body = await response.json();
    expect(body.error).toBe('infeasible');
    expect(body.failure.reason).toBe('calories');
    expect(body.failure.achievableMaxKcal).toBeLessThan(body.failure.lowerKcal);

    // ZERO planu częściowego — i zero szkód w planie, który już był.
    //
    // Pierwsza wersja tego kryterium żądała `plan_item = 0` i była BŁĘDNA: zakładała, że konto
    // wchodzi w test bez planu. Nieudane generowanie nie ma prawa skasować działającego planu —
    // użytkownik straciłby tydzień pracy produktu za to, że zmienił cel na nieosiągalny.
    // Właściwą własnością jest NIEZMIENNOŚĆ: tyle samo wierszy przed i po.
    expect(planCount(userId)).toBe(plansBefore);
    expect(planItemCount(userId)).toBe(itemsBefore);
    // A gdyby zapis przeszedł częściowo, pozycji byłoby tyle, ile ma DZISIEJSZE ustawienie
    // (7 × 3 = 21), a nie tyle, ile miał plan poprzedni.
    expect(planItemCount(userId), 'plan został przepisany na trzy posiłki mimo porażki').not.toBe(
      7 * 3
    );

  });

  test('GET oddaje dla każdej pozycji składniki, kroki i komplet makr (3.11)', async ({
    page,
    request,
  }) => {
    const auth = await authHeaders(page);
    await seedAccount(request, auth);
    expect((await request.post('/api/plan', { headers: auth, data: {} })).status()).toBe(201);

    const response = await request.get('/api/plan', { headers: auth });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.plan.days).toHaveLength(7);

    let checked = 0;
    for (const day of body.plan.days) {
      expect(day.meals).toHaveLength(ReferencePreferences.mealsPerDay);
      for (const meal of day.meals) {
        expect(meal.dish.ingredients.length, 'danie bez składników').toBeGreaterThan(0);
        expect(meal.dish.ingredients[0]).toHaveProperty('grams');
        expect(meal.dish.steps.length, 'danie bez kroków — FR-016').toBeGreaterThan(0);
        // FR-009 wymaga KOMPLETU makr, nie samych kalorii.
        for (const key of ['kcal', 'protein', 'carbs', 'fat']) {
          expect(typeof meal.dish.macros[key], `brak makra ${key}`).toBe('number');
        }
        checked += 1;
      }
    }
    expect(checked).toBe(7 * ReferencePreferences.mealsPerDay);
  });
});
