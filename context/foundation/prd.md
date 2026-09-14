---
project: "MealPlan"
version: 1
status: draft
created: 2026-08-28
context_type: greenfield
product_type: mobile
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 4
  hard_deadline: null
  after_hours_only: true
---

# MealPlan — Product Requirements Document

## Vision & Problem Statement

Osoba pracująca, która chce jadać lepiej, odbija się o cztery osobne tarcia w ciągu jednego
tygodnia. Codziennie ok. 17:00 wie, ile powinna zjeść, ale nie chce jej się myśleć, *co* —
kończy się zamówieniem jedzenia albo tym samym daniem trzeci raz w tygodniu. W niedzielę
wieczorem próbuje ułożyć jadłospis pod kalorie: liczy makra w arkuszu i dopasowuje dania, co
zajmuje 1–2 h i tak się rozjeżdża w ciągu tygodnia. Przed wyjściem do sklepu przepisuje
składniki z przepisów leżących w różnych miejscach, zapomina połowy i wraca do sklepu drugi
raz. A gdy sięga po gotowe diety i gotowe aplikacje, dostaje plan pełen rzeczy, których nie
lubi albo nie ma czasu gotować, więc rezygnuje po tygodniu.

Istniejące aplikacje do kalorii są **dziennikami**: użytkownik wpisuje, co zjadł, a one liczą
*wstecz*. Ten produkt działa odwrotnie — daje gotowy plan **z góry**, dopasowany do wyliczonego
zapotrzebowania i do wykluczeń, bez wpisywania czegokolwiek. Druga rzecz, której istniejące
narzędzia nie domykają: plan i lista zakupów żyją osobno. Tutaj użytkownik zaznacza dowolne dni
z jadłospisu i dostaje jedną zagregowaną listę zakupów z podziałem na kategorie sklepowe.

## User & Persona

**Główna persona:** osoba pracująca, która chce jadać lepiej bez dietetyka.

Dorosły, zna swój cel (schudnąć / utrzymać wagę / przytyć), nie chce płacić kilkuset złotych za
plan od dietetyka i nie chce liczyć makr ręcznie. Sięga po produkt w dwóch momentach: raz przy
planowaniu — niedziela wieczór — i codziennie przy pytaniu „co dziś ugotować".

## Success Criteria

### Primary

- Użytkownik przechodzi cały pierwszy przepływ od początku do końca w jednej sesji: zakłada
  konto → podaje wiek, wagę, wzrost, płeć i poziom aktywności → dostaje wyliczone
  zapotrzebowanie kaloryczne → podaje preferencje (wykluczenia, czas gotowania, liczba posiłków
  dziennie) → dostaje wygenerowany tygodniowy jadłospis z przepisami → zaznacza wybrane dni
  i dostaje listę zakupów z podziałem na kategorie.

### Secondary

- Większość zaproponowanych dań zostaje w planie bez wymiany. Wysoki odsetek podmian oznacza,
  że dobór dań pod preferencje działa słabo.

### Guardrails

- Żaden dzień planu nie zawiera dania z listy wykluczeń użytkownika. Jedno takie danie niszczy
  zaufanie do całego planu.
- Suma kalorii dnia mieści się w ±10% od wyliczonego celu. Rozjazd tutaj unieważnia całą
  obietnicę produktu.
- Dane profilu (waga, wiek, płeć) nie są dostępne dla nikogo poza właścicielem konta.
- Lista zakupów pokrywa wszystkie składniki zaznaczonych dań. Brakujący składnik oznacza drugi
  kurs do sklepu, czyli dokładnie ten ból, który produkt miał usunąć.

## User Stories

### US-01: Użytkownik dostaje pierwszy tygodniowy jadłospis dopasowany do siebie

- **Given** zalogowany użytkownik z uzupełnionym profilem (wiek, waga, wzrost, płeć, poziom
  aktywności) oraz preferencjami (wykluczenia, maksymalny czas przygotowania, liczba posiłków
  dziennie)
