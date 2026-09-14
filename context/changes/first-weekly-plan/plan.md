# Plan implementacji: generator tygodniowego jadłospisu (S-04)

> **Wersja 2** — po przeglądzie planu (`reviews/plan-review.md`, werdykt pierwszej rundy:
> DO PRZEMYŚLENIA). Dziesięć ustaleń rozliczonych; najważniejsze zmiany to poprawiona reguła
> powtórzeń (pierwsza była arytmetycznie zła), piąte ramię diagnozy porażki, ścieżka odczytu
> przepisu i kryteria sprawdzające dwa twarde ograniczenia **na ścieżce sukcesu**, a nie tylko
> w porażce.

## Przegląd

Użytkownik prosi o jadłospis i dostaje plan na siedem dni, w którym **każdy** dzień mieści się
w ±10% celu kalorycznego, **żaden** posiłek nie zawiera pozycji z wykluczeń i **żaden** nie
przekracza zadeklarowanego limitu czasu — albo nie dostaje planu w ogóle, tylko błąd nazywający,
którego z tych trzech ograniczeń nie da się spełnić.

To pierwsza zmiana w tym repo, w której guardrail produktowy jest **liczony**, a nie deklarowany.

## Analiza stanu obecnego

Fundament jest gotowy i częściowo przygotowany wprost pod tę zmianę:

- **Pula stoi na produkcji**: 58 dań, 51 składników, wszystkie z `usda_fdc_id`.
- **Indeks `idx_dish_meal_slot_slot`** został założony w `0003` z uzasadnieniem wskazującym S-04,
  a `0003:30` przewiduje `plan_item.dish_id`.
- **Filtr wykluczeń istnieje jako zapytanie** — trzy warunki `NOT EXISTS` w `listAllowedDishes`
  (`src/server/repository/preferences.ts:213-252`).
- **Arytmetyka makr ma jedno źródło prawdy** — `computeDishMacros` (`src/lib/dish-macros.ts:57`).
- **Środek okna ±10%** to `computeCalorieTarget(profile).effectiveKcal`
  (`src/lib/calorie-target.ts:288-315`) — przycięty do 1000–6000, odporny na nadpisanie `0`.

Czego nie ma:

- **Tabel `plan` i `plan_item`** — sprawdzone na produkcji, `plan_tables = 0`. Następny wolny
  numer migracji to `0006`.
- **Stałej ±10% w `src/lib/`** — żyje jako `const Tolerance = 0.1` w skrypcie `.mjs` i jako proza.
- **Jakiegokolwiek pojęcia tygodnia** — `check-pool-feasibility.mjs` układa i liczy **jeden dzień**.
- **Jakiejkolwiek ścieżki odczytu przepisu.** `grep -rn "dish_step" src/` daje **zero trafień**
  w całym repo. `catalog+api.ts` oddaje składniki pod ekran preferencji, nie przepisy.
- **Zakazu tego samego dania w dwóch porach jednego dnia** i **limitu kosztu przeszukiwania** —
  skrypt referencyjny nie ma ani jednego, ani drugiego.

Trzy ograniczenia zmierzone w badaniu (pełne liczby w `research.md` §E):

1. **Zakaz powtórzeń jest niewykonalny.** Wykluczenie nabiału przy limicie 30 minut zostawia
   **2 śniadania** na 7 dni.
2. **Pula ma twardy sufit kaloryczny zależny od liczby posiłków.** Przy 3 posiłkach maksimum dnia
   to 2542 kcal, więc **cel 3200 kcal jest nieosiągalny** (dolna granica ±10% to 2880).
3. **Przestrzeń przeszukiwania jest skrajnie nierówna** — od 0 do 5 985 427 złożeń **jednego dnia**,
   a plan ma ich siedem, w Workerze, gdzie przekroczenie 10 ms CPU **zabija wywołanie**.

## Pożądany stan końcowy

- `GET /api/plan` zwraca 200 z `{ plan: null }`, gdy planu nie ma — to **stan**, nie błąd.
- `POST /api/plan` generuje plan i zapisuje go, albo zwraca 422 z ustrukturyzowanym powodem
  porażki. **Nigdy nie zwraca planu częściowego.**
- Każdy dzień zapisanego planu sumuje się do wartości w `[0,9 × cel, 1,1 × cel]` domknięcie
  obustronne, liczonej przez `computeDishMacros` — nie przez `SUM()` w SQL-u.
- **Żadne danie w planie nie jest wykluczone i żadne nie przekracza limitu czasu** — sprawdzone
  na planie, który powstał, nie tylko w scenariuszach porażki.
- Ekran `/plan` pokazuje siedem dni, sumę kalorii dnia obok celu, a po rozwinięciu dania —
  składniki z gramaturami, kroki w kolejności i makra (FR-009).
- Konto A nie widzi planu konta B — sprawdzone dwiema drogami, przez ekran i z pominięciem UI.

### Kluczowe odkrycia

- `src/server/env.ts:29` — `all<T>(): Promise<{ results: T[] }>`, **bez `meta`**. G4 zaczyna od
  tej linijki.
- `scripts/check-pool-feasibility.mjs:212-254` — wzorzec przeszukiwania; `break` jest poprawny
  **wyłącznie** dzięki sortowaniu rosnąco po kcal w `bySlot` (`:186-193`).
- `scripts/check-pool-feasibility.mjs:214` — `snacksNeeded = mealsPerDay - 3`: pora „snack"
  występuje w dniu **wielokrotnie**. To jest liczba, o którą rozbiła się pierwsza wersja reguły
  powtórzeń.
- `src/lib/dish-validation.ts:29` — `MealSlot` mieszka **tutaj**, nie w `dish-macros.ts`.
- `migrations/0005_preferences.sql:72-73` — `source` wykluczenia jest **prezentacyjne**.
- `src/app/api/preferences+api.ts:76-78` — `foreignKeyViolation` → 400 zamiast 500.
- `src/app/(app)/preferences.tsx:283-298` — `saveBlockedReason`.
- `context/foundation/lessons.md` — „Kryterium, które przechodzi niezależnie od tego, czy rzecz
  działa, nie jest kryterium". To repo sparzyło się na tym dwa razy.
- `tests/e2e/` **nie ma żadnej drogi do D1** — zero `child_process`, `execSync` i `wrangler`.
  Kryterium żądające odczytu z bazy musi tę drogę najpierw zbudować.

## Czego NIE robimy

- **Podmiany dania (FR-010) i trwałego odrzucenia (FR-011)** — to S-05. Ten plan nie dotyka
  `exclusion` zapisem.
- **Listy zakupów (S-07)** i **trybu gotowania krok po kroku (S-06)** — odblokowane, poza zakresem.
  Odczyt `dish_step` powstaje tutaj, ale wyłącznie jako treść przepisu pod FR-009; tryb krok po
  kroku to osobny ekran i osobna zmiana.
