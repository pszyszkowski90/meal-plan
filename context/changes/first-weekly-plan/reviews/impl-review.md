<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: S-04 — Faza 3 (repozytorium i trasa `/api/plan`)

> Raport fazy 2 zastąpiony tym (ten sam plik, git history ma poprzednią wersję) — ta sama
> konwencja, co w zarchiwizowanej zmianie F-01.

- **Plan**: `context/changes/first-weekly-plan/plan.md`
- **Zakres**: Faza 3 z czterech. Fazy 1–2 scalone w PR #32 i #33; faza 4 poza zakresem.
- **Data**: 2026-09-14
- **Werdykt pierwszej rundy**: **WYMAGA UWAGI** (3 blokujące, 3 ostrzeżenia, 8 obserwacji)
- **Werdykt po poprawkach**: **APPROVED**

> **Przegląd wykonany lokalnie, nie przez zadanie CI — po raz drugi z tego samego powodu.**
> Zadanie `Przegląd implementacji` padło na tym PR-ze bez zapisania raportu (przebieg
> `34885240575`, 4 min 46 s), tak samo jak na PR #33. Diff ma 1190 linii. Bramka czyta PLIK,
> nie komentarz, więc bez raportu przepuściłaby PR bez przeglądu. Przegląd wykonał agent
> adwersaryjny uruchomiony lokalnie — z prawem do `npm test`, `tsc`, `check-conventions`
> i **odczytu z żywej D1**, czyli z większymi możliwościami weryfikacji niż ma zadanie CI.
> To już wzorzec, nie incydent: **przy diffach tej wielkości zadanie CI nie domyka przeglądu.**

## Werdykty wymiarów

| Wymiar | Runda 1 | Po poprawkach |
|---|---|---|
| Plan Adherence | WYMAGA UWAGI | PASS |
| Scope Discipline | PASS | PASS |
| Correctness | PASS | PASS |
| Pattern Consistency | PASS | PASS |
| Test Coverage | WYMAGA UWAGI | PASS |

## Metoda

Bramki odtworzone niezależnie: `npx tsc --noEmit` kod 0, `npm test` 136/136 (identycznie jak
po fazie 2 — zero regresji), `npx expo lint` kod 0, `npm run check-conventions` czysto (53 pliki),
`git diff --exit-code package-lock.json` pusto.

Ponad to: zapytania sprawdzone **wykonaniem przeciw żywej lokalnej D1**, a nie czytaniem —
stałość `passes_exclusions` i `slots` w obrębie dania przy rozgałęzieniu po składnikach,
poprawność `distinct` w zapytaniu kroków, zgodność zaokrąglenia wyroczni testowej z
`computeDishMacros` dla wszystkich 58 dań.

## Ustalenia

### F1 — KRYTYCZNE — kryterium 3.7 odhaczone, a zbudowane przy innym limicie

Plan mówi wprost: **„Konto z `max_prep_minutes = 15`"**, z uzasadnieniem „przy 15 minutach pula
obiadów to jedno danie". Dostarczony test używał **30**, czyli ustawień identycznych z czterema
innymi testami tego pliku — dokładał asercję, ale nie warunek skrajny.

Zmierzone na puli lokalnej:

| limit | breakfast | lunch | dinner | snack |
|---|---:|---:|---:|---:|
| ≤ 15 min | 20 | **1** | 4 | 15 |
| ≤ 30 min | 20 | 12 | 16 | 15 |

Przy 15 minutach obiad jest jeden i to jedyna konfiguracja, w której złamanie limitu jest w ogóle
prawdopodobne. Odstępstwo **nie było odnotowane** w Dzienniku, choć odstępstwa przy 3.4 i 3.10
były — więc odhaczenie było fałszywym twierdzeniem. Trzecie wystąpienie klasy z `lessons.md`
§„Kryterium, które przechodzi niezależnie od tego, czy rzecz działa".

- **Decyzja**: PRZYJĘTE, naprawione. Test używa `maxPrepMinutes = 15` i dopuszcza obie odpowiedzi,
  które plan przewiduje: 201 z asercją „zero dań ponad limitem" albo 422 z `reason: 'prepTime'`,
  `limitMinutes: 15` i `withoutLimit > remaining`. Niedopuszczalny jest wyłącznie plan łamiący
  limit — i to jest treść asercji.

