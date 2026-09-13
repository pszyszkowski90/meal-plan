# Kolejka lekcji — MealPlan

Plik operacyjny dla sesji autonomicznej. **Stan trzymamy tutaj, nie w pamięci rozmowy** — sesja
przeżyje kompresję kontekstu tylko wtedy, gdy po każdym kroku dopisze wpis do Dziennika na końcu.

Decyzje i ich uzasadnienia: [lesson-decisions.md](lesson-decisions.md).
Punkt przywracania przed startem: **`974e38b`**.

**Cel kolejki:** przerobić pozostałe lekcje kursu 10x **na tym projekcie**, a nie streścić je
z opisu. Brief napisany z parafrazy streszczenia CLI jest dokumentem, który udaje wiedzę — nocna
sesja odrzuciła 14 takich briefów właśnie z tego powodu. Wartość powstaje wtedy, gdy narzędzie
lekcji zostanie użyte do realnej pracy w repo, a dopiero potem opisane.

**Stan wyjściowy:** przerobione i opisane są **4 z 18** lekcji (m3l1, m3l2, m3l4, m5l5) — briefy
w `notes/10x-lesson-*-brief.md`. Skille wszystkich 18 lekcji są już zainstalowane (30 sztuk);
**sieć i autoryzacja 10x nie są do niczego potrzebne**.

---

## 0. Warunek startu — przeczytaj, zanim cokolwiek zrobisz

> **W tym drzewie pracuje więcej niż jedna sesja.** 13.09.2026 sesja `dieta-2-d4` budowała hooki
> jakości (`scripts/check-conventions.js`, `scripts/hooks/`, `hooks/`), a inna sesja zgarnęła jej
> plik do swojego commitu przez `git add -A`. Zanim ruszysz:
>
> 1. `git status --short` — jeśli widzisz zmiany, których **nie zrobiłeś**, NIE commituj ich.
> 2. Sprawdź, czy ktoś pracuje równolegle (lista sesji w narzędziu hosta).
> 3. Jeśli tak — ustal podział albo poczekaj. Dwie sesje w jednym drzewie rozjadą `## Progress`,
>    historię gita i stan tej kolejki.

---

## 1. Zasady — obowiązują przez całą sesję

**Zakazane bezwarunkowo** (z `CLAUDE.md`, złamanie psuje repo):

- `npm install` — psuje `package-lock.json` na Windowsie. Używaj `npm ci`.
  **Playwright instaluj POZA projektem**; harness stoi w `~/.mealplan-e2e`, uruchamiasz go przez
  `NODE_PATH="$HOME/.mealplan-e2e/node_modules" npx playwright test` — instrukcja
  w [tests/e2e/README.md](../tests/e2e/README.md). Po zadaniu `git diff package-lock.json` pusty.
- `npm run reset-project`, `npm audit fix --force`.
- `10x get` z jakimkolwiek refem — **synchronizuje `.claude/skills/` do manifestu tej lekcji
  i kasuje resztę**. Wszystko jest pobrane; nie ma powodu tego uruchamiać.
- Zmiana `slug` / `scheme` w `app.json`, usuwanie reguł `rules` z `wrangler.jsonc`.

**`git add -A` jest zakazane.** Stage'uj **po ścieżkach**, które sam zmieniłeś. To nie jest
pedanteria: 13.09 `git add -A` wciągnęło do commitu na `main` niedokończony plik innej sesji.
Przed każdym commitem przeczytaj `git status --short` i wypisz w Dzienniku, co commitujesz.

**Znacznik czasu bierzesz z `date -u +%H:%M`, nigdy z oszacowania.** Nocna sesja czterokrotnie
wpisała do Dziennika czas z przyszłości albo lokalny zamiast UTC. Znacznik jest dla człowieka
sygnałem, czy sesja żyje — zmyślony jest gorszy niż żaden.

