<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-04 — Faza 2 (czysty moduł generatora)

- **Plan**: `context/changes/first-weekly-plan/plan.md`
- **Scope**: Faza 2 z czterech (czysty moduł generatora). Faza 1 (schemat) scalona w PR #32; fazy
  3–4 jawnie poza zakresem tego PR-a.
- **Date**: 2026-09-14
- **CI run**: https://github.com/pszyszkowski90/meal-plan/actions/runs/34879232914
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

> **Metoda tego przebiegu.** Ten przegląd wykonuje się w środowisku, w którym narzędzie Bash
> odmawia `npm ci` / `npm test` / `npx tsc` / `npx expo lint` / `npm run check-conventions` —
> każde z nich prosi o zgodę, której nikt w CI nie potwierdzi. Zamiast zgadywać wynik, przegląd
> użył **rzeczywistego przebiegu równoległego workflow „Bramka jakości"** na tym samym commicie
> (`34879232958`, job „Typy, lint, testy, konwencje, lockfile", **sukces**, zero nieudanych
> kroków) jako autorytatywnego dowodu automatycznej weryfikacji — łącznie z surowym logiem
> testów (`ℹ pass 136` / `ℹ fail 0`). Dryf planu, dyscyplina zakresu, bezpieczeństwo i zgodność
> wzorców zostały ocenione czytaniem kodu, nie jego uruchomieniem. Jeśli przyszły przebieg ma
> uruchamiać te komendy samodzielnie, `--allowedTools` tego zadania musi je dopuścić.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Test Coverage | PASS |
| Success Criteria | PASS |

## Metoda

Porównanie: pełny tekst planu (fazy 2, sekcja „Krytyczne szczegóły implementacji" i pięć
rozstrzygnięć) wobec `git diff origin/main...HEAD`, przeczytany w całości
`src/lib/plan-generator.ts` (586 linii) i próbkowany `src/lib/plan-generator.test.ts` (810 linii,
35 nazwanych testów zmapowanych na kryteria 2.1–2.17), plus porównanie stylu z
`src/lib/dish-validation.ts` i `src/lib/calorie-target.ts`.

Ten PR jest **trzecim commitem** na gałęzi po lokalnym, adwersaryjnym przeglądzie z mutacjami
punktowymi (`reviews/impl-review.md` sprzed tego przebiegu, jedenaście ustaleń F1–F11, wszystkie
rozliczone). Ten przegląd nie powtarza mutacji — weryfikuje **stan po poprawkach** czytaniem kodu
i potwierdza, że nic z tamtych napraw nie zostało cofnięte.

## Cross-reference: pliki zmienione vs. zaplanowane

| Plik | W planie fazy 2? | Werdykt |
|---|---|---|
| `src/lib/plan-generator.ts` | tak | MATCH |
| `src/lib/plan-generator.test.ts` | tak | MATCH |
| `context/changes/first-weekly-plan/plan.md` | konwencja Progress | oczekiwane (odhaczenie 2.1–2.17) |
| `context/changes/first-weekly-plan/reviews/impl-review.md` | konwencja przeglądu | oczekiwane |
| `notes/plan-queue.md` | konwencja Dziennika (`CLAUDE.md` §Dokumenty projektu) | oczekiwane |

Zero plików fazy 3/4 (`src/server/repository/plans.ts`, `src/app/api/plan+api.ts`,
`src/app/(app)/plan.tsx`, `migrations/`, `tests/e2e/`). Zero ruchu w `package-lock.json`
(`git diff --stat` puste).

## Plan drift — kontrakt modułu

Sygnatury, stałe i niezmienniki z sekcji „Wymagane zmiany → 1. Moduł generatora" porównane
z `plan-generator.ts:24–414`:

- `CalorieTolerance = 0.1`, `PlanDays = 7`, `DefaultNodeBudget` — obecne; `DefaultNodeBudget` to
  **100 000**, nie 200 000 z pierwotnego kontraktu planu. To jest udokumentowana i uzasadniona
  zmiana z lokalnego przeglądu (F2: 200 000 węzłów ekstrapoluje się do ~12 ms, powyżej limitu
  10 ms, który budżet ma chronić) — MATCH z **zaktualizowanym** zamiarem planu, nie DRIFT: plan
  sam nazywa kalibrację tej stałej pracą G4, a wartość startowa „po bezpiecznej stronie" jest
  zgodna z duchem zapisu.
