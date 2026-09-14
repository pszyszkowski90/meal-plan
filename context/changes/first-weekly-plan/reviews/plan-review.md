# Przegląd planu: first-weekly-plan (S-04)

- **Data**: 2026-09-14
- **Plan**: `context/changes/first-weekly-plan/plan.md` (wersja 1)
- **Tryb**: głęboki, z weryfikacją wobec bazy kodu
- **Werdykt pierwszej rundy**: **DO PRZEMYŚLENIA**
- **Werdykt po poprawkach**: **SOLIDNY** — wszystkie dziesięć ustaleń rozliczone w wersji 2

## Werdykty wymiarów

| Wymiar | Runda 1 | Po poprawkach | Ustalenia |
|---|---|---|---|
| Zgodność ze stanem końcowym | NIEZALICZONY | SOLIDNY | F1, F2, F3 |
| Oszczędna realizacja | OSTRZEŻENIE | SOLIDNY | F10b, F10c |
| Dopasowanie architektoniczne | OSTRZEŻENIE | SOLIDNY | F4, F8, F9 |
| Martwe punkty | NIEZALICZONY | SOLIDNY | F1, F4, F5, F10a |
| Kompletność planu | NIEZALICZONY | SOLIDNY | F3, F6, F7, F8 |

## Ugruntowanie

13/13 ścieżek i 6/6 symboli z planu potwierdzone w kodzie. Żadne ustalenie nie wynika z błędnej
referencji — wszystkie z arytmetyki albo z rzeczy, których w planie nie było.

Trzy ustalenia zweryfikowane niezależnie przed przyjęciem:

- **F6**: `context/archive/2026-09-13-dietary-preferences/plan.md:349,353,355` — `## Progress`,
  `### Phase 1:`, `#### Automated`. Plan S-03 ma polskie nagłówki treści i **angielskie** znaczniki
  sekcji postępu. Wersja 1 tego planu miała polskie wszystkie cztery.
- **F7**: `grep -rln "execSync|child_process|d1 execute" tests/e2e/` — **brak trafień**.
  Harness nie ma żadnej drogi do D1.
- **F8**: `src/lib/dish-validation.ts:29` — `MealSlot` mieszka tam, nie w `dish-macros.ts`.

## Ustalenia

### F1 — KRYTYCZNE — limit powtórzeń liczony od liczby dni czynił sześć posiłków niewykonalnymi

**Zakwestionowane**: „Limit: `maxUses = ceil(7 / liczba dań dostępnych w tej porze po odsiewie)`.
Adaptuje się sam i nie ma stałej do zgadnięcia."

Licznik był zły. Pora „snack" jest wybierana `7 × (mealsPerDay − 3)` razy, nie 7
(`scripts/check-pool-feasibility.mjs:214`). Pojemność reguły to `k × ceil(7/k)`:

| scenariusz | k | `ceil(7/k)` | pojemność | potrzeba przy 6 posiłkach (21) |
|---|---:|---:|---:|---|
| limit 30 min | 15 | 1 | 15 | ✗ |
| `gluten` wykluczony | 10 | 1 | 10 | ✗ |
| `orzechy` / pięć grup | 6 | 2 | 12 | ✗ |
| `nabial` wykluczony | 5 | 2 | 10 | ✗ |

**Przy sześciu posiłkach reguła nie przepuszczała żadnego zmierzonego scenariusza — łącznie
z pustym.** A sześć posiłków to jedyna liczba, przy której cel 3200 kcal jest osiągalny
(`seed/FEASIBILITY.md:60`), więc plan przeczył własnemu kryterium 2.5.

Drugi defekt: **niemonotoniczność**. Przy `k = 6` pojemność 12, przy `k = 7` spada do 7.
Większa pula dawała ostrzejsze ograniczenie.

**Decyzja: PRZYJĘTE.** Wersja 2: `maxUses(slot) = max(1, ceil(picks(slot) / |pool(slot)|))`
z `picks(slot) = PlanDays × (ile razy pora występuje w dniu)`, **plus relaksacja o 1 przy
wyczerpaniu przestrzeni**. To drugie jest ważniejsze od poprawki arytmetycznej: powtórzenia nie
są jednym z trzech ograniczeń twardych, więc rozmaitość nie może konkurować z guardrailem ±10%
i wygrywać. Kryteria 2.9 i 2.10 przepisane.

### F2 — KRYTYCZNE — dwa z czterech twardych ograniczeń bez kryterium na ścieżce sukcesu

**Zakwestionowane**: §Przegląd obiecuje „żaden posiłek nie zawiera pozycji z wykluczeń i żaden
nie przekracza limitu czasu", a w 41 kryteriach wersji 1 wykluczenia i limit czasu występowały
**wyłącznie** w scenariuszach porażki (2.3, 2.4).

Odsiew robi SQL, którego czysty moduł fazy 2 nie widzi, a faza 3 go nie testowała — więc
**literówka w warunku `NOT EXISTS` przeszłaby cały zestaw na zielono**. To wprost sprzeczne
z `notes/plan-queue.md:151-153` i jest to dokładnie tryb awarii z `lessons.md`: guardrail
sprawdzany tam, gdzie ma zawieść, nigdy tam, gdzie ma działać.

