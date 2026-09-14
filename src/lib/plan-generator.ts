/**
 * Generator tygodniowego jadłospisu — faza 2 S-04.
 *
 * TU MIESZKA GUARDRAIL ±10% i jest to pierwsze miejsce w tym repo, w którym ograniczenie
 * produktowe jest LICZONE, a nie deklarowane. `CLAUDE.md` nazywa trzy ograniczenia twarde
 * (kalorie, wykluczenia, czas przygotowania) i czwartą regułę, którą najłatwiej złamać po cichu:
 * gdy planu nie da się ułożyć, wolno zwrócić WYŁĄCZNIE błąd nazywający ograniczenie — nigdy
 * planu częściowego. „Prawie się zmieściło" jest kuszące i niewidoczne dla użytkownika.
 *
 * Moduł jest CZYSTY: zero bazy, zero HTTP, jeden import typu. To nie jest estetyka — `npm test`
 * to `node --test` z okrajaniem typów, więc guardrail da się przypiąć wyrocznią policzoną
 * na kartce, zamiast przez bazę i trzy warstwy sieci. Ta sama zasada, co w `calorie-target.ts`
 * i `dish-validation.ts`: żadnego `enum`, `namespace` ani właściwości w parametrach konstruktora —
 * Node ich nie okroi, a `tsc` nie ostrzeże.
 *
 * ODSIEW ROBI TEN MODUŁ, nie zapytanie. Do środka wchodzi pula PEŁNA, z flagą `passesExclusions`
 * policzoną w SQL-u tymi samymi warunkami `NOT EXISTS`, co `listAllowedDishes`. Powód jest
 * wydajnościowy i wprost sprzeczny z pierwszym odruchem: diagnoza porażki musi umieć odpowiedzieć
 * „a gdyby zdjąć limit czasu?", więc potrzebuje dań ODRZUCONYCH. Gdyby pula wchodziła już odsiana,
 * trzeba by ciągnąć ją drugi raz — na KAŻDYM żądaniu, także udanym, w jedynym miejscu tego
 * produktu, gdzie limit 10 ms CPU realnie grozi.
 */

import type { MealSlot } from './dish-validation.ts';

/**
 * Guardrail ±10%. JEDNO miejsce w repo — do 14.09.2026 ta liczba żyła jako `const Tolerance`
 * w `scripts/check-pool-feasibility.mjs` i jako proza w `CLAUDE.md`, czyli ograniczenie, którego
 * złamanie unieważnia produkt, nie miało w kodzie żadnego wspólnego źródła.
 */
export const CalorieTolerance = 0.1;

/** Horyzont planu. FR-008 mówi „tydzień" i nie jest to parametr produktu. */
export const PlanDays = 7;

/**
 * Sufit odwiedzonych węzłów przeszukiwania. Istnieje, bo limit 10 ms CPU w Workerze ZABIJA
 * wywołanie, a nie spowalnia je — przekroczenie to 500 bez żadnej wskazówki dla użytkownika.
 *
 * Wartość jest ZGRUBNIE ZMIERZONA, nie zgadnięta. Pierwsza wersja miała 200 000 i przegląd
 * pokazał, że to jest po ZŁEJ stronie limitu: przy ~0,06 µs na węzeł pełny budżet kosztuje
 * ~12 ms rozgrzanego V8 na maszynie deweloperskiej, czyli więcej niż 10 ms, których ma bronić —
 * a zimny isolate `workerd` jest wolniejszy. 100 000 węzłów to ~5,7 ms w tym samym pomiarze.
 * Ścieżka udana jest o rzędy wielkości tańsza (0,05–0,14 ms na realnej puli 58 dań), więc ten
 * sufit dotyka wyłącznie przypadków patologicznych.
 *
 * Właściwa kalibracja — na `workerd`, nie na Node — należy do G4 (`notes/plan-queue.md`).
 */
export const DefaultNodeBudget = 100_000;

/** Dopuszczalne liczby posiłków — enumeracja z `CHECK` na `user_preferences` w migracji `0005`. */
export type MealsPerDay = 3 | 4 | 5 | 6;

