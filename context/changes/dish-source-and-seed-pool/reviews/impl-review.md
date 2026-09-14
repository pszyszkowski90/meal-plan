<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Weź makra składników z wiersza USDA, nie z pamięci modelu

- **Plan**: `context/changes/dish-source-and-seed-pool/plan.md` (Faza 3, wiersze 3.0a–3.0d — backfill dodany 14.09.2026, po tym jak właściciel przejął cały przegląd gramatur od modelu)
- **Scope**: Full plan slice covered by this PR (CI review on PR #24) — nie cała Faza 3 (3.1–3.11 nadal `[ ]`) i nie Faza 4
- **Date**: 2026-09-14
- **CI run**: https://github.com/pszyszkowski90/meal-plan/actions/runs/34846485800
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Test Coverage | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Brak osłony na odczytach plików wejściowych w obu nowych skryptach

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — mały, punktowy fix; ten sam wzorzec w dwóch miejscach
- **Dimension**: Safety & Quality
- **Location**: `scripts/import-usda.mjs:176-177`, `scripts/distill-usda.mjs:116`
- **Detail**: Oba skrypty mają zbudowaną, spójną konwencję `fail()` z czytelnym komunikatem (np. `distill-usda.mjs:109-114` dla brakującego `.usda/`), ale nie stosują jej do własnych odczytów `seed/ingredients.json` / `seed/usda-subset.json`. `import-usda.mjs:176-177` (`JSON.parse(fs.readFileSync(MappingFile/SubsetFile, 'utf8'))`) i `distill-usda.mjs:116` (to samo dla `MappingFile`) rzucą surowy `ENOENT`/`SyntaxError`, gdy plik nie istnieje albo jest uszkodzony — zamiast podpowiedzi w stylu „uruchom najpierw `npm run distill:usda`", którą reszta obu skryptów konsekwentnie daje.
- **Fix**: Owiń oba odczyty w try/catch i wywołaj `fail()` z podpowiedzią (dla `import-usda.mjs` — „uruchom `npm run distill:usda`", dla brakującego `seed/ingredients.json` w obu skryptach — że to plik wersjonowany w repo, więc jego brak zwykle znaczy zły katalog roboczy).
- **Decision**: PENDING

### F2 — `csvRows` dzieli plik na `\n` przed parsowaniem cudzysłowów

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — nie dotyczy obecnego zbioru danych
- **Dimension**: Safety & Quality
- **Location**: `scripts/distill-usda.mjs:88`
- **Detail**: `text.split('\n')` dzieli wiersze przed uruchomieniem `parseCsvLine`, więc pole w cudzysłowie zawierające znak nowej linii zostałoby po cichu rozbite na dwa „wiersze" i błędnie sparsowane, zamiast zgłosić błąd. Komentarz nad `parseCsvLine` (linie 26–27) deklaruje obsługę tego, czego używa USDA — dla krótkich, jednowierszowych pól SR Legacy to prawda, ale zapis jest szerszy niż implementacja.
- **Fix**: Doprecyzuj komentarz do „zakłada pola bez znaku nowej linii" albo, jeśli warto, parsuj cały plik w trybie świadomym cudzysłowów zamiast dzielić z góry po `\n`.
- **Decision**: PENDING

### F3 — Pozycyjny odczyt kolumn CSV bez walidacji nagłówka

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — cichy błąd danych, gdyby założenie kiedyś przestało być prawdziwe
- **Dimension**: Safety & Quality
- **Location**: `scripts/distill-usda.mjs:123` (`food.csv`), `scripts/distill-usda.mjs:149` (`food_nutrient.csv`)
- **Detail**: Obie pętle destrukturyzują wiersz pozycyjnie (`const [fdcId, , description] = row`, `const [, fdcId, nutrientId, amount] = row`) bez sprawdzenia, że nagłówek pliku faktycznie ma taki układ kolumn. Zmiana kolejności kolumn w `food.csv` zostałaby częściowo złapana przez sito opisu (linie 129–143) — inny opis dla tego samego `fdcId` przerwałby destylację. Zmiana kolejności w `food_nutrient.csv` **nie jest łapana przez nic**: skrypt policzyłby wiarygodnie wyglądające, błędne makra, dokładnie ten tryb awarii, przed którym ma chronić cała ta zmiana. Ryzyko jest niskie — SR Legacy 2018-04 to zamrożony, historyczny zrzut, nie API, które się zmienia — ale warte odnotowania jako założenie kontraktu skryptu.
- **Fix**: Sprawdź pierwszy wiersz obu plików względem oczekiwanej listy nazw kolumn przed konsumpcją wierszy i przerwij `fail()`-em przy niezgodności.
- **Decision**: PENDING

### F4 — `fail()` w `import-usda.mjs` bez domyślnej wartości dla `details`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: `scripts/import-usda.mjs:51`
- **Detail**: `function fail(message, details)` nie ma `= []`, w przeciwieństwie do bliźniaczej funkcji w `distill-usda.mjs:100` (`details = []`). Dziś nieszkodliwe — jedyne wywołanie zawsze przekazuje tablicę (`import-usda.mjs:102`) — ale przyszłe wywołanie bez drugiego argumentu rzuciłoby na `for...of details`.
- **Fix**: Dodaj `= []` dla spójności z `distill-usda.mjs`.
- **Decision**: PENDING

### F5 — Odtworzenie demonstracji sita opisu (3.0b) wymaga pełnego pliku USDA

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — kompromis zaakceptowany już przez plan
- **Dimension**: Test Coverage
- **Location**: N/A (proces weryfikacji, nie kod)
- **Detail**: Kod sita (`distill-usda.mjs:129-143`) jest realny i inspekcjonowalny, a idempotencja importu (3.0c) jest w pełni odtwarzalna z samych zacommitowanych plików. Ale ponowne wywołanie konkretnej demonstracji z PR (celowe zepsucie `169251`→`169252`) wymaga rozpakowanego 38 MB zbioru USDA, który pobrał tylko autor — `seed/README.md` dokumentuje kroki pobrania (publiczne, bez klucza), ale nie ma fixture'a pozwalającego odtworzyć to bez pełnego pobrania. Plan świadomie akceptuje, że ten plik jest pobierany przez człowieka i gitignorowany — to nie jest naruszenie, tylko tarcie przy przyszłej weryfikacji.
- **Fix**: Brak wymaganego — do rozważenia w przyszłości: mały fixture CSV (kilka wierszy) wyłącznie do testu regresyjnego sita opisu, bez pełnego zbioru USDA.
- **Decision**: PENDING

<!-- End of report -->
