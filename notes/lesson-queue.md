# Kolejka lekcji — MealPlan

Plik operacyjny dla sesji autonomicznej. **Stan trzymamy tutaj, nie w pamięci rozmowy** — sesja
przeżyje kompresję kontekstu tylko wtedy, gdy po każdym kroku dopisze wpis do Dziennika na końcu.

Decyzje: [lesson-decisions.md](lesson-decisions.md). Punkt przywracania: **`aea480d`**.

**Cel:** domknąć kurs 10x **na tym projekcie**. Brief z parafrazy streszczenia jest dokumentem,
który udaje wiedzę — wartość powstaje wtedy, gdy narzędzie lekcji zostanie użyte do realnej pracy,
a dopiero potem opisane.

---

## 0. Stan faktyczny — przeczytaj, zanim zaplanujesz cokolwiek

Kurs ma **25 lekcji**. Audyt z 13.09.2026, oparty na artefaktach w repo, nie na pamięci:

| Stan | Ile | Które |
|---|---|---|
| **Domknięte** (narzędzie użyte + brief) | **6** | m1l4, m3l1, m3l2, m3l3, m3l4, m5l5 |
| **Przerobione, brak briefu** | **7** | m1l1–m1l3, m1l5, m2l1–m2l3 |
| **Częściowo przerobione** | **2** | m2l4, m3l5 |
| **Nietknięte** | **10** | m2l5, m4l1–m4l5, m5l1–m5l4 |

**Łańcuch M1 i M2 jest przerobiony od dawna** — dowodem są `prd.md`, `shape-notes.md`,
`tech-stack.md`, `AGENTS.md`, `roadmap.md`, `infrastructure.md`, dwie zmiany przeprowadzone pełnym
łańcuchem `new → research → plan → plan-review → implement → impl-review → archive` oraz
**dziewięć raportów przeglądu** w `context/`. Brakuje tam wyłącznie briefów.

**Dlatego kolejka dzieli pracę na trzy różne rzeczy**, a nie traktuje wszystkiego jako „lekcji
do przerobienia":

- **Grupa A** — brakujące *fragmenty* lekcji częściowo przerobionych. Realna praca.
- **Grupa B** — lekcje nietknięte, które da się uczciwie przerobić na MealPlanie.
- **Grupa C** — briefy z istniejących dowodów. Tanie, domykają rejestr.
- **Grupa D** — wykluczone, z powodem.

---

## 1. Zasady — obowiązują przez całą sesję

**Zakazane bezwarunkowo** (z `CLAUDE.md`):

- `npm install` — psuje `package-lock.json` na Windowsie. Używaj `npm ci`. Playwright stoi
  **poza repo** w `~/.mealplan-e2e`; uruchamiasz przez
  `NODE_PATH="$HOME/.mealplan-e2e/node_modules" npx playwright test`
  ([tests/e2e/README.md](../tests/e2e/README.md)). Po zadaniu `git diff package-lock.json` pusty.
- `npm run reset-project`, `npm audit fix --force`.
- **`10x get` z jakimkolwiek refem** — synchronizuje `.claude/skills/` do manifestu tej lekcji
  i **kasuje resztę**. Wszystkie 30 skilli są zainstalowane. Nie ma powodu tego uruchamiać,
  nawet żeby „dociągnąć treść lekcji" (patrz Grupa C).
- Zmiana `slug` / `scheme` w `app.json`, usuwanie reguł `rules` z `wrangler.jsonc`.

**`git add -A` jest zakazane.** Stage'uj **po ścieżkach**, które sam zmieniłeś, i wypisz je
w Dzienniku. 13.09 `git add -A` wciągnęło na `main` niedokończony plik innej sesji.

**Znacznik czasu z `date -u +%H:%M`, nigdy z oszacowania.** Nocna sesja czterokrotnie wpisała
czas z przyszłości albo lokalny zamiast UTC.