/**
 * Danie wchodzące do generatora.
 *
 * `kcal` jest już POLICZONE przez `computeDishMacros` — ten moduł nie robi arytmetyki makr,
 * bo jedno źródło prawdy dla niej jest w `dish-macros.ts` i kopia tutaj rozjechałaby się przy
 * pierwszej korekcie gramatury.
 */
export interface GeneratorDish {
  id: number;
  name: string;
  prepMinutes: number;
  mealSlots: readonly MealSlot[];
  kcal: number;
  /** `false` = danie odsiane przez wykluczenia użytkownika (`kind` ingredient/dish/group). */
  passesExclusions: boolean;
}

export interface GeneratorInput {
  /** `effectiveKcal` z `computeCalorieTarget` — przycięty i odporny na nadpisanie zerem. */
  targetKcal: number;
  mealsPerDay: MealsPerDay;
  maxPrepMinutes: number;
  /** Ziarno. Ten sam ziarno + to samo wejście = ten sam plan. */
  seed: string;
  /** Pula PEŁNA, nieodsiana. Patrz nagłówek modułu. */
  pool: readonly GeneratorDish[];
  nodeBudget?: number;
}

export interface PlanMeal {
  /** Pozycja w dniu, od 1. Osobna od `mealSlot`, bo pora „snack" powtarza się w dniu. */
  slotIndex: number;
  mealSlot: MealSlot;
  dishId: number;
}

export interface PlanDay {
  /** Od 1 do `PlanDays`. */
  dayIndex: number;
  meals: readonly PlanMeal[];
  totalKcal: number;
}

/**
 * Powód, dla którego planu nie da się ułożyć — DANE, nie `throw new Error('…')` rozsiany
 * po kodzie. `CLAUDE.md` wymaga, żeby komunikat nazwał, KTÓREGO z trzech ograniczeń nie da się
 * spełnić; napis wklejony w miejscu rzucenia nie da się ani przetestować, ani przetłumaczyć.
 *
 * Każde ramię niesie DOWÓD, a nie samą etykietę — `withoutExclusions` i `withoutLimit` mówią,
 * ile dań wróciłoby po zdjęciu danego filtru, więc diagnoza jest przeciwfaktyczna, nie zgadnięta.
 *
 * Różnica między `calories` a `combination` jest istotna dla RADY, jakiej ekran udziela:
 *   * `calories` — granice osiągalne w ogóle nie sięgają okna. Radą jest zmiana liczby posiłków
 *     (zmierzone: przy 3 posiłkach sufit dnia to 2542 kcal, więc cel 3200 jest nieosiągalny).
 *   * `combination` — granice okno obejmują, ale ŻADNE złożenie w nie nie trafia. Radą jest
 *     poluzowanie limitu czasu albo wykluczeń, żeby wpuścić do puli inne dania.
 *
 * `searchBudget` NIE JEST czwartym ograniczeniem produktowym. To granica implementacji:
 * przeszukiwanie odpuściło, więc nie wolno twierdzić „nie da się". Ma być rzadkie — jak rzadkie,
 * mierzy G4.
 */
export type PlanFailure =
  | {
      reason: 'exclusions';
      slot: MealSlot;
      remaining: number;
      withoutExclusions: number;
    }
  | {
      reason: 'prepTime';
      slot: MealSlot;
      remaining: number;
      limitMinutes: number;
      withoutLimit: number;
    }
  | {
      reason: 'calories';
      targetKcal: number;
      lowerKcal: number;
      upperKcal: number;
      achievableMinKcal: number;
      achievableMaxKcal: number;
      mealsPerDay: number;
    }
  | {
      reason: 'combination';
      targetKcal: number;
      lowerKcal: number;
      upperKcal: number;
      visitedNodes: number;
      mealsPerDay: number;
    }
  | { reason: 'searchBudget'; visitedNodes: number; budget: number };

