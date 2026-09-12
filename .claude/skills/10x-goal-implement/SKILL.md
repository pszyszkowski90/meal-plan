---
name: 10x-goal-implement
description: >
  Autonomously implement technical plans from
  context/changes/<change-id>/plan.md under Claude Code's
  /goal — no human interaction at any point. Sibling of /10x-implement for
  unattended runs, in an interactive /goal session or headless via claude -p.
  Delegates each phase's code changes to a subagent, flips the
  plan's Automated Progress rows, verifies each phase through an automatic
  quality-gate stack (plan success criteria, deliberate-break check, full suite),
  commits each phase on green with Conventional Commits, and
  surfaces pending Manual rows as a closing human checklist. Use when the user
  wants autonomous or unattended plan execution, pairs /goal with a plan, asks to
  "run the plan under /goal", or needs headless implementation.
argument-hint: <change-id> [phase N]
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - Bash
  - Task
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---

# Autonomiczne wdrażanie planu (w ramach /goal)

Twoim zadaniem jest wdrożenie zatwierdzonego planu technicznego z `context/changes/<change-id>/plan.md` bez interakcji z człowiekiem. Plany zawierają fazy ze specyficznymi zmianami oraz kanoniczną sekcję `## Progress` na dole, która steruje stanem wykonania (patrz `references/progress-format.md`). Ta umiejętność jest autonomicznym odpowiednikiem `/10x-implement`: dzieli te same kontrakty planu — rozwiązywanie planu, `## Progress` jako jedyne źródło prawdy, śledzenie zmienionych plików, protokół Conventional-Commits, cykl życia `change.md` — ale każda decyzja, którą podjąłby człowiek, jest zastąpiona jawną polityką automatyczną.

## Pozycjonowanie i wywołanie

Uruchom tę umiejętność w sesji `/goal`. Warunek celu to test zatrzymania na poziomie sesji; ta umiejętność jest polityką wykonania, która go spełnia.

- **Interaktywne**: najpierw ustaw cel, a następnie wywołaj umiejętność — `/goal <condition>`, a następnie `/10x-goal-implement <change-id> [phase N]`.
- **Bezobsługowe**: `claude -p "/goal <condition> /10x-goal-implement <change-id>" --allowedTools "Read,Glob,Grep,Write,Edit,Bash,Task,TaskCreate,TaskUpdate,TaskList,TaskGet" --permission-mode acceptEdits`.

Skopiuj i wklej szablon warunku `/goal` (uzupełnij `<change-id>` i ograniczenie liczby tur `<N>`, zazwyczaj 20):

```
Użyj umiejętności 10x-goal-implement, aby wdrożyć wszystkie fazy
context/changes/<change-id>/plan.md. Gotowe, gdy: każdy wiersz pod
#### Automated w sekcji ## Progress planu jest zaznaczony, każda
faza ma swój własny commit Conventional-Commits, a końcowy wynik
wymienia wszelkie oczekujące wiersze #### Manual. Ograniczenia: nie
modyfikuj ani nie osłabiaj istniejących testów, chyba że plan tak
stanowi; nie dotykaj plików poza zakresem planu. Zatrzymaj się po
<N> turach, jeśli nie zostanie ukończone.
```

Ewaluator celu odczytuje **tylko transkrypcję rozmowy** — nie może uruchamiać poleceń ani czytać plików. Wszystko, co testuje warunek, musi być zatem opisane w tekście Twojej odpowiedzi: werdykty bramki, SHA commitów, oczekujące wiersze Manual. Bramka, która przeszła cicho, jest nieodróżnialna od bramki, która nigdy nie została uruchomiona. Opisuj.

## Polityka braku interakcji

Nikt nie obserwuje przebiegu. Nigdy nie wywołuj interaktywnych narzędzi do zadawania pytań — nie ma nikogo, kto by odpowiedział, a w przypadku wywołania bezobsługowego wywołanie kończy się niepowodzeniem. Każda decyzja jest podejmowana zgodnie z politykami zawartymi w tym dokumencie. Gdy coś jest naprawdę niejednoznaczne i żadna z poniższych polityk tego nie rozwiązuje, wybierz konserwatywną interpretację, opisz wybór w tekście odpowiedzi i zanotuj go w raporcie z przebiegu. Konserwatywne oznacza: odczyt, który dotyka mniej plików, zmienia mniej zachowań i pozostaje najbliżej dosłownego tekstu planu.

## Konfiguracja

Po wywołaniu tego polecenia:

1. **Rozwiąż plan**:
   - Jeśli wywołano jako `/10x-goal-implement <change-id> [phase N]`, rozwiąż do `context/changes/<change-id>/plan.md`.
   - Jeśli wywołano z `@context/changes/<change-id>/plan.md` lub pełną ścieżką, zaakceptuj.
   - **Odmów, jeśli rozwiązana ścieżka zaczyna się od `context/archive/`** — wydrukuj "This change is archived. Open a new change with `/10x-new` instead." i ZATRZYMAJ.
   - Jeśli nie podano planu lub rozwiązany plik nie istnieje, wydrukuj jeden wiersz — `Cannot start: no plan resolved from "<input>". Provide a change-id or plan path.` — i ZATRZYMAJ. Nie zgaduj change-id.

2. **Załaduj kontekst**:
   - Przeczytaj plan w całości. Sekcja `## Progress` na dole jest autorytatywna dla stanu wykonania — znaczniki wyboru (`- [x]`) znajdują się TYLKO tam. Bloki faz zawierają zwykłe punktorzy `- ` (bez pól wyboru).
   - Przeczytaj `context/foundation/lessons.md`, jeśli istnieje, i zinternalizuj każdy wpis przed rozpoczęciem jakiejkolwiek fazy — są to zaakceptowane powtarzające się zasady zespołu i muszą kształtować każdy wybór implementacyjny w tym przebiegu. Ponieważ implementacja jest delegowana (patrz "Model wykonania per-faza"), przekaż każdy wpis lekcji do dyspozycji każdej fazy — subagent nie może zobaczyć pliku, chyba że go przeniesiesz.
   - Przeczytaj wszystkie pliki wymienione w planie (odniesienia do badań, ramki, pliki źródłowe w tym samym folderze zmian).
   - **Czytaj pliki w całości** — nigdy nie używaj parametrów limit/offset; potrzebujesz pełnego kontekstu.

3. **Wstępna kontrola bramek**: zbierz polecenia z kryteriów sukcesu Automated każdej fazy i sprawdź, czy każde z nich jest uruchamialne w tym środowisku (binarny lub skrypt pakietu istnieje — np. sprawdź skrypty `package.json`, `command -v`, cele `Makefile`). Kryterium, którego polecenie nie może zostać uruchomione, jest strukturalnym niedopasowaniem dla fazy, która go potrzebuje: opisz brakujące polecenie teraz (`PREFLIGHT: <command> not runnable — Phase <N> will stop unless fixed`), a gdy wykonanie osiągnie tę fazę, wydrukuj blok STOP i zatrzymaj. Nie pomijaj cicho nieweryfikowalnego kryterium.

4. **Zaktualizuj `change.md`**: ustaw `status: implementing` (tylko jeśli aktualnie w `{planned, plan_reviewed}`) i `updated: <today>`. Następnie **zsynchronizuj roadmapę** (najlepszy wysiłek) — jeśli `context/foundation/roadmap.md` zawiera element, którego `Change ID` jest równe `<change-id>`, zmień go na `Status: in-progress`, odpowiednik otwartej pracy dla zmiany `done` w `/10x-archive`. Patrz "## Synchronizacja statusu roadmapy" poniżej; opisz wynik, nigdy nie zatrzymuj się na nim.

5. **Utwórz zadania faz**: policz całkowitą liczbę faz (z nagłówków `## Phase N:`) i utwórz jeden wpis TaskCreate dla każdej fazy (`subject: "Phase N: [Phase Name]"`, `activeForm: "Implementing Phase N"`). Ustaw bieżącą fazę `in_progress` za pomocą TaskUpdate przed rozpoczęciem pracy; oznacz ją jako `completed`, gdy jej bramki przejdą i jej commit zostanie zatwierdzony.

6. **Znajdź następny oczekujący krok**: przeskanuj sekcję `## Progress` w poszukiwaniu pierwszego wiersza `- [ ]` **w podsekcji `#### Automated`** w kolejności dokumentu — tam zaczynasz. Wiersze pod `#### Manual` są poza Twoją jurysdykcją (patrz "Wiersze Manual" poniżej); pomiń je podczas lokalizowania punktu wznowienia. Jeśli podano argument `phase N`, przejdź do pierwszego Automated `- [ ]` wewnątrz `### Phase N:`.

## Taksonomia niedopasowań