- **Historii planów.** PRD §Non-Goals: brak śledzenia w czasie. Jeden aktywny plan na konto.
- **Pomiaru CPU i pola `meta` w `all<T>()`** — to G4. Ten plan dokłada **twardy limit węzłów**,
  ale go nie kalibruje pomiarem.
- **Optymalizacji przed pomiarem** (`notes/plan-queue.md` §3).
- **Preferencji pozytywnych (FR-005)** i **przejścia na Workers Paid.**

## Podejście do implementacji

Cztery fazy, uszeregowane tak, że każda jest weryfikowalna bez następnej.

**Sedno jest w fazie 2 i jest to czysty moduł bez bazy.** Cała logika doboru — okno ±10%,
powtórzenia, diagnoza porażki — mieszka w `src/lib/plan-generator.ts`, który importuje wyłącznie
`./dish-validation.ts` (typ `MealSlot`). Guardrail testuje się `node --test`, nie przez bazę i HTTP.

### Cztery rozstrzygnięcia, które podejmuję sam

Upoważnienie: `notes/plan-queue.md` §4. Każde ma pomiar albo uzasadnienie, nie preferencję.

**1. Powtórzenia są dozwolone; limit jest pochodną LICZBY WYBORÓW, nie liczby dni — i jest
miękki, nie twardy.**

Pierwsza wersja tego planu miała `ceil(7 / rozmiar puli)` i była **arytmetycznie zła**: pora
„snack" jest wybierana `7 × (mealsPerDay − 3)` razy, a nie 7. Przy sześciu posiłkach to **21
wyborów**, podczas gdy reguła dopuszczała 15 użyć przy pełnej puli 15 przekąsek — czyli
**wywracała jedyną konfigurację, w której cel 3200 kcal jest w ogóle osiągalny**.

Poprawnie:

```
picks(slot)    = PlanDays × (ile razy ta pora występuje w dniu)
maxUses(slot)  = max(1, ceil(picks(slot) / |pool(slot)|))
```

Druga poprawka jest ważniejsza: **limit jest preferencją rozmaitości, nie ograniczeniem
produktowym.** Ograniczenia twarde są trzy i powtórzenia nie są jednym z nich. Gdy przeszukiwanie
wyczerpie przestrzeń przy danym limicie, generator **podnosi go o 1 i próbuje ponownie**, aż do
`picks(slot)`. Inaczej rozmaitość konkurowałaby z guardrailem ±10% i wygrywała — a to jest
dokładnie odwrotnie, niż mówi `CLAUDE.md`.

Bez tej relaksacji reguła jest też **niemonotoniczna**: przy 6 daniach dopuszcza 12 użyć, przy
7 daniach tylko 7. Większa pula dawałaby ostrzejsze ograniczenie.

**2. Ziarno wybiera PUNKT STARTOWY w posortowanej liście, a nie kolejność.**

To rozstrzyga napięcie, którego pierwsza wersja nie zauważyła: przeszukiwanie DFS po listach
posortowanych rosnąco, zatrzymujące się na pierwszym trafieniu, jest **deterministyczne
z konstrukcji**. Ziarno mogłoby cokolwiek zmienić tylko przez przestawienie kolejności — a to
unieważnia `break`, czyli jedyną odpowiedź tego planu na limit CPU.

Rozwiązanie: lista pory zostaje **posortowana rosnąco**, a ziarno wyznacza przesunięcie startu
`j`, po którym skanuje się z zawinięciem: `j, j+1, …, n−1, 0, 1, …, j−1`. To są **dwa ciągi
rosnące**, więc przycinanie działa w każdym z nich osobno — koszt to stały czynnik 2, a nie
utrata pruningu. Ziarno w kolumnie `plan.seed` daje nowy plan przy każdym wywołaniu i błąd
odtwarzalny co do dania.

**3. Porażka jest DANYMI — rozłączną unią w `src/lib/`, z PIĘCIOMA ramionami.**

Pierwsza wersja miała cztery i zostawiała dziurę: przypadek, w którym żadna pora nie jest pusta,
granice skrajne obejmują okno, przeszukiwanie **wyczerpuje całą przestrzeń** i nic nie znajduje,
a budżet węzłów nie został tknięty. Generator nie miałby wtedy czego zwrócić, a obie dostępne
odpowiedzi kłamią: `calories` z zakresem **zawierającym** cel, albo `searchBudget`, mimo że
przeszukiwanie nie odpuściło, tylko skończyło.

Minimalny przykład: śniadanie ∈ {200, 800}, obiad ∈ {200, 800}, kolacja ∈ {200, 800}, cel 1500 →
okno [1350, 1650], a osiągalne sumy to 600 / 1200 / 1800 / 2400. Nic nie trafia, a granice
(600, 2400) okno obejmują.

Piąte ramię `combination` nazywa to wprost: dania są, czas i wykluczenia się zgadzają, ale
**żadne złożenie nie składa się w okno**. To nadal jest ograniczenie kaloryczne w rozumieniu
`CLAUDE.md` — komunikat mówi o kaloriach — ale niesie inną radę niż `calories` (tam: zmień liczbę
posiłków; tu: poluzuj limit czasu albo wykluczenia, żeby wpuścić inne dania).

**Diagnoza jest dowodem, nie zgadywaniem:**

1. **Pora pusta lub nieobsadzalna** → który filtr ją opróżnił, ustala się **przeciwfaktycznie**,
   z jednego zapytania niosącego per danie `prepMinutes` i flagę `passesExclusions`. Ten filtr,
   którego zdjęcie przywraca dania, jest winowajcą.
2. **Dowiedziona niemożliwość kaloryczna** → suma **`top-k` różnych** dań w porach wielokrotnych
   < dolna granica, albo suma **`bottom-k` różnych** > górna. `top-k`, nie `k × maksimum` —
   bo niezmiennik zakazuje tego samego dania dwa razy w dniu, więc potrojenie najcięższej
   przekąski dałoby sufit, którego nie da się osiągnąć. Czas stały, przed jakąkolwiek pętlą.
3. **Przeszukiwanie** z przycinaniem obustronnym, relaksacją limitu powtórzeń i twardym budżetem
   węzłów. Wyczerpane → `combination`. Budżet przekroczony → `searchBudget`.

**4. Ekran pokazuje cel ZAPISANY Z PLANEM i mówi, gdy jest nieaktualny.**

`plan.target_kcal` jest faktem historycznym (przeciw czemu plan ułożono), a `effectiveKcal`
liczonym przy odczycie stanem bieżącym. Gdy się różnią, ekran mówi to wprost zamiast pokazywać
sumy obok liczby, względem której nigdy nie były liczone.

## Krytyczne szczegóły implementacji

**Przycinanie działa tylko na posortowanej liście.** `break` jest poprawny wyłącznie dlatego, że
lista pory jest posortowana rosnąco po kaloriach. W skrypcie referencyjnym sortowanie jest
w `bySlot`, czyli w **innej funkcji** niż `break`. Przy przenoszeniu obie muszą wylądować w jednym
module, a niezmiennik ma być udokumentowany przy pętli. Przy zawijaniu z rozstrzygnięcia 2
przycinanie stosuje się **osobno do każdego z dwóch ciągów rosnących**.