**Decyzja: PRZYJĘTE.** Wersja 2 dodaje 2.6 (moduł: przejście po wszystkich pozycjach planu,
który powstał), 3.6 (pięć wykluczeń grupowych → zero wykluczonych dań, **sprawdzone celowym
zepsuciem** `NOT EXISTS`) i 3.7 (`max_prep_minutes = 15`).

### F3 — KRYTYCZNE — przepis obiecany w stanie końcowym, bez ścieżki odczytu

**Zakwestionowane**: „dla każdego dania przepis (składniki, kroki, makra)" — a faza 3 deklarowała
trzy funkcje, z których żadna nie oddawała kroków ani makr. `GeneratorDish` niósł sam `kcal`,
mimo że FR-009 wymaga białka, węglowodanów i tłuszczu. `grep -rn "dish_step" src/` → **zero
trafień w całym repo**. Do tego `PlanDay` był używany w sygnaturze i nigdzie niezdefiniowany,
a kształt odpowiedzi `GET` podany tylko dla przypadku `null`.

**Decyzja: PRZYJĘTE.** Wersja 2 dodaje `getPlanWithRecipes`, pełny typ `PlanResponse`,
definicje `PlanMeal` / `PlanDay` oraz kryteria 3.11 i 4.4.

### F4 — KRYTYCZNE — ziarno i niezmiennik sortowania wykluczały się nawzajem

**Zakwestionowane**: „deterministyczny WZGLĘDEM ZIARNA […] nowy plan przy każdym wywołaniu"
obok „`break` jest poprawny **wyłącznie** dlatego, że lista jest posortowana rosnąco".

DFS po listach posortowanych, zatrzymujący się na pierwszym trafieniu, jest deterministyczny
z konstrukcji. Ziarno mogło cokolwiek zmienić tylko przez przestawienie kolejności — co
unieważnia `break`, czyli **jedyną odpowiedź planu na limit CPU**. Plan nie mówił, którą stroną
tego kompromisu idzie.

Kryterium 2.9 miało tę samą wadę w gorszej postaci: klauzula „przy puli na tyle dużej, że różny
jest możliwy" jest ucieczką, która czyni je niefalsyfikowalnym — generator **ignorujący ziarno**
zaliczał je w całości.

**Decyzja: PRZYJĘTE.** Wersja 2, rozstrzygnięcie 2: sortowanie zostaje, a **ziarno wyznacza punkt
startowy z zawinięciem** — `j … n−1, 0 … j−1` to dwa ciągi rosnące, więc przycinanie działa
w każdym osobno, kosztem stałego czynnika 2. Kryterium 2.11 przepisane bez klauzuli ucieczki.

### F5 — KRYTYCZNE — dziura w drabinie diagnozy i niepoliczalne `withoutLimit`

**Zakwestionowane**: `PlanFailure` miał cztery warianty i brakowało piątego — przypadku,
w którym żadna pora nie jest pusta, granice obejmują okno, przeszukiwanie **wyczerpuje całą
przestrzeń** i nic nie znajduje, a budżet nie został tknięty.

Kontrprzykład recenzenta: trzy pory po {200, 800}, cel 1500 → okno [1350, 1650], sumy
600/1200/1800/2400. Obie dostępne odpowiedzi kłamały: `calories` z zakresem **zawierającym** cel,
albo `searchBudget`, o którym plan sam pisze, że nie wolno wtedy twierdzić „nie da się".

Druga część, mechaniczna: `withoutLimit` było nieobliczalne. `listAllowedDishes` stosuje limit
czasu i wykluczenia **w jednym zapytaniu** (`preferences.ts:213-218`), więc z pary
`allowed` + `unfiltered` nie da się odtworzyć zbioru „wykluczenia tak, limit nie".

