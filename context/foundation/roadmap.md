---
project: "MealPlan"
version: 1
status: draft
created: 2026-08-31
updated: 2026-09-13
prd_version: 1
main_goal: speed
top_blocker: decisions
milestone_id: pierwszy-pelny-przeplyw
milestone_seq: 1
milestone_status: open
---

# Mapa drogowa: MealPlan

> Wywiedziona z `context/foundation/prd.md` (v1) + automatycznie zbadana baza kodu.
> Edytuj na miejscu; archiwizuj, gdy zostanie zastąpiona.
> Fragmenty są wymienione w kolejności zależności. Tabela „W skrócie" jest indeksem.

## Kamień milowy

**M-01: Pierwszy pełny przepływ** — Status: otwarty

- **Cel:** użytkownik przechodzi całą ścieżkę produktu w jednej sesji — zakłada konto, podaje
  profil, widzi wyliczone zapotrzebowanie, podaje preferencje, dostaje tygodniowy jadłospis
  w granicy ±10% bez pozycji z wykluczeń, a z zaznaczonych dni generuje listę zakupów.
- **Materiały źródłowe:** `context/foundation/prd.md` (v1)
- **Gotowe, gdy:** każdy F-NN i S-NN poniżej jest `done`.
- **Kotwice zakresu:** FR-001–FR-004, FR-006–FR-014, FR-016, US-01, US-02. Poza kamieniem
  milowym: FR-005 i FR-015 (nice-to-have, zaparkowane) oraz wszystko z sekcji Poza zakresem PRD.

## Podsumowanie wizji

Osoba pracująca wie, ile powinna zjeść, ale nie wie, *co* — i traci 1–2 h w niedzielę na
układanie jadłospisu w arkuszu, który i tak rozjeżdża się w ciągu tygodnia. Istniejące
aplikacje kaloryczne są dziennikami: użytkownik wpisuje, co zjadł, a one liczą wstecz. Ten
produkt działa odwrotnie — daje gotowy plan z góry, dopasowany do wyliczonego zapotrzebowania
i do wykluczeń, bez wpisywania czegokolwiek.

To jest **główna hipoteza** produktu — jedno założenie, którego obalenie unieważniłoby cały
pomysł: że plan ułożony z góry, mieszczący się w ±10% celu kalorycznego i niełamiący ani
jednego wykluczenia, jest na tyle użyteczny, że użytkownik zostawia go bez wymiany zamiast
wracać do zamawiania jedzenia. Druga rzecz, której istniejące narzędzia nie domykają: plan
i lista zakupów żyją osobno. Tutaj użytkownik zaznacza dowolne dni jadłospisu i dostaje jedną
zagregowaną listę z podziałem na kategorie sklepowe.

## Gwiazda przewodnia

**S-04: Użytkownik dostaje wygenerowany tygodniowy jadłospis z przepisami** — to jedyny fragment,
którego zadziałanie potwierdza główną hipotezę; cała reszta mapy drogowej ma sens tylko wtedy,
gdy ten działa.

> „Gwiazda przewodnia" znaczy tu: najmniejszy kompletny przepływ od końca do końca, którego
> pomyślne dostarczenie potwierdza główną hipotezę produktu — ustawiony tak wcześnie, jak
> pozwalają jego wymagania wstępne, bo wszystko inne ma znaczenie dopiero, gdy on działa.

Przy celu sekwencjonowania `speed` gwiazda przewodnia nie stoi na pierwszym miejscu wyłącznie
dlatego, że jej trzy wymagania wstępne — pula dań, cel kaloryczny, preferencje — są wejściami
generatora. Bez nich nie ma z czego ani pod co generować.

## W skrócie

