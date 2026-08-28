---
project: "MealPlan"
context_type: greenfield
created: 2026-08-28
updated: 2026-08-28
product_type: mobile          # mobile jako główna powierzchnia; web traktowany równorzędnie
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 4
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 16
  quality_check_status: accepted
---

# Shape Notes

Źródło pomysłu początkowego: `notes/idea.md` (dosłowny opis od użytkownika).

## Vision & Problem Statement

Osoba pracująca, która chce jadać lepiej, dziś odbija się o cztery osobne tarcia w tym
samym tygodniu:

- **Paraliż decyzyjny** — codziennie ok. 17:00, po pracy: wie, ile powinna zjeść, ale nie
  chce jej się myśleć, *co*. Kończy się zamówieniem jedzenia albo tym samym daniem trzeci
  raz w tygodniu.
- **Ręczne układanie jadłospisu pod kalorie** — niedziela wieczór: liczenie makr w
  arkuszu/kalkulatorze i dopasowywanie dań tak, żeby wyjść na kalorie. Zajmuje 1–2 h i
  tak się rozjeżdża w ciągu tygodnia.
- **Przepisywanie listy zakupów z przepisów** — przed wyjściem do sklepu: przepisy leżą w
  różnych miejscach, składniki przepisywane ręcznie, połowa zapomniana, drugi kurs do
  sklepu.
- **Rozjazd między planem a preferencjami** — przy gotowych dietach/aplikacjach: plan pełen
  rzeczy, których nie lubi albo nie ma czasu gotować, więc rezygnuje po tygodniu.

**Wgląd (co odróżnia ten produkt od istniejących aplikacji):**

Istniejące aplikacje (Fitatu, Yazio, Kcalmar, Lidl Plan) to **dzienniki** — wpisujesz, co
zjadłeś, a one liczą kalorie *wstecz*. Ten produkt działa odwrotnie: dostajesz gotowy plan
**z góry**, dopasowany do wyliczonych kalorii i preferencji, bez wpisywania czegokolwiek.

Druga rzecz, której istniejące narzędzia nie domykają: **plan i lista zakupów żyją osobno**.
Tutaj użytkownik zaznacza dowolne dni z jadłospisu i dostaje jedną zagregowaną listę zakupów
z podziałem na kategorie sklepowe.

## User & Persona

**Główna persona:** osoba pracująca, która chce jadać lepiej bez dietetyka.

Dorosły, zna swój cel (schudnąć / utrzymać wagę / przytyć), nie chce płacić kilkuset złotych
za plan od dietetyka i nie chce liczyć makr ręcznie. Sięga po produkt w dwóch momentach:
raz przy planowaniu (niedziela wieczór) i codziennie przy pytaniu „co dziś ugotować".

## Access Control

Logowanie e-mail + hasło. Użytkownik zakłada konto na start; profil, jadłospis i listy
zakupów są związane z kontem, dzięki czemu ten sam stan jest dostępny na telefonie i w
przeglądarce.

Model ról: **płaski** — jeden typ użytkownika, brak ról administracyjnych. Każdy użytkownik
widzi wyłącznie własne dane; pełna izolacja danych między kontami. Niezalogowany użytkownik
nie ma dostępu do żadnego widoku produktowego poza rejestracją i logowaniem.

## Success Criteria

### Primary

Użytkownik przechodzi cały pierwszy przepływ od początku do końca w jednej sesji:
zakłada konto → podaje wiek, wagę, wzrost, płeć i poziom aktywności → dostaje wyliczone
zapotrzebowanie kaloryczne → podaje preferencje (lubi / nie lubi, kuchnia, czas gotowania,
liczba posiłków dziennie) → dostaje wygenerowany jadłospis z przepisami → zaznacza wybrane
dni i dostaje listę zakupów z podziałem na kategorie.

### Secondary

Większość zaproponowanych dań zostaje w planie bez wymiany — miara trafności dopasowania do
preferencji. Wysoki odsetek podmian oznacza, że generator dobiera dania słabo.

### Guardrails

- Żaden dzień planu nie zawiera dania z listy „nie lubię" ani z listy wykluczeń użytkownika.
  Jedno takie danie niszczy zaufanie do całego planu.
