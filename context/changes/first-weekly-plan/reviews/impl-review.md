<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: S-04 — Faza 2 (czysty moduł generatora)

- **Plan**: `context/changes/first-weekly-plan/plan.md`
- **Zakres**: Faza 2 z czterech. Faza 1 (schemat) scalona w PR #32; fazy 3–4 poza zakresem.
- **Data**: 2026-09-14
- **Werdykt pierwszej rundy**: **WYMAGA UWAGI** (0 krytycznych blokujących merge, 1 krytyczne
  blokujące fazę 3, 5 ostrzeżeń, 5 obserwacji)
- **Werdykt po poprawkach**: **APPROVED**

> **Ten przegląd został wykonany lokalnie, nie przez zadanie CI — i to jest istotne.** Zadanie
> `Przegląd implementacji` padło **dwukrotnie** na tym PR-ze (przebiegi `34875620697`, 2 min 31 s
> i 4 min 21 s), za każdym razem w tym samym miejscu: po wykryciu planu i policzeniu diffu,
> na etapie „parallel evidence gathering", bez zapisania raportu. Diff ma 1207 linii nowego kodu
> plus plan liczący ponad tysiąc linii. Bramka czyta PLIK, nie komentarz, więc bez raportu
> przepuściłaby PR bez żadnego przeglądu. Zamiast obchodzić bramkę etykietą, przegląd wykonał
> agent adwersaryjny uruchomiony lokalnie — z prawem do `npm test`, `tsc`, `check-conventions`
> i mutowania kopii modułu, czyli **z większymi możliwościami weryfikacji niż ma zadanie CI**.

## Werdykty wymiarów

| Wymiar | Runda 1 | Po poprawkach |
|---|---|---|
| Plan Adherence | WARNING | PASS |
| Scope Discipline | PASS | PASS |
| Correctness | WARNING | PASS |
| Pattern Consistency | PASS | PASS |
| Test Coverage | WARNING | PASS |

## Metoda

Bramki odtworzone niezależnie: `npm test` 130/130 (przed poprawkami), `npx tsc --noEmit` kod 0,
`npm run check-conventions` czysto, `npx expo lint` czysto. **Kryterium 2.15 potwierdzone
wykonaniem, nie odczytem.**

Ponad to: **28 mutacji punktowych** nałożonych na kopię modułu i przepuszczonych przez prawdziwy
zestaw testów, plus pięć sond zachowaniowych przeciw realnej puli 58 dań z `seed/`.
Wynik pierwszej rundy: **20 z 26 znaczących mutantów zabitych (~77%)**.

## Ustalenia

### F1 — KRYTYCZNE — pora uboższa niż potrzeby dnia omijała diagnozę i kończyła się złym powodem po 19 ms

`src/lib/plan-generator.ts` — krok 1 diagnozy oraz `sumTop`/`sumBottom`.

Krok 1 wykrywał `remaining < needed`, ale **zwracał porażkę tylko wtedy, gdy któryś
przeciwfaktyczny filtr przywracał dania**. Gdy żaden nie był winny — pula sama miała mniej dań
niż dzień potrzebuje — sterowanie leciało dalej. Komentarz w kodzie deklarował, że krok 2 to
przechwyci; **krok 2 tego nie robił**: `sumTop`/`sumBottom` po cichu sumują `min(count, length)`
elementów, więc brakujące posiłki liczyły się jako 0 kcal, granice zwykle nadal obejmowały okno
i sprawa spadała do przeszukiwania.

Odtworzone na sondzie (pula z **dwiema** przekąskami, sześć posiłków — dzień potrzebuje trzech
różnych):

```
czas: 19 ms
{"reason":"combination","targetKcal":2500,"lowerKcal":2250,"upperKcal":2750,
 "visitedNodes":39561,"mealsPerDay":6}
```

Trzy rzeczy złe naraz:

1. **Zły powód.** `combination` znaczy „granice obejmują okno, ale żadne złożenie nie trafia",
   a ekran radzi przy nim poluzować limit czasu albo wykluczenia. Tu **nie ma czego luzować** —
   pora ma dwa dania, a dzień potrzebuje trzech. Rada byłaby nieprawdziwa.