| ID    | Change ID                    | Wynik (użytkownik może …)                                          | Wymagania wstępne  | Odnośniki PRD                     | Status   |
| ----- | ---------------------------- | ------------------------------------------------------------------ | ------------------ | --------------------------------- | -------- |
| F-01  | `dish-source-and-seed-pool`  | (fundament) pula dań z makrami, ilościami i krokami istnieje w bazie | —                  | FR-008, FR-009, FR-016            | implementing |
| S-01  | `account-and-login`          | założyć konto e-mail + hasło i zalogować się                         | —                  | FR-001, Access Control            | done     |
| S-02  | `profile-and-calorie-target` | podać profil i zobaczyć wyliczone dzienne zapotrzebowanie            | S-01               | FR-002, FR-003                    | done        |
| S-03  | `dietary-preferences`        | podać wykluczenia, maksymalny czas gotowania i liczbę posiłków       | S-01               | FR-004, FR-006, FR-007            | done     |
| S-04  | `first-weekly-plan`          | wygenerować tygodniowy jadłospis w ±10% i otworzyć przepis dania     | F-01, S-02, S-03   | US-01, FR-008, FR-009             | proposed |
| S-05  | `swap-and-reject-dish`       | wymienić danie w planie i oznaczyć je, żeby nie wracało              | S-04               | FR-010, FR-011                    | proposed |
| S-06  | `step-by-step-cooking`       | przejść instrukcję dania krok po kroku w trakcie gotowania           | F-01, S-04         | FR-016, NFR                       | proposed |
| S-07  | `shopping-list-from-days`    | zaznaczyć dni i dostać zagregowaną listę zakupów w kategoriach       | F-01, S-04         | US-02, FR-012, FR-013             | proposed |
| S-08  | `check-off-purchases`        | odhaczać kupione pozycje na liście zakupów                           | S-07               | US-02, FR-014                     | proposed |
| S-09  | `offline-plan-and-list`      | otworzyć wygenerowany plan i listę zakupów bez połączenia z siecią   | S-04, S-07         | FR-008, FR-012, NFR               | proposed |

## Strumienie

Pomoc nawigacyjna — grupuje elementy dzielące ten sam łańcuch wymagań wstępnych. Kanoniczna
kolejność jest w grafie zależności poniżej; ta tabela to proponowana kolejność czytania.

| Strumień | Temat                      | Łańcuch                           | Uwaga                                                                                    |
| -------- | -------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| A        | Konto i wejścia generatora | `S-01` → `S-02` → `S-03`          | Jedyny strumień z gotowym startem; przy celu `speed` to on odblokowuje wszystko pozostałe. |
| B        | Pula dań i generator planu | `F-01` → `S-04` → `S-05` → `S-06` | Łączy strumień A w `S-04`. Cały strumień stoi na Otwartym pytaniu 1.                       |
| C        | Lista zakupów              | `S-07` → `S-08`                   | Łączy strumień B w `S-04` (potrzebuje planu) i `F-01` (ilości składników, kategorie).      |
| D        | Dostępność bez sieci       | `S-09`                            | Domyka wymaganie offline po tym, jak plan (B) i lista (C) już istnieją.                    |

Strumienie A i B da się prowadzić równolegle w osobnych uruchomieniach agenta — nie mają
wspólnych wymagań wstępnych aż do `S-04`.

## Baza

Co jest już na miejscu w bazie kodu na dzień 2026-08-31 (zbadane automatycznie, potwierdzone
przez użytkownika). Fundamenty poniżej zakładają obecność tych elementów i NIE tworzą ich ponownie.

- **Frontend:** obecny — Expo SDK 57 / React Native 0.86 / React 19.2, Expo Router w
  `src/app/`, prymitywy `ThemedText` / `ThemedView`, motyw w `src/constants/theme.ts`,
  zakładki rozdwojone na `app-tabs.tsx` / `app-tabs.web.tsx`. Wyłącznie ekrany startera
  (`index.tsx`, `explore.tsx`) — zero powierzchni produktowej.
- **Backend / API:** częściowy — `worker.ts` oddaje żądania `expo-server/adapter/workerd`;
  jedyna trasa to `src/app/api/health+api.ts` (smoke test wdrożenia). Zero tras produktowych.
- **Dane:** częściowy — binding D1 `DB` → baza `mealplan` (`wrangler.jsonc`) jest podłączony
  i osiągalny z trasy API, a `src/server/env.ts` udostępnia go przez `getWorkerEnv()`. Zero
  schematu, zero migracji, zero warstwy repozytorium.
- **Uwierzytelnianie:** nieobecne — brak dostawcy, sesji, tokenów, ciasteczek i hashowania haseł
  w całym drzewie źródeł.
- **Wdrożenie / infrastruktura:** obecne — Cloudflare Workers, `wrangler.jsonc` z czterema
  regułami modułów i `assets.directory`, auto-deploy z `main` przez Workers Builds, zawężony
  token API, runbook i ścieżka rollbacku w `context/deployment/deploy-plan.md`.