**Bramki lokalne są od 13.09 zautomatyzowane** (`scripts/hooks/`, `hooks/`): hook po edycji,
`pre-commit` na indeksie, `pre-push` na drzewie. Jeśli bramka krzyczy — **nie obchodź jej**,
napraw przyczynę. `--no-verify` jest zakazane.

**Uczciwość weryfikacji — reguła nadrzędna:**

- Odhaczasz **wyłącznie** po zobaczeniu wyniku. Nigdy „powinno działać".
- Czego nie da się zrobić uczciwie → napisz **dlaczego** i idź dalej. Nie zmyślaj zieleni.
- Dwie nieudane próby tego samego → wpis w Dzienniku, następne zadanie.
- Nowej bramki nie uznawaj za działającą, zanim nie zobaczysz jej **czerwonej po celowym
  zepsuciu** (wpis w `lessons.md` z 13.09 — zielony przebieg nie dowodzi, że cokolwiek się wykonało).

**Decyzje:** masz mandat. Każdą nietrywialną dopisz do `lesson-decisions.md` (Co / Powód / Jak cofnąć).

**Git:** commit po każdym zadaniu, stage po ścieżkach. Push na `main` **wdraża natychmiast** —
pushuj po zielonych bramkach, nigdy w środku zadania.

**Produkcja:** testy przeciw lokalnemu `wrangler dev`. **Zapis do produkcyjnej D1 wymaga zgody
człowieka**; po weryfikacji posprzątaj i zapisz to w Dzienniku.

**Pułapki zmierzone, nie teoretyczne:**

- `wrangler dev` trzyma `dist/client` — **zatrzymaj go przed `expo export`**, inaczej build padnie
  na EBUSY, a testy pojadą przeciw staremu artefaktowi. Po przebudowie potwierdź `grep`-em,
  że zmiana jest w `dist/`.
- Harness używa **`localhost`**, nie `127.0.0.1` — `azp` porównywane jako łańcuch znaków.
- Emulator: przy `FATAL … multiple emulators` ubij `emulator.exe` **i dopiero potem** usuń
  `hardware-qemu.ini.lock` i `multiinstance.lock`. DNS domyślny wystarcza, VPN rozłączony.
- `toLocaleString('pl-PL')` **grupuje na Androidzie, nie grupuje w przeglądarce**.

---

## 2. Preflight

```sh
cd "C:/Prywatne/Dieta 2"
git status --short && git log --oneline -3    # cudze zmiany? nie commituj ich
npx tsc --noEmit && npm test && npm run check-lock
```

Jeśli ktoś pracuje równolegle w tym drzewie — ustal podział albo poczekaj.

---

## 3. Grupa A — brakujące fragmenty lekcji częściowo przerobionych

### A1 — m2l4: badanie zewnętrzne i `/10x-frame` (limit 90 min)

**Co z lekcji już jest:** badanie **wewnętrzne** (`/10x-research`) — `research.md` dla F-01.
**Czego brakuje:** badania **zewnętrznego** (Context7, exa.ai) i `/10x-frame` — w repo nie ma
**ani jednego** `frame.md`.

**Realna luka:** `context/changes/dietary-preferences/` nie ma `research.md`. Plan S-03 powstał
z samej decyzji D14, bez ugruntowania.

**Zadanie:**
1. `/10x-research dietary-preferences` — ugrunt: wzorzec `profile+api.ts`, ścieżka zapisu,
   `ChoiceField`, stan dostępności pól.