- Suma kalorii dnia mieści się w **±10%** od wyliczonego celu. Rozjazd tutaj unieważnia całą
  obietnicę produktu.
- Dane profilu (waga, wiek, płeć) nie są widoczne poza kontem właściciela.
- Lista zakupów pokrywa wszystkie składniki zaznaczonych dań — brakujący składnik oznacza
  drugi kurs do sklepu, czyli dokładnie ten ból, który produkt miał usunąć.

## Timeline acknowledgment

Potwierdzono dnia 2026-08-28: 4-tygodniowy MVP wymaga stałego zaangażowania; użytkownik
zaakceptował.

## Functional Requirements

### Konto i profil

- FR-001: Użytkownik może założyć konto (e-mail + hasło) i zalogować się. Priorytet: must-have
  > Socrates: Brak kontrargumentu; konto od pierwszego ekranu, potrzebne do synchronizacji
  > między telefonem a przeglądarką.
- FR-002: Użytkownik może podać i później edytować swój profil: wiek, waga, wzrost, płeć, poziom aktywności w skali 1-5. Priorytet: must-have
  > Socrates: Brak kontrargumentu; to są dokładnie te dane, które użytkownik wskazał jako
  > wejście do wyliczenia zapotrzebowania.
- FR-003: Użytkownik może zobaczyć wyliczone dzienne zapotrzebowanie kaloryczne wynikające z jego profilu. Priorytet: must-have
  > Socrates: Rozważono kontrargument: "sama liczba bez wyjaśnienia budzi nieufność — jeśli
  > użytkownik nie ufa liczbie, nie zaufa też planowi." Rozwiązanie: zachowano; produkt musi
  > pokazać, skąd bierze się wynik, i pozwolić ręcznie nadpisać cel.

### Preferencje żywieniowe

- FR-004: Użytkownik może wskazać potrawy i składniki, których nie chce jeść (wykluczenia). Priorytet: must-have
  > Socrates: Rozważono kontrargument: "wykluczenia składnikowe i daniowe to dwa różne
  > poziomy — mylenie ich sprawi, że guardrail o wykluczeniach będzie łamany." Rozwiązanie:
  > zachowano; oba poziomy muszą być rozdzielone jawnie.
- FR-005: Użytkownik może wskazać, jakie potrawy lubi i jaka kuchnia mu smakuje. Priorytet: nice-to-have
  > Socrates: Rozważono kontrargument: "lubienie jest słabsze niż wykluczanie — skoro FR-004
  > usuwa to, czego użytkownik nie chce, lista ulubionych dodaje mało." Rozwiązanie: obniżono
  > do nice-to-have. W v1 generator opiera się na wykluczeniach, czasie gotowania i kaloriach;
  > preferencje pozytywne dochodzą później.
- FR-006: Użytkownik może określić, ile czasu chce poświęcać na przygotowanie posiłku. Priorytet: must-have
  > Socrates: Brak kontrargumentu; czas przygotowania to jedno z wejść preferencji wskazanych
  > wprost przez użytkownika.
- FR-007: Użytkownik może określić liczbę posiłków dziennie, na jaką dzieli zapotrzebowanie. Priorytet: must-have
  > Socrates: Brak kontrargumentu; liczba posiłków to wejście, które użytkownik nazwał
  > istotnym dla podziału zapotrzebowania.

### Jadłospis

- FR-008: Użytkownik może wygenerować jadłospis na tydzień w przód, dopasowany do zapotrzebowania kalorycznego i preferencji. Priorytet: must-have
  > Socrates: Rozważono kontrargument: "zakupy robi się na 2-3 dni, więc horyzont miesięczny
  > nie służy żadnemu realnemu momentowi użycia; przy małej bazie przepisów miesiąc oznacza
  > też powtarzalność." Rozwiązanie: zakres skrócony z miesiąca do **jednego tygodnia**.
  > Plan miesięczny wraca jako kandydat po v1.