- **When** poprosi o wygenerowanie jadłospisu
- **Then** widzi plan na siedem kolejnych dni, w którym każdy dzień ma zadaną liczbę posiłków,
  a suma kalorii dnia mieści się w ±10% od wyliczonego celu

#### Acceptance Criteria
- Żaden posiłek w całym tygodniu nie zawiera pozycji z listy wykluczeń użytkownika
- Żaden posiłek nie przekracza zadeklarowanego maksymalnego czasu przygotowania
- Każde danie ma dostępny przepis: składniki, instrukcję i makra
- Gdy wykluczeń jest tyle, że planu nie da się ułożyć w granicy ±10%, użytkownik dostaje jawny
  komunikat o tym, zamiast planu łamiącego wykluczenia lub cel kaloryczny

### US-02: Użytkownik generuje listę zakupów na najbliższe dni

- **Given** użytkownik z wygenerowanym jadłospisem
- **When** zaznaczy wybrane dni lub pojedyncze potrawy i poprosi o listę zakupów
- **Then** widzi jedną zagregowaną listę składników pogrupowaną w kategorie sklepowe

#### Acceptance Criteria
- Lista pokrywa wszystkie składniki wszystkich zaznaczonych dań
- Ten sam składnik występujący w kilku daniach pojawia się jako jedna pozycja ze zsumowaną
  ilością
- Użytkownik może odhaczać kupione pozycje

## Functional Requirements

### Konto i profil

- FR-001: Użytkownik może założyć konto (e-mail + hasło) i zalogować się. Priority: must-have
  > Socratic: Brak kontrargumentu; konto od pierwszego ekranu, potrzebne do synchronizacji
  > między telefonem a przeglądarką.
- FR-002: Użytkownik może podać i później edytować swój profil: wiek, waga, wzrost, płeć, poziom aktywności w skali 1-5. Priority: must-have
  > Socratic: Brak kontrargumentu; to są dokładnie te dane, które użytkownik wskazał jako
  > wejście do wyliczenia zapotrzebowania.
- FR-003: Użytkownik może zobaczyć wyliczone dzienne zapotrzebowanie kaloryczne wynikające z jego profilu. Priority: must-have
  > Socratic: Rozważono kontrargument: "sama liczba bez wyjaśnienia budzi nieufność — jeśli
  > użytkownik nie ufa liczbie, nie zaufa też planowi." Rozwiązanie: zachowano; produkt musi
  > pokazać, skąd bierze się wynik, i pozwolić ręcznie nadpisać cel.

### Preferencje żywieniowe

- FR-004: Użytkownik może wskazać potrawy i składniki, których nie chce jeść (wykluczenia). Priority: must-have
  > Socratic: Rozważono kontrargument: "wykluczenia składnikowe i daniowe to dwa różne poziomy
  > — mylenie ich sprawi, że guardrail o wykluczeniach będzie łamany." Rozwiązanie: zachowano;
  > oba poziomy muszą być rozdzielone jawnie.
- FR-005: Użytkownik może wskazać, jakie potrawy lubi i jaka kuchnia mu smakuje. Priority: nice-to-have
  > Socratic: Rozważono kontrargument: "lubienie jest słabsze niż wykluczanie — skoro FR-004
  > usuwa to, czego użytkownik nie chce, lista ulubionych dodaje mało." Rozwiązanie: obniżono
  > do nice-to-have. W v1 dobór dań opiera się na wykluczeniach, czasie gotowania i kaloriach.
- FR-006: Użytkownik może określić, ile czasu chce poświęcać na przygotowanie posiłku. Priority: must-have
  > Socratic: Brak kontrargumentu; czas przygotowania to jedno z wejść preferencji wskazanych
  > wprost przez użytkownika.