2. **Oba źródła zewnętrzne, obowiązkowo:** Context7 na `expo-router` (zakładki, typed routes
   w SDK 57); exa.ai na wzorce UI wykluczeń składnikowych — wyszukiwarka z listy kontra wolny
   tekst. To jest **jawnie otwarte ryzyko** planu S-03 („użytkownik myśli »grzyby«, a w bazie
   są »pieczarki, świeże«").
3. Zaktualizuj plan S-03 tam, gdzie badanie go koryguje.

**Gotowe, gdy:** `research.md` istnieje, cytuje `plik:linia` i **osobno oznacza**, co pochodzi
z bazy kodu, a co z zewnątrz; w planie widać poprawkę z badania albo jawne zdanie, że badanie
planu nie zmieniło i dlaczego.

**`/10x-frame` tylko wtedy, gdy się przyda** — to koło zapasowe na plan, który się nie zbiega.
Jeśli S-03 zbiega się bez problemu, **nie wymuszaj go**; zapisz w briefie, że lekcja przewiduje
go na inną sytuację. Wymuszone użycie byłoby teatrem.

### A2 — m3l5: debugging ze zbieżnością dowodów (limit 90 min)

**Co z lekcji już jest:** debugging-as-test w praktyce — wyścig F1 stał się czerwonym testem,
potem poprawką, a test regresji został (`tests/e2e/profile-screen.spec.ts`).
**Czego brakuje:** świadomej zbieżności **wielu źródeł** zamiast jednego, i briefu.

**Czego nie mamy:** Sentry. Zostają trzy źródła: `npx wrangler tail`, harness E2E i kod.
**Powiedz to w briefie**, nie udawaj czwartego.

**Realny defekt do naprawienia** — oba zostawione jako PENDING w przeglądzie fazy 3
(`context/archive/2026-09-12-profile-and-calorie-target/reviews/impl-review-phase-3.md`):

- **F4** — nieliczbowy tekst w „Własny cel" (np. „abc") **znika bez komunikatu**;
  `parseNumberInput` zwraca `null`, co znaczy „brak nadpisania". Użytkownik traci wpisaną wartość.
- **F5** — błędne **wyłącznie** nadpisanie gasi cały podgląd wyliczenia, a wiersz „Wróć do
  wyliczenia" znika, gdy niepoprawne jest inne pole — użytkownik z zapisanym nadpisaniem nie ma
  jak do niego wrócić.

**Zadanie:** wybierz jeden (F4 prostszy, F5 dotkliwszy), przejdź pełną pętlą: reprodukcja
→ czerwony test → poprawka → zielony → **próba celowego zepsucia**. W briefie opisz, które źródło
dało sygnał jako pierwsze.

### A3 — m2l5: worktree na realnej zmianie (limit 60 min)

**Co z lekcji już jest:** nic. `git worktree list` pokazuje wyłącznie główne drzewo.
Równoległość owszem wystąpiła — ale **przypadkiem**, i 13.09 kosztowała cudzy plik w commicie
na `main`.

**Zadanie:**
1. Przeprowadź **F-01 fazę 2** (czyste moduły `dish-macros` + `dish-validation` z testami —
   w pełni automatyczna, zero zależności od treści dań) w osobnym `git worktree`.
2. Zapisz **regułę współpracy** w `CLAUDE.md`: kiedy worktree jest obowiązkowy, jak stage'ować
   w dzielonym drzewie, jak rozpoznać cudze zmiany. Osobny commit.

**Sedno lekcji, którego nie pomiń:** równoległość ogranicza się do **przepustowości przeglądu**.
Więcej agentów bez przeglądu to więcej nieprzejrzanego kodu — a to repo ma już dowód, że
nieprzejrzana faza trafia na produkcję (faza 1 F-01, patrz C1).

---

## 4. Grupa B — lekcje nietknięte, wykonalne tutaj

### B1 — m5l3: bramka jakości w CI (limit 90 min)

**Realna luka, potwierdzona przeglądem reguł:** CI tego repo to Cloudflare Workers Builds
i **nie uruchamia lintu, typechecku ani testów**. Od 13.09 bronią tego hooki lokalne — ale hook
da się pominąć, a CI nie.

**Zadanie:** workflow GHA na push i PR do `main`: `npm ci`, `npx tsc --noEmit`, `npx expo lint`,
`npm test`, `npm run check-lock`.