**Przeszukiwanie szuka PIERWSZEGO trafienia, nie liczy wszystkich.** Dlatego może przycinać także
**dolną** granicą: jeśli suma plus maksimum pozostałych pór nie sięgnie dolnej granicy, gałąź
odpada. Skrypt referencyjny tego nie robi, bo licząc wszystkie złożenia nic by na tym nie zyskał.

**Limit 10 ms CPU zabija wywołanie, nie spowalnia je.** Budżet węzłów jest częścią kontraktu
generatora od pierwszej linii, nie optymalizacją na potem.

**Pula jest pobierana JEDNYM zapytaniem.** Kuszące jest wołać osobno „pulę po odsiewie" i „pulę
bez odsiewu" na potrzeby diagnozy. To podwoiłoby odczyt i podwójnie wywołało `computeDishMacros`
na **każdym** żądaniu — w jedynym miejscu tego produktu, gdzie limit CPU realnie grozi — a zbiór
bez odsiewu byłby potrzebny wyłącznie w przypadku porażki. Jedno zapytanie zwraca pulę pełną
z flagą `passesExclusions`, a odsiew robi moduł.

---

## Faza 1: Schemat planu

### Przegląd

Migracja `0006` z tabelami `plan` i `plan_item` plus para wsteczna. Nic poza schematem.

### Wymagane zmiany

#### 1. Migracja w przód

**Plik**: `migrations/0006_plan.sql`

**Cel**: dwie tabele trzymające jeden aktywny plan na konto i jego pozycje.

**Kontrakt**:

```sql
CREATE TABLE plan (
  user_id TEXT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  target_kcal INTEGER NOT NULL,
  meals_per_day INTEGER NOT NULL CHECK (meals_per_day BETWEEN 3 AND 6),
  seed TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE plan_item (
  user_id TEXT NOT NULL REFERENCES plan(user_id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL CHECK (day_index BETWEEN 1 AND 7),
  slot_index INTEGER NOT NULL CHECK (slot_index >= 1),
  meal_slot TEXT NOT NULL CHECK (meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  dish_id INTEGER NOT NULL REFERENCES dish(id),
  PRIMARY KEY (user_id, day_index, slot_index)
);

CREATE INDEX idx_plan_item_dish ON plan_item(dish_id);
```

Indeks na `dish_id` istnieje, bo odczyt planu z przepisami (faza 3, `getPlanWithRecipes`) złącza
`plan_item` z `dish` po tej kolumnie, a klucz główny `(user_id, day_index, slot_index)` tego
złączenia nie obsłuży. Ten sam powód i ten sam precedens co `migrations/0004_dish_ingredient_index.sql`.

Cztery decyzje schematu — do zapisania w nagłówku pliku, jak w `0003` i `0005`:

- **`user_id` jako klucz główny `plan`.** Ten sam kształt co `user_profile` i `user_preferences`:
  jeden wiersz na konto. PRD §Non-Goals wyklucza historię planów, więc tabela z historią byłaby
  zakresem, którego nie ma.
- **`plan_item` ma klucz naturalny i wiąże się przez `user_id`.** Powód: skoro plan jest jeden na
  konto, `user_id` **jest** jego identyfikatorem i nie ma czego odczytywać po wstawieniu —
  cały zapis mieści się w jednym `batch()` bez rundy `RETURNING`. Skutek uboczny jest pożądany:
  izolacja filtruje po `user_id` **bezpośrednio na obu tabelach**, bez pośredniego złączenia —
  najmocniejszy kształt dla bazy bez RLS.
  *(Wcześniejsza wersja uzasadniała to typowaniem `batch(): Promise<unknown[]>` w `env.ts:43`.
  To było nietrafione: przy `user_id` jako kluczu nie ma żadnego generowanego identyfikatora,
  więc typowanie `batch()` nie ma tu nic do rzeczy. Zapisane, żeby ktoś nie „naprawił" schematu
  po tym, jak G4 doda `meta`.)*
- **`target_kcal` jest utrwalone i to NIE jest złamanie reguły „cel się nie utrwala".** Tamta
  reguła zakazuje trzymania **wyliczenia z profilu**, żeby ekran i generator nie rozjechały się
  o kopię. Tutaj zapisujemy **fakt historyczny**: przeciw jakiej liczbie plan ułożono. Bez tego
  po zmianie wagi nie da się odróżnić planu wadliwego od nieaktualnego.
- **`CHECK`-i są wyłącznie wyliczeniowe i strukturalne** — precedens `0002:24-34`.
  `day_index BETWEEN 1 AND 7` jest enumeracją siedmiu wartości (horyzont tygodnia jest w FR-008
  i nie jest parametrem), `meals_per_day` powtarza enumerację z `0005`, `slot_index >= 1` jest
  niezmiennikiem strukturalnym. Zakresy kaloryczne **nie wchodzą do DDL**.

#### 2. Migracja wsteczna

**Plik**: `migrations/down/0006_plan.down.sql`

**Cel**: zdjęcie obu tabel i wpisu z rejestru migracji.

**Kontrakt**: `DROP TABLE IF EXISTS plan_item;` przed `DROP TABLE IF EXISTS plan;` (kolejność FK),
potem `DELETE FROM d1_migrations WHERE name = '0006_plan.sql';`. Bez tego ostatniego
`migrations apply` nie odtworzy tabel. Nagłówek z przebiegiem dla człowieka (`wrangler d1 export`
przed czymkolwiek), jak w pozostałych pięciu plikach `down/`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- 1.1 `npx wrangler d1 migrations apply mealplan --local` stosuje `0006` bez błędu, a
  `migrations list --local` nie pokazuje zaległych.
- 1.2 Para wsteczna zdejmuje obie tabele **i** wpis z `d1_migrations`; ponowne
  `migrations apply --local` odtwarza je — sprawdzone przebiegiem w obie strony.
- 1.3 `INSERT` z `day_index = 0` i osobno z `day_index = 8` **odrzucony**, a `day_index = 1`
  i `day_index = 7` **przyjęte**. Cztery wartości, oba końce i tuż za nie.
- 1.4 `meal_slot = 'brunch'` odrzucony; `dish_id` nieistniejący w `dish` odrzucony przez klucz obcy.
- 1.5 Usunięcie wiersza z `plan` kasuje kaskadowo `plan_item`; usunięcie konta kasuje oba.
- 1.6 `npm run check-conventions` czyste — reguła `migration-pair` widzi parę.

#### Weryfikacja ręczna

- 1.7 `.schema plan` i `.schema plan_item` obejrzane i zgodne z kontraktem.

---

## Faza 2: Czysty moduł generatora

### Przegląd

Cała logika doboru w jednym module `src/lib/`, bez bazy i bez HTTP. Tu powstaje guardrail.

### Wymagane zmiany

#### 1. Moduł generatora

**Plik**: `src/lib/plan-generator.ts`

