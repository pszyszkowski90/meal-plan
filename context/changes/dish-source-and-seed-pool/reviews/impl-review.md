<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Wybór źródła przepisów z makrami i zseedowanie minimalnej puli dań — Faza 3 (pilot 20 dań)

- **Plan**: `context/changes/dish-source-and-seed-pool/plan.md`
- **Scope**: Full plan (CI review on PR #25) — porównanie skupione na Fazie 3, jedynej fazie
  dotkniętej tym PR-em (kryteria 3.1–3.11 przeszły z `[ ]` na `[x]`); Faza 4 pozostaje `[ ]` i poza
  zakresem tego diffu.
- **Date**: 2026-09-14
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

## Zakres i metoda

Trzy równoległe subagenty pokryły trzy wymiary przeglądu (dryf planu, bezpieczeństwo/jakość/wzorce,
pokrycie testami), niezależnie od tego przebiegu głównego, który dodatkowo zweryfikował statycznie
(odczyt kodu) kluczowe fragmenty `scripts/seed-dishes.mjs` i `scripts/check-pool-feasibility.mjs`.

**Ograniczenie tego przebiegu**: sesja CI nie miała zgody na wykonywanie `node`/`npm`/`npx`
w Bashu (wymagały zatwierdzenia, którego nikt nieinteraktywnie nie udzielił) ani na `git fetch`
(sieć). Subagent 3 obszedł to, czytając log uruchomionego już joba bramki jakości GitHub Actions
(run `34852770840`, checked out przy SHA `fd81074`) zamiast uruchamiać polecenia lokalnie —
`tsc`, `npm test` (100/100), `expo lint`, `check-conventions` i `check-lock` wszystkie zielone
w tym logu. Twierdzenia dotyczące `wrangler`/D1 (walidator odrzuca zepsute danie, idempotencja,
osierocone wiersze, bramka `--remote`) nie dały się odtworzyć w tym sandboxie (brak `wrangler`,
brak `.dev.vars`) — zweryfikowane statycznym czytaniem kodu (ścieżki istnieją dokładnie tak, jak
opisano), nie uruchomieniem. PR-body i `notes/pool-queue.md` Dziennik twierdzą, że te sprawdzenia
wykonano na żywo przed tym commitem (zgodnie z regułą warunku produkcyjnego z `CLAUDE.md`) — to
twierdzenie jest wewnętrznie spójne z kodem, ale nieweryfikowalne niezależnie z tej sesji.

## Findings

### F1 — Nazwa dania w komentarzu SQL nie jest zabezpieczona przed znakiem nowej linii

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — szybka decyzja, poprawka jednowierszowa i wąsko zakresowa
- **Dimension**: Safety & Quality
- **Location**: scripts/seed-dishes.mjs:201
- **Detail**: `` `-- ${dish.name} — ${dish.macros.kcal} kcal` `` interpoluje `dish.name`
  bezpośrednio do komentarza SQL bez przejścia przez `quote()` (poprawnie — to komentarz, nie
  literał). Wszystkie właściwe literały tekstowe (`slug`, `name` w `VALUES`, `meal_slot`,
  `ingredientName`, kroki) poprawnie przechodzą przez `quote()`, który podwaja apostrofy — to
  jedyne miejsce, gdzie SQLite wymaga ucieczki. Ryzyko tu jest inne: nazwa dania zawierająca
  literalny znak nowej linii przerwałaby jednowierszowy komentarz SQL (`-- ...`) i wypisała
  resztę na nieprzedrostkowanym wierszu. W praktyce nieszkodliwe, bo dane wejściowe to
  wyłącznie przejrzane JSON-y w repo, nie dane użytkownika w runtime — ale skrypt sam siebie
  opisuje jako wzorzec do naśladowania w dalszych fazach.
- **Fix**: Zastąp nowe linie spacją przed wstawieniem do komentarza:
  `` `-- ${dish.name.replace(/\n/g, ' ')} — ${dish.macros.kcal} kcal` ``.
- **Decision**: PENDING

### F2 — `check:pool` w `package.json` nie jest literalnie wymienione w kontrakcie planu

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — nieszkodliwe rozszerzenie, zgodne z celem fazy
- **Dimension**: Scope Discipline
- **Location**: package.json:55
- **Detail**: Plan Fazy 3, punkt 3 wymienia wpisy `package.json` → `scripts`:
  `seed:dishes`, `import:usda`, `distill:usda` (dwa ostatnie już istniały z wcześniejszego commitu).
  Ten PR dodaje też `check:pool`, którego plan nie nazywa wprost — ale `scripts/check-pool-feasibility.mjs`
  jest jawnie zaplanowanym artefaktem punktu 5 tej samej fazy ("Pomiar pilotowy i decyzja"), więc
  wpis operacjonalizuje coś, co plan już zamawiał, nie dokłada nowego zakresu. Klasyfikacja: EXTRA,
  łagodne — nie sprzeczne z listą wykluczeń ("Czego NIE robimy").
- **Fix**: Brak działania wymagane — udokumentowanie w raporcie wystarcza.
- **Decision**: PENDING

<!-- End of report -->
