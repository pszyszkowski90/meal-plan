<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Weź makra składników z wiersza USDA, nie z pamięci modelu

- **Plan**: `context/changes/dish-source-and-seed-pool/plan.md` (Faza 3, wiersze 3.0a–3.0d — backfill dodany 14.09.2026, po tym jak właściciel przejął cały przegląd gramatur od modelu)
- **Scope**: Full plan slice covered by this PR (CI re-review on PR #24, HEAD `768984b`) — nie cała Faza 3 (3.1–3.11 nadal `[ ]`) i nie Faza 4
- **Date**: 2026-09-14
- **CI run**: https://github.com/pszyszkowski90/meal-plan/actions/runs/34847865189
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

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

## Co się zmieniło od poprzedniego przebiegu (`efc6599`)

Commit `768984b` rozlicza cztery z pięciu ustaleń poprzedniej rundy kodem, piąte świadomym
odłożeniem. Zweryfikowałem to czytaniem plików źródłowych (`scripts/distill-usda.mjs`,
`scripts/import-usda.mjs` w całości) i porównaniem ze schematem (`migrations/0003_dish_pool.sql`,
`migrations/0005_preferences.sql`) oraz eksportami `src/lib/dish-macros.ts` i
`src/lib/dish-validation.ts`, które oba skrypty importują — nie tylko czytaniem diffu.

- **F1 (odczyty bez osłony) — NAPRAWIONE.** `readJson(file, hint)` w obu skryptach zamienia
  `ENOENT`/`SyntaxError` na `fail()` z podpowiedzią. Sprawdziłem, że `fail()` kończy proces
  (`process.exit(1)`), więc brak `return` po `fail(...)` w `catch` jest bezpieczny — sterowanie
  i tak nigdy nie wraca.
- **F2 (`csvRows` dzieli po `\n` przed parsowaniem cudzysłowów) — złagodzone komentarzem +
  drugą linią obrony, nie usunięte.** Komentarz nad parserem (`distill-usda.mjs:26–30`) teraz
  uczciwie deklaruje zakres („wiersze BEZ znaku nowej linii”), a nowe sprawdzenie liczby pól
  w `csvRows` złapałoby pole wielowierszowe jako wiersz za krótki. Rozsądny kompromis dla
  zamrożonego zrzutu SR Legacy 2018-04 — przepisanie parsera na tryb w pełni świadomy cudzysłowów
  byłoby pracą pod plik, który tego problemu nie ma.
- **F3 (pozycyjny odczyt kolumn CSV bez walidacji nagłówka) — NAPRAWIONE, i to było
  najostrzejsze ustalenie.** `csvRows(file, expectedHeader)` sprawdza PREFIKS nagłówka i przerywa
  `fail()`-em przy niezgodności; `Headers.food` / `Headers.foodNutrient` w kodzie dokładnie
  odpowiadają pozycjom czytanym dalej (`const [fdcId, , description] = row`,
  `const [, fdcId, nutrientId, amount] = row`). Rozjazd w `food_nutrient.csv` — jedyny tryb awarii
  z całej piątki, którego nic wcześniej nie łapało — jest teraz łapany. Przykładowy komunikat
  z demonstracji w commit message (`kolumna 1: oczekiwano „fdc_id", jest „data_type"`) zgadza się
  z logiką kodu, jeśli zamienić dwie pierwsze kolumny nagłówka `food.csv`.
- **F4 (`fail()` bez domyślnego `details`) — NAPRAWIONE.** `function fail(message, details = [])`
  w `import-usda.mjs`, teraz symetryczne z `distill-usda.mjs`.
- **F5 (fixture do odtworzenia sita opisu) — ŚWIADOMIE ODŁOŻONE do P5**, z uzasadnieniem
  (wymagałoby rozszerzenia `npm test` poza `src/lib/*.test.ts`, co jest osobną decyzją o regule
  repo, nie punktowym fixem). Sito ma teraz drugą, niezależną linię obrony tej samej klasy błędu
  (nagłówek kolumn), więc ryzyko rezydualne jest niższe niż w poprzedniej rundzie.

## Findings

### F6 — Brak pisemnego potwierdzenia happy-path po dodaniu sprawdzenia nagłówka

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — albo już działa (patrz niżej), albo trywialna poprawka jednej linii
- **Dimension**: Safety & Quality
- **Location**: `scripts/distill-usda.mjs:110-121`
- **Detail**: `notes/pool-queue.md` i commit message dokumentują, że guard nagłówka był testowany
  celowym ZEPSUCIEM (przestawienie kolumn → wyjście 1). Nie ma pisemnego potwierdzenia, że **ten
  sam kod** został też ponownie przepuszczony przez pełny, poprawny zbiór SR Legacy po dodaniu
  sprawdzenia — tylko dowód sprzed tej zmiany (35/35 z rundy F79a2f6/5ea27e7). `fs.readFileSync(file,
  'utf8')` nie zdejmuje automatycznie BOM-u; gdyby prawdziwy `food.csv` z USDA miał na początku
  `﻿`, `header[0]` byłoby `"﻿fdc_id"` i legalny plik odpadłby na kolumnie 1 dokładnie tym
  samym torem co plik faktycznie zepsuty. Nie mogłem tego wykonać sam — `.usda/` jest
  gitignorowane i nieobecne w tym checkout CI, a to uruchomienie nie ma zgody na wykonywanie
  `node`/`npm` (tylko odczyt i operacje `git`). Poszlaka przemawiająca ZA tym, że działa: przykładowy
  komunikat błędu w opisie PR-a i commit message wygląda na wyjście z realnego uruchomienia wobec
  prawdziwego pliku, nie na ręcznie spreparowany tekst.
- **Fix**: Jednozdaniowa notatka w `notes/pool-queue.md` (albo w komentarzu nad `csvRows`)
  potwierdzająca, że `npm run distill:usda` przeszedł na pełnym zbiorze **po** dodaniu sprawdzenia
  nagłówka, rozwiałaby to od ręki. Jeśli kiedyś okaże się, że nie przechodzi z powodu BOM-u,
  poprawka to `header[0]?.replace(/^﻿/, '')` przy parsowaniu pierwszego wiersza.
  - Strength: Tani do zweryfikowania (dowolny przebieg `distill:usda` to rozstrzyga), a jeśli
    problem realny, poprawka jest jednolinijkowa i nie zmienia kontraktu funkcji.
  - Tradeoff: Brak — czysto dokumentacyjne albo trywialny fix.
  - Confidence: LOW, że problem faktycznie występuje — SR Legacy 2018-04 to zrzut rządowy, część
    takich eksportów ma BOM, część nie, i nie mam sposobu sprawdzić z tego środowiska.
  - Blind spot: Nie widziałem prawdziwego pliku `food.csv` (gitignorowany, niepobrany w tym
    checkout) ani wyniku żadnego uruchomienia po fixie — to ustalenie jest wnioskowaniem z kodu,
    nie obserwacją uruchomienia.
- **Decision**: PENDING

### F5 — Odtworzenie demonstracji sita opisu (3.0b) wymaga pełnego pliku USDA

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — tarcie przy przyszłej weryfikacji, nie defekt
- **Dimension**: Safety & Quality
- **Location**: N/A (proces weryfikacji, nie kod)
- **Detail**: Kod sita (`distill-usda.mjs:129-143` w poprzedniej numeracji linii) jest realny
  i inspekcjonowalny, a idempotencja importu (3.0c) jest w pełni odtwarzalna z samych
  zacommitowanych plików. Ponowne wywołanie konkretnej demonstracji z PR (celowe zepsucie
  `169251`→`169252`) nadal wymaga rozpakowanego 38 MB zbioru USDA, którego repo nie trzyma.
- **Fix**: Brak wymaganego teraz — do rozważenia w P5, gdy `npm test` może rozszerzyć się poza
  `src/lib/`.
- **Decision**: PRZYJĘTE DO WIADOMOŚCI 14.09.2026, odłożone świadomie do P5 — zdecydowane w
  commit `768984b`, konsekwentnie z poprzednią rundą. Sito ma teraz drugą, niezależną linię
  obrony tej samej klasy błędu (nagłówek kolumn, F3), co obniża ryzyko rezydualne, na które ten
  fixture by patrzył.

## Ograniczenie tego przebiegu

To uruchomienie CI nie miało zgody na wykonywanie `node`/`npm`/dowolnych poleceń poza `git`
(status/diff/log/show/add/commit) i skryptem push — potwierdzone empirycznie (odmowa zarówno
w tej sesji, jak i w subagencie). W efekcie **nie odtworzyłem** `npx tsc --noEmit`, `npm test`,
`npx expo lint` ani `npm run check-conventions` w tym przebiegu; opieram się na: (a) statycznym
czytaniu obu skryptów w całości i porównaniu z realnym schematem D1 i eksportami `src/lib/`, które
importują, (b) fakcie, że `scripts/check-conventions.js:180` jawnie ogranicza swoje reguły
per-plik do `.ts`/`.tsx` pod `src/` — `scripts/*.mjs` nie podlega żadnej z nich — i (c)
samozgłoszonych wynikach z opisu PR-a (100/100 testów, `tsc`/`lint`/`check-conventions` czyste),
których nie mogłem zweryfikować niezależnie w tej sesji. Żaden plik pod `src/lib/` nie zmienił się
w tym PR-ze, więc zestaw testów jednostkowych jest strukturalnie nieporuszony przez ten diff.
Jeśli chcesz, żebym w przyszłości uruchamiał te polecenia sam, rozszerz `--allowedTools` o
`Bash(node:*)` / `Bash(npm run *:*)` dla tego workflow.

<!-- End of report -->