Plany są starannie projektowane, ale rzeczywistość może być skomplikowana. Gdy baza kodu nie odpowiada temu, co opisuje plan, sklasyfikuj niedopasowanie i działaj — nigdy nie edytuj bloków faz, aby dopasować plan. Podczas fazy subagent implementacyjny napotyka te niedopasowania bezpośrednio: adaptuje **Minor** i zgłasza je, a w przypadku **Structural** zatrzymuje się i przekazuje szczegóły z powrotem do głównego, który drukuje blok STOP.

**Minor** — przeniesiony plik, zmieniona nazwa symbolu, dryf importów, trywialna różnica w API lub konfiguracji. Intencja planu jest nienaruszona; zmieniła się tylko koordynacja. Dostosuj implementację do rzeczywistości, opisz adaptację w jednym lub dwóch wierszach (`ADAPT: plan says src/auth.ts, file is now src/auth/index.ts`) i uwzględnij ją w raporcie z przebiegu.

**Structural** — brakująca zależność, architektura różniąca się od tej, którą zakłada plan, odniesienie do pliku lub API, które nie istnieje, faza, która zależy od danych wyjściowych, których poprzednia faza nigdy nie wyprodukowała. Plan nie może być przestrzegany w obecnej formie, a adaptacja oznaczałaby przeprojektowanie. Wydrukuj blok STOP i zatrzymaj.

W przypadku wątpliwości między tymi dwoma, traktuj to jako strukturalne. Błędne zgadnięcie, które zatrzymuje, kosztuje jedno wznowienie; błędne zgadnięcie, które adaptuje, może spowodować wdrożenie przeprojektowania, którego nikt nie zatwierdził.

## Model wykonania per-faza

Każda faza przebiega w dwóch częściach z wyraźnym podziałem pracy:

- **Implementacja jest delegowana.** Wyślij pojedynczego subagenta `Task` do napisania zmian kodu w fazie. Obszerna praca — czytanie plików źródłowych, analizowanie zmian, stosowanie edycji — odbywa się w kontekście subagenta, dzięki czemu główna transkrypcja pozostaje zwięzła podczas długiego, wielofazowego przebiegu.
- **Wszystko, co musi zobaczyć ewaluator celu, pozostaje w głównym kontekście.** Wykonanie bramki, wiersze werdyktów, przygotowanie, commity, SHA, zmiany postępu, bloki STOP i raport z przebiegu — wszystko to odbywa się w głównym kontekście i jest opisywane w tekście Twojej odpowiedzi. Ewaluator celu odczytuje tylko główną transkrypcję — wewnętrzna praca subagenta jest dla niego niewidoczna, więc nic, co testuje warunek celu, nie może znajdować się w subagencie.

### Wysyłanie subagenta implementacyjnego

Dla każdej fazy, przed stosem bramek, wyślij jedno wywołanie `Task` (`subagent_type: general-purpose`), którego prompt zawiera:

- Identyfikator zmiany oraz numer i tytuł fazy.
- Pełną sekcję planu fazy dosłownie — Overview, Changes Required, Success Criteria. (Success Criteria to kontekst, aby subagent znał cel; NIE uruchamia bramek — robi to główny agent.)
- **Dyscyplinę implementacji do przestrzegania.** Rozwiąż `references/implementation-discipline.md` (znajduje się obok tego `SKILL.md`) do **ścieżki absolutnej** i poinstruuj subagenta, aby ją przeczytał i zastosował — wygenerowany agent `Task` nie ma pojęcia o katalogu tej umiejętności, więc ścieżka względna lub "przeczytaj odniesienie tej umiejętności" nie zostanie rozwiązana. Ten plik jest wspólną warstwą rzemieślniczą: czytaj w pełni kod referencyjny, dostosowuj się do rzeczywistości bez przeprojektowywania, weryfikuj, czy zmiana pasuje do otaczającej bazy kodu, stosuj lekcje i przeszukuj `Explore` przed edycją nieznanego obszaru. Zachowaj go jako jedyne źródło — wskaż go, nie powtarzaj go w tekście.
- Każdy wpis z `context/foundation/lessons.md`, jeśli istnieje (subagent nie może przeczytać pliku, chyba że wkleisz wpisy).
- Obowiązującą taksonomię niedopasowań: adaptuj **Minor** niedopasowania bezpośrednio i zgłaszaj je; w przypadku **Structural** niedopasowania, ZATRZYMAJ i zgłoś je, zamiast adaptować lub przeprojektowywać.
- Twarde granice: implementuj TYLKO zmiany kodu. Nie uruchamiaj stosu bramek, nie przygotowuj, nie commituj, nie dotykaj sekcji `## Progress` ani żadnego pola wyboru, nie edytuj bloków faz, nie wychodź poza zakres planu, nigdy nie wywołuj interaktywnych narzędzi.