- FR-007: Użytkownik może określić liczbę posiłków dziennie, na jaką dzieli zapotrzebowanie. Priority: must-have
  > Socratic: Brak kontrargumentu; liczba posiłków to wejście, które użytkownik nazwał istotnym
  > dla podziału zapotrzebowania.

### Jadłospis

- FR-008: Użytkownik może wygenerować jadłospis na tydzień w przód, dopasowany do zapotrzebowania kalorycznego i preferencji. Priority: must-have
  > Socratic: Rozważono kontrargument: "zakupy robi się na 2-3 dni, więc horyzont miesięczny nie
  > służy żadnemu realnemu momentowi użycia; przy małej puli dań miesiąc oznacza też
  > powtarzalność." Rozwiązanie: zakres skrócony z miesiąca do jednego tygodnia. Plan miesięczny
  > wraca jako kandydat po v1.
- FR-009: Użytkownik może zobaczyć dla każdego dania przepis: składniki, instrukcję przygotowania i makra (białko, węglowodany, tłuszcz). Priority: must-have
  > Socratic: Brak kontrargumentu; pełny przepis z makrami dla każdego dania zostaje bez zmian.
- FR-016: Użytkownik może przejść przez instrukcję przygotowania dania krok po kroku w trakcie gotowania. Priority: must-have
  > Socratic: Rozważono kontrargument: "wymaga przepisów rozbitych na kroki — jeśli źródło daje
  > instrukcję jako jeden blok tekstu, trybu krok-po-kroku nie da się zrobić bez ręcznej
  > obróbki." Rozwiązanie: zachowano; kontrargument zaostrza wymaganie wobec źródła przepisów
  > i jest odnotowany w Open Questions jako warunek jego wyboru.
- FR-010: Użytkownik może wymienić pojedyncze danie w jadłospisie na inne. Priority: must-have
  > Socratic: Brak kontrargumentu; dostosowanie planu pod siebie to część wartości opisanej
  > przez użytkownika.
- FR-011: Użytkownik może oznaczyć danie tak, żeby nie pojawiało się w przyszłych jadłospisach. Priority: must-have
  > Socratic: Rozważono kontrargument: "to to samo co FR-004 — dwie ścieżki budujące tę samą
  > listę wykluczeń." Rozwiązanie: zachowano jako możliwość użytkownika, ale wykluczenia
  > z preferencji i oznaczenia z planu zasilają JEDNĄ listę wykluczeń, nie dwa osobne
  > mechanizmy.

### Lista zakupów

- FR-012: Użytkownik może zaznaczyć wybrane dni lub potrawy i wygenerować z nich listę zakupów. Priority: must-have
  > Socratic: Brak kontrargumentu; zaznaczanie dni i generowanie z nich listy użytkownik wskazał
  > wprost jako istotną część produktu.
- FR-013: Użytkownik może zobaczyć listę zakupów pogrupowaną w kategorie sklepowe (warzywa, mięso, nabiał i dalsze). Priority: must-have
  > Socratic: Brak kontrargumentu; podział na kategorie zostaje bez zmian.
- FR-014: Użytkownik może odhaczać kupione pozycje na liście zakupów. Priority: must-have
  > Socratic: Brak kontrargumentu; odhaczanie pozycji zostaje w MVP jako must-have.
- FR-015: Użytkownik może wyeksportować listę zakupów do zewnętrznej aplikacji z notatkami. Priority: nice-to-have
  > Socratic: Brak kontrargumentu; użytkownik sam nazwał to „nice to have" — zostaje poza
  > obowiązkowym zakresem MVP.

## Non-Functional Requirements

- Produkt jest użyteczny na telefonie trzymanym w jednej ręce, także w kuchni — przy mokrych
  rękach i przy patrzeniu na ekran z odległości ramienia.
- Raz wygenerowany plan i raz wygenerowana lista zakupów pozostają dostępne bez połączenia
  z siecią.

## Business Logic