- `GeneratorDish`, `GeneratorInput`, `PlanMeal`, `PlanDay`, `PlanFailure`, `GeneratorResult`,
  `generatePlan(input): GeneratorResult` — kształty identyczne z kontraktem planu, pole po polu.
- Cztery niezmienniki z sekcji „Krytyczne szczegóły implementacji": sortowanie rosnące + `id` jako
  rozstrzygacz remisu (`bySlot:257–268`), przycinanie obustronne osobno na dwóch zakresach po
  zawinięciu ziarna (`findDay:339–390`), zakaz powtórzenia w dniu (`usedToday`, `:365–367`,
  `:379`), twardy budżet węzłów sprawdzany PRZED odwiedzeniem węzła (`:346–350`) — wszystkie
  obecne i udokumentowane komentarzem przy pętli, dokładnie jak plan tego żąda.
- Import wyłącznie `./dish-validation.ts` — potwierdzone `grep -n "^import" plan-generator.ts` →
  jeden wynik.
- Piąte ramię diagnozy (`combination`, odróżnione od `searchBudget` i `calories`) — obecne,
  `reason: 'combination'` zwracane wyłącznie gdy przestrzeń wyczerpana przy nietkniętym budżecie
  (`:572–585`), zgodnie z minimalnym przykładem z planu (śniadanie/obiad/kolacja ∈ {200,800}).

Wniosek: **MATCH** na każdym punkcie kontraktu; jedyne odejście (budżet 100k zamiast 200k) jest
udokumentowaną poprawką znalezioną i uzasadnioną w tym samym cyklu implementacji, nie dryfem.

## Safety, quality, pattern compliance

Moduł jest czystą funkcją bez I/O — klasy ryzyka „injection", „authn/authz", „CORS" nie mają tu
zastosowania. Sprawdzone punkty specyficzne dla tego kodu:

- **Brak nieskończonej pętli/rekursji**: `budget.visited >= budget.limit` sprawdzane przed każdym
  odwiedzeniem węzła (`:346`), pętla relaksacji ograniczona `maxRelaxation = PlanDays` (`:527`).
  Ścieżka porażki zawsze kończy zwróceniem `PlanFailure`, nigdy nie zawiesza wywołania.
- **Brak cichego kłamstwa o kaloriach**: `totalKcal` niesione z sumy przeszukiwania
  (`foundSum`, `:328`, `:405`), nie przeliczane ponownie przez `find()` — usuwa klasę błędu opisaną
  w F10 poprzedniego przeglądu (awaryjne `: 0` przy nietrafieniu).
- **Zero planu częściowego**: `ok: false` nie niesie `days` (sprawdzone typem `GeneratorResult`
  i testem „porażka nie niesie pola days”); pętla dni przerywa i odrzuca cały tydzień
  (`failed`/`budgetHit`, `:538–569`) zamiast zwrócić niepełną tablicę.
- **Jedna drobna obserwacja** (poniżej, F1) — martwa gałąź obronna, nieszkodliwa, ale niespójna
  z tym, jak repo już raz potraktowało analogiczny przypadek (poprzedni przegląd, ustalenie F11).

**Zgodność wzorców** ze `src/lib/dish-validation.ts` i `src/lib/calorie-target.ts`: styl JSDoc
tłumaczący DLACZEGO (nie CO), `as const` zamiast `enum`, brak `namespace`, brak właściwości
w parametrach konstruktora, jawne rozszerzenie `.ts` w imporcie rodzeństwa z tym samym uzasadnieniem
(`node --test` + okrajanie typów nie zgaduje rozszerzeń). Zero niespójności.

## Test coverage

35 nazwanych testów w 12 blokach `describe`, zmapowane jeden-do-jednego na kryteria 2.1–2.17
(m.in. `test('suma równa dokładnie 0,9 × cel jest akceptowana')` → 2.2, `test('limit liczy się
od LICZBY WYBORÓW...')` → 2.9, `test('pora za uboga BEZ winy filtrów kończy się natychmiast...')`
→ naprawa F1 poprzedniego przeglądu). Trzy testy czytają realną pulę z `seed/` przez `node:fs`
**w pliku testu** (zgodnie z zakazem importów w module) i liczą wyrocznie niezależnie —
`realPool()` w `plan-generator.test.ts:706–744` przelicza kcal z `usda-subset.json`, nie kopiuje
liczb.