Wymagaj ustrukturyzowanej wiadomości końcowej jako wartości zwracanej (nie notatki dla użytkownika):

```
STATUS: completed | structural-mismatch
TOUCHED: <repo-relative path>, <path>, ...      # każdy utworzony lub edytowany plik
ADAPTATIONS: <jeden wiersz dla każdego, lub none>
STRUCTURAL: <założenie planu vs. to, co istnieje — tylko gdy STATUS to structural-mismatch>
UNCERTAINTIES: <niejednoznaczne decyzje, lub none>
```

Po powrocie:

- **`structural-mismatch`** → nie uruchamiaj bramek. Wydrukuj blok STOP, używając szczegółów `STRUCTURAL` subagenta i zatrzymaj.
- **`completed`** → zasiej zestaw zmienionych plików fazy z `TOUCHED` (patrz "Śledzenie plików zmienionych podczas fazy"), przenieś `ADAPTATIONS` i `UNCERTAINTIES` do raportu z przebiegu i przejdź do stosu bramek. Nigdy nie ufaj `TOUCHED` ślepo — uzgodnienie `git status --porcelain` na etapie przygotowania jest kontrolą krzyżową dla pliku, który subagent dotknął, ale pominął.

## Stos bramek per-faza

Gdy subagent implementacyjny zwrócił `completed`, a zestaw zmienionych plików został zasiany z jego listy `TOUCHED`, uruchom tę stałą sekwencję w głównym kontekście — pojedyncza kanoniczna kolejność dla wszystkiego między "kodem napisanym" a "commitem zatwierdzonym". Bramki uruchamiają się od najtańszych; przygotowanie znajduje się tam, gdzie potrzebuje go kontrola przerwania; rytuał commitu jest ogonem. Po każdej bramce wydrukuj jednolinijkowy werdykt w tekście odpowiedzi — `GATE <name>: PASS` lub `GATE <name>: FAIL (<summary>, attempt <k>/2)` — aby ewaluator celu go zobaczył.

1. **(a) Kryteria planu** — uruchom polecenia kryteriów sukcesu `#### Automated` fazy z planu, w kolejności. Każde polecenie to jedna bramka z własnym wierszem werdyktu.

2. **Przygotuj zestaw zmienionych plików** — `git add` każdy plik według ścieżki (definicja zestawu i obsługa brudnych ścieżek: patrz "Śledzenie plików zmienionych podczas fazy"). Przygotowanie _tutaj_, przed kontrolą przerwania, sprawia, że przywracanie kontroli przerwania jest dokładne.

3. **(b) Celowa kontrola przerwania** — tylko dla faz, które dodają lub zmieniają testy. Gdy pliki fazy są przygotowane, sprawdź, czy nowy lub zmieniony test faktycznie coś chroni:
   1. Odwróć lub osłab chronione zachowanie w kodzie produkcyjnym — edycja tylko w worktree, nigdy nie przygotowana.
   2. Uruchom odpowiedni test (ograniczone uruchomienie, np. pojedynczy plik testowy).
   3. Potwierdź, że się nie powiódł. Czerwień tutaj jest warunkiem przejścia: `GATE break-check: PASS (test went red on broken code)`.
   4. Przywróć bezwarunkowo za pomocą `git checkout -- <file>` — to resetuje worktree dokładnie do przygotowanej wersji, więc przerwa nigdy nie może przedostać się do commita.
   5. Opisz sekwencję (co zostało zepsute, że test stał się czerwony, że plik został przywrócony).

   Jeśli test **pozostaje zielony** na zepsutym kodzie, asercja niczego nie chroni — to jest błąd bramki. Napraw to, wzmacniając asercję, nigdy nie osłabiając kodu produkcyjnego ani nie pomijając kontroli. Edycja przerwania nigdy nie może zostać zatwierdzona; przywrócenie w kroku 4 jest bezwarunkowe, w tym na ścieżce błędu.

4. **(c) Sprawdzenia w całym repozytorium** — pełny zestaw testów, lint, typecheck, gdziekolwiek plan lub repozytorium je definiuje (np. skrypt `ci:local`, `make check test`). Jeden wiersz werdyktu dla każdego.

5. **(d) Commit** — niezmiennik commit-only-on-green: nigdy nie rozpoczynaj rytuału commitu, gdy jakakolwiek bramka powyżej jest czerwona. Nie ma nadpisania. Jeśli samodzielna naprawa bramki (b)/(c) zmieniła pliki, uruchom ponownie krok 2, aby je przechwycić, a następnie uruchom autonomiczny rytuał commitu.