Aplikacja układa tydzień posiłków tak, żeby każdy dzień trafiał w cel kaloryczny ±10%, nie
łamiąc żadnego wykluczenia ani limitu czasu gotowania.

Reguła konsumuje to, co użytkownik podaje o sobie i o swoich preferencjach: wiek, wagę, wzrost,
płeć i poziom aktywności — z których wynika dzienny cel kaloryczny — listę wykluczeń, maksymalny
czas, jaki chce poświęcić na przygotowanie posiłku, oraz liczbę posiłków, na jaką dzieli dzień.

Wynikiem jest konkretny zestaw dań przypisanych do dni i pór posiłku: nie ranking i nie
sugestia, tylko gotowy plan, który da się ugotować. Użytkownik napotyka regułę raz, w momencie
generowania planu, a potem ponownie za każdym razem, gdy wymienia pojedyncze danie — podmiana
również musi utrzymać dzień w granicy ±10% i nie może wprowadzić pozycji z listy wykluczeń.

Wykluczenia i cel kaloryczny są twardymi ograniczeniami, a nie preferencjami do zważenia:
złamanie któregokolwiek jest błędem, nie kompromisem.

## Access Control

Logowanie e-mail + hasło. Użytkownik zakłada konto na start; profil, jadłospis i listy zakupów
są związane z kontem, dzięki czemu ten sam stan jest dostępny na telefonie i w przeglądarce.

Model ról jest **płaski** — jeden typ użytkownika, brak ról administracyjnych. Każdy użytkownik
widzi wyłącznie własne dane; obowiązuje pełna izolacja danych między kontami. Niezalogowany
użytkownik nie ma dostępu do żadnego widoku produktowego poza rejestracją i logowaniem.

## Non-Goals

- **Nie budujemy własnego algorytmu żywieniowego ani rekomendacji dietetycznych.** Produkt
  dobiera dania pod cel kaloryczny i pod ograniczenia użytkownika; nie doradza medycznie, nie
  uwzględnia chorób, alergii klinicznych ani diet leczniczych.
- **Brak dziennika jedzenia.** Użytkownik nie wpisuje, co faktycznie zjadł. Produkt planuje
  z góry, a nie rozlicza wstecz — to jest wprost ta różnica, która uzasadnia jego istnienie.
- **Brak śledzenia wagi i postępów w czasie.** Profil podaje się raz i edytuje ręcznie; nie ma
  historii pomiarów, wykresów ani automatycznego przeliczania celu po zmianie wagi.
- **Plan miesięczny poza MVP.** Zakres skrócono do jednego tygodnia (FR-008); dłuższy horyzont
  wraca do rozważenia dopiero, gdy tygodniowy plan działa i pula dań jest wystarczająco duża.
- **Preferencje pozytywne poza obowiązkowym zakresem MVP.** FR-005 jest nice-to-have — v1
  dobiera dania na podstawie wykluczeń, czasu gotowania i kalorii, a nie listy ulubionych.
- **Eksport listy zakupów na zewnątrz poza obowiązkowym zakresem MVP.** FR-015 jest
  nice-to-have; w v1 lista żyje w produkcie.

## Open Questions

Stan na 14.09.2026. Numeracja 1–5 jest zachowana, bo odwołują się do niej `CLAUDE.md`,
`roadmap.md` i zarchiwizowane zmiany — pytanie rozstrzygnięte zostaje na swoim numerze
z odpowiedzią, nie znika z listy.

**Cztery z pięciu są zamknięte.** Otwarta jest jedna rzecz i jest nią treść komunikatu
z pytania 3, nie kierunek produktu.