Uruchomienie potwierdzone niezależnie: log joba `Typy, lint, testy, konwencje, lockfile`
(run `34879232958`, ten sam commit) pokazuje `ℹ pass 136` / `ℹ fail 0` — bez ani jednego
nieudanego testu w całym `src/lib/*.test.ts` (nie tylko w tym pliku).

Brak MISSING TEST i brak FAILING TEST względem zobowiązań planu. Kryterium 2.17 (manualne,
„wyrocznie przeczytane jako rachunek") ma wiarygodne pokrycie: komentarze przy `realPool()`
i przy testach powtórzeń wprost tłumaczą, skąd biorą się liczby, zamiast kopiować wyjście
generatora.

## Success criteria (poza testami)

| Sprawdzenie | Wynik | Źródło |
|---|---|---|
| `npx tsc --noEmit` | PASS | log `34879232958`, krok „Run npx tsc --noEmit” bez błędów |
| `npx expo lint` | PASS | log, krok „Run npx expo lint” bez błędów |
| `npm run check-conventions` | PASS | log: `check-conventions: czysto (51 plików)` |
| `npm run check-lock` | PASS | krok zakończony bez błędu |
| `git diff --exit-code package-lock.json` | PASS | potwierdzone lokalnie, diff pusty |

## Findings

### F1 — OBSERVATION — martwa gałąź obronna w `findDay`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — jednowierszowa zmiana, zero ryzyka behawioralnego.
- **Dimension**: Safety & Quality
- **Location**: `src/lib/plan-generator.ts:334-336`
- **Detail**: `if (list.length === 0) { return false; }` wewnątrz `walk()` jest nieosiągalne.
  Jedyne miejsce wywołania `findDay` to `generatePlan`, które PRZED pętlą przeszukiwania
  gwarantuje `pools[slot].length >= needed >= 1` dla każdej pory obecnej w `distinctSlots`
  (krok 1 diagnozy, `:442-491`, zwraca `ok: false` wcześniej, jeśli którakolwiek pora jest
  uboższa). `pools[slot]` nie jest też mutowane w trakcie przeszukiwania (użycie śledzi osobna
  mapa `usesLeft` i zbiór `usedToday`, nie usuwanie z listy) — więc `list.length` jest stałe
  i zawsze ≥ 1 dla każdej pozycji, którą `findDay` w ogóle odwiedza. To dokładnie ta sama klasa
  martwego strażnika, którą poprzedni lokalny przegląd usunął w ustaleniu F11
  (`const start = list.length > 0 ? … : 0`).
- **Fix**: Usunąć gałąź `if (list.length === 0) { return false; }` — niezmiennik, który ją
  czynił martwą, jest już udokumentowany komentarzem przy kroku 1 diagnozy kilka linii wyżej
  w tym samym pliku, więc usunięcie nie traci wiedzy.
- **Decision**: PENDING

## Co przegląd potwierdził jako poprawne (bez zastrzeżeń)

- **Guardrail ±10% ma dwie niezależne bramki** (sprawdzenie końcowe w `walk()` i przycinanie
  obustronne) — potwierdzone czytaniem kodu i komentarza przy pętli; zgodne z ustaleniem
  z poprzedniego przeglądu, że usunięcie którejkolwiek osobno nie czerwieni testów, ale usunięcie
  obu psuje wynik.
- **Dyscyplina zakresu bez zastrzeżeń** — diff to dokładnie dwa pliki fazy 2 plus konwencyjne
  odhaczenie Postępu, wpis do Dziennika i ten raport. Zero repozytorium, tras, ekranów, migracji.
- **`DefaultNodeBudget` po korekcie jest po bezpiecznej stronie** limitu 10 ms — zmierzone
  w poprzednim lokalnym przeglądzie i nie cofnięte w tym commicie.
- **Zero regresji względem jedenastu wcześniejszych ustaleń (F1–F11 poprzedniego raportu)** —
  wszystkie odpowiadające im fragmenty kodu (krok 1 diagnozy kończący się zawsze, klucz
  `usageKey` jako para danie+pora, `totalKcal` niesione z przeszukiwania, usunięty martwy
  ternary z `start`) są obecne w bieżącym stanie pliku.

<!-- End of report -->