**Uczciwość weryfikacji — reguła nadrzędna:**

- Odhaczasz **wyłącznie** po zobaczeniu wyniku. Nigdy „powinno działać".
- Czego nie da się zrobić uczciwie → napisz **dlaczego**, i idź dalej. Nie zmyślaj zieleni.
- Dwie nieudane próby tego samego → wpis w Dzienniku, następne zadanie. Bez zapętlania.
- **Lekcja, której nie da się przerobić na tym projekcie, ma o tym powiedzieć wprost.**
  Format uczciwego briefu dla takiej lekcji jest w sekcji 4.

**Decyzje:** masz mandat na samodzielne rozstrzyganie. Każdą nietrywialną dopisz do
`lesson-decisions.md` w formacie Co / Powód / Jak cofnąć. Decyzja bez zapisu = decyzja niepodjęta.

**Git:** commit po każdym ukończonym zadaniu, stage po ścieżkach. Push na `main` **wdraża
natychmiast** — więc pushuj dopiero po zielonych bramkach i nigdy w środku zadania.

**Produkcja:** testy przeciw lokalnemu `wrangler dev`, nie produkcji. **Zapis do produkcyjnej D1
wymaga zgody człowieka**; jeśli ją dostaniesz, posprzątaj po sobie i zapisz to w Dzienniku.

**Pułapki zmierzone, nie teoretyczne** — łamanie ich kosztowało już czas:

- `wrangler dev` trzyma `dist/client`; **zatrzymaj go przed `expo export`**, inaczej build padnie
  na EBUSY, a testy pojadą przeciw **staremu** artefakcie i zielony wynik nie będzie nic znaczył.
  Po przebudowie potwierdź, że zmiana jest w `dist/` (np. `grep`).
- Harness używa `http://localhost:8787`, **nie `127.0.0.1`** — `azp` porównywane jest jako łańcuch
  znaków, więc pod `127.0.0.1` każde uwierzytelnione żądanie dostaje 401 bez wskazówki.
- Emulator: jeśli `FATAL … multiple emulators`, ubij `emulator.exe` **i dopiero potem** usuń
  `hardware-qemu.ini.lock` i `multiinstance.lock` z `~/.android/avd/mealplan35.avd/`. Kolejność
  ma znaczenie — przy żywym procesie usunięcie nie przechodzi. DNS: **domyślny wystarcza**,
  VPN ma być rozłączony.
- `toLocaleString('pl-PL')` **grupuje na Androidzie, nie grupuje w przeglądarce**. Nie zakładaj
  jednego zachowania.

---

## 2. Preflight

```sh
cd "C:/Prywatne/Dieta 2"
git status --short && git log --oneline -3      # cudze zmiany? patrz sekcja 0
npx tsc --noEmit
npm test                                        # 34 testy
npm run check-lock
```

Harness E2E (opcjonalnie, gdy zadanie go dotyczy):

```sh
npx expo export -p web && npx wrangler dev --port 8787      # w osobnym oknie
cd ~/.mealplan-e2e && NODE_PATH="$HOME/.mealplan-e2e/node_modules" npx playwright test   # 21 testów
```

---

## 3. Kolejka zadań — lekcje wykonalne na MealPlanie

Kolejność jest celowa: najpierw te, które domykają realne luki w projekcie.

### L1 — m2l4: Research Toolkit (limit 90 min)

**Czego uczy:** rozróżnienie badania wewnętrznego (`/10x-research` po bazie kodu) od zewnętrznego
(Context7 — żywa dokumentacja bibliotek, exa.ai — wyszukiwanie), i połączenie obu jako dowodu
wejściowego do `/10x-plan`. `/10x-frame` jako koło zapasowe, gdy plan nie chce się zbiec.

**Realna luka do domknięcia:** `context/changes/dietary-preferences/` **nie ma `research.md`** —
plan powstał w nocy z samej decyzji D14, bez badania. To jedyna aktywna zmiana bez ugruntowania.