- **Obserwowalność:** częściowa — `observability.enabled: true` w `wrangler.jsonc` (logi Workers,
  `head_sampling_rate: 1`) plus `wrangler tail`. Brak śledzenia błędów i metryk produktowych;
  PRD niczego więcej nie wymaga, więc mapa drogowa tego nie dokłada.

## Fundamenty

### F-01: Źródło dań z makrami — decyzja i minimalna pula

- **Wynik:** (fundament) źródło przepisów jest wybrane, a w bazie leży pula dań wystarczająca,
  by ułożyć jeden tydzień w granicy ±10% przy typowych wykluczeniach; każde danie ma składniki
  z ilościami i kategorią sklepową, makra oraz instrukcję rozbitą na kroki.
- **Change ID:** `dish-source-and-seed-pool`
- **Odnośniki PRD:** FR-008, FR-009, FR-016
- **Odblokowuje:** S-04 (generator nie ma z czego wybierać ani czym liczyć kalorii), S-06
  (tryb krok po kroku wymaga instrukcji rozbitej na kroki), S-07 (agregacja listy zakupów
  wymaga ilości składników i kategorii sklepowych). Domyka Otwarte pytania 1 i 2.
- **Wymagania wstępne:** —
- **Równolegle z:** S-01, S-02, S-03
- **Blokery:** —
- **Niewiadome:** — rozstrzygnięte 13.09.2026 (decyzja D14 w `notes/night-decisions.md`,
  konsekwencje w `context/changes/dish-source-and-seed-pool/options.md`).
  - ~~Skąd biorą się przepisy i makra?~~ **Hybryda:** model autoryzuje przepisy raz poza runtime,
    człowiek przegląda gramatury, makra liczy skrypt z USDA FoodData Central (CC0). Odrzucone:
    model na żądanie (makra niewiarygodne), zewnętrzne API przepisów (licencja zabrania
    przechowywania, co kłóci się z wymaganiem offline).
  - ~~Czy źródło daje instrukcję rozbitą na kroki?~~ **Tak — jesteśmy autorem.** Kroki powstają
    jako osobne rekordy z kolejnością (`dish_step`), nie jako blok tekstu.
- **Ryzyko:** to nie jest budowa całej warstwy danych, tylko minimalny kontrakt treści — pula ma
  być na tyle duża, żeby generator miał z czego wybierać, i ani trochę większa. Trzy rozważane
  źródła dają trzy zupełnie różne plany implementacyjne (zapytanie do własnej bazy kontra
  wywołanie modelu na żądanie), więc `/10x-plan` na S-04 przed tą decyzją byłby zmarnowany.
  Ryzyko wtórne: jeśli źródło nie daje kroków, FR-016 wymaga ręcznej obróbki każdego przepisu.
- **Status:** implementing — fazy 1 i 2 wykonane (schemat i walidacja), fazy 3 i 4 (pula dań)
  jeszcze nie. Status `planning` do 14.09.2026 był nieaktualny: opisywał stan sprzed fazy 1.

## Fragmenty

### S-01: Użytkownik zakłada konto i loguje się

- **Wynik:** użytkownik zakłada konto e-mail + hasło, loguje się i widzi ten sam stan na
  telefonie oraz w przeglądarce; niezalogowany nie dostaje żadnego widoku produktowego.
- **Change ID:** `account-and-login`
- **Odnośniki PRD:** FR-001, Access Control
- **Wymagania wstępne:** —
- **Równolegle z:** F-01
- **Blokery:** —
- **Niewiadome:** —
- **Ryzyko:** pierwsza zmiana, która dotyka D1 — wprowadza schemat, konwencję migracji
  (wyłącznie addytywne, migracja wstecz w tym samym commicie, bo `wrangler rollback` nie cofa
  schematu) i warstwę repozytorium przyjmującą `userId` jako pierwszy argument. D1 nie ma RLS,
  więc ta warstwa jest jedynym mechanizmem izolacji danych między kontami: guardrail PRD
  o prywatności profilu — twarde ograniczenie, którego złamanie jest błędem, a nie kompromisem —
  stoi na niej i na niczym innym. Te elementy techniczne wchodzą tutaj, a nie w osobnym
  fundamencie, bo dokładnie tu potrzebuje ich pierwszy widoczny dla użytkownika przepływ.
  **Tożsamość prowadzi Clerk** (decyzja z 1.09.2026 — `context/changes/account-and-login/change.md`),
  więc D1 nie przechowuje e-maili ani haseł, a `userId` przychodzi z podpisanego tokenu. Ubocznie
  znika wymóg planu Workers Paid dla tego fragmentu: był potrzebny wyłącznie pod hashowanie haseł.