**Cel**: zamienia pulę dań plus parametry użytkownika w plan siedmiu dni albo w ustrukturyzowany
powód porażki.

**Kontrakt** (sygnatury, od których zależy reszta planu):

```ts
import type { MealSlot } from './dish-validation.ts';   // JEDYNY import tego modułu

/** Guardrail ±10% — JEDNO miejsce w repo. Dotąd żył jako liczba w skrypcie i proza w CLAUDE.md. */
export const CalorieTolerance = 0.1;
export const PlanDays = 7;
export const DefaultNodeBudget = 200_000;   // zachowawczo; kalibruje G4, nie ta zmiana

export interface GeneratorDish {
  id: number;
  name: string;
  prepMinutes: number;
  mealSlots: readonly MealSlot[];
  /** Policzone przez computeDishMacros PRZED wejściem tutaj — moduł nie liczy makr. */
  kcal: number;
  /** false = danie odsiane przez wykluczenia. Pula wchodzi PEŁNA; odsiew robi moduł, */
  /** żeby diagnoza przeciwfaktyczna nie wymagała drugiego zapytania. */
  passesExclusions: boolean;
}

export interface GeneratorInput {
  targetKcal: number;                 // effectiveKcal z computeCalorieTarget
  mealsPerDay: 3 | 4 | 5 | 6;
  maxPrepMinutes: number;
  seed: string;
  pool: readonly GeneratorDish[];
  nodeBudget?: number;                // domyślnie DefaultNodeBudget
}

export interface PlanMeal { slotIndex: number; mealSlot: MealSlot; dishId: number; }
export interface PlanDay { dayIndex: number; meals: readonly PlanMeal[]; totalKcal: number; }

export type PlanFailure =
  | { reason: 'exclusions'; slot: MealSlot; remaining: number; withoutExclusions: number }
  | { reason: 'prepTime'; slot: MealSlot; remaining: number; limitMinutes: number; withoutLimit: number }
  | { reason: 'calories'; targetKcal: number; lowerKcal: number; upperKcal: number;
      achievableMinKcal: number; achievableMaxKcal: number; mealsPerDay: number }
  | { reason: 'combination'; targetKcal: number; lowerKcal: number; upperKcal: number;
      visitedNodes: number; mealsPerDay: number }
  | { reason: 'searchBudget'; visitedNodes: number; budget: number };

export type GeneratorResult =
  | { ok: true; days: readonly PlanDay[] }
  | { ok: false; failure: PlanFailure };

export function generatePlan(input: GeneratorInput): GeneratorResult;
```

Do zapisania w komentarzu przy typie: **`searchBudget` nie jest ograniczeniem produktowym**, tylko
granicą implementacji — przeszukiwanie odpuściło, więc nie wolno twierdzić „nie da się". Ma być
rzadkie, a jak rzadkie, mierzy G4. `combination` jest czymś innym: przestrzeń **wyczerpana**,
więc twierdzenie „nie da się" jest uprawnione.

Cztery niezmienniki do udokumentowania przy pętli:

- lista każdej pory posortowana **rosnąco po kcal**; przy zawijaniu z ziarna przycinanie stosuje
  się osobno do każdego z dwóch ciągów rosnących;
- to samo danie **nie może** wystąpić dwa razy w jednym dniu;
- użycie dania w tygodniu ≤ `maxUses(slot)`, **z relaksacją o 1 przy wyczerpaniu przestrzeni**;
- odwiedzone węzły ≤ `nodeBudget`.

#### 2. Testy modułu

**Plik**: `src/lib/plan-generator.test.ts`

**Cel**: przypiąć guardrail wyrocznymi policzonymi ręcznie.

**Kontrakt**: `/// <reference types="node" />`, `node:test` + `node:assert/strict`, import
`./plan-generator.ts` z jawnym rozszerzeniem.

Dwie rzeczy, bez których faza jest tautologią:

1. **Osobna funkcja weryfikująca w teście** sumuje kalorie dnia z `GeneratorDish.kcal` i sprawdza
   okno, zamiast ufać polu `totalKcal` zwróconemu przez generator.
2. **Wyrocznie dań liczone poza generatorem.** `GeneratorDish.kcal` wchodzi już policzone, więc
   niezależność dotyczy **sumy dnia i doboru**, nie arytmetyki pojedynczego dania — tę pokrywa
   `dish-macros.test.ts`. Kryterium 2.13 mówi to wprost, żeby nikt nie odczytał 2.1 jako
   mocniejszego dowodu, niż jest.

Scenariusz z realnej puli (2.5) wczytuje `seed/` przez `node:fs` **w pliku testu**. Zakaz importów
z 2.12 dotyczy **modułu**, nie testu — przepisanie 41 liczb do testu rozjechałoby się z `seed/`
przy pierwszej korekcie gramatury.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- 2.1 Plan zwrócony jako `ok: true` ma **siedem** dni, każdy z dokładnie `mealsPerDay` pozycjami,
  a suma kalorii **każdego** dnia mieści się w `[0,9 × cel, 1,1 × cel]` — sprawdzona funkcją
  weryfikującą w teście, nie polem `totalKcal`.
- 2.2 Granice okna **domknięte obustronnie**: dzień równy dokładnie `0,9 × cel` i dokładnie
  `1,1 × cel` **akceptowane**, o 1 kcal poza — **odrzucone**. Cztery wartości.
- 2.3 Pula, w której każde danie pory ma `passesExclusions: false`, daje `reason: 'exclusions'`
  z tą porą i `withoutExclusions > remaining`.
- 2.4 Pula, w której limit czasu opróżnia porę, daje `reason: 'prepTime'` z
  `withoutLimit > remaining`. **Ten sam zestaw dań z podniesionym limitem daje `ok: true`** —
  inaczej kryterium dowodziłoby tylko, że filtr filtruje.
- 2.5 Realna pula z `seed/`: 3 posiłki i cel 3200 kcal → `reason: 'calories'` z
  `achievableMaxKcal < lowerKcal`; **ten sam zestaw przy 6 posiłkach → `ok: true`**.
- 2.6 **Żaden posiłek planu, który powstał, nie jest wykluczony i żaden nie przekracza limitu
  czasu** — sprawdzone przejściem po wszystkich `7 × mealsPerDay` pozycjach wyniku `ok: true`.
  To jest to kryterium, którego brak przepuściłby literówkę w odsiewie.
- 2.7 Zero planu częściowego: `ok: false` nie ma pola `days`; `ok: true` nie ma dnia
  z mniejszą liczbą pozycji niż `mealsPerDay`.
- 2.8 To samo danie nie występuje dwa razy w jednym dniu — sprawdzone także dla `mealsPerDay = 6`,
  gdzie dzień potrzebuje **trzech różnych** przekąsek.
- 2.9 Limit powtórzeń liczy się od **liczby wyborów**, nie od liczby dni: przy 15 przekąskach
  i 6 posiłkach (21 wyborów) `maxUses = ceil(21/15) = 2` i plan **powstaje**; przy 12 obiadach
  (7 wyborów) `maxUses = 1`.