export type GeneratorResult =
  | { ok: true; days: readonly PlanDay[] }
  | { ok: false; failure: PlanFailure };

/**
 * Skład dnia. Trzy posiłki główne plus przekąski — dokładnie jak w skrypcie wykonalności
 * (`check-pool-feasibility.mjs:49-51`), żeby raport i generator mówiły o tym samym dniu.
 */
export function daySlots(mealsPerDay: MealsPerDay): readonly MealSlot[] {
  const snacks: MealSlot[] = [];
  for (let index = 0; index < mealsPerDay - 3; index += 1) {
    snacks.push('snack');
  }
  return ['breakfast', 'lunch', 'dinner', ...snacks];
}

/**
 * Ile razy dana pora jest wybierana w CAŁYM tygodniu.
 *
 * To jest liczba, o którą rozbiła się pierwsza wersja reguły powtórzeń: pora „snack" przy sześciu
 * posiłkach jest wybierana 7 × 3 = 21 razy, a nie 7. Limit liczony od liczby DNI dopuszczał
 * wtedy 15 użyć przy pełnej puli 15 przekąsek — czyli wywracał jedyną konfigurację, w której
 * cel 3200 kcal jest w ogóle osiągalny.
 */
function picksPerWeek(mealsPerDay: MealsPerDay, slot: MealSlot): number {
  return PlanDays * daySlots(mealsPerDay).filter((entry) => entry === slot).length;
}

/**
 * Ile razy wolno użyć jednego dania w tygodniu.
 *
 * Limit jest POCHODNĄ rozmiaru puli, nie stałą: przy 12 obiadach na 7 wyborów daje 1 (żadnych
 * powtórzeń), przy 2 śniadaniach daje 4. Zmierzone 14.09: wykluczenie nabiału przy limicie
 * 30 minut zostawia DWA śniadania, więc zakaz powtórzeń zamieniłby zwyczajny profil w błąd.
 *
 * To jest PREFERENCJA ROZMAITOŚCI, nie ograniczenie produktowe — dlatego `generatePlan` podnosi
 * ją i próbuje ponownie, gdy przestrzeń się wyczerpie. Ograniczenia twarde są trzy i powtórzenia
 * nie są jednym z nich; gdyby rozmaitość konkurowała z guardrailem ±10%, wygrywałaby, a to jest
 * dokładnie odwrotnie, niż mówi `CLAUDE.md`.
 */
function baseMaxUses(mealsPerDay: MealsPerDay, slot: MealSlot, poolSize: number): number {
  if (poolSize <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(picksPerWeek(mealsPerDay, slot) / poolSize));
}

/**
 * Deterministyczny generator pseudolosowy z ziarna tekstowego (xorshift32 po haszu FNV-1a).
 *
 * Nie chodzi o jakość statystyczną, tylko o dwie własności: to samo ziarno daje ten sam plan
 * (błąd zgłoszony przez użytkownika da się odtworzyć co do dania), a inne ziarno daje inny
 * (użytkownik niezadowolony z tygodnia dostaje nowy, a nie ten sam).
 */
function seededRandom(seed: string): () => number {
  let state = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 0x01000193) >>> 0;
  }
  if (state === 0) {
    state = 0x9e3779b9;
  }
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

/** Suma `count` NAJWIĘKSZYCH różnych wartości z posortowanej rosnąco listy. */
function sumTop(sortedKcal: readonly number[], count: number): number {
  let total = 0;
  for (let index = 0; index < count && index < sortedKcal.length; index += 1) {
    total += sortedKcal[sortedKcal.length - 1 - index];
  }
  return total;
}

/** Suma `count` NAJMNIEJSZYCH różnych wartości z posortowanej rosnąco listy. */
function sumBottom(sortedKcal: readonly number[], count: number): number {
  let total = 0;
  for (let index = 0; index < count && index < sortedKcal.length; index += 1) {
    total += sortedKcal[index];
  }
  return total;
}

type SlotPools = Record<MealSlot, GeneratorDish[]>;