- **Status:** done

### S-02: Użytkownik podaje profil i widzi wyliczone zapotrzebowanie

- **Wynik:** użytkownik podaje wiek, wagę, wzrost, płeć i poziom aktywności w skali 1–5, może
  je później edytować, i widzi wynikające z nich dzienne zapotrzebowanie kaloryczne wraz
  z wyjaśnieniem, skąd bierze się ta liczba.
- **Change ID:** `profile-and-calorie-target`
- **Odnośniki PRD:** FR-002, FR-003
- **Wymagania wstępne:** S-01
- **Równolegle z:** F-01, S-03
- **Blokery:** —
- **Niewiadome:**
  - Jak produkt uzasadnia wyliczone zapotrzebowanie i czy użytkownik może nadpisać cel ręcznie?
    Kierunek jest przesądzony w PRD (FR-003: pokazać, skąd wynik, i pozwolić nadpisać), do
    doprecyzowania zostaje forma. Właściciel: użytkownik. Blok: nie.
- **Ryzyko:** wynik tego fragmentu jest wejściem ograniczenia ±10% — błąd we wzorze przenosi się
  na każdy wygenerowany plan i pozostaje niewidoczny, dopóki ktoś nie policzy ręcznie. Dane
  profilu są jednocześnie najbardziej wrażliwe w produkcie, więc to pierwszy realny test
  warstwy izolacji wprowadzonej w S-01.
- **Status:** done

### S-03: Użytkownik podaje preferencje żywieniowe

- **Wynik:** użytkownik wskazuje potrawy i składniki, których nie chce jeść, maksymalny czas
  przygotowania posiłku oraz liczbę posiłków dziennie — i może to później zmienić.
- **Change ID:** `dietary-preferences`
- **Odnośniki PRD:** FR-004, FR-006, FR-007
- **Wymagania wstępne:** S-01
- **Równolegle z:** F-01, S-02
- **Blokery:** —
- **Niewiadome:** — rozstrzygnięte 13.09.2026 (decyzja D14, `notes/night-decisions.md`).
  - ~~Jak rozdzielone są wykluczenia składnikowe od daniowych?~~ **Jedna tabela `exclusion`
    z polem `kind`** (`ingredient` / `dish`); wykluczenie składnikowe wskazuje `ingredient_id`,
    nigdy tekst — dopasowanie po nazwie łamie guardrail przy „risotto z borowikami".
    Rozpisane w `context/changes/dish-source-and-seed-pool/options.md` §4.
- **Korekta zależności (13.09.2026):** wykluczenia składnikowe wskazują na tabelę `ingredient`
  z F-01, więc S-03 **nie jest już równoległe do F-01** — wymaga jego fazy 1 (schemat).
- **Ryzyko:** to tutaj powstaje jedna lista wykluczeń, którą później zasila także S-05
  (oznaczanie dań z planu) — PRD jest jednoznaczne, że to jeden mechanizm, nie dwa. Zły model
  danych na tym fragmencie wraca jako przeróbka w S-04 i S-05.
- **Status:** done — obie fazy wykonane, wszystkie kryteria planu zamknięte 14.09.2026,
  łącznie z izolacją dwóch kont (1.6) i weryfikacją natywną (2.9).

### S-04: Użytkownik dostaje wygenerowany tygodniowy jadłospis z przepisami

- **Wynik:** użytkownik prosi o jadłospis i widzi plan na siedem kolejnych dni, gdzie każdy
  dzień ma zadaną liczbę posiłków, suma kalorii dnia mieści się w ±10% celu, żaden posiłek nie
  zawiera pozycji z wykluczeń ani nie przekracza maksymalnego czasu przygotowania — a dla
  każdego dania może otworzyć przepis ze składnikami, instrukcją i makrami.
