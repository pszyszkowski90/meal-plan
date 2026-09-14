---
date: 2026-09-14T16:27:02Z
researcher: agent (Claude Opus 5)
git_commit: b5048557b450fae87b145d441425b5b26fba64db
branch: g3-first-weekly-plan
repository: meal-plan
topic: "S-04 — generator tygodniowego jadłospisu: co już istnieje, czym liczyć guardrail ±10% i o co ta zmiana może się rozbić"
tags: [research, codebase, plan-generator, guardrail, d1, dish-pool, cpu-limit]
status: complete
last_updated: 2026-09-14
last_updated_by: agent (Claude Opus 5)
---

# Research: generator tygodniowego jadłospisu (S-04)

**Data**: 2026-09-14T16:27:02Z
**Badacz**: agent (Claude Opus 5)
**Commit**: `b504855`
**Gałąź**: `g3-first-weekly-plan`
**Repozytorium**: `meal-plan`

## Pytanie badawcze

Co w repo już istnieje pod generator tygodniowego planu, czego brakuje, i **na czym ta zmiana
realnie się wywróci**, jeśli tego nie nazwać przed planowaniem? Ograniczenie brzegowe: guardrail
±10% jest w `CLAUDE.md` ograniczeniem twardym, a nie preferencją, i to pierwsza zmiana w tym repo,
w której jest **liczony**, a nie tylko deklarowany.

---

## Podsumowanie

Fundament jest gotowy i jest lepszy, niż sugeruje status: schemat puli ma indeks założony wprost
pod ten generator, filtr wykluczeń **już istnieje jako zapytanie** (`listAllowedDishes`), a
arytmetyka makr ma jedno źródło prawdy z testami opartymi o ręcznie policzoną wyrocznię.

Ale badanie znalazło **pięć rzeczy, których nie widać z dokumentów**, a które przesądzają kształt
planu. Trzy z nich wywracają założenia zapisane w `notes/plan-queue.md` §G3:

1. **Zakaz powtórzeń dań w tygodniu jest niewykonalny** — i to nie w scenariuszu skrajnym, tylko
   w zwyczajnym. Wykluczenie nabiału przy limicie 30 minut zostawia **2 śniadania** na 7 dni.
   Kolejka zakładała, że problemem będzie 12 obiadów; problemem jest 2 śniadania.
2. **Pula ma twardy sufit kaloryczny zależny od liczby posiłków.** Przy 3 posiłkach dnia
   **nie da się** osiągnąć 3200 kcal — maksimum to 2542 kcal, a dolna granica ±10% wynosi 2880.
   To jest porażka, której nie powoduje ani wykluczenie, ani limit czasu, tylko sama pula. Komunikat
   porażki musi umieć to rozpoznać i nazwać, inaczej powie użytkownikowi nieprawdę.
3. **`listAllowedDishes` nie wystarczy** — nie zwraca ani pór posiłku, ani makr, więc generator
   i tak potrzebuje własnego zapytania. Kolejka sugeruje dziedziczenie; dziedziczyć da się filtr,
   nie zapytanie.
4. **`all<T>()` nie ma pola `meta`** — G4 (pomiar CPU) wymaga zmiany w `src/server/env.ts`, a nie
   tylko dopisania pomiaru. Do tego `batch()` zwraca `unknown[]`, więc **wielowierszowy insert
   w jednej transakcji nie odda wygenerowanych identyfikatorów**; to przesądza kształt zapisu planu.
5. **Stała ±10% nie istnieje w `src/lib/`.** Żyje dziś jako `const Tolerance = 0.1` w skrypcie
   `.mjs` i jako proza w `CLAUDE.md`. Guardrail, który jest ograniczeniem produktu, nie ma
   w kodzie jednego miejsca.

Poza tym: wzorzec wyszukiwania kombinacji **już jest napisany i sprawdzony** w
`scripts/check-pool-feasibility.mjs` — z przycinaniem, które jest poprawne tylko dzięki sortowaniu
rosnąco po kaloriach. Generator powinien go przenieść do `src/lib/`, a nie wymyślać od nowa.