**Zadanie:**
1. `/10x-research dietary-preferences` — ugruntuj: gdzie realnie stoi granica danych (wzorzec
   `profile+api.ts`), jak wygląda ścieżka zapisu, czym jest `ChoiceField`, co z dostępnością pól.
2. **Badanie zewnętrzne, obowiązkowo oba źródła:** Context7 na `expo-router` (wzorzec zakładek
   i typed routes w SDK 57) oraz na Clerku, jeśli dotknie sesji; exa.ai na wzorce UI wykluczeń
   składnikowych (wyszukiwarka z listy kontra wolny tekst — to jest otwarte ryzyko planu S-03).
3. Zapisz `research.md` i **zaktualizuj plan S-03** tam, gdzie badanie go koryguje.

**Gotowe, gdy:** `research.md` istnieje, cytuje `plik:linia`, a w planie widać co najmniej jedną
poprawkę wynikającą z badania (albo jawne zdanie, że badanie planu nie zmieniło i dlaczego).

### L2 — m2l3: Solo Code Review (limit 60 min)

**Czego uczy:** `/10x-impl-review` jako bramka przed scaleniem — sześć wymiarów, triaż ustalenie
po ustaleniu, macierz ważność × wpływ, świadome pomijanie jako **prawidłowy** wynik.

**Realna luka:** **faza 1 F-01** (migracja `0003`, typ D1 z `all()`) weszła 13.09 i **nie była
recenzowana**. Jest na produkcji.

**Zadanie:** `/10x-impl-review dish-source-and-seed-pool phase 1`, potem triaż każdego ustalenia
z jawnym wynikiem (napraw / pomiń / zaakceptuj ryzyko / nie zgadzam się). Raport do
`context/changes/dish-source-and-seed-pool/reviews/`.

**Uwaga:** przegląd ma prawo zakwestionować moje odstępstwo od planu (`prep_minutes` bez zakresu
5–120 w `CHECK`) — jeśli tak, rozstrzygnij i zapisz, nie broń decyzji z rozpędu.

### L3 — m3l5: Debugging with AI (limit 90 min)

**Czego uczy:** zbieżność dowodów z czterech źródeł (monitoring, logi, reprodukcja w Playwrighcie,
kod) zamiast wklejania stack trace'a. **Debugging-as-test**: błąd najpierw staje się czerwonym
testem, dopiero potem powstaje poprawka, a test zostaje jako regresja.

**Czego NIE mamy:** Sentry. Zostają trzy źródła: `npx wrangler tail`, harness E2E i kod —
**powiedz to w briefie**, nie udawaj czwartego.

**Realny defekt do naprawienia** (z przeglądu fazy 3, oba zostawione jako PENDING):
- **F4** — nieliczbowy tekst w „Własny cel" (np. „abc") **znika bez komunikatu**, bo
  `parseNumberInput` zwraca `null`, czyli „brak nadpisania". Użytkownik traci wpisaną wartość.
- **F5** — błędne **wyłącznie** nadpisanie gasi cały podgląd wyliczenia, a wiersz „Wróć do
  wyliczenia" znika, gdy niepoprawne jest inne pole — użytkownik z zapisanym nadpisaniem nie ma
  jak do niego wrócić.

**Zadanie:** wybierz jeden (F4 jest prostszy, F5 bardziej dotkliwy), przejdź pełną pętlą:
czerwony test → poprawka → zielony → próba celowego zepsucia. Raport z przebiegu w briefie.

### L4 — m5l3: Code Review w pipeline (limit 90 min)

**Czego uczy:** GitHub Actions od podstaw, minimalny `review.yml` na PR, wyciągnięcie agenta do
Composite Action przypiętej do **SHA, nie ruchomego tagu**.