- **Change ID:** `first-weekly-plan`
- **Odnośniki PRD:** US-01, FR-008, FR-009
- **Wymagania wstępne:** F-01, S-02, S-03
- **Równolegle z:** —
- **Blokery:** —
- **Niewiadome:**
  - Jak zachowuje się produkt, gdy wykluczeń jest tyle, że planu nie da się ułożyć w ±10%?
    Kierunek jest w kryteriach akceptacji US-01 (jawny komunikat, żadnego planu częściowego),
    do doprecyzowania zostaje próg i treść. Właściciel: użytkownik. Blok: nie.
  - Czy przechodzimy na plan Cloudflare Workers Paid? Wdrożenie odnotowuje, że limit 10 ms CPU
    planu darmowego nie mówi nic o obciążeniu generatora i że plan płatny należy zakładać od
    pierwszego dnia pracy nad nim. Właściciel: użytkownik. Blok: nie.
- **Ryzyko:** trzy twarde ograniczenia naraz — ±10% kcal, zero wykluczeń, limit czasu
  przygotowania — muszą być spełnione jednocześnie, albo generator ma zwrócić błąd nazywający,
  którego z nich nie da się spełnić. To jedyne miejsce w produkcie, gdzie „prawie dobrze" jest
  błędem, a nie kompromisem. Drugie ryzyko jest środowiskowe: dobór dań pod trzy ograniczenia
  to najcięższa obliczeniowo rzecz w tym produkcie, a mieszkać ma w Workerze z limitem CPU.
- **Status:** proposed

### S-05: Użytkownik wymienia danie i trwale je odrzuca

- **Wynik:** użytkownik wymienia pojedyncze danie w jadłospisie na inne — z zachowaniem ±10%
  dla tego dnia i bez wprowadzania pozycji z wykluczeń — oraz może oznaczyć danie tak, żeby
  nie pojawiało się w przyszłych jadłospisach.
- **Change ID:** `swap-and-reject-dish`
- **Odnośniki PRD:** FR-010, FR-011
- **Wymagania wstępne:** S-04
- **Równolegle z:** S-06, S-07
- **Blokery:** —
- **Niewiadome:** —
- **Ryzyko:** podmiana przechodzi przez to samo ograniczenie co generowanie — łatwo zrobić
  ścieżkę, która omija sprawdzenie ±10%, bo „to tylko jedno danie". Oznaczanie dania musi
  zasilać tę samą listę wykluczeń co preferencje z S-03, nie drugą równoległą; rozejście się
  tych dwóch ścieżek to dokładnie ten błąd, przed którym PRD ostrzega przy FR-011.
- **Status:** proposed

### S-06: Użytkownik gotuje danie krok po kroku

- **Wynik:** użytkownik przechodzi instrukcję przygotowania dania krok po kroku w trakcie
  gotowania — obsługiwane telefonem trzymanym w jednej ręce, czytelne z odległości ramienia.
- **Change ID:** `step-by-step-cooking`
- **Odnośniki PRD:** FR-016, NFR
- **Wymagania wstępne:** F-01, S-04
- **Równolegle z:** S-05, S-07
- **Blokery:** —
- **Niewiadome:** —
- **Ryzyko:** wykonalność tego fragmentu jest w całości pochodną decyzji z F-01 — jeśli wybrane
  źródło zwraca instrukcję jednym blokiem tekstu, każdy przepis wymaga ręcznego rozbicia na
  kroki i fragment przestaje być mały. To jedyny ekran używany przy mokrych rękach, więc
  wymaganie o obsłudze jedną ręką obowiązuje tu ostrzej niż gdziekolwiek indziej.
- **Status:** proposed

### S-07: Użytkownik generuje listę zakupów z zaznaczonych dni

- **Wynik:** użytkownik zaznacza wybrane dni lub pojedyncze potrawy i dostaje jedną zagregowaną
  listę składników pogrupowaną w kategorie sklepowe, gdzie ten sam składnik z kilku dań jest
  jedną pozycją ze zsumowaną ilością.