- 2.10 **Relaksacja działa**: pula, w której trafienie istnieje wyłącznie z powtórzeniem
  przekraczającym `maxUses`, daje `ok: true` z tym powtórzeniem — rozmaitość ustępuje guardrailowi,
  a nie odwrotnie.
- 2.11 Determinizm względem ziarna, **bez klauzuli ucieczki**: na ustalonej puli 12 śniadań ziarna
  `a` i `b` dają plany różniące się co najmniej jedną pozycją; ziarno `a` powtórzone daje plan
  identyczny co do `dishId` we **wszystkich** `7 × mealsPerDay` pozycjach.
- 2.12 Wyczerpana przestrzeń przy nietkniętym budżecie → `reason: 'combination'`. Wejście:
  trzy pory po {200, 800} kcal, cel 1500 — sumy 600/1200/1800/2400, okno [1350, 1650].
  **Nie `calories`** (granice obejmują cel) i **nie `searchBudget`** (budżet nietknięty).
- 2.13 Przekroczony budżet węzłów → `reason: 'searchBudget'`, nie zawieszenie ani plan częściowy.
- 2.14 `achievableMaxKcal` liczone z **różnych** dań: przy porze występującej trzykrotnie sufit
  to suma trzech największych przekąsek, nie trzykrotność największej.
- 2.15 `npm test` zielone, `npx tsc --noEmit`, `npx expo lint`, `npm run check-conventions` czyste.
- 2.16 Moduł importuje **wyłącznie** `./dish-validation.ts` — `grep` po `^import`
  w `src/lib/plan-generator.ts` nie pokazuje niczego innego, w szczególności `@/server`,
  `expo` ani `react`.

#### Weryfikacja ręczna

- 2.17 Wyrocznie przeczytane jako rachunek; żadna liczba oczekiwana nie skopiowana z uruchomienia
  generatora. Zakres niezależności (suma dnia i dobór, nie arytmetyka dania) potwierdzony.

---

## Faza 3: Repozytorium i trasa API

### Przegląd

Jedno zapytanie oddające pulę z porami, makrami i flagą wykluczenia; odczyt planu z przepisami;
zapis w jednej transakcji; dwie metody trasy.

### Wymagane zmiany

#### 1. Repozytorium planu

**Plik**: `src/server/repository/plans.ts`

**Cel**: jedyne miejsce z SQL-em tej zmiany.

**Kontrakt**, cztery funkcje:

- `listPoolForGenerator(userId)` — **jedno** zapytanie oddające **całą** pulę: `id`, `name`,
  `prep_minutes`, pory z `dish_meal_slot`, składniki (`grams` + `*_per_100g`) oraz
  `passesExclusions`. Flagę liczą **te same trzy warunki `NOT EXISTS`** co
  `listAllowedDishes` (`preferences.ts:213-238`) przeniesione do `CASE WHEN … THEN 0 ELSE 1 END` —
  przepisanie ich w innym kształcie byłoby drugim mechanizmem wykluczeń. **Limitu czasu zapytanie
  NIE stosuje** — robi to moduł, bo diagnoza przeciwfaktyczna potrzebuje dań ponad limitem.
  Makra liczy `computeDishMacros` po stronie kodu; zapytanie nigdy nie robi `SUM()`.
- `getPlan(userId)` — nagłówek planu: `startDate`, `targetKcal`, `mealsPerDay`, `seed`, `createdAt`.
- `getPlanWithRecipes(userId)` — pozycje planu wraz z treścią przepisu: dla każdego dania nazwa,
  `prepMinutes`, składniki z gramaturami, kroki z `dish_step` **w kolejności `position`** oraz
  `Macros` z `computeDishMacros` (białko, węglowodany, tłuszcz — FR-009 wymaga wszystkich trzech).
  **To pierwsza ścieżka odczytu `dish_step` w repo** — `grep -rn "dish_step" src/` daje dziś zero.
- `savePlan(userId, plan)` — `batch()`: `DELETE FROM plan_item WHERE user_id = ?1`,
  `DELETE FROM plan WHERE user_id = ?1`, wstawienie nagłówka, wstawienie pozycji. Jedna transakcja
  D1, więc nieudany zapis nie zostawia planu w połowie.

#### 2. Trasa API

**Plik**: `src/app/api/plan+api.ts`

**Cel**: `GET` oddaje zapisany plan z przepisami, `POST` generuje nowy.

**Kontrakt odpowiedzi** — jeden kształt dla obu metod, jak `{ profile, target }` w `profile+api.ts`:

```ts
type PlanResponse = {
  plan: {
    startDate: string; targetKcal: number; mealsPerDay: number; seed: string;
    days: { dayIndex: number; totalKcal: number; meals: {
      slotIndex: number; mealSlot: MealSlot;
      dish: { id: number; name: string; prepMinutes: number;
              macros: Macros;
              ingredients: { name: string; grams: number }[];
              steps: string[] };
    }[] }[];
  } | null;
  /** Bieżący cel z profilu — do porównania z plan.targetKcal. */
  currentTargetKcal: number | null;
};
```

Kształt trasy: `requireUserId` → repozytorium → JSON, zero SQL-a, zero `getWorkerEnv()`. Cztery
rzeczy przeniesione z `profile+api.ts` wprost:

- `Cache-Control: no-store` w jednym helperze — plan jest danymi osobowymi.
- Osobne bloki `try` dla każdej fazy, żeby zepsute ciało dało 400, a nie 500.
- **Brak planu to stan** — `GET` zwraca 200 z `{ plan: null }`, nigdy 404.
- `foreignKeyViolation` → 400. Plan odnoszący się do `dish_id` usuniętego przy przeseedowaniu puli
  trafi dokładnie w to.

Porażka generatora → **422** z `{ error: 'infeasible', failure: PlanFailure }`. Kod odrębny od 400,
bo żądanie było poprawne, a niewykonalne jest zadanie. Ciało niesie **dane**, nie gotowe zdanie —
tekst składa klient.

`POST` odmawia z **409**, gdy brakuje profilu albo preferencji: bez nich nie ma ani celu, ani
liczby posiłków, a generowanie „na wartościach domyślnych" byłoby zgadywaniem za użytkownika.

#### 3. Testy trasy i dostęp do D1 z harnessu

**Pliki**: `tests/e2e/plan-api.spec.ts`, `tests/e2e/support/d1.ts`

**Cel**: sprawdzić trasę i **stan bazy po niej** — dziś harness nie umie zajrzeć do D1.

**Kontrakt**: `tests/e2e/support/d1.ts` opakowuje
`npx wrangler d1 execute mealplan --local --json --command "…"` przez `execSync` z `shell: true`
i parsuje JSON od pierwszego `[`. **Zapytanie musi być jedną linią** — znak nowej linii urywa
polecenie, a objaw to kod 1 z pustym `stderr` (`notes/plan-queue.md` §1). Wzorzec parsowania jest
w `scripts/check-pool-feasibility.mjs:96-127` i wystarczy go przenieść. Helper jest **tylko do
odczytu** — żaden test nie pisze do bazy z pominięciem API.