2. **Sprzeczny ładunek.** Przy porze CAŁKIEM pustej wychodziło `visitedNodes: 0` — „przestrzeń
   wyczerpana" bez ani jednego odwiedzonego węzła. Kryterium 2.12 asertuje `visitedNodes > 0`
   dla prawdziwego `combination`, więc kod potrafił wyemitować werdykt, który jego własne
   kryterium by odrzuciło.
3. **Koszt CPU.** 39 561 węzłów to **mniej** niż ówczesny budżet 200 000, więc budżet tego nie
   zatrzymywał. 19 ms w tej sondzie, a recenzent zmierzył 8,7 ms rozgrzane / 14,4 ms zimne na
   realnej puli. Limit Workera to 10 ms i jego przekroczenie **zabija wywołanie** — użytkownik
   dostałby 500 bez komunikatu zamiast obiecanego 422.

- **Decyzja**: PRZYJĘTE, naprawione. Krok 1 kończy działanie **za każdym razem**, gdy
  `remaining < needed`. Gdy żaden filtr nie jest winny, powodem jest `calories` — bo dźwignią
  jest liczba posiłków, nie filtry — z `achievableMinKcal` i `achievableMaxKcal` równymi **0**:
  skoro pełnego dnia nie da się złożyć, zbiór osiągalnych sum jest pusty, a zero zawsze leży
  poniżej dolnej granicy (`ProfileBounds.targetKcal.min` to 1000 kcal). Po poprawce ta sama sonda
  daje **1 ms** i `reason: 'calories'`. Dodane dwa testy: „pora NIEDOSTATECZNIE obsadzona liczy
  się od liczby posiłków, nie od zera" oraz „pora za uboga BEZ winy filtrów kończy się
  natychmiast, a nie przeszukiwaniem".

### F2 — OSTRZEŻENIE — budżet węzłów kupował ~12 ms, czyli więcej niż 10 ms, których miał bronić

`DefaultNodeBudget` wynosił 200 000, a komentarz nazywał tę wartość „zachowawczą". Pomiar
recenzenta przy ~0,06 µs na węzeł:

| budżet | powód | węzły | najlepszy z 5 |
|---:|---|---:|---:|
| 25 000 | `searchBudget` | 25 000 | 2,08 ms |
| 100 000 | `searchBudget` | 100 000 | 5,67 ms |
| **200 000** | `combination` | 139 728 | **8,74 ms** |

Pełny budżet 200 000 ekstrapoluje się do **~12 ms rozgrzanego V8 na maszynie deweloperskiej** —
zimny isolate `workerd` jest wolniejszy. Budżet nie mógł zapobiec awarii, dla której powstał.

- **Decyzja**: PRZYJĘTE, naprawione. `DefaultNodeBudget` obniżony do **100 000** (~5,7 ms
  w tym samym pomiarze), a komentarz przy stałej wymienia liczby zamiast słowa „zachowawcza".
  Ścieżka udana kosztuje 0,05–0,14 ms na realnej puli, więc sufit dotyka wyłącznie przypadków
  patologicznych. **Właściwa kalibracja na `workerd` nadal należy do G4** — to nie jest pomiar,
  którego ta faza miała dokonać, tylko poprawienie wartości startowej na stronę bezpieczną.

### F3 — OSTRZEŻENIE — kryterium 2.10 było odhaczone, a jego test nie uruchamiał relaksacji

Kryterium 2.10 żąda puli, w której trafienie istnieje **wyłącznie z powtórzeniem przekraczającym
`maxUses`**. Test miał jedno śniadanie, przy którym `baseMaxUses = ceil(7/1) = 7` — dokładnie
tyle, ile trzeba — więc `extra` nigdy nie opuszczało zera. Dowód recenzenta: mutacja
`maxRelaxation = PlanDays` → `= 0` zostawiała ten test **zielony**.