- **Change ID:** `shopping-list-from-days`
- **Odnośniki PRD:** US-02, FR-012, FR-013
- **Wymagania wstępne:** F-01, S-04
- **Równolegle z:** S-05, S-06
- **Blokery:** —
- **Niewiadome:** —
- **Ryzyko:** sumowanie ilości wymaga jednostek, które da się dodać — „2 łyżki" i „30 g" tej
  samej rzeczy nie zsumują się bez normalizacji, a to zależy od kształtu danych z F-01.
  Ograniczenie z PRD jest twarde: brakujący składnik oznacza drugi kurs do sklepu, czyli
  dokładnie ten ból, który produkt miał usunąć.
- **Status:** proposed

### S-08: Użytkownik odhacza kupione pozycje

- **Wynik:** użytkownik odhacza pozycje na liście zakupów w trakcie robienia zakupów, a stan
  odhaczenia zostaje.
- **Change ID:** `check-off-purchases`
- **Odnośniki PRD:** US-02, FR-014
- **Wymagania wstępne:** S-07
- **Równolegle z:** S-05, S-06, S-09
- **Blokery:** —
- **Niewiadome:** —
- **Ryzyko:** używane w sklepie, jedną ręką, często przy słabym zasięgu — dlatego jest osobnym
  fragmentem od generowania listy, mimo że dotyka tego samego ekranu. Zapisywanie każdego
  odhaczenia przez sieć to najprostszy sposób, żeby ten ekran przestał działać dokładnie
  w momencie, w którym jest potrzebny; S-09 domyka to formalnie.
- **Status:** proposed

### S-09: Plan i lista zakupów działają bez sieci

- **Wynik:** raz wygenerowany jadłospis i raz wygenerowana lista zakupów otwierają się i są
  użyteczne bez połączenia z siecią.
- **Change ID:** `offline-plan-and-list`
- **Odnośniki PRD:** FR-008, FR-012, NFR
- **Wymagania wstępne:** S-04, S-07
- **Równolegle z:** S-05, S-06, S-08
- **Blokery:** —
- **Niewiadome:** —
- **Ryzyko:** jest na końcu świadomie — dokłada się do istniejących ekranów planu i listy,
  zamiast narzucać kształt przechowywania danych każdemu wcześniejszemu fragmentowi. Koszt tej
  kolejności: dotyka wielu ekranów naraz. Zysk: nie płacimy za offline w każdym fragmencie
  z osobna, zanim wiadomo, co realnie trzeba trzymać lokalnie.
- **Status:** proposed

## Przekazanie do backlogu

| Identyfikator | Change ID                    | Sugerowany tytuł                                          | Gotowe do `/10x-plan` | Uwagi                                                     |
| ------------- | ---------------------------- | --------------------------------------------------------- | --------------------- | --------------------------------------------------------- |
| F-01          | `dish-source-and-seed-pool`  | Wybór źródła przepisów i zseedowanie puli dań              | no                    | Czeka na Otwarte pytania 1 i 2 (decyzja użytkownika)      |
| S-01          | `account-and-login`          | Konto e-mail + hasło i granica danych użytkownika          | yes                   | Uruchom `/10x-plan account-and-login`                      |
| S-02          | `profile-and-calorie-target` | Profil użytkownika i wyliczone zapotrzebowanie             | no                    | Po ukończeniu S-01                                         |
| S-03          | `dietary-preferences`        | Preferencje: wykluczenia, czas gotowania, liczba posiłków  | —                     | **Zrobione** 14.09.2026; do zarchiwizowania                |
| S-04          | `first-weekly-plan`          | Generator tygodniowego jadłospisu z widokiem przepisu      | no                    | Po F-01, S-02 i S-03                                       |
| S-05          | `swap-and-reject-dish`       | Wymiana dania i trwałe odrzucenie                          | no                    | Po S-04                                                    |
| S-06          | `step-by-step-cooking`       | Tryb gotowania krok po kroku                               | no                    | Po F-01 i S-04; wykonalność zależy od Otwartego pytania 2  |
| S-07          | `shopping-list-from-days`    | Lista zakupów z zaznaczonych dni, w kategoriach            | no                    | Po F-01 i S-04                                             |
| S-08          | `check-off-purchases`        | Odhaczanie kupionych pozycji                               | no                    | Po S-07                                                    |
| S-09          | `offline-plan-and-list`      | Dostępność planu i listy zakupów bez sieci                 | no                    | Po S-04 i S-07                                             |

## Otwarte pytania dotyczące mapy drogowej