function emptySlotPools(): SlotPools {
  return { breakfast: [], lunch: [], dinner: [], snack: [] };
}

/**
 * Rozdziela pulę na pory i sortuje ROSNĄCO PO KALORIACH.
 *
 * Sortowanie nie jest kosmetyką — jest warunkiem poprawności przycinania w `findDay`. Gdy suma
 * przekroczy górną granicę, wolno przerwać pętlę (`break`) wyłącznie dlatego, że każde następne
 * danie w tej liście jest cięższe. Bez sortowania `break` ucinałby gałęzie, które mieściłyby się
 * w oknie. W skrypcie referencyjnym te dwie rzeczy są w różnych funkcjach; tutaj są obok siebie
 * celowo.
 *
 * Remis po kaloriach rozstrzyga `id`, żeby kolejność nie zależała od kolejności wierszy z bazy —
 * inaczej determinizm względem ziarna byłby pozorny.
 */
function bySlot(dishes: readonly GeneratorDish[]): SlotPools {
  const grouped = emptySlotPools();
  for (const dish of dishes) {
    for (const slot of dish.mealSlots) {
      grouped[slot].push(dish);
    }
  }
  for (const slot of Object.keys(grouped) as MealSlot[]) {
    grouped[slot].sort((left, right) => left.kcal - right.kcal || left.id - right.id);
  }
  return grouped;
}

/** Klucz limitu użyć: para (danie, pora). Nazwa celowo NIE zaczyna się od `use` — `eslint-config-expo`
 * czyta taką jako hook Reacta i wywraca lint regułą `react-hooks/rules-of-hooks`. */
function usageKey(dishId: number, slot: MealSlot): string {
  return `${dishId}:${slot}`;
}

type DayOutcome =
  | { kind: 'found'; meals: PlanMeal[]; totalKcal: number }
  | { kind: 'exhausted' }
  | { kind: 'budget' };

/**
 * Znajduje JEDEN dzień mieszczący się w oknie — pierwsze trafienie, nie wszystkie złożenia.
 *
 * To jest istotna różnica wobec `countDays` w skrypcie wykonalności, który liczy WSZYSTKIE
 * złożenia i dlatego nie ma prawa mieć limitu ani przycinać dolną granicą. Szukając pierwszego
 * trafienia wolno zrobić oba.
 *
 * ZIARNO WYZNACZA PUNKT STARTOWY, nie kolejność. Gdyby ziarno przestawiało listę, `break`
 * przestałby być poprawny i przycinanie — jedyna odpowiedź tego modułu na limit CPU — zniknęłoby.
 * Skan z zawinięciem `j … n-1, 0 … j-1` to DWA ciągi rosnące, więc przycinanie działa w każdym
 * z nich osobno, kosztem stałego czynnika 2.
 */