**Decyzja: PRZYJĘTE w całości.** Wersja 2 dodaje piąte ramię `combination` (przestrzeń wyczerpana
— twierdzenie „nie da się" uprawnione, ale rada inna niż przy `calories`) oraz zamienia dwa
zbiory na **jedno** zapytanie zwracające pełną pulę z flagą `passesExclusions`. To samo naprawia
F10b. Kryterium 2.12 przypina kontrprzykład recenzenta wprost.

### F6 — KRYTYCZNE — sekcja postępu w niekanonicznym formacie

**Zakwestionowane**: wersja 1 miała `## Postęp`, `### Faza N:`, `#### Automatyczne`, `#### Ręczne`
— **wszystkie cztery znaczniki inaczej**, niż wymaga kontrakt. `/10x-implement` by tego nie
sparsował.

Potwierdzone niezależnie: cztery zarchiwizowane plany trzymają markery angielskie, łącznie
z S-03, który ma polskie nagłówki treści.

**Decyzja: PRZYJĘTE.** Znaczniki angielskie, treść pozycji po polsku, jak w S-03.

### F7 — OSTRZEŻENIE — faza 3 bez plików testowych i z kryteriami bez zdolności

**Zakwestionowane**: faza 3 miała dziesięć kryteriów automatycznych i **zero** nazwanych plików
testowych, a cztery z nich (3.4, 3.5, 3.7, 3.8 wersji 1) wymagały odczytu D1 — zdolności, której
harness nie ma. Kryterium 3.5 jawnie **zakazywało** obejścia przez odpowiedź trasy.

Ta sama klasa problemu: 2.5 żądało „realnej puli", a 2.12 zakazywało importów.

**Decyzja: PRZYJĘTE.** Wersja 2 dodaje do fazy 3 §3 pliki `tests/e2e/plan-api.spec.ts` oraz
`tests/e2e/support/d1.ts` (tylko do odczytu, wzorzec parsowania z
`check-pool-feasibility.mjs:96-127`, z regułą „zapytanie jedną linią"). Zakres zakazu importów
doprecyzowany: dotyczy **modułu**, nie testu, a 2.5 wczytuje `seed/` przez `node:fs`.

### F8 — OSTRZEŻENIE — kryterium o importach odwrócone

**Zakwestionowane**: „Moduł nie importuje niczego poza `./dish-macros.ts`". Dwa fakty z kodu:
`MealSlot` jest w `dish-validation.ts:29`, a moduł **nie potrzebuje** `dish-macros.ts`, bo
`GeneratorDish` niesie już policzone `kcal`. Kryterium zakazywało importu potrzebnego
i dopuszczało niepotrzebny. Do tego `nodeBudget` nie występował w `GeneratorInput`, mimo że
kryterium 2.10 wymagało ustawienia go z testu.

**Decyzja: PRZYJĘTE.** 2.16 przepisane, `nodeBudget?` dodane do `GeneratorInput`,
a zakres niezależności wyroczni (suma dnia i dobór, nie arytmetyka dania) dopisany do 2.17.

### F9 — OSTRZEŻENIE — uzasadnienie klucza naturalnego nietrafione; ekran bez reguły celu

**Zakwestionowane**: „Powód jest **mechaniczny**: `batch()` zwraca `unknown[]`, więc wielowierszowy
insert nie odda identyfikatora." Przy `user_id TEXT PRIMARY KEY` **nie ma żadnego generowanego
identyfikatora do odczytania** — typowanie `batch()` nie ma tu nic do rzeczy. Ryzyko realne:
po G4, które doda `meta`, ktoś uzna przesłankę za nieaktualną i „naprawi" schemat.

Druga część: decyzja o `target_kcal` zatrzymywała się w pół kroku — plan nie mówił, **który** cel
pokazuje ekran, a kryterium 4.2 nigdy nie porównywało sumy z oknem, więc generator produkujący
dni po 4000 kcal przy celu 2000 je zaliczał.

**Decyzja: PRZYJĘTE.** Uzasadnienie przepisane na „jeden plan na konto + atomowy `batch()` bez
rundy `RETURNING`", z adnotacją o odrzuconej przesłance. Dodane rozstrzygnięcie 4 (ekran pokazuje
`plan.targetKcal` i mówi o nieaktualności) oraz kryterium 4.3.

### F10 — OSTRZEŻENIE — trzy rzeczy pomniejsze, każda przyjęta

**(a) Granica liczona wbrew własnemu niezmiennikowi.** „Suma maksimów pór" przy sześciu posiłkach
potraja **tę samą** przekąskę, choć niezmiennik zakazuje powtórzenia w dniu — bound permisywny,
a sprawa spada do przeszukiwania i ląduje w dziurze z F5. → `top-k` / `bottom-k` **różnych** dań,
kryterium 2.14.

**(b) Drugie zapytanie na ścieżce sukcesu.** `listUnfilteredDishes()` jako pole `GeneratorInput`
ciągnęłoby pulę dwa razy na **każdym** żądaniu, w jedynym miejscu, gdzie limit CPU grozi.
→ jedno zapytanie z flagą, kryterium 3.13 i punkt 4 w §Uwagi o wydajności.

**(c) Ziarno tylko do zapisu.** Przycisk generowania istniał wyłącznie w stanie `missing`, więc
obie obiecane korzyści ziarna były niezrealizowane. → „Wygeneruj ponownie" w stanie `ready`
z potwierdzeniem, `seed` w odpowiedzi `GET`, kryterium 4.6.

## Co przegląd potwierdził jako dobre

Granice zakresu pilnowane wzorowo — S-05, S-06 i S-07 nie przeciekają do żadnej z czterech faz.
Decyzja o czystym module w `src/lib/` zgodna z trzema precedensami w repo. Trzy kryteria napisane
dokładnie tak, jak każe `lessons.md`: **1.3** (oba końce zakresu i tuż za nie), **2.4** (ten sam
zestaw z wyższym limitem daje `ok: true`, więc test nie dowodzi tylko, że filtr filtruje)
i **3.8** (izolacja sprawdzona celowym zepsuciem).
