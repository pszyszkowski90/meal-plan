import { test, expect, type Browser, type Page } from '@playwright/test';

import { secondaryCredentials, signIn } from './support/sign-in';
import { sessionToken } from './support/token';

/**
 * Kryterium **1.6** fazy 1 S-03 (`context/changes/dietary-preferences/plan.md`) i **2.9** S-02 —
 * dowód izolacji między dwiema PRAWDZIWYMI tożsamościami.
 *
 * Dlaczego to musi być osobny plik z drugim kontem: `data-boundary.spec.ts` pilnuje warstwy
 * zewnętrznej — że bez tożsamości i z podrobionym tokenem trasa odmawia. To jest odmowa, nie
 * izolacja. Zapytanie, któremu ktoś usunąłby `WHERE user_id = ?`, przechodzi tamten plik
 * w całości na zielono: jeden token, jedno konto, jedyny wiersz w bazie należy do wołającego.
 * D1 nie ma RLS, więc ten filtr jest **jedyną** granicą między kontami — i jedynym sposobem,
 * żeby go sprawdzić, są dwie tożsamości naraz.
 *
 * Poświadczenia konta B czyta `secondaryCredentials()` ze środowiska harnessu — nigdy z repo.
 * Brak zmiennych to czytelny błąd, nie cicho pominięty test: test, który sam siebie wyłącza,
 * jest gorszy niż jego brak, bo wygląda w raporcie jak przebyty.
 */

/** Marker konta A — ten sam składnik, na którym stoją pozostałe specyfikacje preferencji. */
const MarkerA = 'pieczarki, świeże';
/** Marker konta B — **inny** składnik, żeby dało się odróżnić, czyj wpis widać. */
const MarkerB = 'łosoś atlantycki, surowy';

/** Szereg wymuszony: oba konta piszą do tej samej bazy, a testy zależą od stanu ustawionego wyżej. */
test.describe.configure({ mode: 'serial' });

function prepField(page: Page) {
  return page.getByRole('textbox', { name: 'Maksymalny czas przygotowania (min)' });
}

function searchField(page: Page) {
  return page.getByRole('textbox', { name: 'Szukaj składnika' });
}

/**
 * Wejście na ekran i czekanie na ZASTOSOWANIE pobrania, nie na samą odpowiedź — etykieta
 * „Zapisz" pojawia się dokładnie wtedy, gdy dane są już w stanie komponentu. Ten sam wzorzec
 * co w `preferences-screen.spec.ts`; powielony świadomie, bo tamten plik trzyma go prywatnie,
 * a wspólny helper na dwa pliki byłby dziś abstrakcją z jednym powodem istnienia.
 */
