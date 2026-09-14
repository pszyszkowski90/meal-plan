# Kolejka: dług przeglądowy, domknięcie S-03 i pula dań

Plik operacyjny i **jedyne źródło stanu** tej paczki prac — jak `cert-queue.md` dla nocy z 13.09.
Sesja przeżyje kompresję kontekstu tylko wtedy, gdy po każdym kroku dopisze wpis do Dziennika
na końcu. Nie trzymaj stanu w pamięci rozmowy.

Kolejność jest uszeregowana **kosztem niezrobienia**, nie tematem.

## Jak to uruchomić

```
/loop Wykonuj kolejne zadanie z notes/pool-queue.md. Trzymaj się sekcji Zasady. Po każdym zadaniu dopisz wpis do Dziennika na końcu pliku, otwórz PR, przeczytaj werdykt przeglądu i scal po zielonych bramkach. Nie zaczynaj P6 i nie czekaj na decyzje właściciela z sekcji 4 — pomiń, co zablokowane, i opisz to w Dzienniku.
```

Kolejne zadanie do wzięcia: **P3**. P1 i P2 są zrobione (patrz Dziennik).

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

### P3 — domknięcie S-03 · ~1–2 h · **następne do wzięcia**

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

### P4 — F-01 faza 3: pilot 20 dań · duże · **jedyna rzecz blokująca generator**

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

**Podział pracy:** agent buduje potok, generuje kandydatów i **odsiewa maszynowo** — Atwater,
próg na porcję, gęstość energetyczna plus nowe sito wiarygodności per składnik — po czym sortuje
dania po podejrzliwości. Do człowieka idą **tylko pozycje odstające**, nie wszystkie dwadzieścia
(§4). Niezmienne zostaje jedno: **agent nie wpisuje `reviewedBy` za człowieka**, bo to bramka
przed seedem na produkcję, a nie formalność.

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
- **Nie wpisuj `reviewedBy` za człowieka** — to bramka przed seedem na produkcję. Odsiew
  maszynowy owszem, podpis nie.
- **Nie odhaczaj 2.9 ani 2.10 bez dowodu** — zrzut albo nic.
- **Nie rozluźniaj D14** (wariant (b) z §4) bez wyraźnej zgody właściciela.
- **Nie stempluj statusów przed zamknięciem ustaleń.** Dokładnie tak powstał dług z P1.
- **Nie rób `10x get`** — synchronizuje `.claude/skills/` i kasuje resztę.
- **Nie ruszaj ustawień repozytorium** ani nie dodawaj współpracowników.
- Nie archiwizuj `dish-source-and-seed-pool` — będzie w toku aż do P5.

---

## 4. Co agent rozstrzyga sam, a co należy do właściciela

**Domyślnie rozstrzyga agent.** Ta sekcja miała wcześniej sześć pozycji „do decyzji właściciela"
i to była pomyłka: pięć z nich było zwykłą pracą, którą da się wykonać i cofnąć. Zostaje jedna
realna decyzja i jedno pytanie o kompromis.

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
| **Przegląd gramatur — część maszynowa** | D14 chodzi o wyłapanie tego, co model zmyśli (300 g oliwy w porcji), a nie o rytuał. Część sit już istnieje: Atwater, próg na porcję, gęstość energetyczna. Dołóż **sito wiarygodności per składnik** i posortuj dania po podejrzliwości. Do człowieka idą wtedy tylko pozycje odstające, nie wszystkie dwadzieścia. |

### Naprawdę należy do właściciela

1. **Workers Paid, 5 USD/mc.** To jego pieniądze. **Nie jest to jednak bloker „na zapas":**
   najpierw **zmierz** realne CPU generatora (P5). `infrastructure.md` ostrzega, że przekroczenie
   10 ms **zabija wywołanie**, a nie spowalnia — więc gdy pomiar pokaże przekroczenie, przedstaw
   liczbę i zapytaj. Nie wcześniej.

2. **Podpis pod gramaturami — i tylko pod tym, co wystaje.** `reviewedBy` jest bramką przed
   seedem na produkcję, więc **agent nigdy nie wpisuje tam cudzego nazwiska** — to fałszowanie
   zapisu, nie skrót. Do wyboru:
   - **(a, rekomendowane)** właściciel ogląda kilka dań odstających po sicie i podpisuje je;
     mechanizm D14 zostaje nietknięty, koszt to minuty;
   - **(b)** świadome rozluźnienie D14: `reviewedBy` przyjmuje wartość automatyczną, gdy wszystkie
     sita przechodzą i danie nie jest odstające. **Tego nie wprowadzaj bez wyraźnej zgody** —
     osłabia decyzję, która ma w repo uzasadnienie.

3. **Ustawienia repozytorium** — gdyby kiedykolwiek były potrzebne.

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
