<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Wybór źródła przepisów z makrami i zseedowanie minimalnej puli dań — Faza 4 (skalowanie puli i pomiar końcowy)

- **Plan**: `context/changes/dish-source-and-seed-pool/plan.md`
- **Scope**: Full plan (CI review on PR #27, re-run after `synchronize`) — Fazy 1–3 były już
  zamknięte i przejrzane wcześniej (patrz `change.md`); ten PR dotyczy wyłącznie Fazy 4
  (kryteria 4.1–4.8, wszystkie `[x]`). Ten przebieg zastępuje poprzedni raport z tego samego pliku
  (commit `7f14e2c`), po tym jak PR-branch dostał commit `4b56c3a` rozliczający jego ustalenia F1/F2.
- **Date**: 2026-09-14
- **CI run**: https://github.com/pszyszkowski90/meal-plan/actions/runs/34859737580
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Test Coverage | PASS |
| Success Criteria | PASS |

## Zakres i metoda

PR nie dotyka żadnego pliku `.ts`/`.tsx` — to zmiana danych (36 plików `seed/dishes/<slug>.json`
z poprzedniej rundy plus 2 kolejne dodane w `4b56c3a`, łącznie pula 58 dań) i skryptu
`scripts/seed-dishes.mjs` (+31/-1: nowa funkcja diagnostyczna `reportUnusedIngredients`), plus
dokumentacja (`CLAUDE.md`, `plan.md`, `notes/pool-queue.md`, `seed/FEASIBILITY.md`, nowy
`seed/REVIEW.md`).

**Ta runda miała częściowy dostęp do `git`/`gh`/MCP CI, ale nie do `npm`/`npx`/`node -e`** w Bashu
(ten sam znany limit środowiska co poprzednie rundy tej zmiany — patrz `change.md`, PR #24/#25/#27
pierwsza runda). Zamiast statycznie przybliżać kryteria automatyczne od zera, ten przebieg
skorzystał z `mcp__github_ci__get_ci_status`: workflow **„Bramka jakości" (run `34859737522`) —
job „Typy, lint, testy, konwencje, lockfile" — zakończył się `success`** dla dokładnie tego commita
(`4b56c3a`, ten sam `created_at` co ten przegląd), co niezależnie potwierdza `tsc`, `npm test`,
`expo lint`, `check-conventions` i `check-lock` bez potrzeby ich ponownego uruchamiania w tym
sandboxie.

Dodatkowo zweryfikowano statycznie i deleguje częściowo do subagenta ogólnego przeznaczenia:

- `git diff --exit-code origin/main...HEAD -- package-lock.json` — pusty (0 nowych zależności).
- Policzenie dań per pora posiłku wprost z plików `seed/dishes/*.json` (grep, nie raport): **20
  śniadań / 29 obiadów / 33 kolacje / 15 przekąsek** — zgodne z kryterium 4.1 i z `CLAUDE.md`.
  Minima z planu (12/18/18/12) spełnione ze sporym zapasem.
- Wszystkie **58** plików mają niepuste `reviewedBy` i `reviewedAt`.
- **Każdy** `ingredientName` użyty w 58 plikach dań (subagent naliczył ~267 odwołań) istnieje
  dosłownie (ze znakami diakrytycznymi) w `seed/ingredients.json` — zero nieznanych składników,
  zero nazw niedopasowanych literą (pułapka, którą sam walidator by przepuścił, bo sprawdza tylko
  wobec `ingredients.json`, nie wobec bazy — nazwana wprost w `CLAUDE.md` po tym PR-ze).
- **Zero osieroconych składników** w finalnym stanie: `oliwki czarne, z puszki` i
  `boczniaki, świeże` (dwa ustalenia z poprzedniej rundy, F2) mają teraz każde swoje danie
  (`makaron-z-oliwkami-i-feta`, `makaron-z-boczniakami`) — sprawdzone bezpośrednio przez `grep`
  literału `"boczniaki, świeże"` w obu plikach, nie tylko przez odczyt narracji.
- 16 nowych wierszy w `seed/ingredients.json` ma komplet `fdcId` + `category` z zamkniętego enuma;
  niezmiennik Atwatera przeliczony ręcznie dla nich (plus cztery warzywa sprawdzone dodatkowo)
  mieści się w tolerancji `DishBounds` z `src/lib/dish-validation.ts` (10% względne albo próg
  bezwzględny 12 kcal dla warzyw bogatych w błonnik — zgodnie z decyzją D20).
- Wszystkie 58 plików mają niepuste `mealSlots` i `steps`.

To pokrywa merytorycznie te same kryteria co realne `validateDish`/`seed-dishes.mjs --remote`,
tylko inną metodą (statyczną, nie wykonaniem) — spójne z ograniczeniem opisanym w poprzednich
rundach tej zmiany.

## Findings

### F1 — `seed/REVIEW.md` i notatka 4.6 w `plan.md` wciąż podają liczby sprzed naprawy F2 (56 zamiast 58 dań)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — czysto dokumentacyjne, zero wpływu na dane, guardrail ±10% czy runtime
- **Dimension**: Plan Adherence
- **Location**: `seed/REVIEW.md:9`
- **Detail**: Commit `4b56c3a` naprawił dwa ustalenia poprzedniej rundy (F1: brakujący
  `seed/REVIEW.md`; F2: osierocony składnik) w jednym przebiegu — i przy okazji dodał **dwa nowe
  dania**, podnosząc pulę z 56 do 58 (commit message tego samego commita wprost to mówi: „pula ma
  58 zamiast 56"). Artefakty, które ten sam commit **stworzył lub przeliczył od zera**, poprawnie
  odzwierciedlają 58: `plan.md` §4.1/4.7 (20/29/33/15, „58 dań, 51 składników"), `CLAUDE.md`
  („58 dań i 51 składników… 29 obiadów, 33 kolacje"), `seed/FEASIBILITY.md` (`Dań w puli: 58`,
  „Filtr czasu ścina obiady z 29 do 12, a kolacje z 33 do 16").

  Ale `seed/REVIEW.md`, stworzony w **tym samym commicie**, otwiera się zdaniem „Wszystkie 56 dań:
  agent (upoważnienie właściciela 14.09.2026)" (linia 9) — liczba sprzed dodania tych dwóch dań.
  To samo zdarza się w `plan.md` w notatce ręcznej przy kryterium 4.6: „Filtr 30 minut ścina
  obiady z 27 do 10, a kolacje z 31 do 14" — te liczby (27/31/10/14) są sprzed naprawy F2;
  `seed/FEASIBILITY.md` (ten sam raport, do którego 4.6 się odnosi) podaje już **29→12 i 33→16**.
  Opis PR-a ma ten sam wzorzec (nagłówek „56 dań", tabela minimów 27 obiadów / 31 kolacji) —
  najpewniej dlatego, że opis PR-a został napisany przed commitem `4b56c3a` i nie był odświeżony
  po nim; to poza zasięgiem tego raportu (opis PR-a nie jest plikiem w repo), ale wzmacnia obraz:
  trzy niezależne miejsca prozy zostały w tyle za tymi samymi dwoma dodanymi daniami.

  Znaczenie jest niskie — żadna z tych liczb nie steruje kodem ani danymi, a artefakty, które
  faktycznie bramkują coś (walidator, `check-pool-feasibility.mjs`, `plan.md` §4.1/4.7) są
  poprawne. Ale `seed/REVIEW.md` powstał specyficznie po to, by być wiarygodną narracją tego, co
  stempel `reviewedBy` obejmuje — a jego własny pierwszy fakt jest nieaktualny w chwili, gdy plik
  trafia do repo, co osłabia dokładnie ten cel.
- **Fix**: Zaktualizować `seed/REVIEW.md:9` na „Wszystkie 58 dań" i `plan.md`'s notatkę 4.6 na
  „z 29 do 12, a kolacje z 33 do 16" (dopasowując do liczb już policzonych w `FEASIBILITY.md`).
  Drobna, tekstowa poprawka — nie wymaga ponownego seeda ani przeliczeń.
  - Strength: Zero ryzyka regresji, jedna linijka w każdym z dwóch plików, przywraca spójność
    między artefaktami, które już mają poprawne liczby.
  - Tradeoff: Brak — to czysta korekta tekstu.
  - Confidence: HIGH — liczby 58/29/33/12/16 są niezależnie potwierdzone przez `FEASIBILITY.md`,
    `plan.md` §4.1/4.7 i bezpośrednie przeliczenie plików w tym przeglądzie.
  - Blind spot: Nie sprawdzałem każdego wystąpienia „56" w repo poza wymienionymi plikami — jeśli
    jest ich więcej (np. w innych notatkach), ten fix ich nie obejmuje.
- **Decision**: NAPRAWIONE 14.09.2026 — trafne i precyzyjne ustalenie. Poprawione **cztery**
  miejsca, nie dwa wskazane: `seed/REVIEW.md:9` („58 dań"), notatka 4.6 w `plan.md` (29 → 12
  i 33 → 16), `change.md` („20 → 58 dań", wpis dopisany przez poprzednią rundę przeglądu)
  oraz opis PR-a. Ostatnie dwa znalazłem dopiero przeczesaniem `grep`-em po „56 dań", „27 obiadów"
  i „31 kolacji" — bez tego poprawiłbym dokładnie to, co wskazano, i zostawił resztę.
  Mechanizm był jeden: liczby przeliczane przez skrypt (`FEASIBILITY.md`, `plan.md` §4.1/4.7,
  `CLAUDE.md`) zaktualizowały się razem z pulą, a te wpisane ręcznie w prozie — nie. Ustalenie
  słusznie zwraca uwagę, że akurat `seed/REVIEW.md` powstał po to, by być wiarygodny, więc
  nieaktualna liczba w jego pierwszym zdaniu kosztuje więcej niż gdzie indziej.

<!-- End of report -->
