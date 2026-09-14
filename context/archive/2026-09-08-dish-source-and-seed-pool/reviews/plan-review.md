# Przegląd planu: źródło przepisów z makrami i zseedowana pula dań

- **Plan**: `context/changes/dish-source-and-seed-pool/plan.md` (wersja 1)
- **Data**: 2026-09-13
- **Werdykt wersji 1**: **WYMAGA UWAGI** — 6 ustaleń krytycznych, 10 ostrzeżeń, 4 obserwacje
- **Status**: wszystkie ustalenia krytyczne i większość ostrzeżeń **naprawione w wersji 2** planu

> Przegląd prowadzony bez człowieka przy klawiaturze (praca nocna). Sortowanie interaktywne
> zastąpione decyzjami zapisanymi poniżej. Recenzent czytał wyłącznie kod i dokumenty —
> **nie uruchamiał żadnego polecenia**.

## Ustalenia krytyczne — wszystkie naprawione

| # | Ustalenie | Co było źle | Naprawa w wersji 2 |
|---|---|---|---|
| F1 | **Cykl zależności faz 2 i 3** | Faza 2 miała importować USDA „dla składników używanych w puli", ale lista składników nie istnieje, dopóki faza 3 nie napisze dań. Jednocześnie walidator fazy 3 wymagał domkniętej fazy 2. Żadna nie mogła zapalić swojej bramki | Faza 2 to teraz **wyłącznie czyste moduły** (makra + walidacja), bez żadnej zależności od treści. Mapowanie i import USDA przeniesione do potoku fazy 3, a `seed/ingredients.json` dostało nazwaną ścieżkę jako osobny artefakt |
| F2 | **Idempotencja seeda niewykonalna i niepełna** | `on conflict(name)` na `dish` bez indeksu UNIQUE (SQLite odmówi); upsert nie dotykał `dish_ingredient`/`dish_step`, więc usunięty składnik zostawał w bazie, a danie po cichu zachowywało błędne kalorie; nazwa wyświetlana jako klucz tożsamości psuje się przy poprawce literówki i unieważni `plan_item.dish_id` w S-04 | `dish.slug NOT NULL UNIQUE` z nazwy pliku jako tożsamość; `name` zostaje polem zmiennym; dzieci **przepisywane w całości** (`delete` + `insert`); kryterium 3.3 testuje właśnie osierocony wiersz |
| F3 | **Najdroższa praca przed bramką, która może ją unieważnić** | Autorstwo i obowiązkowy przegląd 60 dań (większość z 10–15 h, nieodwracalne) stały **przed** pomiarem wykonalności. Werdykt „pula za mała" oznaczałby powtórzenie całości. Research proponował tani pilot, plan go nie przejął | Nowa **faza 3 „Pilot — 20 dań przez cały potok"** kończąca się jawną DECYZJĄ SKALOWANIA; faza 4 nie startuje bez niej |
| F4 | **Obowiązkowy przegląd bez egzekwowalnej bramki** | „Dania nieprzejrzane nie wchodzą do puli" nie było egzekwowane przez nic poza dyscypliną — `seed-dishes.js` nie wiedział o `REVIEW.md`, a kryterium było ręcznym checkboxem | `reviewedBy`/`reviewedAt` w każdym `seed/dishes/*.json`; **seed odmawia trybu `--remote`** dla dania bez tych pól. Sedno D14 dostało techniczne oparcie |
| F5 | **Surowy kontra ugotowany — nienazwany tryb awarii** | USDA rozróżnia ryż surowy (~365 kcal/100 g) od ugotowanego (~130). Różnica ~180% to wielokrotność całego budżetu ±10%, a **ani przegląd gramatur, ani próg 2000 kcal jej nie wykryje**: gramatura jest poprawna, wynik mieści się w zakresie | Stan składnika jest **częścią jego tożsamości** — `ingredient.name` zawsze zawiera stan („ryż biały, suchy"), przepisy podają gramaturę przed obróbką. Reguła w „Krytycznych szczegółach" i w `PROMPT.md` |
| F6 | **`listDishes` bez ścieżki wykonania** | `npm test` widzi tylko `src/lib/`; repozytorium woła `getWorkerEnv()`, więc poza workerd rzuca; tras plan świadomie nie przewidywał; harness nie ma czego kliknąć. Kryterium 4.1 było oznaczone jako automatyczne, a nie dało się go wykonać **w żaden sposób** | Repozytorium i trasy **usunięte z zakresu** i przekazane do S-04, która pierwsza ich potrzebuje. Skrypt pomiarowy czyta D1 przez `wrangler d1 execute --json` |

## Ostrzeżenia — naprawione

- **F7 — mechanizm zapisu do D1 nienazwany.** Wersja 2 zapisuje wprost: skrypt produkuje `.sql`
  przez `fs.writeFileSync(..., 'utf8')` (nigdy przez przekierowanie powłoki — na Windowsie dokłada
  BOM i psuje polskie znaki), wgranie przez `wrangler d1 execute --file`, escapowanie apostrofów
  obowiązkowe (brak `bind()` poza Workerem), wpisy w `package.json → scripts`. Otwarte założenie
  (transakcje na `--remote`) przeniesione do „Otwartych ryzyk" jako **do zweryfikowania przed fazą 3**.
- **F8 — `listDishes(env, …)` łamał wzorzec repozytorium.** Nieaktualne — repozytorium wypadło
  z zakresu (F6). Obserwacja o tym, że żadna funkcja w `src/server/repository/` nie przyjmuje `env`,
  trafiła do „Analizy stanu obecnego" jako fakt dla S-04.
- **F9 — brak niezmiennika Atwatera.** Dodane trzy sita do `dish-validation.ts`: Atwater (±10%),
  próg dolny i górny na porcję, gęstość energetyczna 0,3–5,0 kcal/g. Łapią klasy błędów (×10, ×0,1,
  zły wiersz USDA, składnik zmapowany na wodę), których nie wykrywa ani przegląd, ani próg górny.
- **F10 — `meal_slot` jako kolumna dzielił pulę czterokrotnie.** Zamienione na `dish_meal_slot`
  (wiele-do-wielu): obiad i kolacja to w praktyce ten sam zbiór.
- **F11 — reguła makr implementowana trzy razy.** Wersja 2 zakazuje wprost: zapytania kontrolne
  i skrypt pomiarowy **czytają wiersze i wołają `computeDishMacros`**. Rozjazd zaokrągleń SQL-owego
  i modułowego zapalałby kryteria z powodu artefaktu, nie defektu.
- **F12 — skrypty `.js` poza `tsc` i `npm test`.** Logika walidacji przeniesiona do
  `src/lib/dish-validation.ts` z testem; skrypty to `.mjs` z relatywnym importem `.ts`.
- **F14 — kategoria sklepowa niezdefiniowana** mimo że roadmapa F-01 jej wymaga. Zamknięty enum
  11 wartości z `CHECK` (granica z `0002`: wyliczenia tak, zakresy nie) plus opcjonalne
  `grams_per_piece` do prezentacji.
- **F16 — kryteria bez liczb.** Wpisane minima per pora posiłku (12/18/18/12), `prep_minutes` 5–120,
  a kryterium „bez nowych zależności" zamienione na `git diff --exit-code package-lock.json` —
  `check-lock` sprawdza spójność wewnętrzną i **przeszedłby na zielono także po dodaniu zależności**.
- **F19 — `servings` wprowadzało dwuznaczność** `perDish`/`perServing`, która łamałaby ±10%
  o cichy czynnik. Kolumna usunięta; konwencja: każdy przepis jest na jedną porcję.

## Ostrzeżenia i obserwacje przyjęte bez zmiany w planie

- **F13 — pomiar tylko w wariancie optymistycznym.** Naprawione: raport ma trzy scenariusze
  (bez filtrów / limit 30 min / limit + wykluczenia) i liczbę dań ocalałych na porę posiłku.
- **F15 — plan nie przejął najsilniejszego łagodzenia z researchu** (wielokrotne próbkowanie
  zbiło MAPE z 31,9% do 10,1%). Przyjęte w tańszej formie: `modelKcalHint` jako pole **jawnie
  nieautorytatywne**, którego seed nigdy nie zapisuje do D1, służące wyłącznie do uszeregowania
  przeglądu. Zachowuje literę D14 („makra liczy skrypt, nigdy model") i odzyskuje darmowy detektor.
- **F17 — napięcie „zero kodu generatora" kontra skrypt szukający kombinacji.** Doprecyzowane
  w „Czego NIE robimy": skrypt jest diagnostyką jednorazową, do S-04 idą **liczby**, nie kod.
- **F18 — plik USDA bez miejsca i parsera.** Dwustopniowo: `distill-usda.mjs` destyluje raz pobrany
  duży plik (poza repo, w `.gitignore`) do wersjonowanego `seed/usda-subset.json`.
- **F20 — drobiazgi.** Odniesienie do linii w `env.ts` poprawione na przybliżone; kolejność
  `migrations --remote` przed seedem zapisana wprost; nieaktualne zdanie w `CLAUDE.md` o braku
  runnera testów **zostało już poprawione** przy domykaniu fazy 4 S-02.

## Czego przegląd nie sprawdził

Recenzent zapisał to wprost i warto to przenieść: nie uruchomił żadnego polecenia; **nie zweryfikował**
zachowania D1 wobec jawnych transakcji w `wrangler d1 execute --file` ani tego, czy Node w tej
instalacji zaimportuje `.ts` z pliku `.mjs`; nie weryfikował rozmiarów pobrań USDA ani konkretnych
wartości kcal dla ryżu surowego i ugotowanego (liczby w F5 i F18 ilustrują skalę, nie są danymi
źródłowymi). Pierwsze dwie rzeczy są **warunkami wstępnymi fazy 3** i trafiły do „Otwartych ryzyk".