Spec idzie wzorcem `tests/e2e/preferences-api.spec.ts`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- 3.1 `GET /api/plan` bez nagłówka `Authorization` → 401, ciało bez danych; trasa dopisana do
  `DataRoutes` w `tests/e2e/data-boundary.spec.ts:16`.
- 3.2 `POST /api/plan` bez tożsamości → 401; z podrobionym tokenem → 401.
- 3.3 Konto bez planu → **200** z `{ plan: null }`, nie 404.
- 3.4 `POST` na koncie bez profilu → 409, a `select count(*) from plan where user_id = …` daje **0**.
- 3.5 `POST` z profilem i preferencjami → 201, a **każdy** z siedmiu dni odczytanych **z bazy**
  (helper `support/d1.ts`) i przeliczonych z `dish_ingredient` mieści się w ±10%.
- 3.6 **Konto z pięcioma wykluczeniami grupowymi**: po `POST` zapytanie łączące `plan_item`
  z `dish_ingredient`, `ingredient_group` i `exclusion` daje **zero wierszy**. Sprawdzone
  **celowym zepsuciem** — zdjęciem jednego `NOT EXISTS`, po którym kryterium musi się zaczerwienić.
- 3.7 **Konto z `max_prep_minutes = 15`**: żadne `dish.prep_minutes` w `plan_item` nie przekracza
  15 — albo `POST` zwraca 422 `reason: 'prepTime'` i **zero wierszy** w `plan`. Zmierzone:
  przy 15 minutach pula obiadów to **jedno danie**, więc oba wyniki są dopuszczalne, ale plan
  łamiący limit nie jest.
- 3.8 Konto A nie widzi planu konta B — dwiema drogami, przez ekran i z pominięciem UI. Sprawdzone
  **celowym zepsuciem filtra `user_id`**.
- 3.9 Drugi `POST` **zastępuje** plan: `plan_item` ma dokładnie `7 × mealsPerDay` wierszy,
  nie dwa razy tyle.
- 3.10 Profil skrajny (3 posiłki, cel przycięty do 6000) → 422 `reason: 'calories'` i **zero
  wierszy** w `plan` oraz `plan_item`.
- 3.11 `GET` po `POST` oddaje dla każdej pozycji ≥ 1 składnik z gramaturą, ≥ 1 krok
  i komplet makr (kcal, białko, węglowodany, tłuszcz).
- 3.12 Makra nie są liczone w SQL-u — `grep -in "sum(" src/server/repository/plans.ts` pusty.
- 3.13 Pula pobierana **jednym** zapytaniem — `grep -c "\.prepare(" ` w ścieżce generowania
  pokazuje jedno wywołanie na pulę, nie dwa.
- 3.14 `npm test`, `npx tsc --noEmit`, `npx expo lint`, `npm run check-conventions` czyste;
  `git diff --exit-code package-lock.json` pusty.

#### Weryfikacja ręczna

- 3.15 `npx wrangler dev` na zbudowanym `dist/` — `POST` i `GET` sprawdzone w docelowym runtime,
  nie przez `expo start --web`. Przed `expo export` ubity `workerd.exe`, obecność zmiany
  w artefakcie potwierdzona `grep` po `dist/server/`.

---

## Faza 4: Ekran planu

### Przegląd

Nowa zakładka `/plan`: siedem dni, suma kalorii obok celu, przepis po rozwinięciu dania.

### Wymagane zmiany

#### 1. Ekran

**Plik**: `src/app/(app)/plan.tsx`

**Cel**: pokazać plan, pozwolić go wygenerować i ponownie wygenerować, i **uczciwie** pokazać porażkę.

**Kontrakt**: `LoadState` z pięcioma ramionami — `loading | ready | missing | offline | error`.
`missing` znaczy „planu jeszcze nie ma" i niesie przycisk generowania, a nie komunikat o błędzie.
Pobranie raz, strażnikiem `useRef`; `setState` wyłącznie w callbackach obietnicy; zero
`useMemo` / `useCallback`.

Sześć rzeczy przeniesionych ze wzorca, bo każda jest naprawioną awarią albo wnioskiem z przeglądu:

- **Generowanie zablokowane, dopóki stan jest nieznany**, z przyczyną widoczną na przycisku —
  wzorzec `saveBlockedReason` (`preferences.tsx:283-298`). Tu ostrzejszy: `POST` **nadpisuje** plan.