**Trzy rzeczy do rozstrzygnięcia i zapisania jako decyzja:**
1. GHA **nie może wdrażać** — wdrożeniem zajmuje się Workers Builds. To bramka, nie drugi deploy.
2. `npm ci` na Linuksie to dokładnie ten scenariusz, który psuje `npm install` na Windowsie —
   workflow jest **najlepszym możliwym testem lockfile'a**. Napisz to w briefie.
3. E2E **nie wchodzi** — Playwright jest poza `package.json`, a wciągnięcie go złamałoby regułę
   lockfile'a. Zapisz jako świadome ograniczenie.

**Gotowe, gdy:** workflow **przeszedł na prawdziwym pushu** — albo jawnie napisz, że nie dało się
go uruchomić i dlaczego.

### B2 — m4l1: skalowanie kontekstu (limit 60 min)

**Realna luka:** przegląd reguł dał `CLAUDE.md` **WARN na długość** (272 linie niepuste przy progu
200) i zostawił **trzy niewykonane propozycje** ([claude-md-rule-review.md](claude-md-rule-review.md)):
podnieść trzy reguły niszczące do „Twardych reguł", odzyskać 34 linie z bloku `10x-cli`, usunąć
duplikaty `Spacing` i listy wariantów `ThemedText`.

**Pułapka:** blok `10x-cli` jest **generowany** — skasowanie wróci przy następnym `10x get`,
a jedyny wskaźnik na `lessons.md` siedzi właśnie w nim. Przenieś go do „Dokumentów projektu",
**zanim** cokolwiek usuniesz.

Osobny commit. Po zmianie uruchom `/10x-rule-review CLAUDE.md` ponownie i **porównaj kartę
wyników z poprzednią** — to jest dowód, nie deklaracja.

---

## 5. Grupa C — briefy z istniejących dowodów

Lekcje **przerobione dawno, bez briefu**. Zadanie jest tanie: opisać, co lekcja zostawiła
w tym projekcie. Jeden brief = jeden commit.

### C1 — m2l3: przegląd kodu (limit 60 min)

**Mam treść lekcji** (streszczenie w scratchpadzie sesji nocnej) **i dziewięć raportów** jako
materiał: cztery `impl-review` S-01, trzy S-02, dwa `plan-review`.

**Ale jest też realna luka:** **faza 1 F-01** (migracja `0003`, typ D1 z `all()`) weszła 13.09
i **nie była recenzowana**, a jest na produkcji. Więc: najpierw
`/10x-impl-review dish-source-and-seed-pool phase 1` z triażem, potem brief — z ośmiu przeglądów,
nie z jednego.

**Uwaga:** przegląd ma prawo zakwestionować odstępstwo od planu (`prep_minutes` bez zakresu 5–120
w `CHECK`). Rozstrzygnij i zapisz, nie broń decyzji z rozpędu.

### C2 — m1l1, m1l2, m1l3, m1l5, m2l1, m2l2 (limit 30 min łącznie)

**Problem, który musisz obejść uczciwie:** treści tych lekcji **nie ma lokalnie** — pobrane
zostały tylko m2l3→m5l5. Odtworzenie ich przez `10x get` jest **zakazane** (skasuje skille).

**Dlatego te briefy mają inny kształt** i inny nagłówek — nie „co lekcja wprowadza", tylko:

> **Co ta lekcja zostawiła w tym projekcie** — brief odtworzony z artefaktów, nie z treści lekcji.
> Treść lekcji nie jest dostępna lokalnie.

Zawartość: jakie artefakty powstały, jakie decyzje w nich widać, co z nich obowiązuje do dziś.
Materiał: `shape-notes.md`, `prd.md`, `tech-stack.md`, `bootstrap-verification/verification.md`,
`infrastructure.md`, `roadmap.md`, `context/archive/2026-08-31-account-and-login/`.

**Każdy brief ma jawnie mówić, że jest rekonstrukcją.** Brief udający relację z lekcji, której
nie widziałeś, jest dokładnie tym, czego ta kolejka ma unikać.