1. **Skąd biorą się przepisy i makra?** Rozważane opcje: generowanie przez model AI na żądanie,
   własna ręcznie zseedowana pula dań, publiczna baza składników (USDA / Open Food Facts) plus
   własne przepisy. Właściciel: użytkownik. Blokuje: F-01, a przez nie S-04, S-06 i S-07 —
   czyli strumienie B, C i D w całości.
2. **Czy wybrane źródło przepisów daje instrukcję rozbitą na kroki?** Warunek konieczny dla
   FR-016. Do rozstrzygnięcia razem z pytaniem 1. Właściciel: użytkownik. Blokuje: F-01, S-06.
3. **Jak rozdzielone są wykluczenia składnikowe od daniowych?** Bez tego rozdzielenia
   ograniczenie o wykluczeniach będzie łamane. Właściciel: użytkownik. Blokuje: S-03, a przez
   nie S-04 i S-05.
4. **Jak zachowuje się produkt, gdy wykluczeń jest tyle, że planu nie da się ułożyć w ±10%?**
   Kierunek zapisany w kryteriach akceptacji US-01; próg i treść komunikatu do doprecyzowania.
   Właściciel: użytkownik. Blokuje: nie blokuje planowania S-04.
5. **Jak produkt uzasadnia wyliczone zapotrzebowanie i czy użytkownik może nadpisać cel ręcznie?**
   Właściciel: użytkownik. Blokuje: nie blokuje planowania S-02.
6. **Czy przechodzimy na plan Cloudflare Workers Paid przed pracą nad generatorem?** Wdrożenie
   odnotowuje, że limit 10 ms CPU planu darmowego nie mówi nic o obciążeniu generatora.
   Właściciel: użytkownik. Blokuje: nie blokuje planowania S-04, ale blokuje jego wdrożenie.

## Zaparkowane

- **Własny algorytm żywieniowy i porady dietetyczne** — Poza zakresem PRD: produkt dobiera dania
  pod cel kaloryczny i ograniczenia użytkownika, nie doradza medycznie i nie uwzględnia chorób
  ani alergii klinicznych.
- **Dziennik jedzenia** — Poza zakresem PRD; produkt planuje z góry, a nie rozlicza wstecz. To
  jest ta różnica, która uzasadnia jego istnienie.
- **Śledzenie wagi i postępów w czasie** — Poza zakresem PRD: profil podaje się raz i edytuje
  ręcznie, bez historii pomiarów i automatycznego przeliczania celu.
- **Plan miesięczny** — Poza zakresem PRD; zakres skrócono do tygodnia (FR-008), dłuższy horyzont
  wraca dopiero, gdy tygodniowy plan działa i pula dań jest wystarczająco duża.
- **Preferencje pozytywne (co lubię, jaka kuchnia)** — FR-005 jest nice-to-have; v1 dobiera dania
  na podstawie wykluczeń, czasu gotowania i kalorii.
- **Eksport listy zakupów do zewnętrznej aplikacji z notatkami** — FR-015 jest nice-to-have;
  w v1 lista żyje w produkcie.
- **Binarka natywna przez EAS Build i publikacja w sklepie** — odłożone w `tech-stack.md`
  i `deploy-plan.md`; ten kamień milowy weryfikuje się na wdrożonym webie i w Expo Go.
- **Śledzenie błędów i metryki produktowe** — PRD nie stawia takiego wymagania, a cel
  sekwencjonowania to `speed`; logi Workers wystarczają na ten kamień milowy.

## Historia kamieni milowych

(Pusta — M-01 jest pierwszym kamieniem milowym.)

## Zrobione

- **S-01: użytkownik zakłada konto e-mail + hasło, loguje się i widzi ten sam stan na telefonie
  oraz w przeglądarce; niezalogowany nie dostaje żadnego widoku produktowego** — Zarchiwizowane
  2026-09-12 → `context/archive/2026-08-31-account-and-login/`. Lekcja: —.
- **S-02: użytkownik podaje wiek, wagę, wzrost, płeć i poziom aktywności w skali 1–5, może je
  później edytować, i widzi wynikające z nich dzienne zapotrzebowanie kaloryczne wraz
  z wyjaśnieniem, skąd bierze się ta liczba** — Zarchiwizowane 2026-09-13 →
  `context/archive/2026-09-12-profile-and-calorie-target/`. Lekcja: —.