## Eskalacja samodzielnej naprawy

Bramka, która się nie powiodła, otrzymuje maksymalnie **2** próby samodzielnej naprawy. Numeruj je w wierszach werdyktów (`attempt 1/2`, `attempt 2/2`). Jeśli ta sama bramka nie powiedzie się po raz trzeci, problem jest głębszy niż mechaniczny dryf — wydrukuj blok STOP i zatrzymaj, zamiast marnować tury.

Zastosuj poprawkę kodu w ten sam sposób, w jaki stosujesz początkową implementację: wyślij skoncentrowanego subagenta `Task` zawierającego dane wyjściowe nieudanej bramki i pliki powodujące błąd, i połącz jego zwrócone ścieżki `TOUCHED` z zestawem zmienionych plików fazy przed ponownym przygotowaniem i ponownym uruchomieniem bramki. Trywialne, mechaniczne poprawki (zbłąkany import, zmiana nazwy) mogą być stosowane bezpośrednio w głównym kontekście. Tak czy inaczej, budżet 2 prób pozostaje niezmieniony, a edycja tylko w worktree kontroli przerwania + bezwarunkowe przywrócenie zawsze pozostaje w głównym kontekście — nigdy jej nie deleguj.

Granice tego, co może zrobić poprawka:

- Nigdy nie osłabiaj asercji, nie usuwaj testu ani nie luzuj reguły lint/typecheck, aby bramka przeszła, chyba że plan wyraźnie tak stanowi. Napraw kod, aby spełniał sprawdzenie, a nie sprawdzenie, aby spełniało kod.
- Gdy oczekiwana wartość testu jest niejednoznaczna — plan i implementacja się nie zgadzają, a nie ma niezależnego źródła właściwej odpowiedzi — nie zgaduj. Oznacz krok jako niepewny w raporcie z przebiegu, pozostaw werdykt bramki uczciwy i pozwól, aby ścieżka STOP lub raport ujawniły to człowiekowi.

## Format bloku STOP

Blok STOP to widoczna dla człowieka powierzchnia błędu i sygnał, który ewaluator celu odczytuje jako "nieukończone". Wydrukuj go dokładnie w tej formie, a następnie zatrzymaj — bez dalszych edycji, bez commita:

```
STOPPED — <STRUCTURAL MISMATCH | GATE FAILURE> in Phase <N>
Expected: <co mówi plan / czego wymaga bramka>
Found:    <rzeczywista sytuacja / podsumowanie nieudanych danych wyjściowych>
Why:      <dlaczego to blokuje autonomiczną kontynuację>
Resume:   napraw powyższe, a następnie /10x-goal-implement <change-id> phase <N>
```

Przed zatrzymaniem pozostaw drzewo robocze w uczciwym stanie: ukończone wiersze Progress pozostają odwrócone, praca w toku pozostaje w drzewie roboczym niezacommitowana, a wszelkie celowe edycje przerwania są przywrócone. Wznowienie nie wymaga dodatkowego stanu — pierwszy oczekujący wiersz Automated jest punktem ponownego wejścia.

## Śledzenie plików zmienionych podczas fazy

Rytuał commitu przygotowuje pliki z **zestawu zmienionych plików** utrzymywanego w pamięci roboczej przez każdą fazę. Ten zestaw jest kanonicznym wejściem do `git add` — nigdy nie wracaj do heurystyk `git status` dla decyzji o przygotowaniu.

- **Zasiej zestaw z listy `TOUCHED` subagenta implementacyjnego**, gdy zwróci `completed`, i połącz w nim wszelkie ścieżki zwrócone przez subagenta samodzielnej naprawy. Gdy edytujesz plik bezpośrednio w głównym kontekście — pola wyboru `## Progress` w `plan.md`, zmiana statusu `change.md` — dodaj również jego ścieżkę.
- Zestaw zawsze zawiera `context/changes/<change-id>/plan.md` — dodaj go przy wejściu do fazy, przed odwróceniem jakichkolwiek pól wyboru.
- **Bootstrap fazy 1**: w pierwszej fazie zmiany, zasiej również zestaw wszystkimi nieśledzonymi lub zmodyfikowanymi plikami w `context/changes/<change-id>/` (zazwyczaj `change.md`, `research.md`, `plan.md`), aby pliki kontekstowe zmiany trafiły do pierwszego commita.
- Zestaw **resetuje się na każdej granicy fazy**, po zakończeniu commitu fazy.
- Zestaw nadpisuje `git status`. Plik, który jest brudny, ale nie znajduje się w zestawie, jest niepowiązany — nigdy nie jest przygotowywany.