**Jeśli uznasz, że taka rekonstrukcja nie ma wartości — napisz to w Dzienniku i pomiń.**
To jest dopuszczalny wynik; sześć plików „dla kompletu" nikomu nie służy.

---

## 6. Grupa D — wykluczone, z powodem

Dla każdej krótki, uczciwy brief (~25–40 linii): **co lekcja wprowadza** → **dlaczego nie daje się
przerobić na MealPlanie** → **co musiałoby być prawdą** → **co z niej zabieram mimo to**.
Treść tych lekcji **jest** w scratchpadzie sesji nocnej, więc pierwsza sekcja stoi na materiale.

| Lekcja | Powód |
|---|---|
| **m4l2** Mapa projektu | Celuje w nieznane repo legacy. MealPlan ma 39 plików w `src/`, historię decyzji w `context/` i `CLAUDE.md` opisujący architekturę. „Wide Scan → Deep Focus" nie ma czego odkryć. |
| **m4l3** Analiza feature | Wymaga mapy z m4l2 jako pakietu wejściowego. |
| **m4l4** Refaktoryzacja | Zakłada zastane problemy strukturalne. Repo ma 34 testy, świeży przegląd i zero długu, którego nikt nie nazwał. |
| **m4l5** Modernizacja z DDD | Zakłada domenę, której kod nigdy nie nazwał. Tu domena jest nazwana w PRD i `options.md`, a kodu domenowego prawie nie ma. |
| **m5l1** Internal Builders | Dotyczy tarcia zespołowego, nie tego produktu. |
| **m5l2** Agent zespołowy z SDK | Buduje osobny artefakt, nie zmianę w MealPlanie. Sensowne dopiero razem z B1. |
| **m5l4** Shared AI Registry | Dystrybucja artefaktów dla zespołu. Projekt jednoosobowy. |

**Jeśli przy pisaniu odkryjesz, że lekcja JEDNAK się nadaje** — przerób ją i napisz z doświadczenia.
Ta tabela jest oceną, nie wyrokiem; zapisz wtedy decyzję o zmianie zdania.

---

## 7. Zapas

Po jednej rzeczy, commit po każdej:

- **Dostępność formularzy** (ustalenie F6) — `TextField` nie nadaje polom nazw; czytnik ekranu
  czyta „pole edycji" cztery razy, a harness adresuje je pozycyjnie. Naprawa w dwóch prymitywach
  pozwala skasować obejścia w `tests/e2e/support/profile-form.ts`.
- **Osierocone `assets/images/tabIcons/explore*.png`** (ustalenie F7) — bez importera od fazy 3.
- **F-01 faza 2**, jeśli nie poszła przez A3.

**Nie wymyślaj nowego zakresu produktowego.** Poza MVP: dziennik jedzenia, śledzenie wagi, plan
miesięczny, FR-005, FR-015. **Generatora planu (S-04) nie implementuj** — czeka na pulę dań.

---

## 8. Dziennik

Dopisuj po **każdym** zadaniu i przy każdej blokadzie. Znacznik z `date -u +%H:%M`.

```
### <HH:MM UTC> — <ID> <tytuł>
Wynik: ok | blocked | failed | pominięte
Co zrobione: <jedno–trzy zdania>
Co zacommitowane: <ścieżki — dowód, że nie było `git add -A`>
Commit: <sha albo ->
Do decyzji: <albo ->
```

<!-- DZIENNIK PONIŻEJ -->

### 10:47 UTC — preflight
Wynik: ok
Co zrobione: Drzewo czyste (`git status --short` pusty, HEAD `288916a`). Trzy bramki zielone:
`npx tsc --noEmit` bez błędów, `npm test` 34/34, `npm run check-lock` — 1127 pakietów spójnych.
`core.hooksPath` wskazuje na `hooks/`, więc warstwy 2 i 3 są aktywne w tym klonie.
Co zacommitowane: notes/lesson-queue.md
Commit: (poniżej)
Do decyzji: -