function findDay(
  slots: readonly MealSlot[],
  pools: SlotPools,
  lower: number,
  upper: number,
  usesLeft: Map<string, number>,
  offsets: readonly number[],
  budget: { visited: number; limit: number },
): DayOutcome {
  // Granice tego, co dołożą POZOSTAŁE pory — wejście do przycinania obustronnego.
  const minRest: number[] = new Array(slots.length + 1).fill(0);
  const maxRest: number[] = new Array(slots.length + 1).fill(0);
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const list = pools[slots[index]];
    const min = list.length > 0 ? list[0].kcal : Number.POSITIVE_INFINITY;
    const max = list.length > 0 ? list[list.length - 1].kcal : Number.NEGATIVE_INFINITY;
    minRest[index] = minRest[index + 1] + min;
    maxRest[index] = maxRest[index + 1] + max;
  }

  const chosen: PlanMeal[] = [];
  const usedToday = new Set<number>();
  let outOfBudget = false;
  let foundSum = 0;

  const walk = (position: number, sum: number): boolean => {
    if (position === slots.length) {
      // Sprawdzenie okna jest tu REDUNDANTNE wobec przycinania niżej i to jest świadome.
      // Zmierzone 14.09 celowym zepsuciem: zdjęcie tej linii NIE czerwieni ani jednego testu,
      // bo przy ostatniej pozycji `minRest` i `maxRest` są zerowe, więc przycinanie samo
      // wpuszcza wyłącznie sumy z okna. Zdjęcie przycinania też nie czerwieni niczego, bo łapie
      // je ta linia. Guardrail ma więc DWIE niezależne bramki i żadna z nich nie jest w stanie
      // przepuścić dnia poza oknem w pojedynkę — dlatego obie zostają.
      const fits = sum >= lower && sum <= upper;
      if (fits) {
        foundSum = sum;
      }
      return fits;
    }
    const slot = slots[position];
    const list = pools[slot];
    if (list.length === 0) {
      return false;
    }
    const start = offsets[position] % list.length;
    // Dwa zakresy, każdy rosnący po kaloriach — dlatego `break` wewnątrz zakresu jest poprawny.
    const ranges: readonly (readonly [number, number])[] = [
      [start, list.length],
      [0, start],
    ];

    for (const [from, to] of ranges) {
      for (let index = from; index < to; index += 1) {
        if (budget.visited >= budget.limit) {
          outOfBudget = true;
          return false;
        }
        budget.visited += 1;

        const dish = list[index];
        const next = sum + dish.kcal;

        // Górne przycięcie: dalsze dania w TYM zakresie są cięższe, więc cały ogon odpada.
        if (next + minRest[position + 1] > upper) {
          break;
        }
        // Dolne przycięcie: tej gałęzi nie da się dociągnąć do dolnej granicy. Nie `break`,
        // bo cięższe dania dalej w zakresie mogą już wystarczyć.
        if (next + maxRest[position + 1] < lower) {
          continue;
        }
        // Niezmiennik: to samo danie nie może wystąpić dwa razy w JEDNYM dniu.
        if (usedToday.has(dish.id)) {
          continue;
        }
        // Preferencja rozmaitości: limit użyć w tygodniu, liczony OSOBNO dla każdej pory.
        // Klucz musi być parą (danie, pora), a nie samym daniem: 39 z 58 dań realnej puli należy
        // do więcej niż jednej pory, a limit jest pochodną rozmiaru puli TEJ pory. Wspólny klucz
        // pozwalał daniu przenieść hojny limit z pory obfitej do pory ciasnej — zmierzone:
        // danie z puli przekąsek liczącej 1 pozycję lądowało 7 razy na 7 dni jako obiad, w puli
        // dwunastu obiadów, która żadnego powtórzenia nie wymuszała.
        const left = usesLeft.get(usageKey(dish.id, slot));
        if (left !== undefined && left <= 0) {
          continue;
        }

        usedToday.add(dish.id);
        chosen.push({ slotIndex: position + 1, mealSlot: slot, dishId: dish.id });
        if (walk(position + 1, next)) {
          return true;
        }
        chosen.pop();
        usedToday.delete(dish.id);
        if (outOfBudget) {
          return false;
        }
      }
    }
    return false;
  };

  const found = walk(0, 0);
  if (outOfBudget) {
    return { kind: 'budget' };
  }
  if (!found) {
    return { kind: 'exhausted' };
  }
  // Suma jest NIESIONA z przeszukiwania, nie liczona ponownie. Wersja szukająca dań po `id`
  // miała awaryjne `: 0` przy nietrafieniu — czyli w module, którego całym zadaniem jest nie
  // kłamać o kaloriach, cicho zaniżała dzień. Tu wartość pochodzi z tej samej sumy, na której
  // sprawdzono okno, więc rozjazd jest niemożliwy z konstrukcji.
  return { kind: 'found', meals: chosen.slice(), totalKcal: foundSum };
}

/**
 * Układa tydzień albo mówi, którego ograniczenia nie da się spełnić.
 *
 * NIGDY nie zwraca planu częściowego — `ok: false` nie ma pola `days`, a `ok: true` ma siedem
 * pełnych dni. To jest ta reguła z `CLAUDE.md`, którą najłatwiej złamać po cichu.
 */