- FR-009: Użytkownik może zobaczyć dla każdego dania przepis: składniki, instrukcję przygotowania i makra (białko, węglowodany, tłuszcz). Priorytet: must-have
  > Socrates: Brak kontrargumentu; pełny przepis z makrami dla każdego dania zostaje bez zmian.
- FR-016: Użytkownik może przejść przez instrukcję przygotowania dania krok po kroku w trakcie gotowania. Priorytet: must-have
  > Socrates: Rozważono kontrargument: "wymaga przepisów rozbitych na kroki — jeśli źródło daje
  > instrukcję jako jeden blok tekstu, trybu krok-po-kroku nie da się zrobić bez ręcznej
  > obróbki." Rozwiązanie: zachowano; kontrargument zaostrza wymaganie wobec źródła przepisów
  > i jest odnotowany w Open Questions jako warunek wyboru tego źródła.
- FR-010: Użytkownik może wymienić pojedyncze danie w jadłospisie na inne. Priorytet: must-have
  > Socrates: Brak kontrargumentu; dostosowanie planu pod siebie to część wartości opisanej
  > przez użytkownika.
- FR-011: Użytkownik może oznaczyć danie tak, żeby nie pojawiało się w przyszłych jadłospisach. Priorytet: must-have
  > Socrates: Rozważono kontrargument: "to to samo co FR-004 — dwie ścieżki budujące tę samą
  > listę wykluczeń." Rozwiązanie: zachowano jako możliwość użytkownika, ale wykluczenia z
  > preferencji i oznaczenia z planu zasilają JEDNĄ listę wykluczeń, nie dwa osobne mechanizmy.

### Lista zakupów

- FR-012: Użytkownik może zaznaczyć wybrane dni lub potrawy i wygenerować z nich listę zakupów. Priorytet: must-have
  > Socrates: Brak kontrargumentu; zaznaczanie dni i generowanie z nich listy użytkownik wskazał
  > wprost jako istotną część produktu.
- FR-013: Użytkownik może zobaczyć listę zakupów pogrupowaną w kategorie sklepowe (warzywa, mięso, nabiał i dalsze). Priorytet: must-have
  > Socrates: Brak kontrargumentu; podział na kategorie zostaje bez zmian.
- FR-014: Użytkownik może odhaczać kupione pozycje na liście zakupów. Priorytet: must-have
  > Socrates: Brak kontrargumentu; odhaczanie pozycji zostaje w MVP jako must-have.
- FR-015: Użytkownik może wyeksportować listę zakupów do zewnętrznej aplikacji z notatkami. Priorytet: nice-to-have
  > Socrates: Brak kontrargumentu; użytkownik sam nazwał to "nice to have" — zostaje poza
  > obowiązkowym zakresem MVP.

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
- Gdy wykluczeń jest tyle, że planu nie da się ułożyć w granicy ±10%, użytkownik dostaje
  jawny komunikat o tym, zamiast planu łamiącego wykluczenia lub cel kaloryczny

### US-02: Użytkownik generuje listę zakupów na najbliższe dni

- **Given** użytkownik z wygenerowanym jadłospisem
- **When** zaznaczy wybrane dni lub pojedyncze potrawy i poprosi o listę zakupów
- **Then** widzi jedną zagregowaną listę składników pogrupowaną w kategorie sklepowe

#### Acceptance Criteria
- Lista pokrywa wszystkie składniki wszystkich zaznaczonych dań
- Ten sam składnik występujący w kilku daniach pojawia się jako jedna pozycja ze zsumowaną ilością
- Użytkownik może odhaczać kupione pozycje

## Business Logic

Aplikacja układa tydzień posiłków tak, żeby każdy dzień trafiał w cel kaloryczny ±10%, nie
łamiąc żadnego wykluczenia ani limitu czasu gotowania.

Reguła konsumuje to, co użytkownik podaje o sobie i o swoich preferencjach: wiek, wagę, wzrost,
płeć i poziom aktywności (z których wynika dzienny cel kaloryczny), listę wykluczeń, maksymalny
czas, jaki chce poświęcić na przygotowanie posiłku, oraz liczbę posiłków, na jaką dzieli dzień.