**Przygotowanie zestawu (krok 2 stosu bramek):** przygotuj zestaw zmienionych plików ∪ `{context/changes/<change-id>/plan.md}` (Faza 1: zestaw zasiany bootstrapem). Uruchom `git status --porcelain`; każda brudna ścieżka poza zestawem przygotowania **nigdy nie jest przygotowywana** — wymień ją jako `DIRTY (not staged): <paths>` w tekście odpowiedzi (aby pojawiła się w transkrypcji i raporcie z przebiegu) i kontynuuj tylko z zaplanowanym zestawem. To uzgodnienie jest również siatką bezpieczeństwa przed delegowanym subagentem, który dotknął pliku, ale pominął go z `TOUCHED` — pominięcie pojawia się jako DIRTY, zamiast cicho prześlizgnąć się poza granicę commitu. Przygotuj według nazwy za pomocą `git add` każdy plik; nigdy `git add -A` ani `git add .`.

## Śledzenie odniesień do problemów/zadań dla commitów

Przed skomponowaniem jakiejkolwiek wiadomości commitu fazy lub epilogu, przeskanuj kontekst rozmowy w poszukiwaniu odniesień do systemu śledzenia związanych z tą pracą: klucze Jira (`ABC-123`), identyfikatory Linear (`ENG-123`), problemy/PR GitHub (`#123`, `GH-123`, pełne adresy URL) lub jawne linki do zadań. Jeśli są obecne, dodaj wiersz `Refs:` do treści commitu, zachowując dokładne identyfikatory; wiele odniesień umieść oddzielone przecinkami w jednym wierszu. Nigdy nie wymyślaj ani nie wnioskuj odniesień z change-id, nazwy gałęzi lub nazw plików — używaj tylko tego, co jest widoczne w kontekście. Zastosuj ten sam wiersz `Refs:` do każdego commitu fazy i epilogu.

## Synchronizacja statusu roadmapy

`context/foundation/roadmap.md` (produkowany przez `/10x-roadmap`) indeksuje każdą Fundację/Fragment za pomocą stabilnego **Change ID**. `/10x-archive` zmienia pasujący element na `Status: done`, gdy zmiana jest archiwizowana; ten krok łączy bliski koniec — gdy rozpoczyna się autonomiczna implementacja, oznacz pasujący element jako **`in-progress`**, aby roadmapa pokazywała bieżącą pracę.

Uruchom to **raz, przy wejściu** (zaraz po stemplu `change.md` → `implementing`), a nie na fazę. Wyszukiwanie jest **obowiązkowe**; "najlepszy wysiłek" obejmuje tylko *edycje* — brakująca roadmapa lub nieznaleziony cel jest pomijany cicho i nigdy nie zatrzymuje przebiegu, nie wywołuje bloku STOP ani nie wlicza się do budżetu samodzielnej naprawy. Nie pomijaj sprawdzenia, zakładając, że nie ma roadmapy; opisz wynik (dopasowany + zmieniony, już zaawansowany lub brak dopasowania) w tekście odpowiedzi, aby ewaluator celu go zobaczył.

1. `test -f context/foundation/roadmap.md`. Jeśli brak, opisz `ROADMAP: none — skipped.` i pomiń ten krok.
2. Zapisz brudny stan: `ROADMAP_PREDIRTY=$(git status --porcelain context/foundation/roadmap.md 2>/dev/null)` (używane w kroku 5).
3. Przeczytaj plik. Znajdź `<change-id>` użyty jako `Change ID`:
   - w tabeli `## At a glance` — wiersz, którego komórka **Change ID** jest dokładnie równa `<change-id>`;
   - oraz w treści `## Foundations` / `## Slices` — blok `### <ID>: …` zawierający wiersz `- **Change ID:** <change-id>`.

   `<ID>` to lokalny identyfikator elementu w roadmapie (`F-NN` / `S-NN`). Dopasowanie jest tylko dokładnym ciągiem znaków. **Brak dopasowania** → opisz `ROADMAP: no item with Change ID "<change-id>" — left untouched.` i pomiń resztę.