---

## Ustalenia szczegółowe

### A. Schemat — co jest, czego nie ma

Pięć migracji zastosowanych, `0001`–`0005`, wszystkie na produkcji. **Następny wolny numer to
`0006`.** Tabel `plan*` na produkcji **nie ma** (sprawdzone zapytaniem: `plan_tables = 0`).

Pula dań (`migrations/0003_dish_pool.sql`) jest **współdzielona, bez `user_id`**:

| Tabela | Kształt istotny dla S-04 |
|---|---|
| `dish` | `id`, `slug` UNIQUE, `name`, `prep_minutes CHECK (> 0)`, `created_at`. **Brak kolumny z makrami i brak `servings`** — konwencja: każdy przepis to jedna porcja (`0003:13-17`) |
| `dish_meal_slot` | `(dish_id, meal_slot)` PK, `CHECK (meal_slot IN ('breakfast','lunch','dinner','snack'))`. Wiele-do-wielu **celowo** |
| `dish_ingredient` | `(dish_id, ingredient_id)` PK, `grams REAL CHECK (> 0)`. FK do `ingredient` **bez** `ON DELETE CASCADE` |
| `dish_step` | `(dish_id, position)` PK, `CHECK (position >= 1)`, `text` |
| `ingredient` | makra `*_per_100g`, `category` (kategorie **sklepowe**, pod listę zakupów), `usda_fdc_id` |

**`migrations/0003_dish_pool.sql:85-88` zakłada indeks `idx_dish_meal_slot_slot` z uzasadnieniem
wskazującym wprost generator S-04**, a `0003:30` przewiduje `plan_item.dish_id`. Ta zmiana była
przygotowana.

Preferencje (`0005`) dają komplet wejść:

- `user_preferences`: `max_prep_minutes CHECK (> 0)`, `meals_per_day CHECK (BETWEEN 3 AND 6)`
- `exclusion`: **jedna** tabela, `kind IN ('ingredient','dish','group')` + `source IN ('preferences','plan')`,
  z `CHECK`-iem wymuszającym dokładnie jedną wypełnioną kolumnę odniesienia
- `exclusion_group` + `ingredient_group` — grupy słownikowe (`grzyby`, `nabial`, `gluten`, …)

**`source` jest wyłącznie prezentacyjne i nie wolno mu wpływać na dobór dania** (`0005:72-73`).
Dla FR-011 (S-05) wartością do wstawienia jest `source = 'plan'` — ale odsiew ma widzieć oba źródła.

**Konwencja migracji wstecznej jest twarda i sprawdzana maszynowo.** Każdy plik `migrations/*.sql`
musi mieć parę `migrations/down/<nazwa>.down.sql`, a reguła `migration-pair`
([check-conventions.js:237-273](../../../scripts/check-conventions.js)) wywraca bramkę w obie strony.
Plik `down` musi też zawierać `DELETE FROM d1_migrations WHERE name = '<nazwa>.sql';` — bez tego
`migrations apply` nie odtworzy tabeli.

### B. Filtr wykluczeń już istnieje — ale nie wystarcza

`src/server/repository/preferences.ts:213-252` ma `listAllowedDishes(userId)`, a komentarz
`:198-199` mówi wprost, że to zapytanie generator ma odziedziczyć. Zapytanie robi trzy rzeczy:

- odsiewa po `prep_minutes <= COALESCE((SELECT max_prep_minutes …), d.prep_minutes)` —
  **`COALESCE` znaczy „brak preferencji = pełna pula, nie pusta"**;
- odsiewa dania wykluczone wprost (`kind='dish'`), przez składnik (`kind='ingredient'`)
  i przez grupę (`kind='group'` przez `ingredient_group`);
- zwraca `id, slug, name, prep_minutes` posortowane po nazwie.