- **Decyzja**: PRZYJĘTE, naprawione. Nowy test: pula śniadań `{400, 50}` przy celu 1700 — limit
  bazowy to `ceil(7/2) = 4`, ale danie 50 kcal nie mieści się w żadnym złożeniu, więc plan wymaga
  **siedmiu** użyć dania 400 kcal. Asercja sprawdza `maxUsed === 7` **oraz** `maxUsed > 4`.
  Stary test zostaje pod zmienioną nazwą — pilnuje czego innego (że przy wystarczającym limicie
  bazowym relaksacja nie jest potrzebna). Zweryfikowane: mutacja `maxRelaxation = 0` czerwieni
  teraz zestaw.

### F4 — OSTRZEŻENIE — kierunek dolnego przycięcia nie był testowany

Zamiana `continue` → `break` w dolnym przycięciu zostawiała **wszystkie 30 testów zielone**,
a jest to realny błąd: w zakresie rosnącym cięższe danie dalej może dosięgnąć dolnej granicy,
której lżejsze nie dosięga, więc `break` wyrzuca poprawne gałęzie. Sonda recenzenta: pula
`{100, 900}` + 9×500 + 9×500 przy celu 1900 daje `ok: true` w oryginale i `combination`
po mutacji — czyli fałszywe „nie da się ułożyć planu" na puli, która plan ma.

- **Decyzja**: PRZYJĘTE, naprawione. Dodany test „dolne przycięcie pomija danie, ale NIE ucina
  reszty zakresu" z dokładnie tą pulą. Zweryfikowane: mutacja czerwieni go.

### F5 — OSTRZEŻENIE — wspólny limit użyć przenosił hojność między porami

`usesLeft` było kluczowane samym daniem i brało `Math.max` limitów z obu pór, więc danie siedzące
w porze obfitej wnosiło tamten hojny limit do pory ciasnej. **39 z 58 dań realnej puli ma więcej
niż jedną porę.** Sonda: danie w `['lunch','snack']` przy puli przekąsek liczącej 1 pozycję
(limit 14) lądowało **7 razy na 7 dni jako obiad**, w puli dwunastu obiadów, która żadnego
powtórzenia nie wymuszała — dokładnie to, co ma wychwycić ręczne kryterium 4.12.

- **Decyzja**: PRZYJĘTE, naprawione. Klucz limitu to teraz **para (danie, pora)** — funkcja
  `usageKey` — a `Math.max` zniknął: każda pora ma własny limit pochodny od rozmiaru TAMTEJ puli.
  Poprawka objęła trzy miejsca (odczyt w `findDay`, zasiew i dekrementacja w `generatePlan`);
  pierwsza próba zmieniła tylko odczyt i **zestaw to złapał** — dwa testy powtórzeń zaczerwieniły
  się, bo limit przestał być egzekwowany.

  **Uczciwa adnotacja o granicy dowodu**: dodany test asertuje własność, ale **nie łapie** mutacji
  `usageKey` → samo `id` (136/136 zielone). Powód leży w projekcie, nie w teście: limit jest
  **miękki**, więc przy ciasnej podaży relaksacja i tak podnosi go do tej samej wartości, a przy
  podaży obfitej limit nie wiąże, bo punkt startowy z ziarna rozprasza wybory. Różnica obu kluczy
  jest statystyczna, nie deterministyczna. Test, który by ją „łapał", musiałby zaglądać do wnętrza
  mapy zamiast patrzeć na plan — i byłby testem implementacji, nie zachowania. Zapisane
  w komentarzu testu, żeby nikt nie odczytał go jako mocniejszego dowodu, niż jest.

### F6 — OSTRZEŻENIE — rozstrzygacz remisu w diagnozie testowany tylko w jedną stronę

Zdjęcie `&& withoutExclusions >= withoutLimit` zostawiało **30/30 zielone**: jedyny test remisu
miał `withoutExclusions = 5 > withoutLimit = 1`, więc wykluczenia wygrywały tak czy owak.
Kierunek, w którym ma wygrać `prepTime`, nie miał testu. Recenzent sprawdził algebrę warunku
i potwierdził, że **kod jest poprawny** — to była luka w pokryciu, nie defekt.