1. ~~**Skąd biorą się przepisy i makra?**~~ — **Rozstrzygnięte 13.09.2026** (decyzja D14,
   `notes/night-decisions.md`). Hybryda: model językowy autoryzuje przepisy **raz, poza
   runtime** (polskie nazwy, gramatury, kroki, czas), człowiek przegląda ilości, makra liczy
   deterministycznie skrypt z tabeli **USDA FoodData Central** (CC0), a Worker w runtime czyta
   **wyłącznie D1** — nigdy nie woła modelu. Odrzucone: model na żądanie (makra z błędem energii
   rzędu 36%, więc guardrail sprawdzałby liczbę, która sama jest błędna) i zewnętrzne API
   przepisów (licencja zakazuje przechowywania, co wyklucza wymaganie offline). Pełne rozpisanie
   z konsekwencjami: `context/archive/2026-09-08-dish-source-and-seed-pool/options.md` §2.
   **Wdrożone:** pula stoi na produkcji — 58 dań, 51 składników, każdy z `usda_fdc_id`.
   Nie blokuje niczego.
2. ~~**Czy wybrane źródło przepisów daje instrukcję rozbitą na kroki?**~~ — **Rozstrzygnięte
   13.09.2026** razem z pytaniem 1. **Tak, bo jesteśmy autorem przepisów**: kroki powstają jako
   osobne rekordy z kolejnością (tabela `dish_step`), nie jako blok tekstu. To zdejmuje warunek
   z FR-016. Nie blokuje niczego.
3. **Jak zachowuje się produkt, gdy wykluczeń jest tyle, że planu nie da się ułożyć w ±10%?** —
   **kierunek rozstrzygnięty, treść otwarta.** `CLAUDE.md` przesądza kształt jako ograniczenie
   twarde: zwróć **błąd nazywający, którego z trzech ograniczeń** (kalorie, wykluczenia, czas)
   nie da się spełnić, i **nie zwracaj planu ani planu częściowego**. Otwarte zostaje słownictwo
   komunikatów i próg, przy którym generator uznaje dobór za niewykonalny — a progu **nie da się
   zgadnąć, trzeba go zmierzyć na realnej puli**, co jest możliwe dopiero przy S-04
   (`first-weekly-plan`). Szkic trzech komunikatów: `context/archive/2026-09-08-dish-source-and-seed-pool/options.md` §5.
   **Właściciel: agent** (upoważnienie w `notes/plan-queue.md` §4 — string jest rzeczą
   odwracalną, kształt już zapadł). **Blokuje: nic** — S-04 domyka to po drodze, a nie czeka
   na to.
4. ~~**Jak rozdzielone są wykluczenia składnikowe od daniowych?**~~ — **Rozstrzygnięte
   13.09.2026** (D14, doprecyzowane przez D21 w `notes/lesson-decisions.md`). **Jedna** tabela
   `exclusion` z polem `kind` (`ingredient` / `dish` / `group`), plus tabela `exclusion_group`
   na grupy słownikowe. Rozdzielenie jest jawne przez `kind`, a nie przez drugi mechanizm —
   dzięki temu wykluczenia z preferencji (FR-004) i oznaczenia dań z planu (FR-011) zasilają
   **tę samą** listę, zgodnie z rozstrzygnięciem sokratejskim przy FR-011.
   **Wdrożone** w S-03 (`dietary-preferences`, migracja `0005`). Nie blokuje niczego.
5. ~~**Jak produkt uzasadnia wyliczone zapotrzebowanie kaloryczne i czy użytkownik może
   nadpisać cel ręcznie?**~~ — **Rozstrzygnięte i wdrożone 12.09.2026** w S-03
   (`profile-and-calorie-target`). Ekran profilu pokazuje wzór Mifflin-St Jeor z podstawionymi
   wartościami użytkownika, a nadpisanie ręczne jest dostępne i przycinane do widełek
   **1000–6000 kcal** (decyzja D16). Cel obowiązujący to nadpisanie, a gdy go nie ma —
   wyliczenie; jedno źródło prawdy dla ekranu i dla generatora to `src/lib/calorie-target.ts`.
   Nie blokuje niczego.