- **„Wygeneruj ponownie" w stanie `ready`**, z potwierdzeniem, bo nadpisuje. Bez tego ziarno
  z rozstrzygnięcia 2 byłoby kolumną tylko do zapisu, a obiecana korzyść („nie podoba mi się ten
  tydzień") nie miałaby przycisku.
- **Porażka renderowana z danych `PlanFailure`**, jedną funkcją `failureText(failure)`. Komunikat
  nazywa ograniczenie i podaje liczbę z diagnozy. Przy `reason: 'calories'` mówi, ile najwyżej da
  się ułożyć przy tej liczbie posiłków — radzenie „usuń wykluczenie" byłoby wtedy **nieprawdą**.
  Przy `combination` radzi poluzować limit czasu lub wykluczenia, bo tam problem jest inny.
- **Cel z planu, nie z profilu** — ekran pokazuje `plan.targetKcal`, a gdy `currentTargetKcal`
  się różni, mówi wprost, że plan jest nieaktualny wobec zmienionego profilu.
- **`flexShrink: 1, minWidth: 0`** w wyśrodkowanej kolumnie — bez tego web obcina ją z obu stron
  poniżej ~750 px.
- **Rezerwacja `BottomTabInset + Spacing.three`** w `contentInset` / `paddingBottom`.

Dostępność: zero `testID` w tym repo. Każdy sterownik dostaje `accessibilityRole` +
`accessibilityLabel` + **jawne** `aria-label`; rozwinięcie przepisu niesie `accessibilityState`
**oraz** jawne `aria-expanded`, bo RNW nie tłumaczy `accessibilityState`.

**Pułapka lokatorów, wprost dla tego ekranu**: oba ekrany zakładek są zamontowane naraz, a ekran
planu jest pełen liczb kalorycznych — te same liczby są jednocześnie na ekranie profilu. Nazwy
dostępnościowe muszą trafiać w jedno miejsce („Dzień 3, suma 2 410 kcal"), nie w samą liczbę.

#### 2. Zakładka w obu plikach

**Pliki**: `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx`,
`assets/images/tabIcons/plan{,@2x,@3x}.png`

**Kontrakt**: natywnie `<NativeTabs.Trigger name="plan">` — `name` **musi** być nazwą pliku trasy;
na webie `<TabTrigger name="plan" href="/plan" asChild>` — wiąże `href`. Bez trójki PNG `require()`
padnie przy bundlowaniu. Reguła `tab-parity` wywraca commit, jeśli któregoś brakuje.

#### 3. Testy przeglądarkowe

**Pliki**: `tests/e2e/plan-screen.spec.ts`, zmiany w `tests/e2e/account-isolation.spec.ts`

**Kontrakt**: wszystkie lokatory przez `getByRole(role, { name, exact: true })`. Helper
`openPlan(page)` czeka na **zastosowany stan**, nie na odpowiedź.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- 4.1 Konto bez planu widzi stan `missing` z przyciskiem generowania — **nie** komunikat o błędzie.
- 4.2 Po wygenerowaniu ekran pokazuje **siedem** dni, każdy z `mealsPerDay` pozycjami, a suma dnia
  na ekranie zgadza się z sumą policzoną niezależnie z makr dań tego dnia.
- 4.3 **Każda z siedmiu sum odczytanych ze strony mieści się w `[0,9 × targetKcal, 1,1 × targetKcal]`**,
  gdzie `targetKcal` jest wartością pokazaną przez ekran. To jest kryterium, którego brak
  przepuściłby generator produkujący dni po 4000 kcal przy celu 2000.
- 4.4 Rozwinięcie dania pokazuje ≥ 1 składnik z gramaturą, ≥ 1 krok i komplet makr.
- 4.5 Konto z profilem skrajnym (3 posiłki, cel 6000) widzi komunikat nazywający **ograniczenie
  kaloryczne** i **nie widzi** żadnego dnia planu — zero planu częściowego na ekranie.
- 4.6 „Wygeneruj ponownie" w stanie `ready` zastępuje plan; ekran pokazuje siedem dni po operacji,
  nie czternaście.
- 4.7 Zerwana sieć w trakcie pobrania → komunikat o braku połączenia, użytkownik **zostaje
  zalogowany**.
- 4.8 Konto A nie widzi planu konta B — przez ekran i z pominięciem UI.
- 4.9 Przycisk generowania zablokowany, dopóki stan planu jest nieznany, i mówi dlaczego.
- 4.10 Zakładka osiągalna na obu platformach — `check-conventions` (`tab-parity`) czyste.
- 4.11 Pełny zestaw E2E zielony przeciw `wrangler dev` na zbudowanym `dist/`; `npm test`,
  `npx tsc --noEmit`, `npx expo lint`, `check-conventions`, `check-lock` czyste.

#### Weryfikacja ręczna

- 4.12 Plan przeczytany jak jadłospis: czy tydzień da się zjeść — czy nie ma dnia z trzech sałatek
  ani tej samej kolacji cztery razy przy puli, która na to nie wymuszała.
- 4.13 Ekran obejrzany przy ~400 px: kolumna nieobcięta, ostatni dzień niescho­wany pod zakładkami.
- 4.14 Smoke test po wdrożeniu: `/api/plan` bez `Authorization` → 401,
  `/api/health` → `{"ok":true,"d1":true}`.

---

## Strategia testowania

### Testy jednostkowe

Cała faza 2. Wyrocznie policzone ręcznie. Przypadki brzegowe: obie granice okna i tuż za nie,
pora pusta, pula zbyt mała na tydzień bez powtórzeń, niemożliwość kaloryczna dowiedziona bez
przeszukiwania, przestrzeń wyczerpana przy nietkniętym budżecie, budżet przekroczony.

**Anty-wzorzec**: oczekiwana suma dnia przepisana z uruchomienia generatora. To byłaby tautologia.

### Testy integracyjne

Fazy 3 i 4, przez HTTP, przez D1 (nowy helper) i przez przeglądarkę. Izolacja kont dwiema drogami
— gdyby ekran filtrował po stronie klienta, test tylko przez UI byłby zielony wobec przeciekającej
trasy.

**Trzy testy sprawdzone celowym zepsuciem**: filtr `user_id` (3.8), warunek `NOT EXISTS`
wykluczeń (3.6) i limit czasu (3.7). Bez czerwonego przebiegu zielony niczego nie znaczy.

### Kroki testowania ręcznego

1. Konto A: 4 posiłki, limit 30 minut, 2 wykluczenia → wygeneruj, przeczytaj tydzień, sprawdź
   sumy trzech losowych dni kalkulatorem.
2. Zmień na 3 posiłki i cel 3200 kcal → oczekiwana **porażka kaloryczna** z liczbą, nie plan.
3. Wyklucz nabiał, limit 30 minut → plan powstaje, śniadania się powtarzają; sprawdź, że żadne
   nie występuje częściej niż `maxUses` policzone z liczby wyborów.
4. Ustaw 6 posiłków → dzień ma **trzy różne** przekąski, a plan powstaje mimo 21 wyborów z puli 15.
5. „Wygeneruj ponownie" dwa razy → dwa różne tygodnie, plan zastępowany, nie dokładany.
6. Zerwij sieć w trakcie pobrania → komunikat o połączeniu, sesja zachowana.

## Uwagi dotyczące wydajności

**To jedyne miejsce w tym produkcie, gdzie limit 10 ms CPU realnie grozi** — i grozi zabiciem
wywołania. Cztery rzeczy w tym planie są odpowiedzią:

1. Dowiedziona niemożliwość kaloryczna **przed** pętlą, w czasie stałym.
2. Przycinanie **obustronne** — skrypt referencyjny przycina tylko górą, bo liczy wszystkie
   złożenia; generator szuka pierwszego.
3. Twardy budżet węzłów z osobnym powodem porażki.
4. **Jedno zapytanie po pulę zamiast dwóch** — zbiór do diagnozy przeciwfaktycznej jest potrzebny
   tylko przy porażce, a podwojony odczyt kosztowałby na **każdym** żądaniu.

**Kalibracja budżetu należy do G4.** `DefaultNodeBudget` wchodzi z wartością zachowawczą.

Liczba dla skali: mianownik złożeń **jednego dnia** sięga 5 985 427, a plan ma siedem dni.

## Uwagi dotyczące migracji

`0006` dokłada wyłącznie nowe tabele — zero zmian w istniejących, więc nie ma danych do
przeniesienia.

**Kolejność produkcyjna jest obowiązkowa** (`CLAUDE.md`): `migrations apply mealplan --remote`
wchodzi **przed** commitem fazy, która tych tabel używa. Push na `main` wdraża natychmiast, więc
trasa czekająca na tabelę stoi na produkcji i zwraca 500.

Wstecz: `migrations/down/0006_plan.down.sql`, uruchamiany **wyłącznie przez człowieka** po
`npx wrangler d1 export mealplan --remote --output kopia.sql`.

## Referencje

- Badanie: `context/changes/first-weekly-plan/research.md`
- Przegląd planu: `context/changes/first-weekly-plan/reviews/plan-review.md`
- Wzorzec przeszukiwania: `scripts/check-pool-feasibility.mjs:212-254`
- Wzorzec parsowania wyjścia wranglera: `scripts/check-pool-feasibility.mjs:96-127`
- Wzorzec trasy: `src/app/api/profile+api.ts:72-129`
- Wzorzec repozytorium: `src/server/repository/preferences.ts:213-252`
- Wzorzec ekranu: `src/app/(app)/preferences.tsx`
- Wzorzec testu izolacji: `tests/e2e/account-isolation.spec.ts`
- Raport wykonalności puli: `seed/FEASIBILITY.md`
- Szkic komunikatów porażki: `context/archive/2026-09-08-dish-source-and-seed-pool/options.md` §5

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.

### Phase 1: Schemat planu

#### Automated

- [x] 1.1 `migrations apply --local` stosuje `0006`, `migrations list --local` bez zaległych — 9b60ac9
- [x] 1.2 Para wsteczna zdejmuje tabele i wpis z `d1_migrations`; ponowne zastosowanie przechodzi — 9b60ac9
- [x] 1.3 `day_index` 0 i 8 odrzucone, 1 i 7 przyjęte — 9b60ac9
- [x] 1.4 `meal_slot` spoza enuma odrzucony; `dish_id` spoza `dish` odrzucony przez klucz obcy — 9b60ac9
- [x] 1.5 Kaskady działają: usunięcie planu kasuje pozycje, usunięcie konta kasuje oba — 9b60ac9
- [x] 1.6 `npm run check-conventions` czyste, `migration-pair` widzi parę — 9b60ac9

#### Manual

- [x] 1.7 `.schema` obu tabel obejrzany i zgodny z kontraktem — 9b60ac9

### Phase 2: Czysty moduł generatora

#### Automated

- [x] 2.1 Siedem dni po `mealsPerDay` pozycji, każdy dzień w ±10% — sprawdzone niezależną funkcją — f6ff446
- [x] 2.2 Granice okna domknięte obustronnie; o 1 kcal poza — odrzucone — f6ff446
- [x] 2.3 `reason: 'exclusions'` z dowodem `withoutExclusions > remaining` — f6ff446
- [x] 2.4 `reason: 'prepTime'` z `withoutLimit > remaining`; ten sam zestaw z wyższym limitem → `ok: true` — f6ff446
- [x] 2.5 Realna pula: 3 posiłki i 3200 kcal → `calories`; ten sam zestaw przy 6 posiłkach → `ok: true` — f6ff446
- [x] 2.6 Żaden posiłek planu, który powstał, nie jest wykluczony ani ponad limitem czasu — f6ff446
- [x] 2.7 Zero planu częściowego — `ok: false` bez `days`, `ok: true` bez niepełnego dnia — f6ff446
- [x] 2.8 To samo danie nie występuje dwa razy w dniu — także przy `mealsPerDay = 6` — f6ff446
- [x] 2.9 `maxUses` liczone od liczby wyborów: 15 przekąsek i 6 posiłków → `ceil(21/15) = 2`, plan powstaje — f6ff446
- [x] 2.10 Relaksacja działa: trafienie wymagające powtórzenia ponad `maxUses` daje `ok: true` — f6ff446
- [x] 2.11 Determinizm względem ziarna, bez klauzuli ucieczki — f6ff446
- [x] 2.12 Wyczerpana przestrzeń przy nietkniętym budżecie → `combination`, nie `calories` — f6ff446
- [x] 2.13 Przekroczony budżet → `searchBudget`, nie zawieszenie — f6ff446
- [x] 2.14 `achievableMaxKcal` liczone z różnych dań, nie z krotności największego — f6ff446
- [x] 2.15 `npm test`, `tsc --noEmit`, `expo lint`, `check-conventions` czyste — f6ff446
- [x] 2.16 Moduł importuje wyłącznie `./dish-validation.ts` — f6ff446

#### Manual

- [x] 2.17 Wyrocznie przeczytane jako rachunek; zakres niezależności potwierdzony — f6ff446

### Phase 3: Repozytorium i trasa API

#### Automated

- [ ] 3.1 `GET /api/plan` bez tożsamości → 401; trasa dopisana do `DataRoutes`
- [ ] 3.2 `POST /api/plan` bez tożsamości → 401; podrobiony token → 401
- [ ] 3.3 Konto bez planu → 200 z `{ plan: null }`, nie 404
- [ ] 3.4 `POST` bez profilu → 409 i zero wierszy w `plan`
- [ ] 3.5 `POST` z profilem → 201, każdy z siedmiu dni odczytany z bazy mieści się w ±10%
- [ ] 3.6 Pięć wykluczeń grupowych → zero wykluczonych dań w planie; sprawdzone celowym zepsuciem
- [ ] 3.7 `max_prep_minutes = 15` → plan bez dania ponad limitem albo 422 `prepTime` i zero wierszy
- [ ] 3.8 Konto A nie widzi planu B — dwiema drogami, sprawdzone celowym zepsuciem filtra
- [ ] 3.9 Drugi `POST` zastępuje plan; `plan_item` ma `7 × mealsPerDay` wierszy
- [ ] 3.10 Profil skrajny → 422 `calories` i zero wierszy
- [ ] 3.11 `GET` oddaje składniki, kroki i komplet makr dla każdej pozycji
- [ ] 3.12 Zero `sum(` w `src/server/repository/plans.ts`
- [ ] 3.13 Pula pobierana jednym zapytaniem, nie dwoma
- [ ] 3.14 `npm test`, `tsc`, `lint`, `check-conventions` czyste; `package-lock.json` nietknięty

#### Manual

- [ ] 3.15 `wrangler dev` na zbudowanym `dist/`; obecność zmiany w artefakcie potwierdzona

### Phase 4: Ekran planu

#### Automated

- [ ] 4.1 Konto bez planu widzi stan `missing` z przyciskiem, nie błąd
- [ ] 4.2 Siedem dni na ekranie; suma dnia zgadza się z niezależnym przeliczeniem
- [ ] 4.3 Każda z siedmiu sum na ekranie mieści się w oknie ±10% pokazanego celu
- [ ] 4.4 Rozwinięcie dania pokazuje składnik z gramaturą, krok i komplet makr
- [ ] 4.5 Profil skrajny → komunikat o ograniczeniu kalorycznym i zero dni na ekranie
- [ ] 4.6 „Wygeneruj ponownie" zastępuje plan; siedem dni po operacji, nie czternaście
- [ ] 4.7 Zerwana sieć → komunikat o połączeniu, użytkownik zostaje zalogowany
- [ ] 4.8 Konto A nie widzi planu B — przez ekran i z pominięciem UI
- [ ] 4.9 Przycisk generowania zablokowany przy nieznanym stanie, z podaną przyczyną
- [ ] 4.10 Zakładka na obu platformach; `tab-parity` czyste
- [ ] 4.11 Pełny zestaw E2E zielony przeciw `wrangler dev`; wszystkie bramki czyste

#### Manual

- [ ] 4.12 Plan przeczytany jak jadłospis — czy tydzień da się zjeść
- [ ] 4.13 Ekran przy ~400 px: kolumna nieobcięta, ostatni dzień widoczny
- [ ] 4.14 Smoke test po wdrożeniu