async function openPreferences(page: Page): Promise<void> {
  const loaded = page.waitForResponse(
    (r) => r.url().includes('/api/preferences') && r.request().method() === 'GET',
  );
  await page.goto('/preferences');
  await loaded;
  await expect(prepField(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zapisz', exact: true })).toBeVisible();
}

/** Ustawia wykluczenie składnikowe, jeśli konto jeszcze go nie ma, i zapisuje. */
async function ensureExclusion(page: Page, name: string, query: string): Promise<void> {
  if ((await page.getByRole('button', { name: `Usuń ${name}` }).count()) === 0) {
    await searchField(page).fill(query);
    await page.getByRole('button', { name: `Wyklucz ${name}` }).click();
  }
  await prepField(page).fill('45');
  await page.getByRole('radio', { name: '4', exact: true }).click();
  await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
  await expect(page.getByText('Zapisano')).toBeVisible();
}

/**
 * Świeży kontekst zalogowany kontem B. Wywołujący zamyka go sam.
 *
 * `storageState: undefined` jest tu KONIECZNE, a nie ozdobne. Fixture `browser` Playwrighta
 * podstawia opcje z `use` także do `browser.newContext()`, więc „świeży" kontekst dostawał
 * zapisaną sesję konta A — i bramka `(auth)` odsyłała z `/sign-in` prosto do aplikacji,
 * zalogowanej JAKO A. Test przechodził wtedy przez logowanie kontem B, nigdy go nie widząc,
 * i porównywałby konto A samo ze sobą. Zmierzone: pierwsze uruchomienie 14.09.2026 stanęło na
 * polu e-mail, którego na ekranie głównym nie ma.
 */
async function openAccountB(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await signIn(page, secondaryCredentials());
  return page;
}

test.describe('Ryzyko #1 — izolacja dwóch kont', () => {
  test('1.6 konto B nie widzi wykluczeń konta A ani ich nie nadpisuje', async ({
    browser,
    page,
  }) => {
    // Konto A — kontekst z zapisaną sesją, ten sam co w reszcie harnessu.
    await openPreferences(page);
    await ensureExclusion(page, MarkerA, 'pieczar');

    const pageB = await openAccountB(browser);
    try {
      await openPreferences(pageB);

      // Sedno kryterium: wpis konta A nie ma prawa pojawić się na ekranie konta B.
      await expect(pageB.getByRole('button', { name: `Usuń ${MarkerA}` })).toHaveCount(0);

      // Konto B zapisuje WŁASNE wykluczenie — i to jest moment, w którym zapytanie bez filtra
      // po `user_id` skasowałoby listę konta A (`replaceExclusions` kasuje i wstawia całość).
      await ensureExclusion(pageB, MarkerB, 'losos');

      await openPreferences(pageB);
      await expect(pageB.getByRole('button', { name: `Usuń ${MarkerB}` })).toBeVisible();
      await expect(pageB.getByRole('button', { name: `Usuń ${MarkerA}` })).toHaveCount(0);
    } finally {
      await pageB.context().close();
    }

    // I druga strona granicy: konto A ma dalej swoje i nie dostało cudzego.
    await openPreferences(page);
    await expect(page.getByRole('button', { name: `Usuń ${MarkerA}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `Usuń ${MarkerB}` })).toHaveCount(0);
  });

  test('1.6 trasa danych oddaje każdej tożsamości WYŁĄCZNIE jej wiersze', async ({
    browser,
    page,
    request,
  }) => {
    // Ten sam dowód z pominięciem interfejsu — gdyby ekran filtrował listę po swojej stronie,
    // test przez UI byłby zielony przy przeciekającej trasie. Filtr ma być w SQL-u.
    const tokenA = await sessionToken(page);

    const pageB = await openAccountB(browser);
    let tokenB: string;
    try {
      tokenB = await sessionToken(pageB);
    } finally {
      await pageB.context().close();
    }

    // Dwie tożsamości to naprawdę dwie tożsamości — inaczej cały plik niczego nie dowodzi.
    expect(tokenA).not.toBe(tokenB);

    // Wpis wykluczenia niesie IDENTYFIKATOR, nie nazwę — nazwy ekran bierze z katalogu. Test
    // porównuje więc to, co naprawdę leży w bazie, a tłumaczy na nazwy dopiero na potrzeby
    // czytelności asercji.
    const catalog = await request
      .get('/api/catalog', { headers: { Authorization: `Bearer ${tokenA}` } })
      .then((r) => r.json());
    const idOf = (name: string): number => {
      const found = catalog.ingredients.find((item: { name: string }) => item.name === name);
      if (!found) {
        throw new Error(`Składnika „${name}" nie ma w katalogu — zmienił się seed?`);
      }
      return found.id;
    };
    const ingredientA = idOf(MarkerA);
    const ingredientB = idOf(MarkerB);

    const [bodyA, bodyB] = await Promise.all([
      request
        .get('/api/preferences', { headers: { Authorization: `Bearer ${tokenA}` } })
        .then((r) => r.json()),
      request
        .get('/api/preferences', { headers: { Authorization: `Bearer ${tokenB}` } })
        .then((r) => r.json()),
    ]);

    const idsA = bodyA.exclusions.map((entry: { ingredientId: number | null }) => entry.ingredientId);
    const idsB = bodyB.exclusions.map((entry: { ingredientId: number | null }) => entry.ingredientId);

    expect(idsA).toContain(ingredientA);
    expect(idsA).not.toContain(ingredientB);
    expect(idsB).toContain(ingredientB);
    expect(idsB).not.toContain(ingredientA);
  });

  /**
   * S-04 kryterium 3.8 — plan jest danymi użytkownika i podlega tej samej granicy co preferencje.
   *
   * Plan ma cechę, której nie mają profil ani preferencje: `POST` **zastępuje** poprzedni plan,
   * kasując wiersze. Gdyby `savePlan` zgubiło `where user_id = ?1` w którymkolwiek z dwóch
   * `DELETE`, konto B skasowałoby plan konta A **wygenerowaniem własnego** — i nikt by się o tym
   * nie dowiedział, bo A zobaczyłby po prostu „brak planu". Dlatego kolejność tego testu jest
   * istotna: A generuje, B generuje, a potem sprawdzamy, czy A **wciąż ma swój**.
   */
  test('3.8 plan konta A przeżywa wygenerowanie planu przez konto B i nie miesza się z nim', async ({
    browser,
    page,
    request,
  }) => {
    const tokenA = await sessionToken(page);
    const authA = { Authorization: `Bearer ${tokenA}` };

    // Konto A: komplet wejść i własny plan.
    await request.put('/api/profile', {
      headers: authA,
      data: {
        age: 35,
        weightKg: 75,
        heightCm: 178,
        sex: 'male',
        activityLevel: 2,
        targetKcalOverride: 2200,
      },
    });
    await request.put('/api/preferences', {
      headers: authA,
      data: { preferences: { maxPrepMinutes: 30, mealsPerDay: 4 }, exclusions: [] },
    });
    expect((await request.post('/api/plan', { headers: authA, data: {} })).status()).toBe(201);

    const planA = await request.get('/api/plan', { headers: authA }).then((r) => r.json());
    expect(planA.plan).not.toBeNull();
    const dishesA: number[] = planA.plan.days.flatMap(
      (day: { meals: { dish: { id: number } }[] }) => day.meals.map((meal) => meal.dish.id)
    );
    expect(dishesA).toHaveLength(28);

    // Konto B: własny profil, inna liczba posiłków — żeby plany dało się od siebie odróżnić
    // po kształcie, a nie tylko po treści.
    const pageB = await openAccountB(browser);
    let tokenB: string;
    try {
      tokenB = await sessionToken(pageB);
    } finally {
      await pageB.context().close();
    }
    expect(tokenA).not.toBe(tokenB);
    const authB = { Authorization: `Bearer ${tokenB}` };

    await request.put('/api/profile', {
      headers: authB,
      data: {
        age: 30,
        weightKg: 60,
        heightCm: 165,
        sex: 'female',
        activityLevel: 2,
        targetKcalOverride: 1800,
      },
    });
    await request.put('/api/preferences', {
      headers: authB,
      data: { preferences: { maxPrepMinutes: 45, mealsPerDay: 3 }, exclusions: [] },
    });
    expect((await request.post('/api/plan', { headers: authB, data: {} })).status()).toBe(201);

    const [afterA, planB] = await Promise.all([
      request.get('/api/plan', { headers: authA }).then((r) => r.json()),
      request.get('/api/plan', { headers: authB }).then((r) => r.json()),
    ]);

    // A WCIĄŻ ma plan — to jest ta asercja, którą zgubiony `where user_id` w `DELETE` czerwieni.
    expect(afterA.plan, 'plan konta A zniknął po wygenerowaniu planu przez konto B').not.toBeNull();
    expect(afterA.plan.mealsPerDay).toBe(4);
    expect(afterA.plan.targetKcal).toBe(2200);
    expect(afterA.plan.days).toHaveLength(7);

    // B ma SWÓJ plan, o swoim kształcie — nie kopię planu A.
    expect(planB.plan).not.toBeNull();
    expect(planB.plan.mealsPerDay).toBe(3);
    expect(planB.plan.targetKcal).toBe(1800);
    expect(planB.plan.seed).not.toBe(afterA.plan.seed);
  });
});