### F2 — KRYTYCZNE — dwa z trzech ramion odsiewu wykluczeń nie miały ŻADNEGO pokrycia

Nagłówek pliku sam nazywa ryzyko („napisanie ich drugi raz byłoby drugim mechanizmem wykluczeń"),
a trzy warunki **są** fizycznie przepisane z `preferences.ts` do `case when`. Sprawdzone było
wyłącznie `kind = 'group'`. Pozostałe dwa rodzaje wpisu nie miały testu **nigdzie w repo** —
`listAllowedDishes` też nie ma testu zachowaniowego.

Ramię składnikowe jest przy tym **główną ścieżką interfejsu**: przycisk „Wyklucz <składnik>"
zapisuje dokładnie ten rodzaj wpisu. Literówka w nim wpuściłaby na talerz składnik wykluczony
wprost przez użytkownika, po cichu, przy wszystkich bramkach na zielono. To pierwsze z trzech
ograniczeń twardych `CLAUDE.md`.

- **Decyzja**: PRZYJĘTE, naprawione — i naprawa wymagała **dwóch podejść**, bo pierwsze nie
  działało. Dodane dwa testy, **osobne dla każdego ramienia**. Pierwsza wersja sprawdzała oba
  w jednym teście i ramię daniowe było w niej **niewidoczne**: wykluczenie popularnego składnika
  odsiewało te same dania, więc test przechodził także ze zdjętym ramieniem daniowym (zmierzone
  zepsuciem). Druga poprawka dotyczyła doboru danych: wykluczenie **jednego** dania o najniższym
  `id` też nie łapało zepsucia, bo przy 58 daniach i 28 pozycjach szansa, że akurat to jedno
  zostanie wybrane, jest niska. Test wyklucza więc **dokładnie te dania, które generator właśnie
  wybrał** — są dowodnie takie, które do tego profilu pasują, więc ich powrót jest dowodem awarii.

  Oba ramiona sprawdzone celowym zepsuciem, **każde osobno**, pełnym cyklem: zdjęte ramię
  składnikowe → **17 naruszeń**, zdjęte ramię daniowe → **10 naruszeń**.

### F3 — KRYTYCZNE — `countD1` zamieniało „nie zmierzyłem" na „zero naruszeń"

`queryD1` kończyło się `parsed[0]?.results ?? []`, a `countD1` — `rows[0]?.n ?? 0`. Trzy
najmocniejsze asercje guardraila tej fazy to `toBe(0)`: dania wykluczone, dania ponad limitem
czasu i niezmiennik `7 × meals_per_day`. Każda zmiana kształtu wyjścia wranglera czytałaby się
jako **dowód zgodności**.

To dosłownie zarejestrowana lekcja „Odróżnij «narzędzie znalazło problem» od «narzędzie się nie
uruchomiło»", zastosowana do helpera, który ten PR wprowadza.

- **Decyzja**: PRZYJĘTE, naprawione. `queryD1` rzuca, gdy wrangler nie oddał pola `results`;
  `countD1` rzuca, gdy zapytanie nie oddało liczby. Zapytanie zliczające zawsze oddaje dokładnie
  jeden wiersz, więc brak wiersza znaczy, że nie policzono niczego — a `0` byłoby kłamstwem
  po stronie bezpiecznej dla testu i niebezpiecznej dla produktu.

### F4 — OSTRZEŻENIE — gałąź „brak planu" z kryterium 3.3 jest nieosiągalna w każdym przebiegu

Test asertował 200, „nie 404" i obecność pól, ale nigdy samej wartości pustej. Gałąź jest
nieosiągalna **z konstrukcji zestawu**: Playwright porządkuje pliki po ścieżce,
`account-isolation.spec.ts` sortuje się przed `plan-api.spec.ts`, a jego test 3.8 generuje plan
dla tego konta — więc konto ma plan zawsze, także na świeżo zmigrowanej bazie. Trasa zwracająca
404 dla „brak planu" przeszłaby ten test.

- **Decyzja**: PRZYJĘTE częściowo — zapisane uczciwie, nie naprawione zmianą zachowania. Test
  dowodzi KONTRAKTU (200, nigdy 404, oba pola, `no-store`) i mówi to wprost w komentarzu, razem
  z powodem. Wymuszanie pustej wartości wymagałoby albo trasy kasującej plan (powiększenie
  powierzchni produktu pod test — ten sam argument co przy 3.4), albo zależności od kolejności
  plików, która jest własnością narzędzia, a nie produktu. Wiersz Postępu 3.3 zmieniony, żeby
  mówił, co jest dowiedzione.

### F5 — OSTRZEŻENIE — zapisany plan może wyjechać poza okno bez żadnej zmiany w `plan`

`getPlanWithRecipes` przelicza `totalKcal` z **bieżących** wierszy `dish_ingredient`, a
`plan.target_kcal` jest zachowanym faktem historycznym. `seed-dishes.mjs` przy korekcie gramatury
kasuje i wstawia `dish_ingredient` na nowo — więc suma dnia zapisanego planu zmienia się, choć
`plan` i `plan_item` są nietknięte. `GET` oddawał taki plan jako całkiem zwyczajny, a ekran
pokazywałby dzień na 2900 kcal obok celu 2200 jak gdyby nigdy nic.

Bez tego faza 4 zobaczyłaby czerwone kryterium 4.3 i wyglądałoby ono na błąd generatora, którym
nie jest.

- **Decyzja**: PRZYJĘTE, naprawione. Kontrakt odpowiedzi dostał `plan.daysOutOfWindow: number[]` —
  normalnie pusty. Okno liczone **tą samą stałą** `CalorieTolerance` z `@/lib/plan-generator`;
  drugie miejsce z liczbą 0,1 byłoby dokładnie tym rozjazdem, przed którym ta stała powstała.
  To inny rodzaj nieaktualności niż `currentTargetKcal`: tam zmienił się UŻYTKOWNIK, tu PULA —
  rada jest ta sama („wygeneruj ponownie"), ale powód inny. Test 3.5 asertuje, że świeżo
  wygenerowany plan ma pustą listę dni poza oknem.

### F6 — OSTRZEŻENIE — `startDate` to data UTC, przesunięta o dobę dla strefy produktu

`new Date().toISOString().slice(0, 10)` dla użytkownika w Polsce między lokalną północą
a 01:00/02:00 zapisze datę **wczorajszą**.

- **Decyzja**: PRZYJĘTE jako KONTRAKT, nie jako poprawka kodu. `start_date` jest **datą
  kalendarzową UTC** i mówi, KIEDY plan powstał — nie służy do wyliczania etykiet. Ekran
  etykietuje dni numerem (`Dzień 1`…`Dzień 7`), co jest i tak właściwsze produktowo: plan jest
  na „siedem kolejnych dni", a nie na konkretne daty. Zapisane komentarzem w miejscu, gdzie data
  powstaje. Przyjmowanie daty lokalnej od klienta odrzucone — dokładałoby ciało do `POST`,
  który dziś świadomie żadnego nie czyta.

### F7 — OBSERWACJA — podrobiony token sprawdzony tylko dla `GET`

- **Decyzja**: PRZYJĘTE, naprawione. Dodany test `POST /api/plan` z podrobionym tokenem.
  `POST` jest tu groźniejszy niż `GET`: **zastępuje** plan, więc przyjęty podrobiony token
  kasowałby cudzy tydzień.

### F8 — OBSERWACJA — test izolacji zbierał listę dań i jej nie porównywał

`dishesA` było zbierane, asertowane na długość i nigdy więcej nie czytane. Test obiecujący
„nie miesza się z nim" sprawdzał trzy pola nagłówka.

- **Decyzja**: PRZYJĘTE, naprawione. Po wygenerowaniu planu przez konto B plan konta A jest
  porównywany **co do dania**, nie co do nagłówka.

### F9 — OBSERWACJA — asercja modulo nie asertowała tego, co mówił komentarz

`21 % 7 === 0` i `28 % 7 === 0`, więc asercja ich nie rozróżniała.

- **Decyzja**: PRZYJĘTE, naprawione. Zastąpione asercją, która faktycznie rozróżnia: liczba
  pozycji **nie jest** liczbą wynikającą z dzisiejszych ustawień.

### F10 — OBSERWACJA — kryterium 3.12 jako dosłowny `grep` daje czerwień na czystym pliku

Trzy trafienia to komentarze **zakazujące** agregacji kalorii w SQL-u. Intencja spełniona;
sprawdzone, że żaden ciąg SQL w pliku nie zawiera agregatu po kaloriach.

- **Decyzja**: ODŁOŻONE ŚWIADOMIE. Właściwym miejscem jest reguła w `check-conventions.js`
  skanująca wyłącznie ciała szablonów SQL — czyli osobna zmiana z własną bramką. Reguła w tym
  repo wchodzi tylko wtedy, gdy całe drzewo ją przechodzi, więc dopisanie jej „przy okazji"
  łamałoby zasadę zapisaną w `check-conventions.js`.

### F11 — OBSERWACJA — podzapytania liczone na wiersz wyjścia, nie na danie

**267 wierszy na 58 dań**, więc `group_concat` biegnie 267× zamiast 58×, a trzy `NOT EXISTS` —
801× zamiast 174×.

- **Decyzja**: ODŁOŻONE ŚWIADOMIE, z liczbą. To czas **po stronie D1**, nie CPU Workera, więc
  nie zagraża budżetowi 10 ms; zmierzona różnica `meta.duration` wobec przepisania na CTE
  mieściła się w szumie (2–4 ms w obie strony) przy 58 daniach. Sprawa skalowania, nie dzisiejszy
  defekt — a `plan-queue.md` §3 zakazuje optymalizowania przed pomiarem. Właściwym momentem
  jest G4, który i tak mierzy tę ścieżkę.

### F12 — OBSERWACJA — przesłanianie aliasu `di` stało się nośne

Wewnętrzne `from dish_ingredient di` przesłania **zewnętrzny** `left join dish_ingredient di`.
Korelacja wiąże się z aliasem wewnętrznym, co jest poprawne — ale w `preferences.ts`, skąd ten
SQL pochodzi, zewnętrznego `di` nie było.

- **Decyzja**: ODŁOŻONE ŚWIADOMIE, po weryfikacji **pomiarem**: dla konta z wykluczeniem
  składnikowym każde danie ma jedną wartość `passes_exclusions` i jedną `slots` we wszystkich
  swoich wierszach (`inconsistent_dishes = 0`), a ramię składnikowe faktycznie odpala.
  Przemianowanie aliasów byłoby czystsze, ale zmienia SQL, który właśnie został sprawdzony
  dwoma celowymi zepsuciami, a zysk jest hipotetyczny. Do zrobienia przy następnym dotknięciu
  tego zapytania.

### F13 — OBSERWACJA — trzy drobiazgi w kodzie, żaden nie jest dziś defektem

Współdzielona przez referencję tablica kroków między dniami; podwójny odczyt profilu w `POST`;
500 zwracane, gdy odczyt po udanym zapisie rzuci.

- **Decyzja**: ODŁOŻONE ŚWIADOMIE. Pierwsze jest nieszkodliwe, dopóki nikt nie mutuje tablicy
  w miejscu — do pilnowania w fazie 4, gdzie ekran tę tablicę dostanie. Drugie to jedna runda
  do D1 na dziewięć w całym `POST`. Trzecie jest realne, ale rzadkie i nie powoduje niespójności
  danych (plan JEST zapisany); poprawka wymagałaby rozdzielenia „błąd zapisu" od „błąd odczytu
  po zapisie", co jest zmianą kształtu obsługi błędów i zasługuje na własny przegląd.

### F14 — OBSERWACJA — kryterium 3.4 zostało przepisane, a tabela pokrycia E2E nie zaktualizowana

Treść kryterium 3.4 została w tym PR-ze **zastąpiona**, nie tylko odhaczona. Zmiana jest
udokumentowana w Dzienniku i w samym teście, a powód (brak trasy kasującej; niepowiększanie
powierzchni produktu pod test) jest spójny — ale edytowanie kryterium tak, żeby pasowało do tego,
co zbudowano, jest trybem awarii, przed którym stoi przegląd planu, więc musi być widoczne
w rejestrze przeglądu, a nie tylko w diffie.

- **Decyzja**: PRZYJĘTE jako zapis. Tekst kryterium w sekcji `Faza 3` doprowadzony do zgodności
  z wierszem Postępu, żeby dokument nie mówił dwóch rzeczy naraz. Aktualizacja
  `tests/e2e/README.md` **odłożona świadomie** — to plik opisujący cały harness i zasługuje
  na jedną aktualizację po fazie 4, a nie dwie częściowe.

## Stan po poprawkach

`npm test` 136/136 · `tsc --noEmit` czysto · `expo lint` czysto · `check-conventions` czysto
(53 pliki) · `check-lock` czysto · `package-lock.json` nietknięty ·
**E2E 58/58** przeciw `wrangler dev` na zbudowanym `dist/` (było 44 przed tą paczką).

Cztery celowe zepsucia w tej fazie, każde pełnym cyklem z potwierdzeniem zepsucia w artefakcie:

| Zepsucie | Wynik |
|---|---|
| zdjęte ramię wykluczeń grupowych | **3.6 na czerwono** |
| zdjęte ramię wykluczeń składnikowych | **czerwone, 17 naruszeń** |
| zdjęte ramię wykluczeń daniowych | **czerwone, 10 naruszeń** |
| zdjęty filtr `user_id` z obu `DELETE` w `savePlan` | **3.8 na czerwono** |

## Odnotowana niestabilność

W trakcie przebiegów **dwa razy** pojawił się nieodtwarzalny błąd: raz `apiRequestContext.put:
socket hang up`, raz porażka testu 3.9 w pełnym przebiegu, która w izolacji i w kolejnym pełnym
przebiegu nie wystąpiła. Zapisane, bo `tests/e2e/README.md` odnotowuje, że zestaw jedzie
`workers: 1` właśnie po to, żeby nie ukrywać wyścigów, a `retries` świadomie nie ma. Dwa
wystąpienia na kilkanaście przebiegów to za mało, żeby wskazać przyczynę — ale za dużo,
żeby przemilczeć.

## Co przegląd potwierdził jako poprawne

Szesnaście punktów sprawdzonych i czystych, w tym te najtrudniejsze do obronienia czytaniem:

- **Ponowne użycie `?1` w trzech `NOT EXISTS`** — poprawne, wykonane przeciw żywej bazie.
- **Grupowanie „pierwszy wiersz wygrywa"** — `slots` i `passes_exclusions` zależą wyłącznie
  od `d.id`, więc są identyczne na każdym wierszu dania; zmierzone: **zero dań** o niestałej
  wartości któregokolwiek z tych pól.
- **Danie bez składników** wchodzi do puli z zerowymi kaloriami i nie znika po cichu.
- **`distinct` w zapytaniu kroków** — poprawne i konieczne; klucz główny `dish_step` to
  `(dish_id, position)`, więc nie da się scalić dwóch różnych kroków.
- **Zgodność zaokrąglenia wyroczni testowej z `computeDishMacros`** — sprawdzona dla wszystkich
  58 dań: **zero rozbieżności**, a najbliższe danie jest 0,02 kcal od remisu przy połówce, czyli
  trzy rzędy wielkości od różnicy zmiennoprzecinkowej między dwiema drogami sumowania.
- **`savePlan` jako jeden `batch()`** — usunięcia dziecko→rodzic, wstawienia rodzic→dziecko,
  jedna transakcja D1; naruszenie klucza obcego wycofuje całość, współbieżne `POST`-y serializują
  się na granicy batcha (ostatni wygrywa z planem KOMPLETNYM, nigdy mieszanym).
- **Mapowanie kodów** 409 / 422 / 400 / 500 zgodne z planem co do punktu.
- **Interpolacja identyfikatora konta** w testach bezpieczna — `userIdOf` asertuje kształt
  i rzuca, zanim wartość dotrze do SQL-a.
- **Dyscyplina zakresu bez zastrzeżeń** — zero plików fazy 4, zero zmian w migracjach, zero
  zapisów do `exclusion`, `package-lock.json` nietknięty.
- **Zero regresji fazy 2** — `plan-generator.ts` i jego testy nie są w diffie, a naprawa F1
  z poprzedniej rundy jest nietknięta.

<!-- End of report -->