Wynikiem jest konkretny zestaw dań przypisanych do dni i pór posiłku — nie ranking, nie
sugestia, tylko gotowy plan, który da się ugotować. Użytkownik napotyka regułę raz, w momencie
generowania planu, a potem ponownie za każdym razem, gdy wymienia pojedyncze danie: podmiana
również musi utrzymać dzień w granicy ±10% i nie może wprowadzić pozycji z listy wykluczeń.

Wykluczenia i cel kaloryczny są traktowane jako twarde ograniczenia, nie jako preferencje do
zważenia — złamanie któregokolwiek jest błędem, a nie kompromisem.

## Non-Functional Requirements

- Produkt jest użyteczny na telefonie trzymanym w jednej ręce, także w kuchni — przy mokrych
  rękach i przy patrzeniu na ekran z odległości ramienia.
- Raz wygenerowany plan i lista zakupów pozostają dostępne bez połączenia z siecią.

## Non-Goals

- **Nie budujemy własnego algorytmu żywieniowego ani rekomendacji dietetycznych.** Produkt
  dobiera dania pod cel kaloryczny i pod ograniczenia użytkownika; nie doradza medycznie, nie
  uwzględnia chorób, alergii klinicznych ani diet leczniczych.
- **Brak dziennika jedzenia.** Użytkownik nie wpisuje, co faktycznie zjadł. Produkt planuje z
  góry, a nie rozlicza wstecz — to jest wprost ta różnica wobec istniejących aplikacji, która
  uzasadnia jego istnienie.
- **Brak śledzenia wagi i postępów w czasie.** Profil podaje się raz i edytuje ręcznie; nie ma
  historii pomiarów, wykresów ani automatycznego przeliczania celu po zmianie wagi.
- **Plan miesięczny poza MVP.** Zakres skrócono do jednego tygodnia (FR-008); dłuższy horyzont
  wraca do rozważenia dopiero, gdy tygodniowy plan działa i baza dań jest wystarczająco duża.

## Forward: product framing

Mobile jest główną powierzchnią produktu, ale wersja webowa jest traktowana jako równorzędna,
a nie jako dodatek. To ma konsekwencje przy wyborze stacku — warto, żeby kolejny krok łańcucha
wziął to pod uwagę jako wymaganie, a nie jako opcję.

## Open Questions

1. **Skąd biorą się przepisy i makra?** — nierozstrzygnięte. Rozważane opcje: generowanie przez
   model AI na żądanie, własna ręcznie zseedowana baza, publiczna baza składników (USDA /
   Open Food Facts) plus własne przepisy. Blokuje: tak — cały generator planu (FR-008) i
   guardrail ±10% kcal stoją na jakości makr. Właściciel: użytkownik.
2. **Czy wybrane źródło przepisów daje instrukcję rozbitą na kroki?** — warunek konieczny dla
   FR-016 (tryb gotowania krok po kroku). Wynika wprost z wyzwania sokratejskiego przy FR-016.
   Do rozstrzygnięcia razem z pytaniem 1.
3. **Jak zachowuje się produkt, gdy wykluczeń jest tyle, że planu nie da się ułożyć w ±10%?** —
   kierunek zapisany w kryteriach akceptacji US-01 (jawny komunikat), ale próg i sposób
   komunikatu do doprecyzowania.

## Quality cross-check

Kontrola przeprowadzona 2026-08-28. Wszystkie pozycje obowiązkowe dla sesji greenfield są
obecne:

| Pozycja | Status |
|---|---|
| Kontrola dostępu | obecny — logowanie e-mail + hasło, model płaski |
| Logika biznesowa (reguła jednozdaniowa) | obecny |
| Artefakty projektu | obecny — `shape-notes.md` z pełnym checkpointem |
| Potwierdzenie kosztu czasowego | obecny — `## Timeline acknowledgment`, 4 tygodnie |
| Non-Goals | obecny — 4 wpisy |
| Zachowane zachowanie | n/a (greenfield) |

Luki nie blokujące bramki jakości, przeniesione do `## Open Questions`: źródło przepisów i
makr (blokuje implementację generatora), format instrukcji przygotowania, zachowanie przy
nadmiarze wykluczeń.