**Czego nie zwraca: pór posiłku i makr.** Generator potrzebuje obu, więc zapytanie trzeba
rozszerzyć albo napisać obok. Dziedziczy się **trzy warunki `NOT EXISTS`** — logikę odsiewu —
a nie gotowy wynik. Przepisanie tych warunków drugi raz to dokładnie ten rozjazd, przed którym
ostrzega reguła „jedna lista wykluczeń".

### C. Arytmetyka makr i cel kaloryczny — gotowe, z jednym brakiem

`computeDishMacros(items: readonly DishMacroItem[]): Macros`
([dish-macros.ts:57](../../../src/lib/dish-macros.ts)) — sumuje `per100g.X * grams/100` i zaokrągla
**tylko sumę** (kcal do jedności, makra do 0,1 g, „pół w górę"). Zaokrąglenie jest **częścią
kontraktu**, przypiętą testem. Konsekwencja dla guardraila: **sumy dnia są sumami liczb
całkowitych** — raport wykonalności powstał dokładnie tak.

Środkiem okna ±10% jest **`computeCalorieTarget(profile).effectiveKcal`**
([calorie-target.ts:288-315](../../../src/lib/calorie-target.ts)), a nie `computedKcal`.
Dokumentacja pola `:80-88` nazywa S-04 wprost. Trzy szczegóły niosące ciężar:

1. nadpisanie wygrywa **tylko gdy `> 0`** — celowo nie `??`, bo `0` trafiłby do guardraila;
2. przycięcie do `1000–6000` obowiązuje **także nadpisanie**;
3. `computedKcal` liczy się z **zaokrąglonego** BMR, żeby ekran zgadzał się z kalkulatorem.

**Brakuje jednej rzeczy: stałej ±10%.** Dziś to `const Tolerance = 0.1` w
`scripts/check-pool-feasibility.mjs:30` plus proza w `CLAUDE.md`. Ograniczenie, którego złamanie
unieważnia produkt, nie ma w kodzie jednego miejsca — i to jest do naprawienia w tej zmianie,
zanim powstanie drugi kopiec tej liczby.

### D. Wzorzec wyszukiwania kombinacji — istnieje i jest sprawdzony

`scripts/check-pool-feasibility.mjs:212-254` to dwustopniowy DFS:

```js
const walkMain = (index, sum) => {
  if (index === main.length) { walkSnacks(0, snacksNeeded, sum); return; }
  for (const dish of grouped[main[index]]) {
    const next = sum + dish.macros.kcal;
    if (next > upper) { break; }        // ← przycięcie
    walkMain(index + 1, next);
  }
};
```

Własności warte przeniesienia i **trzy, które trzeba dopisać**:

| Własność | Stan w skrypcie | Co z tym w S-04 |
|---|---|---|
| Przycinanie górnym progiem (`break`, nie `continue`) | jest — poprawne **tylko** dzięki `sort((a,b) => a.macros.kcal - b.macros.kcal)` w `bySlot` | przenieść razem z sortowaniem; rozdzielenie ich psuje poprawność po cichu |
| Przekąski po rosnących indeksach (bez powtórzeń w dniu, bez permutacji) | jest | zostaje |
| Akceptacja obustronnie domknięta `sum >= lower && sum <= upper` | jest | zostaje |
| **Brak zakazu tego samego dania w dwóch porach jednego dnia** | brak | **trzeba dopisać** — dziś obiad i kolacja mogą być tym samym daniem |
| **Brak limitu węzłów / czasu** | brak | **trzeba dopisać** — patrz §F, limit 10 ms |
| **Brak jakiegokolwiek pojęcia tygodnia** | brak — skrypt liczy **jeden dzień** | **trzeba dopisać** |

Skrypt importuje prawdziwy `computeDishMacros` z `src/lib/` (`:24`) z uzasadnieniem: „Własna
arytmetyka dałaby raport o puli, której nie ma". Generator ma zrobić to samo.

### E. Pomiary puli — trzy rzeczy, których dokumenty nie mówią

Policzone niezależnie z `seed/` (składniki × USDA × gramatury), zgodnie z `computeDishMacros`.

**E1. Filtr czasu tnie nierównomiernie i katastrofalnie:**

| limit | breakfast | lunch | dinner | snack |
|---:|---:|---:|---:|---:|
| 15 min | 20 | **1** | **4** | 15 |
| 20 min | 20 | **2** | **5** | 15 |
| 30 min | 20 | 12 | 16 | 15 |
| 45 min | 20 | 29 | 33 | 15 |

`PreferenceBounds.maxPrepMinutes` dopuszcza **5–240 minut**. Użytkownik, który wpisze 15, dostaje
**jeden obiad w całej puli**. To nie jest scenariusz skrajny — to wartość w środku dopuszczalnego
zakresu formularza.

**E2. Pojedyncze wykluczenie grupowe potrafi ściąć porę do dwóch dań** (limit 30 min):

| Wykluczona grupa | breakfast | lunch | dinner | snack |
|---|---:|---:|---:|---:|
| `nabial` | **2** | 8 | 9 | 5 |
| `gluten` | 13 | **5** | 9 | 10 |
| `orzechy` | 13 | 11 | 15 | **6** |
| `ryby` | 20 | 9 | 12 | 15 |

Pięć grup naraz (`grzyby`, `orzechy`, `ryby`, `owoce-morza`, `wieprzowina`) przy limicie 30 min:
breakfast 11, **lunch 5**, dinner 8, snack 6.

**To rozstrzyga pytanie o powtórzenia.** Tydzień bez powtórzeń wymaga ≥ 7 dań na porę. Użytkownik
bez nabiału z limitem 30 minut ma **2 śniadania**. Zakaz powtórzeń zamieniłby ten profil w błąd
„nie da się ułożyć planu" — mimo że da się, tylko z powtórzeniami. Powtórzenia **muszą** być
dozwolone; przy `k` daniach na porę minimalna liczba powtórzeń wynosi `ceil(7/k)`.

**E3. Pula ma twardy sufit kaloryczny zależny od liczby posiłków:**

| liczba posiłków | osiągalny zakres dnia (limit 30 min) | cel 3200 kcal |
|---:|---|---|
| 3 | 1022–2536 kcal | **NIEOSIĄGALNY** (potrzeba ≥ 2880) |
| 4 | 1245–2990 kcal | osiągalny, wąsko (0,1% złożeń) |
| 5 | 1468–3444 kcal | osiągalny (5,1%) |
| 6 | 1691–3898 kcal | osiągalny (33,0%) |

Potwierdza to `seed/FEASIBILITY.md`: przy 3 posiłkach i celu 3200 kcal liczba trafień to **0**,
a przy 2800 kcal — **9** w całej puli (0,0%).

Dla komunikatu porażki to jest kluczowe: istnieje porażka, której **nie powoduje** ani wykluczenie,
ani limit czasu — powoduje ją sama pula przy danej liczbie posiłków. Komunikat mówiący „usuń
któreś wykluczenie" byłby wtedy **nieprawdziwy i bezużyteczny**: użytkownik ma usunąć wykluczenia,
których nie ma.

### F. Limit CPU — dlaczego to jedyne miejsce w tym produkcie, gdzie boli

`infrastructure.md` §rejestr ryzyk: przekroczenie 10 ms CPU **zabija wywołanie**, nie spowalnia je.

Dane z `FEASIBILITY.md` pokazują, jak nierówna jest przestrzeń przeszukiwania: mianownik złożeń
jednego dnia sięga **5 985 427** (2800 kcal, 6 posiłków, bez filtrów), a liczba trafień waha się
od **0** do **3,4 mln**. To jest liczba dla **jednego dnia**; plan ma siedem.

Dwie konsekwencje, które muszą trafić do planu:

1. **Generator nie może wyliczać wszystkich złożeń.** Musi znajdować **pierwsze** trafienie
   i kończyć — to inna pętla niż `countDays`, która liczy wszystkie.
2. **Musi mieć twardy limit odwiedzonych węzłów**, po przekroczeniu którego melduje porażkę.
   Bez niego przy wąskim przejściu (3200 kcal, 4 posiłki, 0,1% trafień) przeszukiwanie potrafi
   przejść przez setki tysięcy węzłów, zanim trafi — a każdy przekroczony limit to zabite wywołanie,
   czyli 500 bez żadnej wskazówki dla użytkownika.

**Pomiar (G4) wymaga zmiany w `src/server/env.ts`**: `all<T>()` jest dziś zadeklarowane jako
`Promise<{ results: T[] }>` ([env.ts:29](../../../src/server/env.ts)) — bez `meta`. Tak samo
`run(): Promise<unknown>` i `batch(): Promise<unknown[]>`.

**Skutek uboczny `batch()` zwracającego `unknown[]`: wielowierszowy insert w jednej transakcji
nie odda wygenerowanych identyfikatorów.** To przesądza kształt zapisu planu — albo `plan_item`
dostaje klucz naturalny (`plan_id, day, slot_index`) zamiast `AUTOINCREMENT`, albo zapis idzie
dwoma krokami: `INSERT … RETURNING id` dla nagłówka planu, potem `batch` pozycji z tym `id`.
Wzorzec `RETURNING … .first<Row>()` jest w repo trzykrotnie
([app-users.ts:90](../../../src/server/repository/app-users.ts),
[user-profile.ts:98](../../../src/server/repository/user-profile.ts),
[preferences.ts:139](../../../src/server/repository/preferences.ts)).

### G. Kontrakt trasy API i ekranu — wzorce do skopiowania, nie do wymyślenia

Trasa odniesienia to [profile+api.ts](../../../src/app/api/profile+api.ts): `requireUserId` →
funkcja repozytorium → JSON, zero SQL-a, zero `getWorkerEnv()`. Cztery rzeczy warte przeniesienia:

1. **`Cache-Control: no-store`** w jednym helperze (`profileJson`, `:48-50`) — nie rozsypane po trasie.
2. **Osobne bloki `try` dla każdej fazy `PUT`** (auth / parsowanie ciała / walidacja / dane), żeby
   zepsute ciało dało 400, a nie 500.
3. **Brak zasobu to stan, nie błąd** — 200 z `{ profile: null }`, nigdy 404. Dla S-04: „planu
   jeszcze nie wygenerowano" jest stanem `missing`, nie błędem.
4. **`foreignKeyViolation`** z [preferences+api.ts:76-78](../../../src/app/api/preferences+api.ts) —
   tłumaczy `FOREIGN KEY constraint failed` na 400 zamiast 500. Plan odnoszący się do `dish_id`,
   którego już nie ma po przeseedowaniu puli, trafi dokładnie w to.

Po stronie ekranu wzorcem jest [preferences.tsx](../../../src/app/(app)/preferences.tsx) —
pobiera dwa punkty naraz. Rzeczy, które wyglądają na kosmetykę, a są naprawionymi awariami:

- **Strażnik „raz" to `useRef`, nie tablica zależności**, a nieaktualność odpowiedzi rozstrzyga
  **licznik przebiegów**, nie flaga `cancelled` — mieszanie tych dwóch czasów życia zawiesiło ekran
  w `loading` na zawsze (lekcja w `lessons.md`).
- **`setState` wyłącznie w callbackach obietnicy** — `react-hooks/set-state-in-effect` to **błąd**
  lintu, nie ostrzeżenie.
- **Zapis zablokowany, dopóki stan jest nieznany**, z widoczną przyczyną na przycisku
  (`saveBlockedReason`, `:283-298`). Generator ma ten sam hazard: nie wolno nadpisać planu, którego
  się jeszcze nie wczytało.
- **`flexShrink: 1, minWidth: 0`** w wyśrodkowanej kolumnie — bez tego kolumna jest na webie
  obcinana z obu stron poniżej ~750 px (zmierzone 14.09).
- **Zero `testID` w całym repo.** Tożsamość niesie `accessibilityRole` + `accessibilityLabel` +
  **jawne** `aria-label`; stan wymaga `accessibilityState` **oraz** jawnego `aria-checked`, bo RNW
  nie tłumaczy `accessibilityState`.

**Nowa zakładka = trzy pliki plus ikona:** ekran, `app-tabs.tsx` (`name` = nazwa pliku trasy),
`app-tabs.web.tsx` (wiąże `href`) oraz trójka PNG w `assets/images/tabIcons/`. Reguła `tab-parity`
w `check-conventions.js:194-235` wywraca commit, jeśli któregoś brakuje.

### H. Testy — co jest wzorcem, a co trzeba dopisać

`npm test` to `node --test src/lib/*.test.ts` — **wyłącznie czyste moduły**. Każdy nowy moduł
w `src/lib/` musi zostać bez importów (bundlowany do klienta **i** `dist/server`, uruchamiany
przez okrajanie typów w Node): **żadnego `enum`, `namespace` ani właściwości w parametrach
konstruktora**. Test obok, z `/// <reference types="node" />` i importem `./<nazwa>.ts`.

Wyrocznie liczy się ręcznie i wypisuje w komentarzu — `dish-macros.test.ts:22` mówi to wprost.
Dla S-04 znaczy to: **oczekiwaną sumę dnia trzeba policzyć z gramatur i tabeli USDA, nie
z uruchomienia generatora.** Inaczej test dowodzi, że generator równa się sam sobie.

E2E: nowa trasa danych dopisuje się do `DataRoutes` w
[data-boundary.spec.ts:16](../../../tests/e2e/data-boundary.spec.ts) — to samo generuje pokrycie
401 i podrobionego tokenu. Izolacja kont ma osobny plik z **dwoma prawdziwymi kontami** i sprawdza
tę samą własność dwiema drogami: przez ekran i z pominięciem UI. `storageState: undefined` przy
`browser.newContext()` jest **wymagane**, inaczej „świeży" kontekst dziedziczy sesję konta A
i test porównuje A z samym sobą.

**Pułapka lokatorów istotna dla S-04**: oba ekrany zakładek są zamontowane naraz, więc ta sama
liczba („2759 kcal") występuje w dwóch miejscach jednocześnie i luźne dopasowanie tekstu wywraca
się na trybie ścisłym Playwrighta — co **wygląda jak brakujący element**, a jest kolizją lokatora.
Ekran planu, pełen liczb kalorycznych, trafi w to natychmiast.

---

## Odniesienia do kodu

- `migrations/0003_dish_pool.sql:85-88` — indeks `idx_dish_meal_slot_slot` założony wprost pod S-04
- `migrations/0005_preferences.sql:72-73` — `source` jest prezentacyjne, nie wpływa na dobór
- `src/server/repository/preferences.ts:213-252` — `listAllowedDishes`, trzy warunki `NOT EXISTS`
- `src/server/env.ts:29` — `all<T>(): Promise<{ results: T[] }>`, **bez `meta`**
- `src/server/env.ts:43` — `batch(): Promise<unknown[]>`, nie oddaje identyfikatorów
- `src/lib/dish-macros.ts:57` — `computeDishMacros`, zaokrąglenie tylko sumy
- `src/lib/calorie-target.ts:288-315` — `computeCalorieTarget`, `effectiveKcal` jako środek okna
- `scripts/check-pool-feasibility.mjs:212-254` — wzorzec przeszukiwania z przycinaniem
- `scripts/check-pool-feasibility.mjs:186-193` — `bySlot` z sortowaniem rosnąco po kcal
- `src/app/api/profile+api.ts:88-129` — cztery osobne bloki `try` w `PUT`
- `src/app/api/preferences+api.ts:76-78` — `foreignKeyViolation` → 400 zamiast 500
- `src/app/(app)/preferences.tsx:283-298` — `saveBlockedReason`
- `scripts/check-conventions.js:194-235` — reguła `tab-parity`
- `scripts/check-conventions.js:237-273` — reguła `migration-pair`
- `tests/e2e/data-boundary.spec.ts:16` — `DataRoutes`
- `tests/e2e/account-isolation.spec.ts:76-81` — `storageState: undefined`

## Wnioski architektoniczne

**Jedno źródło prawdy jest tu wzorcem dominującym i trzykrotnie sprawdzonym w boju.** Cel
kaloryczny nie jest utrwalany, tylko liczony przy odczyciie przez ten sam moduł, którego użyje
generator. Makra liczy jeden moduł, a skrypt wykonalności importuje go zamiast kopiować
arytmetykę. Wykluczenia mają jedną tabelę, a nie dwie. Generator wchodzi w ten wzorzec, a nie
obok niego — i dokłada do niego **brakującą stałą ±10%**.

**Granice walidacji żyją w `src/lib/`, nie w `CHECK`-ach.** `CHECK` jest wyliczeniowy albo
strukturalny; zakres jest w module. Powód jest mechaniczny: SQLite nie ma
`ALTER TABLE … DROP CONSTRAINT`, więc korekta granicy kosztuje przebudowę tabeli, a rozjazd
wychodzi użytkownikowi jako 500 nieodróżnialne od awarii D1.

**Izolacja kont jest wyłącznie w SQL-u.** D1 nie ma RLS. Każda funkcja repozytorium bierze
`userId` pierwszym argumentem i filtruje po nim; warstwa nie ma testów jednostkowych, więc
granicy pilnuje dopiero test E2E z dwoma kontami.

## Kontekst historyczny (z wcześniejszych zmian)

- `context/archive/2026-09-08-dish-source-and-seed-pool/options.md` §5 — szkic trzech komunikatów
  porażki i jawne stwierdzenie, że **progu nie da się zgadnąć, bo wynika z rozmiaru puli i musi
  zostać zmierzony, gdy pula powstanie. „To zadanie dla S-04, nie dla F-01."**
- `context/archive/2026-09-08-dish-source-and-seed-pool/plan.md` — fazy 1–4; faza 1 weszła na
  produkcję **bez przeglądu** i to jedyny taki przypadek w repo
- `context/archive/2026-09-13-dietary-preferences/` — S-03, skąd pochodzi `listAllowedDishes`
  i model wykluczeń z `kind`
- `context/foundation/lessons.md` — sześć wpisów, z których **trzy dotyczą wprost tej zmiany**:
  ref kontra flaga z domknięcia, nadpisywanie tego, co użytkownik wpisał, oraz „kryterium, które
  przechodzi niezależnie od tego, czy rzecz działa, nie jest kryterium"

## Powiązane badania

- `context/archive/2026-09-08-dish-source-and-seed-pool/research.md` — badanie źródeł przepisów,
  opcje A–E i dowody na niewiarygodność makr z modelu
- `seed/FEASIBILITY.md` — raport wykonalności puli, 5 celów × 3 scenariusze × 4 liczby posiłków

## Otwarte pytania

Wszystkie należą do agenta (`notes/plan-queue.md` §4) i domykają się w planie, nie przed nim:

1. **Ile powtórzeń dania w tygodniu.** Badanie pokazuje, że zakaz jest niewykonalny (2 śniadania
   przy wykluczeniu nabiału). Otwarte zostaje, czy limit jest stały, czy pochodną rozmiaru puli
   po odsiewie — to drugie jest jedyne, które nie wywraca się na wąskiej puli.
2. **Determinizm.** Niepoliczone: czy dwa wywołania z tym samym profilem mają dać ten sam plan.
   Deterministyczny jest łatwiejszy do testowania i do odtworzenia błędu; niedeterministyczny
   wymaga ziarna zapisanego z planem.
3. **Twardy limit węzłów przeszukiwania.** Wynika z pomiaru CPU (G4), którego nie da się zrobić
   przed istnieniem generatora. Do ustalenia liczbą, nie zgadywaniem.

**Do właściciela (i tylko po pomiarze):** Workers Paid. Nie stawiać tego pytania bez liczby.