**Realna luka, potwierdzona przeglądem reguł:** CI tego repo to Cloudflare Workers Builds
i **nie uruchamia ani lintu, ani typechecku, ani testów**. Bramki lokalne są jedyną obroną,
a `CLAUDE.md` mówi wprost „Typecheck i lint nadal uruchamiasz sam przed pushem".

**Zadanie:** workflow GHA, który na push i PR do `main` uruchamia `npm ci`, `npx tsc --noEmit`,
`npx expo lint`, `npm test`, `npm run check-lock`.

**Trzy rzeczy do rozstrzygnięcia i zapisania jako decyzja:**
1. Czy GHA **nie koliduje** z Workers Builds (dwa CI na jednym repo — to ma być bramka jakości,
   nie drugie wdrożenie; workflow **nie wdraża**).
2. `npm ci` na Linuksie to dokładnie ten scenariusz, który psuje `npm install` na Windowsie —
   workflow jest więc **najlepszym możliwym testem lockfile'a**. Powiedz to w briefie.
3. E2E **nie wchodzi** do CI w tym zadaniu — Playwright jest poza `package.json`, a jego wciągnięcie
   złamałoby regułę lockfile'a. Zapisz to jako świadome ograniczenie.

**Gotowe, gdy:** workflow istnieje i **przeszedł na prawdziwym pushu** (albo jawnie napisz, że nie
dało się go uruchomić i dlaczego).

### L5 — m2l5: Multi-agent i worktrees (limit 60 min)

**Czego uczy:** git worktrees do izolacji kodu, wybór między `/10x-implement`, `/goal`
i `claude -p`, oraz **ograniczenie równoległości do przepustowości przeglądu** — więcej agentów
bez przeglądu to więcej nieprzejrzanego kodu.

**Dlaczego akurat teraz:** 13.09 dwie sesje pracowały w jednym drzewie i jedna zgarnęła plik
drugiej do commitu na `main`. Ta lekcja jest odpowiedzią na problem, który już wystąpił.

**Zadanie:** przerób jedną zmianę przez `git worktree` (kandydat: F-01 faza 2 — czyste moduły
`dish-macros` i `dish-validation`, w pełni automatyczna i niezależna od treści dań), a potem
**zapisz regułę współpracy** w `CLAUDE.md`: kiedy worktree jest obowiązkowy, jak stage'ować
w dzielonym drzewie, jak rozpoznać cudze zmiany. Zmiana `CLAUDE.md` — osobny commit.

### L6 — m4l1: Skalowanie kontekstu (limit 60 min)

**Czego uczy:** dlaczego monolityczny plik reguł degraduje wyniki agenta (skończony budżet uwagi,
context rot) i jak rozdzielić chudy korzeń odsyłający do `context/` jako systemu zapisu.

**Realna luka:** przegląd reguł z 13.09 dał `CLAUDE.md` **WARN na długość** (272 linie niepuste
przy progu 200) i zostawił **trzy niewykonane propozycje**:
1. podnieść trzy reguły niszczące do „Twardych reguł" (warunek produkcyjny przed commitem,
   `expo start --web` to nie test wdrożenia, `10x get` kasuje skille),
2. odzyskać 34 linie z bloku generowanego przez `10x-cli`,
3. usunąć duplikaty wartości `Spacing` i listy wariantów `ThemedText`.

Raport: [claude-md-rule-review.md](claude-md-rule-review.md).

**Zadanie:** wykonaj te trzy propozycje w duchu lekcji. **Uwaga na pułapkę:** blok `10x-cli` jest
generowany — skasowanie wróci przy następnym `10x get`, a jedyny wskaźnik na `lessons.md` siedzi
właśnie w nim. Przenieś go do „Dokumentów projektu", **zanim** cokolwiek usuniesz.
Zmiana `CLAUDE.md` — osobny commit. Po zmianie uruchom `/10x-rule-review CLAUDE.md` ponownie
i porównaj kartę wyników z poprzednią.

---