- **Decyzja**: PRZYJĘTE, naprawione. Dodany test lustrzany (1 wykluczone, 5 ponad limitem →
  `prepTime`). Zweryfikowane: mutacja czerwieni go.

### F7 — OBSERWACJA — próg `needed` w kroku 1 nie był testowany

Mutacja `remaining >= needed` → `remaining >= 1` zostawiała **30/30 zielone**: każdy test
opróżniał porę do zera, gdzie oba progi się pokrywają. Przypadek wielokrotny (`needed = 3` dla
przekąsek przy sześciu posiłkach) — czyli cały powód istnienia `needed` — nie był asertowany.

- **Decyzja**: PRZYJĘTE, naprawione tym samym testem co F1 („pora NIEDOSTATECZNIE obsadzona…":
  dwie przekąski dostępne, sześć posiłków, `remaining = 2` przy `needed = 3`).
  Zweryfikowane: mutacja czerwieni teraz dwa testy.

### F8 — OBSERWACJA — dwa przeżywające mutanty w obsłudze ziarna i budżetu

`offsets[position]` → `offsets[0]` przeżywa 30/30 (przesunięcie **per pozycja** nie jest przypięte,
przypięte jest tylko „inne ziarno → inny plan"). Zerowanie `budget.visited` na starcie każdej
iteracji relaksacji też przeżywa 30/30.

- **Decyzja**: ODŁOŻONE ŚWIADOMIE, bez zmiany kodu. Oba są własnościami wewnętrznymi, nie
  zachowaniem widocznym dla użytkownika: plan pozostaje poprawny w obu wariantach, zmienia się
  wyłącznie rozrzut wyborów i moment zgłoszenia `searchBudget`. Kumulacja budżetu przez pętlę
  relaksacji jest **zamierzona** — to ona sprawia, że `searchBudget` jest zachowawcze zamiast
  kłamać `combination` — i jest opisana w kodzie. Test przypinający je musiałby zaglądać do
  wnętrza pętli. Właściwym momentem jest G4, gdy budżet dostanie zmierzoną wartość i będzie
  z czym porównywać.

### F9 — OBSERWACJA — zbiory przeciwfaktyczne liczone na ścieżce udanej

`bySlot()` biegło trzy razy bezwarunkowo, a dwa z tych wyników czytano **wyłącznie** w gałęzi
porażki kroku 1. Plan argumentuje dokładnie to samo o odczycie z bazy („zbiór do diagnozy
przeciwfaktycznej jest potrzebny tylko przy porażce"), a moduł unikał drugiego zapytania i płacił
potrojonym kosztem w pamięci.

- **Decyzja**: PRZYJĘTE, naprawione. Oba zbiory liczone dopiero w gałęzi `remaining < needed`,
  i to jako zwykłe zliczenie (`filter(...).length`) zamiast pełnego grupowania z sortowaniem.

### F10 — OBSERWACJA — `totalKcal` przeliczane po `find` z cichym zerem

`pools[meal.mealSlot].find(…)` było O(pula) na posiłek, a `dish !== undefined ? dish.kcal : 0`
oznaczało, że nietrafienie **po cichu zaniżyłoby dzień** — w module, którego całym zadaniem jest
nie kłamać o kaloriach.

- **Decyzja**: PRZYJĘTE, naprawione. Suma jest teraz **niesiona z przeszukiwania** — to ta sama
  wartość, na której sprawdzono okno — więc rozjazd jest niemożliwy z konstrukcji, a skanowanie
  i awaryjne zero zniknęły. Kryterium 2.1 nadal asertuje `totalKcal === wyrocznia`.

### F11 — OBSERWACJA — martwy strażnik

`const start = list.length > 0 ? offsets[position] % list.length : 0;` — kilka linii wyżej kod
zwraca już dla `list.length === 0`, więc ternarny mógł iść tylko jedną gałęzią.

- **Decyzja**: PRZYJĘTE, naprawione — ternarny usunięty.

## Poprawka wprowadzona przy okazji (nie z przeglądu)

Funkcja pomocnicza nazywała się początkowo `useKey` i **wywróciła `expo lint`** pięcioma błędami
`react-hooks/rules-of-hooks`: preset czyta nazwę zaczynającą się od `use` jako hook Reacta,
niezależnie od tego, że plik nie ma nic wspólnego z Reactem. Przemianowana na `usageKey`, powód
zapisany w komentarzu przy definicji, żeby nikt nie „poprawił" nazwy z powrotem.

## Stan po poprawkach

`npm test` **136/136** (było 130 — sześć nowych testów) · `npx tsc --noEmit` czysto ·
`npx expo lint` czysto · `npm run check-conventions` czysto (51 plików) ·
`package-lock.json` nietknięty.

Cztery z sześciu mutacji, które wcześniej przeżywały, są teraz zabijane — zweryfikowane
uruchomieniem każdej z osobna:

| mutacja | przed | po |
|---|---|---|
| `maxRelaxation = 0` | przeżywa | **2 czerwone** |
| dolne przycięcie jako `break` | przeżywa | **2 czerwone** |
| zdjęty rozstrzygacz remisu | przeżywa | **1 czerwony** |
| `remaining >= 1` zamiast `>= needed` | przeżywa | **2 czerwone** |
| `usageKey` bez pory | przeżywa | przeżywa (F5, powód zapisany) |
| `offsets[0]`, zerowanie budżetu | przeżywa | przeżywa (F8, odłożone) |

## Co przegląd potwierdził jako poprawne

Warto wymienić, bo adwersaryjny przegląd powinien raportować też negatywne wyniki poszukiwań:

- **Guardrail jest szczelny.** Nie udało się skonstruować ani wejścia, ani przeżywającej mutacji,
  która zwróciłaby plan łamiący ±10%, wykluczenia, limit czasu, zakaz powtórzenia w dniu albo
  oddający dzień niepełny.
- **Zaokrąglanie granic jest dokładne.** `Math.ceil(t·0,9)` / `Math.floor(t·1,1)` przeskanowane
  dla **każdego** całkowitego celu 1000–6000 wobec arytmetyki całkowitej: **zero rozbieżności**.
  Nigdzie w dopuszczalnym zakresie profilu okno nie jest zmiennoprzecinkowo zwężone ani poszerzone.
- **Indeksowanie przesunięć i podział na dwa zakresy są poprawne**, łącznie z przypadkami
  brzegowymi `start = 0` i `start = n−1` (drugi zakres pusty, każdy element odwiedzony raz).
- **Przycinanie jest sformułowane poprawnie**, także z `Number.POSITIVE_INFINITY` dla pustej
  listy: `minRest` jest dolnym ograniczeniem reszty, `maxRest` górnym, a mutacja każdego z nich
  na zły koniec listy zabija odpowiednio 2 i 8 testów.
- **`outOfBudget` rozwija rekurencję czysto** — sprawdzenie budżetu stoi przed `push`, każda
  ścieżka porażki zdejmuje przed propagacją, a poziom najwyższy zwraca `{ kind: 'budget' }` nie
  czytając `chosen`. Dzień częściowo wypełniony nie może wyciec do wyniku.
- **Obie bramki okna są nośne razem.** Usunięcie sprawdzenia końcowego **albo** górnego przycięcia
  z osobna zostawia zestaw zielony (co Dziennik i komentarz w kodzie uczciwie odnotowują),
  ale usunięcie **obu** zabija 3 testy, w tym wyrocznię 2.1 i przypadek na realnej puli.
- **Dyscyplina zakresu bez zastrzeżeń** — diff to dokładnie dwa pliki fazy 2 plus odhaczenie
  Postępu i wpis do Dziennika. Zero repozytorium, tras, ekranów, migracji i ruchu
  w `package-lock.json`. Nic z S-05, S-06 ani S-07 nie przeciekło.
- **Kryterium 2.6 jest prawdziwym testem, nie ozdobnym** — pula z daniami odrzuconymi o tych
  samych kaloriach i niższych `id`, żeby zepsuty odsiew sięgnął po nie **pierwsze**.

<!-- End of report -->
