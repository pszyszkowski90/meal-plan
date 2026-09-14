<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Wybór źródła przepisów z makrami i zseedowanie minimalnej puli dań — Faza 4 (skalowanie puli i pomiar końcowy)

- **Plan**: `context/changes/dish-source-and-seed-pool/plan.md`
- **Scope**: Full plan (CI review on PR #27) — Fazy 1–3 były już zamknięte i przejrzane
  wcześniej (patrz `change.md`); ten PR dotyczy wyłącznie Fazy 4 (kryteria 4.1–4.8, wszystkie
  `[x]`). Plan F-01 nie ma po tym PR-ze żadnych pozostałych faz.
- **Date**: 2026-09-14
- **CI run**: https://github.com/pszyszkowski90/meal-plan/actions/runs/34857784898
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Test Coverage | PASS |
| Success Criteria | WARNING |

## Zakres i metoda

Ten PR nie dotyka żadnego pliku `.ts`/`.tsx` — jest to zmiana wyłącznie danych (36 nowych plików
`seed/dishes/<slug>.json`, 16 nowych wierszy w `seed/ingredients.json` i `seed/usda-subset.json`)
plus dokumentacja (`CLAUDE.md`, `plan.md`, `notes/pool-queue.md`, `seed/FEASIBILITY.md`).
Z tego powodu przegląd skupił się na integralności danych względem kontraktu `dish-validation.ts`
i `seed-dishes.mjs`, a nie na typowym przeglądzie kodu źródłowego.

**Ograniczenie tego przebiegu** — takie samo jak w poprzednich rundach przeglądu tej zmiany
(patrz `change.md`, wpisy dla PR #24 i #25): ta sesja CI nie miała zgody na wykonywanie
`npm`/`npx`/`node -e` w Bashu (każde wywołanie, łącznie z `npm --version` i `node -e "1+1"`,
wymagało zatwierdzenia, którego nikt nieinteraktywnie nie udzielił; działały tylko
`node --version`, `python3 --version` i polecenia `git`). Nie dało się więc odtworzyć
`npm test`, `npx tsc --noEmit`, `npx expo lint`, `npm run check-conventions` ani uruchomić
`node ./scripts/seed-dishes.mjs --local` w tej sesji.

Zamiast tego przegląd zweryfikował statycznie, co dało się sprawdzić bez wykonania kodu:

- `git diff --exit-code origin/main...HEAD -- package-lock.json` — pusty, potwierdza „zero
  nowych zależności" z opisu PR-a.
- Wszystkie **56** plików `seed/dishes/*.json` mają niepuste pole `reviewedBy` (sprawdzone
  `grep`-em po całym katalogu, nie tylko po nowych plikach).
- Każdy `ingredientName` użyty w `seed/dishes/*.json` (255 odwołań) istnieje w
  `seed/ingredients.json` — zero nieznanych składników.
- Wszystkie wartości `mealSlots` w nowych plikach należą do enuma
  `{breakfast, lunch, dinner, snack}`; wszystkie `prepMinutes` mieszczą się w 5–45 minut
  (wewnątrz granicy 5–120 z `DishBounds` w `src/lib/dish-validation.ts`).
- Przeliczenie liczby dań per pora posiłku wprost z plików (nie z raportu) dało **20/27/31/15**
  (breakfast/lunch/dinner/snack) — dokładnie tyle, ile deklaruje kryterium 4.1 i opis PR-a.
- Ręczne przeliczenie niezmiennika Atwatera (`4·białko + 4·węgle + 9·tłuszcz`) dla wszystkich
  **16 nowych składników** z `seed/usda-subset.json` — wszystkie mieszczą się w tolerancji
  z `DishBounds` (10% względne albo 12 kcal bezwzględne). Trzy warzywa bogate w błonnik
  (kapusta biała, cukinia, kukurydza z puszki) przechodzą wyłącznie dzięki progowi bezwzględnemu
  12 kcal — spójne z uzasadnieniem decyzji D20 w `plan.md`.

To daje wysoką pewność, że dane przejdą `validateDish` i `seed-dishes.mjs --remote`, ale **nie
jest to samo, co uruchomienie realnego walidatora** — rekomendacja: właściwy pipeline CI/CD tego
repo (z pełnym dostępem do `npm`) powinien pozostać ostatecznym rozjemcą dla kryteriów 4.1–4.5,
tak jak w poprzednich rundach tego przeglądu.

## Findings

### F1 — `seed/REVIEW.md` nigdy nie powstał, mimo że plan wymienia go jako artefakt Fazy 3 i 4

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — brak wpływu na runtime, uzupełnienie jest odwracalne i wąsko zakresowe
- **Dimension**: Plan Adherence
- **Location**: `context/changes/dish-source-and-seed-pool/plan.md:338` (Faza 4, „Reszta puli")
- **Detail**: Plan Fazy 3, punkt 4 zapowiada: „`seed/REVIEW.md` zostaje jako narracja, ale
  przestaje być jedynym mechanizmem" — a Faza 4, „Wymagane zmiany" §1 wymienia
  `seed/REVIEW.md` wprost na liście plików do zaktualizowania obok `seed/dishes/<slug>.json`
  i `seed/ingredients.json`. Plik **nigdy nie istniał** w historii repozytorium
  (`git log --all -- seed/REVIEW.md` nie zwraca nic) — ani w Fazie 3, ani w tym PR-ze.
  Substancja, którą miał nieść (narracja przeglądu gramatur), jest w praktyce pokryta przez
  Dziennik w `notes/pool-queue.md` (wpisy P4b i P5 opisują właśnie to, łącznie z trzema
  odrzuconymi daniami i uzasadnieniem) oraz przez techniczną bramkę `reviewedBy` w
  `seed-dishes.mjs`, którą plan sam nazywa właściwym mechanizmem. To zmniejsza wagę ustalenia,
  ale nie zamyka go — plan nadal literalnie wymienia plik, którego nie ma.
- **Fix**: Jedno z dwóch, do wyboru przez właściciela zmiany:
  - **Opcja A ⭐ Rekomendowana**: Usunąć `seed/REVIEW.md` z listy plików Fazy 4 w `plan.md`
    (edycja dokumentu, nie kodu) z dopiskiem, że rolę narracji przejął Dziennik w
    `notes/pool-queue.md` — to już faktyczny stan rzeczy, tylko nienazwany wprost.
    - Strength: Zero nowej pracy; nazywa to, co już się dzieje.
    - Tradeoff: Traci się jeden, dedykowany plik z historią przeglądu dań (rozproszoną teraz
      po Dzienniku kolejki, który ma szerszy zakres niż tylko pula dań).
    - Confidence: HIGH — Dziennik faktycznie zawiera treść, którą REVIEW.md miał nieść.
    - Blind spot: Nie sprawdzałem, czy inny dokument (np. `seed/README.md`) już odsyła do
      Dziennika jako źródła prawdy o przeglądzie — jeśli nie, warto dodać taki odnośnik przy
      okazji tej edycji.
  - **Fix B**: Utworzyć `seed/REVIEW.md` post factum, streszczając 56 dań i decyzję o trzech
    odrzuconych (dane już są w `seed/FEASIBILITY.md` i `notes/pool-queue.md`, więc to głównie
    kopiowanie, nie nowa praca).
- **Decision**: PENDING

### F2 — Nowy składnik „oliwki czarne, z puszki" nie jest używany w żadnym daniu

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — martwy wiersz w katalogu, zero wpływu na guardrail ±10%
- **Dimension**: Scope Discipline
- **Location**: `seed/ingredients.json:392`
- **Detail**: Ten PR dodaje 16 nowych składników; 15 z nich są użyte w co najmniej jednym z 36
  nowych dań. `oliwki czarne, z puszki` (fdcId 169094) nie występuje w żadnym z 56 plików
  `seed/dishes/*.json`. Najbardziej prawdopodobne wyjaśnienie: składnik miał obsłużyć danie
  „kanapki z fetą i oliwkami", które `seed/FEASIBILITY.md` wymienia jako jedno z trzech
  odrzuconych przez sito `modelKcalHint` (rozjazd 22%) — ingredient został dodany do mapowania,
  zanim danie odpadło, i nie został cofnięty. Nieszkodliwe dziś; stanie się widoczne, gdy
  powstanie `GET /api/catalog` (S-07) i pokaże pozycję, której nie da się nigdzie ugotować.
- **Fix**: Usunąć wiersz `oliwki czarne, z puszki` z `seed/ingredients.json` i odpowiadający mu
  wpis w `seed/usda-subset.json`, chyba że jest już zaplanowane danie, które go użyje.
- **Decision**: PENDING

### F3 — Zestaw testów tej rundy przeglądu jest statyczny, nie wykonany

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — nie jest to defekt w PR-ze, tylko ograniczenie środowiska przeglądu
- **Dimension**: Success Criteria
- **Location**: N/A (ograniczenie sesji CI, opisane w „Zakres i metoda" wyżej)
- **Detail**: Kryteria automatyczne 4.1–4.5 (minima per pora posiłku, `reviewedBy` na
  wszystkich daniach, `migrations list --remote` bez zaległych, raport wykonalności, `npm
  test`/`tsc`/`expo lint`/`check-conventions`/`git diff` na lockfile) nie zostały odtworzone
  wykonaniem w tej sesji — brak zgody na `npm`/`npx`/`node -e` w Bashu. Zastąpione statyczną
  weryfikacją opisaną wyżej, która niezależnie potwierdziła liczby z 4.1 i brak zmian w
  lockfile z 4.5, ale nie uruchomiła `tsc`/`test`/`lint`/`check-conventions` ani rzeczywistego
  `validateDish` na wszystkich 56 daniach.
- **Fix**: Brak działania po stronie autora PR-a — to ograniczenie narzędzia przeglądu, nie
  luka w implementacji. Warto zaktualizować `--allowedTools` tej umiejętności o
  `Bash(npm run *)`, `Bash(npx *)`, `Bash(node *)`, żeby przyszłe przebiegi mogły wykonać
  kryteria automatyczne zamiast je tylko statycznie przybliżać.
- **Decision**: PENDING

<!-- End of report -->