4. **Znaleziono dopasowanie** → jeśli `Status:` elementu jest już `in-progress` lub `done`, pozostaw go (**tylko do przodu** — nigdy nie cofaj) i opisz `ROADMAP: <ID> already <status> — left untouched.`; przejdź do kroku 5. W przeciwnym razie ustaw komórkę **Status** w `## At a glance` i wiersz `- **Status:**` w treści elementu na `in-progress` (każda edycja niezależna i najlepszy wysiłek — pomiń podedycję, która nie znajduje się tam, gdzie umieszcza ją szablon, i opisz pominięcie), zaktualizuj `updated:` w frontmatterze na `<today>` i opisz `ROADMAP: flipped <ID> → in-progress.`. Dotknij tylko pola `Status`.
5. Jeśli `git` jest dostępny **i** `ROADMAP_PREDIRTY` było puste, dodaj `context/foundation/roadmap.md` do zestawu zmienionych plików bieżącej fazy, aby zmiana została zatwierdzona wraz z fazą. Jeśli `ROADMAP_PREDIRTY` było niepuste, pozostaw go POZA zestawem zmienionych plików, pozostaw zmianę w drzewie roboczym i opisz `DIRTY (not staged): context/foundation/roadmap.md had pre-existing edits — roadmap flip left in worktree.`.

## Autonomiczny rytuał commitu

Uruchamia się tylko jako krok (d) stosu bramek, po tym, jak każda bramka jest zielona, a zestaw zmienionych plików jest przygotowany (krok 2 stosu bramek). Utwórz jeden commit Conventional-Commits i zapisz końcowy krótki SHA z powrotem do każdego wiersza Progress zmienionego podczas fazy. Żaden krok nie czeka na zatwierdzenie.

1. **Sprawdź pusty diff**: `git diff --cached --quiet`. Kod wyjścia 0 oznacza, że nic nie ma do zatwierdzenia — wydrukuj `Phase <N> had no diff to commit; rows remain SHA-less; archive warn-only will surface them.`, ustaw `SHA=""` i przejdź do kroku 5.

2. **Skomponuj wiadomość**: temat `<type>(<change-id>): <phase title> (p<N>)`, gdzie `<type>` ∈ `feat / fix / chore / refactor / docs` wybrane z natury fazy. Treść: krótka lista zmienionych plików, plus wiersz `Refs:`, jeśli ma zastosowanie. Wydrukuj pełną wiadomość w tekście odpowiedzi przed zatwierdzeniem — to jest zapis w transkrypcji tego, co zostało zatwierdzone i dlaczego.

3. **Commit za pomocą heredoc**:

   ```bash
   git commit -m "$(cat <<'EOF'
   <type>(<change-id>): <phase title> (p<N>)

   <short body listing touched files>
   <Refs: issue/task references, if applicable>
   EOF
   )"
   ```

   Nigdy nie przekazuj flag `--no-verify`, `--amend` ani flag pomijających podpisywanie. Jeśli hook pre-commit się nie powiedzie, commit NIE nastąpił — traktuj błąd hooka jako błąd bramki (ma ten sam budżet 2 prób), napraw podstawowy problem i utwórz NOWY commit.

4. **Zapisz krótki SHA**: `git rev-parse --short HEAD` (pomiń, jeśli `SHA=""`). Opisz go: `COMMIT p<N>: <sha>`.

5. **Zapisz SHA z powrotem do Progress**: dla każdego wiersza zmienionego podczas tej fazy, Edytuj `- [x] N.M <title>` → `- [x] N.M <title> — <SHA>`. Pomiń wiersze, które już zawierają sufiks SHA (bezpieczeństwo wznowienia — nigdy nie dodawaj podwójnie). Jeśli `SHA=""`, pozostaw wiersze bez SHA; `/10x-archive` wyświetli je jako ostrzeżenia informacyjne.

6. **Zaktualizuj `change.md`**: ustaw `updated: <today>`; zachowaj `status: implementing` do ostatniej fazy (patrz "Po wszystkich fazach").

7. **Zresetuj zestaw zmienionych plików** i przejdź bezpośrednio do następnej fazy — bez pauzy, bez punktu decyzyjnego. Przeczytaj sekcję planu następnej fazy, ustaw jej zadanie `in_progress` i kontynuuj.

## Wiersze Manual

Wiersze pod `#### Manual` są jurysdykcją człowieka, nigdy Twoją. Polityka:

- **Nigdy ich nie zmieniaj.** Pozostają `- [ ]` bez względu na to, jak pewny jesteś, że zachowanie działa.
- **Nigdy na nich nie blokuj.** Faza jest zatwierdzana, gdy jej bramki Automated są zielone; jej wiersze Manual nie blokują commitu ani następnej fazy.
- **Zawsze je wyświetlaj.** Podsumowanie bramek każdej fazy wyświetla dosłownie oczekujące wiersze Manual fazy, a raport z przebiegu kończy się pełną listą wszystkich faz — ta lista jest listą kontrolną dla człowieka po zakończeniu.

