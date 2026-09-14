# Kolejka: dług przeglądowy, domknięcie S-03 i pula dań

Plik operacyjny i **jedyne źródło stanu** tej paczki prac — jak `cert-queue.md` dla nocy z 13.09.
Sesja przeżyje kompresję kontekstu tylko wtedy, gdy po każdym kroku dopisze wpis do Dziennika
na końcu. Nie trzymaj stanu w pamięci rozmowy.

Kolejność jest uszeregowana **kosztem niezrobienia**, nie tematem.

## Jak to uruchomić

```
/loop Wykonuj kolejne zadanie z notes/pool-queue.md. Trzymaj się sekcji Zasady. Po każdym zadaniu dopisz wpis do Dziennika na końcu pliku, otwórz PR, przeczytaj werdykt przeglądu i scal po zielonych bramkach. Nie zaczynaj P6 i nie czekaj na decyzje właściciela z sekcji 4 — pomiń, co zablokowane, i opisz to w Dzienniku.
```

Kolejne zadanie do wzięcia: **P4**. P1, P2 i P3 są zrobione (patrz Dziennik).

---

## 0. Stan wyjściowy — zmierzony 14.09.2026, nie założony

| Co | Stan |
|---|---|
| `main` | `7dcaad6`; PR-y #14–#17 scalone 14.09 rano |
| Produkcja | zdrowa: `/api/health` → `{"ok":true,"d1":true}` |
| D1 produkcyjna | **0 dań**, 35 składników, 8 grup wykluczeniowych, 20 przypisań |
| Migracje `--remote` | `0001`–`0005` wszystkie zastosowane |
| S-03 faza 2 | przegląd był `REJECTED` — **wszystkie sześć ustaleń rozliczone 14.09**, zero `PENDING` |
| Bramka przeglądu | **działała pozornie**; trzy defekty naprawione 14.09 (#15, #17) — szczegóły w §1 |
| F-01 | fazy 1 i 2 zrobione, **faza 2 nieprzejrzana**, fazy 3 i 4 zerowe |
| `seed/` | **nie istnieje**; w `scripts/` jest tylko `seed-ingredients.mjs` |
| `roadmap.md` | F-01 `planning` (jest `implementing`), S-03 `planning` (jest po fazie 2) |
| `test-plan.md` §3 | fazy 2–4 `not started`, choć faza 4 (bramki w CI) działa od 13.09 |
| E2E | 42 testy, pełny zestaw zielony; `npm test` 100/100 |


**Co się zmieniło po P3 (14.09, po scaleniu #20–#22)** — reszta tabeli wyżej zostaje jako
migawka z rana, nie przepisuj jej:

| Co | Stan |
|---|---|
| `main` | `c8ba60a`; produkcja zdrowa (`/api/health` → `{"ok":true,"d1":true}`, `/` 200, 404 dla nieznanej, `/api/account` 401) |
| S-03 | **zamknięte i zarchiwizowane** — `context/archive/2026-09-13-dietary-preferences/` |
| E2E | **44 testy** (było 42), pełny zestaw zielony; `npm test` 100/100 |
| Konto testowe B | istnieje, poświadczenia w `.env` harnessu (`MEALPLAN_E2E_*_B`), poza repo |
| Bramka przeglądu | czwarty defekt naprawiony (#21): brak **należnego** raportu to teraz błąd |
| `roadmap.md` / `test-plan.md` | statusy doprowadzone do stanu faktycznego; F-01 `implementing` |

---

## 1. Zasady

Pełny zestaw w `cert-queue.md` §1 — obowiązuje bez zmian. Tu nowa reguła plus te, o które
najłatwiej się potknąć.

### Bramka przeglądu blokuje OTWARTE USTALENIA — i to ona się psuła

`impl-review.yml` ma krok **„Sprawdź werdykt przeglądu"**, który ma zatrzymać scalenie, gdy
przegląd czegoś nie przepuścił. **Ten krok był zepsuty i meldował sukces, sprawdzając nie ten
plik** — dlatego PR #10 przeszedł na zielono z werdyktem ODRZUCONYM i ustaleniem krytycznym
o cichej utracie danych użytkownika. Trzy defekty, wszystkie naprawione 14.09.2026:

1. **Zły selektor** (`git ls-files … | tail -1`) — brał alfabetycznie ostatni raport w całym
   repozytorium, nie raport tego PR-a. Zawsze wygrywał `dish-source-and-seed-pool`, a raport
   `dietary-preferences` z werdyktem ODRZUCONY nie był czytany **nigdy** (#15).
2. **Nieudany odczyt** — `git pull --ff-only` kończył się `Invalid username or token`, więc nawet
   dobry selektor czytałby kopię sprzed przebiegu agenta. Raport bierzemy teraz przez `gh`
   z gałęzi PR-a, a pusty odczyt jest błędem, nie cichą zgodą (#15).
3. **Zły sygnał** — pierwsza wersja naprawy pilnowała samego werdyktu, a werdykt jest MIGAWKĄ
   i zostaje w raporcie na zawsze. Blokowałaby więc każdy późniejszy PR dotykający raportu,
   łącznie z tym, który ustalenia zamyka. Bramka patrzy teraz na pola `Decision`/`Decyzja`
   o wartości PENDING (#17).

**Co z tego wynika dla pracy:**

- Scalenie zatrzyma **otwarte ustalenie**, nie napis w nagłówku. Rozliczyć ustalenie znaczy
  wpisać decyzję: naprawione, zaakceptowane, odroczone — każda z uzasadnieniem.
- **Nie stempluj `status: impl_reviewed`**, dopóki ustalenia są `PENDING`.
- Zielony przebieg **nadal nie zwalnia z przeczytania raportu**. Bramka łapie brak decyzji, nie
  złą decyzję — a przy F1 okazało się, że **proponowana w przeglądzie naprawa była
  niewystarczająca** i test po niej nadal świecił na czerwono.

```sh
git show origin/<galaz>:context/changes/<id>/reviews/impl-review.md | grep -E "Verdict|Decision"
```

### Przypomnienia

- `npm install` zakazane → `npm ci`. Playwright poza repo:
  `cd ~/.mealplan-e2e && NODE_PATH="$HOME/.mealplan-e2e/node_modules" npx playwright test`
- `git add -A` zakazane. Stage po ścieżkach, wypisz je w Dzienniku.
- `--no-verify` zakazane. `10x get` zakazane.
- Znacznik czasu z `date -u +%H:%M`, wklejany **w tej samej komendzie**, w której piszesz wpis.
- **Przed `expo export` ubij wszystkie `workerd.exe` i proces `wrangler dev`**, inaczej EBUSY.
  Jeden `taskkill` nie wystarcza — rodzic odradza dziecko. Działa pętla:
  ```powershell
  $t=0; while ($t -lt 8) { $p = Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'workerd' -or $_.CommandLine -match 'wrangler' }; if (-not $p) { break }; $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 2; $t++ }
  ```
- **Czekaj na ZASTOSOWANIE stanu, nie na odpowiedź.** `waitForResponse` wraca, zanim React wstawi
  dane w stan — to przewróciło raz testy i raz skrypt zrzutów. Sygnałem gotowości ekranu
  preferencji jest etykieta przycisku („Zapisz", nie „Zapis wstrzymany").
- Harness używa `localhost`, nie `127.0.0.1` — `azp` porównywane jako łańcuch znaków.
- **`ActionButton` renderuje się jako prawdziwy `<button>`** — lokator przez `getByRole`.
- Warunek produkcyjny (`secret`, zmienna buildu, `migrations apply --remote`) wchodzi **przed**
  commitem fazy, która go potrzebuje.

---

## 2. Zadania

### ~~P1 — F1: zapis bez strażnika kasuje wykluczenia~~ · ZROBIONE 14.09 (#14)

### ~~P2 — reszta ustaleń przeglądu i domknięcie werdyktu~~ · ZROBIONE 14.09 (#15, #16, #17)

### ~~P3 — domknięcie S-03~~ · ZROBIONE 14.09 (#20, #21, #22)

- **1.6 — konto A nie widzi wykluczeń konta B.** Wymaga **drugiego konta testowego**.
  **Zakłada je agent, nie właściciel**: konto testowe używa adresu `+clerk_test`, który instancja
  developerska Clerka przyjmuje bez prawdziwej skrzynki, więc rejestracja idzie przez ekran
  `/sign-up` aplikacji. Poświadczenia dopisz do `~/.mealplan-e2e/.env` jako
  `MEALPLAN_E2E_EMAIL_B` / `MEALPLAN_E2E_PASSWORD_B` — **nigdy do repozytorium**.
  Test: konto B zapisuje własne wykluczenia i **nie widzi** wykluczeń konta A ani ich nie nadpisuje.
  To samo konto zamyka przy okazji **2.9 z S-02** (`BLOCKED-MANUAL` od tamtej zmiany)
  i **fazę 3 z `test-plan.md`** — najwyższy zwrot z całego P3.
- **2.9 Expo Go** i **2.10 czytelność przy 20 wpisach** — **spróbuj sam**, patrz §4. Odhacz
  wyłącznie z dowodem (zrzut), a nie z założenia; oddaj właścicielowi dopiero, gdy emulator
  nie wstanie.
- Po tym: `/10x-archive` dla `dietary-preferences`, statusy w `roadmap.md` (S-03 → `done`,
  F-01 → `implementing`) i `test-plan.md` §3 (faza 4 działa, nie jest `not started`).

### P4 — F-01 faza 3: pilot 20 dań · duże · **następne do wzięcia; jedyna rzecz blokująca generator**

Tabela `dish` ma na produkcji **0 wierszy**. Nocny seed dołożył wyłącznie składniki i grupy, bo
do CRUD-a na wykluczeniach dania nie były potrzebne. S-04 nie ma z czego wybierać ani czym liczyć
kalorii, więc ta faza jest wąskim gardłem całego kamienia M-01.

Do zbudowania od zera — **jedenaście kryteriów, zero odhaczonych**:

| Artefakt | Po co |
|---|---|
| `seed/PROMPT.md` | jedno miejsce z instrukcją dla modelu, autoryzującego przepisy **poza runtime** (D14) |
| `seed/dishes/<slug>.json` × 20 | treść dań: gramatury, kroki, pory posiłku, `modelKcalHint`, `reviewedBy` |
| `seed/ingredients.json` | mapowanie nazwa → `fdcId` USDA |
| `scripts/distill-usda.mjs` | destylat tabeli USDA do makr na 100 g |
| `scripts/import-usda.mjs` | import destylatu do `ingredient` |
| `scripts/seed-dishes.mjs` | seed dań **z bramką: `--remote` odmawia dla dania bez `reviewedBy`** |
| `scripts/check-pool-feasibility.mjs` | raport wykonalności puli |

**Wzorzec jest już w repo:** `scripts/seed-ingredients.mjs` — bez zależności, pisze SQL na stdout,
idempotentny po tożsamości wiersza, a **sito Atwatera importuje z `src/lib/`, zamiast je
przepisywać**. Trzymaj się tego: skrypt z kopią progu zasieje dania, których walidator nie przyjmie.

**Weryfikację przepisów przejmuje agent w całości** (decyzja właściciela z 14.09, §4). Człowiek
wyszedł z pętli, więc **sito jest jedyną obroną i musi być ostrzejsze niż zakładał pierwotny plan**:

1. **Makra muszą pochodzić z wiersza USDA, nie z pamięci modelu.** Dziś **żaden z 35 składników
   na produkcji nie ma `usda_fdc_id`** — makra wpisał nocą agent z własnej wiedzy. Przeszły sito
   Atwatera, co łapie błędy rzędu ×10, ale nie dowodzi, że liczba jest prawdziwa. **Backfill
   `usda_fdc_id` i weryfikacja tych 35 wierszy wobec USDA to pierwsza robota w P4**, przed
   dodaniem czegokolwiek nowego.
2. **Dane USDA są osiągalne bez udziału właściciela** (sprawdzone 14.09): zbiorcze pliki
   `https://fdc.nal.usda.gov/fdc-datasets/…` pobierają się bez klucza, a API
   `api.nal.usda.gov/fdc/v1` odpowiada z `DEMO_KEY` i oddaje `fdcId` oraz cztery makra.
   Preferuj **pobranie zbiorcze** — deterministyczne, wersjonowalne w `seed/usda-subset.json`
   i bez limitów zapytań. Plik źródłowy zostaje poza repo, w `.gitignore`.
3. **Rozjazd deklaracji modelu z wyliczeniem z USDA powyżej 20% oznacza odrzucenie dania**, nie
   korektę gramatury pod sito. Powód do Dziennika.
4. `reviewedBy` zapisuje prawdę: `agent (upoważnienie właściciela 14.09.2026)`. Nigdy cudze
   nazwisko.

### P5 — F-01 faza 4: skalowanie puli · duże

Reszta puli do minimów (≥ 12 śniadań, ≥ 18 obiadów, ≥ 18 kolacji, ≥ 12 przekąsek), seed
`--remote`, `seed/FEASIBILITY.md`, opis puli i skryptów w `CLAUDE.md`.

Tu wracają dwie pozycje odłożone świadomie:
- **pole `meta` w `all<T>()`** w `src/server/env.ts` — razem z pomiarem CPU, bo dopiero wtedy jest
  co mierzyć (ustalenie F4 przeglądu fazy 1 F-01),
- **stronicowanie katalogu składników** i debounce wyszukiwarki — ustalenie F6 przeglądu S-03
  fazy 2, odłożone przy 35 składnikach, wraca gdy pula urośnie.

### P6 — S-04: generator planu · NIE ZACZYNAJ przed P4

Blokuje go **brak puli dań** (P4), a nie decyzje. Treść komunikatu „planu nie da się ułożyć"
rozstrzyga agent (§4); Workers Paid wraca dopiero po pomiarze CPU z P5 i tylko z liczbą w ręku.

---

## 3. Czego NIE robić

- **Nie implementuj S-04 przed zamknięciem P4.** Blokada z `CLAUDE.md` obowiązuje.
- **Nie seeduj dań `--remote` bez `reviewedBy`.** Bramka w `seed-dishes.mjs` ma odmawiać.
- **Nie wpisuj `reviewedBy` cudzym nazwiskiem** — zapisuje się tam, kto NAPRAWDĘ sprawdzał.
- **Nie naginaj gramatury, żeby danie przeszło sito** — odrzuć je i zapisz powód.
- **Nie odhaczaj 2.9 ani 2.10 bez dowodu** — zrzut albo nic.
- **Nie seeduj składnika bez `usda_fdc_id`** — od 14.09 makra muszą pochodzić z wiersza USDA.
- **Nie stempluj statusów przed zamknięciem ustaleń.** Dokładnie tak powstał dług z P1.
- **Nie rób `10x get`** — synchronizuje `.claude/skills/` i kasuje resztę.
- **Nie ruszaj ustawień repozytorium** ani nie dodawaj współpracowników.
- Nie archiwizuj `dish-source-and-seed-pool` — będzie w toku aż do P5.

---

## 4. Co agent rozstrzyga sam, a co należy do właściciela

**Domyślnie rozstrzyga agent.** Ta sekcja miała wcześniej sześć pozycji „do decyzji właściciela"
i to była pomyłka: pięć z nich było zwykłą pracą, którą da się wykonać i cofnąć. Po decyzji
z 14.09 (niżej) zostaje **jedna** realna decyzja — i to dopiero po pomiarze.

> **Sprostowanie numeracji.** W PRD jest **pięć** Open Questions. Komunikat „planu nie da się
> ułożyć" to **pytanie 3**, nie 4. „Workers Paid" **nie jest** Open Question — to pozycja
> w rejestrze ryzyk w `infrastructure.md`. Wcześniejsza wersja tego pliku powtarzała błędną
> numerację za inną sesją.

### Agent rozstrzyga sam i tylko odnotowuje w Dzienniku

| Rzecz | Dlaczego to nie jest decyzja właściciela |
|---|---|
| **Treść i próg komunikatu „planu nie da się ułożyć"** (PRD, pytanie 3) | Kształt jest już rozstrzygnięty w `CLAUDE.md`: komunikat nazywa, **którego z trzech ograniczeń** nie da się spełnić, i nie wraca żaden plan częściowy. Brakuje słów i liczby — jedno i drugie jest odwracalne (string i stała). Napisz, pokaż w Dzienniku, idź dalej. |
| **Skalowanie puli po pilocie** | Minima są już w planie (≥ 12 śniadań, ≥ 18 obiadów, ≥ 18 kolacji, ≥ 12 przekąsek), a raport wykonalności odpowiada, czy się bronią. Eskaluj **wyłącznie**, gdy z raportu wyjdzie potrzeba rzędu trzykrotnie większej puli — to już niespodzianka kosztowa, nie parametr. |
| **2.10 — czytelność listy przy 20 wpisach** | Wygeneruj 20 wpisów, zrób zrzut, obejrzyj go i zapisz werdykt z dowodem. Osąd wizualny na podstawie zrzutu jest w zasięgu agenta. |
| **2.9 — Expo Go** | Spróbuj emulatora (obraz API 35, **nie** 36.1; wymaga firmowego DNS). Jeśli wstanie — sprawdź zakładkę, ikonę i wyszukiwarkę, zrób zrzut. Dopiero gdy emulator nie wstanie, oddaj to właścicielowi z opisem błędu. |
| **Przegląd gramatur — CAŁY** | Właściciel upoważnił agenta 14.09 (niżej). Część sit już istnieje: Atwater, próg na porcję, gęstość energetyczna. Dochodzi weryfikacja wobec prawdziwych wierszy USDA i sito wiarygodności per składnik. |

### Naprawdę należy do właściciela

1. **Workers Paid, 5 USD/mc.** To jego pieniądze. **Nie jest to jednak bloker „na zapas":**
   najpierw **zmierz** realne CPU generatora (P5). `infrastructure.md` ostrzega, że przekroczenie
   10 ms **zabija wywołanie**, a nie spowalnia — więc gdy pomiar pokaże przekroczenie, przedstaw
   liczbę i zapytaj. Nie wcześniej.

2. **Ustawienia repozytorium** — gdyby kiedykolwiek były potrzebne.

### ROZSTRZYGNIĘTE 14.09.2026 — weryfikację przepisów przejmuje agent

Właściciel **upoważnił agenta do zweryfikowania wszystkich przepisów** i zrezygnował z własnego
przeglądu gramatur. To jest świadome rozluźnienie D14, podjęte przez właściciela po przedstawieniu
kosztu — nie skrót agenta.

**Co z tego wynika i czego NIE wolno:**

- `reviewedBy` zapisuje **prawdę o tym, kto sprawdzał**: `agent (upoważnienie właściciela
  14.09.2026)`. Nadal **nie wolno wpisać tam cudzego nazwiska** — bramka `--remote` ma odróżniać
  danie sprawdzone od niesprawdzonego, a nie udawać, że ktoś je oglądał.
- **Sito jest teraz JEDYNĄ obroną**, bo człowiek wyszedł z pętli. Dlatego musi być ostrzejsze,
  a nie takie samo: patrz P4, punkt o weryfikacji wobec USDA.
- Danie, którego sito nie przepuszcza, **nie jedzie na produkcję** i ląduje w Dzienniku z powodem.
  Nie „poprawiaj" gramatury tak, żeby przeszła — to obchodzenie własnego guardraila.

## 5. Dziennik

Dopisuj po **każdym** zadaniu i przy każdej blokadzie.

```
### <HH:MM UTC> — <ID> <tytuł>
Wynik: ok | blocked | failed | pominięte
Co zrobione: <jedno–trzy zdania>
Co zacommitowane: <ścieżki — dowód, że nie było `git add -A`>
Werdykt przeglądu: <czy przeczytany, czy ustalenia mają decyzje>
PR: <numer albo ->
Do decyzji: <albo ->
```

<!-- DZIENNIK PONIŻEJ -->

### 07:40 UTC — P1 Strażnik zapisu (F1)
Wynik: ok
Co zrobione: test odtwarzający utratę danych napisany PRZED naprawą i czerwony, z dowodem
w wyniku — wychodził prawdziwy `PUT` z `"exclusions":[]`. **Naprawa z przeglądu okazała się
niewystarczająca**: sama klauzula `if (load.kind !== 'ready') return;` nie przechodziła testu, bo
bramkuje tylko okno PRZED zakończeniem pobrania. Prawdziwą przyczyną był jeden strażnik `touched`
na dwa niezależne byty — rozdzielony na `touchedPreferences` i `touchedExclusions`. Bramkowanie
stanem pobrania zostało jako druga warstwa, rozszerzona o `offline` i `error`.
Co zacommitowane: `src/app/(app)/preferences.tsx`, `tests/e2e/preferences-screen.spec.ts`
Werdykt przeglądu: przeczytany ręcznie (bramka była wtedy jeszcze zepsuta)
PR: #14
Do decyzji: —

### 07:45 UTC — P2 Pozostałe ustalenia i bramka werdyktu
Wynik: ok
Co zrobione: F2 zaimplementowane (`aria-errormessage` + `aria-describedby`, `useId()`), F3 i F4
pokryte testami, poprawiony akapit o `0004 --remote` w `review-fixes.md`, wszystkie sześć ustaleń
rozliczone decyzjami. Przy okazji **naprawiona bramka werdyktu**, która sprawdzała raport innej
zmiany i przez to przepuściła PR #10 — trzy defekty, opisane w §1, sprawdzone na czterech
przypadkach. Usunięta też przyczyna migotania testów: `openPreferences` czekało na ODPOWIEDŹ,
a nie na jej ZASTOSOWANIE.
Co zacommitowane: `src/components/ui/text-field.tsx`, `tests/e2e/preferences-screen.spec.ts`,
`context/changes/dietary-preferences/reviews/impl-review.md`,
`context/changes/dish-source-and-seed-pool/follow-ups/review-fixes.md`,
`.github/workflows/impl-review.yml`
Werdykt przeglądu: zielony; wszystkie ustalenia mają decyzje
PR: #15, #16, #17
Do decyzji: —

### 11:47 UTC — P3 Domknięcie S-03
Wynik: ok
Co zrobione: **konto testowe B założone przez agenta** — nie z przeglądarki: ekran `/sign-up`
montuje Smart CAPTCHA Clerka, która w Chromium sterowanym przez Playwrighta nigdy się nie kończy
(żądanie rejestracji nie wychodzi w ogóle, bez błędu na ekranie — sprawdzone headless i z oknem).
Zadziałała rejestracja z emulatora, gdzie Clerk pomija CAPTCHA; poświadczenia w `.env` harnessu,
poza repozytorium. **1.6 zamknięte** dwoma testami w `account-isolation.spec.ts` (przez ekran
i z pominięciem UI), sprawdzonymi celowym zepsuciem filtra `user_id` — obie asercje czerwone,
po przywróceniu zielone. Przy okazji zamyka to 2.9 z S-02 i fazę 3 z `test-plan.md`.
**2.9 i 2.10 nie przeszły z marszu — oba ujawniły realne defekty, oba naprawione:**
(1) natywnie podpowiedzi wyszukiwarki renderują się pod klawiaturą, a dotknięcie podpowiedzi przy
otwartej klawiaturze tylko ją chowało (`keyboardShouldPersistTaps` domyślnie `'never'`);
(2) na webie poniżej ~750 px kolumna treści nie schodzi poniżej szerokości swojej treści i jest
obcinana z obu stron — 743 px w oknie 400 px, ten sam defekt na ekranie profilu. Harness jeździ
na 1280 px, więc nie miał jak tego zobaczyć. Statusy w `roadmap.md` i `test-plan.md` doprowadzone
do stanu faktycznego (S-03 `done`, F-01 `implementing`, fazy 2–4 planu testów `complete`).
Pełny zestaw E2E: 44/44, `npm test` 100/100, `tsc`, `expo lint` i `check-conventions` czyste.
Co zacommitowane: `src/app/(app)/preferences.tsx`, `src/app/(app)/profile.tsx`,
`tests/e2e/account-isolation.spec.ts`, `tests/e2e/support/sign-in.ts`, `tests/e2e/README.md`,
`context/changes/dietary-preferences/plan.md`, `context/foundation/roadmap.md`,
`context/foundation/test-plan.md`, `notes/pool-queue.md`
Werdykt przeglądu: ZATWIERDZONY, 0 krytycznych; ustalenia F1 i F2 naprawione, F3 i F4 (dotyczą
samej bramki) rozliczone osobnym PR-em — patrz wpis P3a
PR: #20
Do decyzji: —

### 12:12 UTC — P3a Bramka werdyktu, czwarty defekt
Wynik: ok
Co zrobione: przy rozliczaniu przeglądu PR #20 wyszło, że bramka **znowu** meldowała sukces,
nie przeczytawszy niczego — i to dwoma niezależnymi drogami. (1) Agent nie ma zgody na
`git commit`, więc raport wystawił **wyłącznie jako komentarz**; bramka czyta plik, nie znalazła
go i wypisała notkę „PR nie dotyczy żadnego planu", mając przed sobą dwa ustalenia PENDING.
(2) Pole decyzji musiało mieć dwukropek POZA pogrubieniem (`- **Decyzja**: …`); raport napisany
w drugim, identycznie renderującym się wariancie dał **zero** ustaleń — przy werdykcie
odrzucającym każde PENDING byłoby niewidzialne. Obie drogi zamknięte: brak należnego raportu
(PR rusza `plan.md`) to teraz błąd, wyrażenie przyjmuje oba warianty, a raport z ustaleniami
i zerem decyzji też blokuje. Logika sprawdzona lokalnie na sześciu przypadkach — kody wyjścia
zgodne z oczekiwanymi.
**Czego świadomie NIE zrobiono:** nie ruszono uprawnień agenta. `--allowedTools` **zastępuje**
domyślny zestaw narzędzi, więc może odebrać mu narzędzia MCP do komentarza i etykiet, a skutku
nie da się sprawdzić na PR-ze, który tę zmianę wprowadza (recenzent jest na nim wyłączony).
Do czasu naprawy raport do PR-a o planie commituje prowadzący zadanie.
Co zacommitowane: `.github/workflows/impl-review.yml`,
`context/changes/dietary-preferences/reviews/impl-review-p3.md`, `notes/pool-queue.md`
Werdykt przeglądu: recenzent wyłączony na tym PR-ze z założenia (walidacja workflow wobec
gałęzi domyślnej) — to udokumentowane zachowanie, nie usterka
PR: #21
Do decyzji: —

### 12:18 UTC — P3b Archiwizacja S-03
Wynik: ok
Co zrobione: `dietary-preferences` przeniesione do `context/archive/2026-09-13-dietary-preferences/`,
`change.md` ostemplowane (`status: archived`, `archived_at`), element S-03 domknięty w roadmapie
wpisem w sekcji „Zrobione". Archiwizacja poszła **osobnym PR-em świadomie**: `/10x-archive`
przenosi razem z folderem raport przeglądu, którego bramka pod ścieżką `context/archive/` już nie
znajduje — zrobiona razem z pracą oznaczałaby przegląd, który nie ma jak zadziałać.
Drobiazg do zapamiętania: `git mv` i `mv` z Git Basha odmówiły („Permission denied") na samym
katalogu, mimo że żaden plik w środku nie był zablokowany; `Move-Item` z PowerShella przeszło
bez oporu, a git rozpoznał wszystkie sześć plików jako zmianę nazwy, więc historia została.
Co zacommitowane: `context/archive/2026-09-13-dietary-preferences/` (6 plików, zmiana nazwy),
`context/foundation/roadmap.md`, `notes/pool-queue.md`
Werdykt przeglądu: brak raportu i brak planu w `context/changes/` — bramka przepuszcza notką,
zgodnie z rozróżnieniem wprowadzonym w #21; recenzent potwierdził to samodzielnie
PR: #22
Do decyzji: —

### 12:56 UTC — P4a Backfill USDA: makra składników z wiersza, nie z pamięci
Wynik: ok
Co zrobione: pierwsza robota z P4 — weryfikacja 35 składników wobec USDA. **Osiem z nich nie
zgadzało się z żadnym wierszem**: boczek 541→393 kcal (białko 37→13,7 g), tuńczyk 116→86,
serek 103→81, krewetki 85→71 (białko 20,1→13,6), papryka 31→26, kurczak 120→108, soczewica
1,1→2,17 g tłuszczu. Wszystkie osiem **przeszło sito Atwatera**, bo były wewnętrznie spójne —
sito łapie błędy rzędu ×10, nie liczby wymyślone konsekwentnie. Potok: zbiorczy plik SR Legacy
(6 MB, bez klucza) → `scripts/distill-usda.mjs` → wersjonowany `seed/usda-subset.json` →
`scripts/import-usda.mjs` → SQL. `scripts/seed-ingredients.mjs` **usunięty**: trzymał makra
w kodzie, więc jego kolejne uruchomienie po cichu przywracałoby błędne wartości.
Trzy nazwy doprowadzone do tego, co opisuje wiersz USDA (twaróg → serek wiejski, bo twarogu
w USDA nie ma); zmiana nazwy idzie osobnym UPDATE przed wstawieniem, inaczej powstałby drugi
wiersz, a wykluczenia zostałyby przy starym.
**Zabezpieczenie, które się obroniło:** destylacja przerywa, gdy opis USDA nie zgadza się
z zapisanym w mapowaniu. Sprawdzone celowo: `169251` to pieczarki SUROWE, `169252` — GOTOWANE.
Literówka w jednej cyfrze podmienia produkt, a sito Atwatera tego nie widzi.
**Pułapka do zapamiętania:** `npm run x > plik.sql` wkleja do pliku nagłówek npm i wywraca SQL
na `near ">": syntax error`. Przy `2>/dev/null` wygląda to na udany przebieg — mój pierwszy
test idempotencji był przez to bezwartościowy i trzeba go było powtórzyć. Potrzebne `--silent`.
Produkcja zaktualizowana (`--remote`): 35/35 z `usda_fdc_id`, zero osieroconych wykluczeń,
20 przypisań do grup zachowanych.
Co zacommitowane: `seed/ingredients.json`, `seed/usda-subset.json`, `seed/README.md`,
`scripts/distill-usda.mjs`, `scripts/import-usda.mjs`, usunięty `scripts/seed-ingredients.mjs`,
`package.json`, `.gitignore`, `CLAUDE.md`, `notes/pool-queue.md`
Werdykt przeglądu: ZATWIERDZONY, 0 krytycznych, 1 ostrzeżenie + 4 obserwacje. Cztery naprawione
(osłona odczytów, doprecyzowany kontrakt parsera, **sprawdzenie nagłówka kolumn CSV**, domyślne
`details`), piąta — fixture do testu sita — odłożona z powodem do P5. Najostrzejsza była F3:
przestawienie kolumn w `food_nutrient.csv` nie było łapane przez NIC i dałoby wiarygodnie
wyglądające, błędne makra. Guard sprawdzony celowym zepsuciem nagłówka.
**Sprostowanie do wpisu P3a:** twierdziłem tam, że agent przeglądu „nie ma zgody na `git commit`".
To nieprawda — log tego przebiegu pokazuje `ALLOWED_TOOLS` z `Bash(git add:*)`, `Bash(git commit:*)`
i skryptem push. Agent raport **zacommitował**, a bramka go przeczytała i zablokowała scalenie na
pięciu otwartych ustaleniach — dokładnie tak, jak miała. Na PR #20 raportu nie było z innego,
nieustalonego powodu; blokowane są tam wyłącznie polecenia spoza tej listy (`npm test`, `gh`).
Druga runda przeglądu (po naprawach) dorzuciła F6: brak pisemnego dowodu, że destylacja przeszła
na PEŁNYM zbiorze **po** dodaniu sprawdzenia nagłówka, plus hipoteza o BOM. Dowód uzupełniony —
trzy przebiegi, za każdym „35 składników", destylat bajt w bajt ten sam; BOM-u w SR Legacy 2018-04
**nie ma** (`head -c 16 | xxd` → `"fdc_id"`). BOM i tak jest teraz zdejmowany jawnie, bo bez tego
legalny plik z sygnaturą odpadłby z komunikatem o zepsutym układzie kolumn — czyli wskazującym
w złe miejsce.
PR: #24
Do decyzji: —

### 13:58 UTC — P4b Pilot 20 dań przez cały potok
Wynik: ok
Co zrobione: pula dań przestała być pusta — **20 dań na produkcji**, czyli zdjęte wąskie gardło
całego kamienia M-01. Powstały: `seed/PROMPT.md` (reguły autorskie), 20 plików `seed/dishes/*.json`,
`scripts/seed-dishes.mjs` i `scripts/check-pool-feasibility.mjs`.
Sprawdzone celowym zepsuciem, nie z założenia: walidator na zepsutym pliku wypisuje **pięć błędów
naraz i nie tworzy żadnego SQL-a**, mimo że pozostałe 20 dań jest poprawnych (wszystko albo nic);
`--remote` odmawia dla dania bez `reviewedBy`, a `--local` to samo danie przepuszcza; usunięcie
składnika z JSON-a usuwa go też z `dish_ingredient`, bez osieroconego wiersza; drugi przebieg daje
stan identyczny co do znaku.
**Najważniejszy wynik to raport wykonalności, i nie jest on pomyślny.** Pula nie sięga górnej
połowy celów: 3200 kcal jest **nieosiągalne w każdym scenariuszu**, a 2800 kcal wychodzi tylko
przy sześciu posiłkach i tylko w 2-12% złożeń. Powód jest arytmetyczny: najcięższy możliwy dzień
to 2791 kcal. Konto testowe ma wyliczony cel **2790 kcal** — dokładnie na tej granicy.
Przy okazji wyszło, że raport policzony na jednej liczbie posiłków kłamie: ta sama pula daje 0%
przy trzech posiłkach i 80% przy sześciu dla celu 2400 kcal. Pierwsza wersja skryptu liczyła
tylko cztery posiłki i odpowiadała „nie da się" na pytanie, na które odpowiedź brzmi „da się,
ale nie przy czterech". Poprawione — raport liczy 3/4/5/6.
**Decyzja o fazie 4 (agent, §4 kolejki):** skalujemy do minimów z planu, ale z poprawioną
kompozycją — co najmniej cztery śniadania > 600 kcal, cztery przekąski > 400 kcal oraz po sześć
obiadów i kolacji > 700 kcal, część w limicie 30 minut. Nie eskaluję: §4 rezerwuje eskalację na
potrzebę puli rzędu trzykrotnie większej, a tu liczba dań się broni — zmienia się rozkład gramatur.
Uzasadnienie i pełny raport: `seed/FEASIBILITY.md`.
Pułapka do zapamiętania: zapytanie do `wrangler --command` przez powłokę **musi być jedną linią**.
Znak nowej linii urywa polecenie, a objaw to `wrangler zwrócił 1` z pustym stderr — komunikat,
który o niczym nie mówi.
Produkcja: 20 dań, 90 składników, 82 kroki, 33 przypisania do pór, zero niekompletnych, polskie
znaki nietknięte. Wiersze 3.1-3.11 planu F-01 rozliczone.
Co zacommitowane: `seed/PROMPT.md`, `seed/FEASIBILITY.md`, `seed/dishes/` (20 plików),
`scripts/seed-dishes.mjs`, `scripts/check-pool-feasibility.mjs`, `package.json`,
`context/changes/dish-source-and-seed-pool/plan.md`, `notes/pool-queue.md`
Werdykt przeglądu: <do uzupełnienia>
PR: <do uzupełnienia>
Do decyzji: —