export function generatePlan(input: GeneratorInput): GeneratorResult {
  const { targetKcal, mealsPerDay, maxPrepMinutes, seed, pool } = input;
  const limit = input.nodeBudget !== undefined ? input.nodeBudget : DefaultNodeBudget;
  const lower = Math.ceil(targetKcal * (1 - CalorieTolerance));
  const upper = Math.floor(targetKcal * (1 + CalorieTolerance));
  const slots = daySlots(mealsPerDay);
  const distinctSlots: MealSlot[] = [];
  for (const slot of slots) {
    if (!distinctSlots.includes(slot)) {
      distinctSlots.push(slot);
    }
  }

  const allowed = pool.filter((dish) => dish.passesExclusions && dish.prepMinutes <= maxPrepMinutes);
  const pools = bySlot(allowed);

  // KROK 1 diagnozy: pora, której nie da się obsadzić. Dzień potrzebuje tylu RÓŻNYCH dań,
  // ile razy pora w nim występuje — niezmiennik zakazuje powtórzenia w jednym dniu.
  //
  // Ten krok KOŃCZY działanie za każdym razem, gdy pora jest za uboga. Wcześniejsza wersja
  // przepuszczała dalej przypadek „za mało dań, ale żaden filtr nie jest winny" i to był realny
  // defekt, nie teoretyczny: zmierzone na puli z dwiema przekąskami przy sześciu posiłkach —
  // krok 2 przepuszczał (bo `sumTop` po cichu sumował tyle dań, ile było, licząc brakujące
  // posiłki jako 0 kcal), przeszukiwanie odwiedzało 39 561 węzłów przez 19 ms i kończyło
  // werdyktem `combination`. Trzy rzeczy naraz były złe: zły powód (radzi poluzować filtry,
  // choć żaden nie jest winny), sprzeczny ładunek (przy porze CAŁKIEM pustej wychodziło
  // `visitedNodes: 0`, czyli „przeszukiwanie wyczerpane" bez ani jednego węzła) i koszt powyżej
  // 10 ms, czyli 500 zamiast obiecanego 422.
  for (const slot of distinctSlots) {
    const needed = slots.filter((entry) => entry === slot).length;
    const remaining = pools[slot].length;
    if (remaining >= needed) {
      continue;
    }
    // Zbiory przeciwfaktyczne liczone DOPIERO TUTAJ, w gałęzi porażki. Na ścieżce udanej nikt
    // ich nie czyta, a każdy z nich to pełne przefiltrowanie, pogrupowanie i posortowanie puli.
    const withoutExclusions = pool.filter(
      (dish) => dish.prepMinutes <= maxPrepMinutes && dish.mealSlots.includes(slot),
    ).length;
    const withoutLimit = pool.filter(
      (dish) => dish.passesExclusions && dish.mealSlots.includes(slot),
    ).length;

    // Winowajcą jest ten filtr, którego zdjęcie przywraca WIĘCEJ dań. Remis idzie na wykluczenia,
    // bo są pod pełną kontrolą użytkownika, a limit czasu bywa podyktowany jego dniem.
    if (withoutExclusions > remaining && withoutExclusions >= withoutLimit) {
      return { ok: false, failure: { reason: 'exclusions', slot, remaining, withoutExclusions } };
    }
    if (withoutLimit > remaining) {
      return {
        ok: false,
        failure: {
          reason: 'prepTime',
          slot,
          remaining,
          limitMinutes: maxPrepMinutes,
          withoutLimit,
        },
      };
    }
    // Żaden filtr nie jest winny — pula sama nie ma czym obsadzić tej pory przy tej liczbie
    // posiłków. Dźwignią jest liczba posiłków, więc powodem jest `calories`, a osiągalny zbiór
    // jest PUSTY: skoro nie da się złożyć pełnego dnia, nie istnieje żadna osiągalna suma.
    // Zero jest tu prawdą, a nie zaokrągleniem — i zawsze leży poniżej dolnej granicy, bo
    // `ProfileBounds.targetKcal.min` to 1000 kcal.
    return {
      ok: false,
      failure: {
        reason: 'calories',
        targetKcal,
        lowerKcal: lower,
        upperKcal: upper,
        achievableMinKcal: 0,
        achievableMaxKcal: 0,
        mealsPerDay,
      },
    };
  }

  // KROK 2 diagnozy: dowiedziona niemożliwość kaloryczna, w czasie stałym, PRZED pętlą.
  //
  // `top-k` RÓŻNYCH dań, nie k-krotność największego: niezmiennik zakazuje powtórzenia w dniu,
  // więc potrojenie najcięższej przekąski dałoby sufit, którego nie da się osiągnąć — i granica
  // byłaby permisywna, przepuszczając do przeszukiwania cele, które są nieosiągalne.
  let achievableMinKcal = 0;
  let achievableMaxKcal = 0;
  for (const slot of distinctSlots) {
    const needed = slots.filter((entry) => entry === slot).length;
    const kcal = pools[slot].map((dish) => dish.kcal);
    achievableMinKcal += sumBottom(kcal, needed);
    achievableMaxKcal += sumTop(kcal, needed);
  }
  if (achievableMaxKcal < lower || achievableMinKcal > upper) {
    return {
      ok: false,
      failure: {
        reason: 'calories',
        targetKcal,
        lowerKcal: lower,
        upperKcal: upper,
        achievableMinKcal,
        achievableMaxKcal,
        mealsPerDay,
      },
    };
  }

  // KROK 3: przeszukiwanie. Limit powtórzeń jest relaksowany, aż przestanie blokować —
  // rozmaitość ustępuje guardrailowi, nie odwrotnie.
  const budget = { visited: 0, limit };
  const random = seededRandom(seed);
  const maxRelaxation = PlanDays;

  for (let extra = 0; extra <= maxRelaxation; extra += 1) {
    // Klucz to PARA (danie, pora) — patrz `useKey`. Danie należące do dwóch pór dostaje w każdej
    // z nich własny limit, pochodny od rozmiaru TAMTEJ puli.
    const usesLeft = new Map<string, number>();
    for (const slot of distinctSlots) {
      const allowance = baseMaxUses(mealsPerDay, slot, pools[slot].length) + extra;
      for (const dish of pools[slot]) {
        usesLeft.set(usageKey(dish.id, slot), allowance);
      }
    }

    const days: PlanDay[] = [];
    let failed = false;
    let budgetHit = false;

    for (let dayIndex = 1; dayIndex <= PlanDays; dayIndex += 1) {
      const offsets = slots.map(() => Math.floor(random() * 1_000_003));
      const outcome = findDay(slots, pools, lower, upper, usesLeft, offsets, budget);
      if (outcome.kind === 'budget') {
        budgetHit = true;
        break;
      }
      if (outcome.kind === 'exhausted') {
        failed = true;
        break;
      }
      for (const meal of outcome.meals) {
        const key = usageKey(meal.dishId, meal.mealSlot);
        const left = usesLeft.get(key);
        usesLeft.set(key, left === undefined ? 0 : left - 1);
      }
      days.push({ dayIndex, meals: outcome.meals, totalKcal: outcome.totalKcal });
    }

    if (budgetHit) {
      return {
        ok: false,
        failure: { reason: 'searchBudget', visitedNodes: budget.visited, budget: limit },
      };
    }
    if (!failed && days.length === PlanDays) {
      return { ok: true, days };
    }
  }

  // Przestrzeń wyczerpana przy nietkniętym budżecie: dania są, czas i wykluczenia się zgadzają,
  // ale żadne złożenie nie trafia w okno. To NIE jest `searchBudget` — przeszukiwanie nie
  // odpuściło, tylko skończyło — i nie jest `calories`, bo granice okno obejmują.
  return {
    ok: false,
    failure: {
      reason: 'combination',
      targetKcal,
      lowerKcal: lower,
      upperKcal: upper,
      visitedNodes: budget.visited,
      mealsPerDay,
    },
  };
}