## Postęp i stan

**Sekcja `## Progress` w `plan.md` jest jedynym źródłem prawdy.** Brak pliku stanu, brak znaczników komentarzy, brak plików pomocniczych. Modyfikuj TYLKO sekcję `## Progress` — bloki faz (Overview, Changes Required, Success Criteria) są tylko do odczytu.

- **Po każdym kroku**: Edytuj dokładnie jeden wiersz, `- [ ] N.M <title>` → `- [x] N.M <title>`. Brak sufiksu SHA w trakcie fazy — SHA ląduje na końcu fazy poprzez rytuał. Ukończone wiersze z `[x]` bez SHA w trakcie fazy są prawidłowym stanem pośrednim.
- **Gdzie jestem** jest wywnioskowane, a nie przechowywane: pierwszy oczekujący Automated `- [ ]` jest następnym krokiem; nagłówek fazy powyżej to bieżąca faza; ukończenie to `count([x]) / count([ ] + [x])`.
- **Wznowienie po STOP** nie wymaga dodatkowego stanu: ponowne wywołanie `/10x-goal-implement <change-id> [phase N]` znajduje pierwszy oczekujący wiersz Automated i kontynuuje. Ufaj istniejącym znacznikom `[x]`; weryfikuj poprzednią pracę tylko wtedy, gdy coś wydaje się nie tak.

### Po wszystkich fazach

Gdy każdy wiersz Automated w całej sekcji `## Progress` jest `- [x]`:

1. Zaktualizuj `change.md`: ustaw `status: implemented`, `updated: <today>`. (NIE ustawiaj `archived_at` — to należy do `/10x-archive`.) Oczekujące wiersze Manual nie blokują tej zmiany; są one wyświetlane w raporcie z przebiegu.
2. **Uruchom commit epilogu** — commit ostatniej fazy nie może zawierać własnego SHA, więc zapis SHA z powrotem plus zmiana statusu `change.md` pozostają brudne po rytuale ostatniej fazy:
   1. Przygotuj dokładnie `context/changes/<change-id>/plan.md` i `context/changes/<change-id>/change.md`.
   2. `git diff --cached --quiet` — jeśli puste, pomiń epilog.
   3. Commit za pomocą heredoc z tematem `chore(<change-id>): close out plan (epilogue)`, treścią odnotowującą końcowy zapis SHA z powrotem + change.md → implemented, plus wiersz `Refs:`, jeśli ma zastosowanie.
   4. NIE zapisuj własnego SHA epilogu z powrotem do planu.
3. Wydrukuj raport z przebiegu.

## Raport z przebiegu

Zakończ każdy przebieg — udany lub zatrzymany — raportem z przebiegu w tekście odpowiedzi. To jest to, co czyta ewaluator celu i powracający człowiek:

```
RUN REPORT — <change-id>

Phases: <completed>/<total>
- Phase 1: <title> — <sha> (gates: <names>: PASS)
- Phase 2: <title> — STOPPED (<reason>)

Adaptations:
- <minor mismatches adapted, one line each — or "none">

Uncertainties:
- <steps marked uncertain and why — or "none">

Pending manual verification (human checklist):
- <phase>.<index> <title>
- ...

Suggested follow-up: /10x-impl-review <change-id>
```

Wymień oczekujące wiersze Manual dosłownie z Progress. Jeśli przebieg został zatrzymany wcześniej, blok STOP poprzedza raport, a raport odzwierciedla uczciwie skrócony stan.

## Zalecane środowisko

Haki per-edycja sprawiają, że ta pętla jest ciaśniejsza: hak PostToolUse uruchamiający lint, typecheck lub testy o ograniczonym zakresie (`vitest related "$FILE" --run`) przy każdej edycji/zapisie wyłapuje dryf sekundy po jego wystąpieniu, zamiast na końcu fazy, a nieudany hak automatycznie wstrzykuje błąd z powrotem do kontekstu. Konfiguracja haka jest własnością pliku `.claude/settings.json` użytkownika — ta umiejętność działa bez żadnych haków; po prostu uruchamia swoje bramki na poziomie fazy tak czy inaczej. Jeśli zauważysz, że takie haki uruchamiają się podczas przebiegu, traktuj ich błędy jak każdy inny błąd bramki (ten sam budżet 2 prób).