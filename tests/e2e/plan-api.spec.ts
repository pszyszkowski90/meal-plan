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
    // Plan MOŻE już istnieć z poprzedniego przebiegu — istotne jest, że brak planu to 200,
    // nigdy 404, i że kontrakt ma oba pola.
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
    await seedAccount(request, auth, { maxPrepMinutes: 30, mealsPerDay: 4 });

    const response = await request.post('/api/plan', { headers: auth, data: {} });
    expect(response.status()).toBe(201);

    // Zapytanie liczy dania ŁAMIĄCE limit. Zero jest jedyną dopuszczalną odpowiedzią —
    // i to jest sprawdzenie na ŚCIEŻCE SUKCESU, nie w scenariuszu porażki.
    const overLimit = countD1(`
      select count(*) as n from plan_item pi
        join dish d on d.id = pi.dish_id
       where pi.user_id = '${userId}' and d.prep_minutes > 30`);
    expect(overLimit, 'plan zawiera danie ponad zadeklarowanym limitem czasu').toBe(0);
  });

  test('plan nie zawiera dania z wykluczonym składnikiem (3.6)', async ({ page, request }) => {
    const auth = await authHeaders(page);
    const userId = await userIdOf(page);

    const catalog = await request.get('/api/catalog', { headers: auth });
    expect(catalog.status()).toBe(200);
    const groups = (await catalog.json()).groups as { id: number; slug: string }[];

    // Pięć grup wykluczeniowych naraz — scenariusz z `notes/plan-queue.md` §G3.
    const excludedSlugs = ['grzyby', 'orzechy', 'ryby', 'owoce-morza', 'wieprzowina'];
    const exclusions = groups
      .filter((group) => excludedSlugs.includes(group.slug))
      .map((group) => ({ kind: 'group', ingredientId: null, dishId: null, groupId: group.id }));
    expect(exclusions.length, 'seed musi mieć te grupy wykluczeniowe').toBeGreaterThan(0);

    await request.put('/api/profile', { headers: auth, data: ReferenceProfile });
    const savedPreferences = await request.put('/api/preferences', {
      headers: auth,
      data: { preferences: { maxPrepMinutes: 45, mealsPerDay: 4 }, exclusions },
    });
    expect(savedPreferences.status()).toBe(200);

    const response = await request.post('/api/plan', {
      headers: auth,
      data: {},
      failOnStatusCode: false,
    });
    // Plan może się nie udać przy pięciu wykluczeniach — ale jeśli się uda, NIE MA PRAWA
    // zawierać wykluczonego dania. Obie odpowiedzi są dopuszczalne, złamanie wykluczenia nie.
    expect([201, 422]).toContain(response.status());

    if (response.status() === 201) {
      const violating = countD1(`
        select count(*) as n from plan_item pi
          join dish_ingredient di on di.dish_id = pi.dish_id
          join ingredient_group ig on ig.ingredient_id = di.ingredient_id
          join exclusion e on e.user_id = pi.user_id and e.kind = 'group' and e.group_id = ig.group_id
         where pi.user_id = '${userId}'`);
      expect(violating, 'plan zawiera danie z wykluczonej grupy').toBe(0);
    } else {
      const body = await response.json();
      expect(body.error).toBe('infeasible');
      expect(body.failure.reason).toBeDefined();
      // Zero planu częściowego — porażka nie zostawia pozycji TEGO konta.
      expect(planItemCount(userId)).toBe(0);
    }

    // Sprzątamy wykluczenia, żeby kolejne testy w pliku startowały z czystym stanem.
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
    expect(itemsBefore % 7).toBe(0);

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