## 4. Lekcje wykluczone — z powodem, nie z lenistwa

Dla każdej z nich napisz **krótki, uczciwy brief** (`notes/10x-lesson-<ref>-brief.md`, ~25–40 linii)
w formacie: **co lekcja wprowadza** → **dlaczego nie daje się przerobić na MealPlanie** →
**co musiałoby być prawdą, żeby dała** → **co z niej zabieram mimo to**. Bez udawania, że
ćwiczenie się odbyło.

| Lekcja | Powód wykluczenia |
|---|---|
| **m3l3** Hooks and Triggers | **Robi to teraz inna sesja** (`scripts/check-conventions.js`, `scripts/hooks/`, `hooks/`). Nie duplikuj. Gdy tamta praca wyląduje, napisz brief **z jej efektu** — to wtedy lekcja przerobiona, tylko nie twoimi rękami. Odnotuj to uczciwie. |
| **m4l2** Mapa projektu | Celuje w nieznane repo legacy. MealPlan ma 39 plików w `src/`, pełną historię decyzji w `context/` i `CLAUDE.md` opisujący architekturę. „Wide Scan → Deep Focus" nie ma czego odkryć. |
| **m4l3** Analiza feature | Wymaga mapy z m4l2 jako pakietu wejściowego. |
| **m4l4** Refaktoryzacja | Zakłada zastane problemy strukturalne do uszeregowania. Repo ma 34 testy, świeży przegląd i zero długu, którego nikt nie nazwał. |
| **m4l5** Modernizacja legacy z DDD | Zakłada domenę, której kod nigdy nie nazwał. Tutaj domena jest nazwana w PRD i `options.md`, a kodu domenowego prawie nie ma. |
| **m5l1** Internal Builders | Dotyczy tarcia zespołowego i narzędzi wewnętrznych, nie tego produktu. |
| **m5l2** Agent zespołowy z SDK | Buduje osobny artefakt (agent recenzujący), nie zmianę w MealPlanie. Sensowne dopiero razem z m5l3. |
| **m5l4** Shared AI Registry | Dystrybucja artefaktów dla zespołu. Projekt jest jednoosobowy. |

**Jeśli przy pisaniu któregoś briefu odkryjesz, że lekcja JEDNAK daje się przerobić** — przerób ją
i napisz z doświadczenia. Ta tabela jest oceną, nie wyrokiem; zapisz wtedy decyzję o zmianie zdania.

---

## 5. Zapas (gdy zostanie czas)

Po jednej rzeczy, commit po każdej:

- **F-01 faza 2** — `dish-macros` + `dish-validation` z testami (jeśli nie poszła przez L5).
- **Dostępność formularzy** — `TextField` nie nadaje polom nazw; czytnik ekranu czyta „pole edycji"
  cztery razy, a harness adresuje je pozycyjnie. Naprawa w dwóch prymitywach pozwala skasować
  obejścia w `tests/e2e/support/profile-form.ts`. Ustalenie F6 przeglądu fazy 3.
- **Osierocone `assets/images/tabIcons/explore*.png`** — bez importera od fazy 3 (ustalenie F7).

**Nie wymyślaj nowego zakresu produktowego.** Poza MVP zostają: dziennik jedzenia, śledzenie wagi,
plan miesięczny, FR-005, FR-015. Generatora planu (S-04) **nie implementuj** — czeka na pulę dań.

---

## 6. Dziennik

Dopisuj po **każdym** zadaniu i przy każdej blokadzie. Znacznik z `date -u +%H:%M`.

```
### <HH:MM UTC> — <L#> <tytuł>
Wynik: ok | blocked | failed
Co zrobione: <jedno–trzy zdania>
Co zacommitowane: <ścieżki — dowód, że nie było `git add -A`>
Commit: <sha albo ->
Do decyzji: <albo ->
```

<!-- DZIENNIK PONIŻEJ -->
