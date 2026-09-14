# Kolejka: dług przeglądowy, domknięcie S-03 i pula dań

Plik operacyjny i **jedyne źródło stanu** tej paczki prac — jak `cert-queue.md` dla nocy z 13.09.
Sesja przeżyje kompresję kontekstu tylko wtedy, gdy po każdym kroku dopisze wpis do Dziennika
na końcu. Nie trzymaj stanu w pamięci rozmowy.

Kolejność jest uszeregowana **kosztem niezrobienia**, nie tematem. P1 stoi pierwsze, bo dziś
na produkcji działa ekran, który potrafi po cichu skasować komuś listę wykluczeń.

---

## 0. Stan wyjściowy — zmierzony 14.09.2026, nie założony

| Co | Stan |
|---|---|
| `main` | `ff36ede`, dwanaście PR-ów, drzewo czyste |
| Produkcja | wdrożenie z 13.09 22:26 UTC, smoke czysty: `/` 200, nieznana ścieżka 404, `/api/health` `{"ok":true,"d1":true}`, cztery trasy API bez nagłówka 401 |
| D1 produkcyjna | **0 dań**, 35 składników, 8 grup wykluczeniowych, 20 przypisań |
| Migracje `--remote` | `0001`–`0005` **wszystkie zastosowane** (sprawdzone zapytaniem o `d1_migrations`) |
| S-03 faza 2 | przegląd **REJECTED** — ~~cztery ustalenia `PENDING`, kod nienaprawiony~~ **rozliczone 14.09.2026**: F1 w #14, F2/F3/F4 w #16, wszystkie sześć ustaleń ma decyzję |
| F-01 | fazy 1 i 2 zrobione, faza 2 **nieprzejrzana**, fazy 3 i 4 zerowe |
| `seed/` | **nie istnieje**; w `scripts/` jest tylko `seed-ingredients.mjs` |
| `roadmap.md` | F-01 `planning` (jest `implementing`), S-03 `planning` (jest po fazie 2) |
| `test-plan.md` §3 | fazy 2–4 `not started`, choć faza 4 (bramki w CI) działa od 13.09 |

**Jedno odroczone pytanie zamyka się od razu, bez pracy.** `follow-ups/review-fixes.md` w F-01
mówi, że `0004 --remote` **nie zostało wykonane**. Zostało — zabrało je nocne
`migrations apply --remote` przy `0005`. Dowód:

```sh
npx wrangler d1 execute mealplan --remote --command "select name from d1_migrations order by id;"
```

Wystarczy poprawić ten akapit w `review-fixes.md`; to część P2.

---

## 1. Zasady

Pełny zestaw w `cert-queue.md` §1 — obowiązuje bez zmian. Tu tylko nowa reguła, wyprowadzona
z tego, jak powstał dług z P1, plus te, o które najłatwiej się potknąć.

### Nowa: bramka przeglądu blokuje OTWARTE USTALENIA — i to ona się psuła

`impl-review.yml` ma krok **„Sprawdź werdykt przeglądu"**, który ma zatrzymać scalenie, gdy
przegląd czegoś nie przepuścił. **Ten krok był zepsuty i przez to meldował sukces, sprawdzając
nie ten plik** — dlatego PR #10 przeszedł na zielono z werdyktem ODRZUCONYM i ustaleniem
krytycznym o cichej utracie danych. Trzy defekty, naprawione 14.09.2026:

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

- Scalenie zatrzyma **otwarte ustalenie**, nie napis w nagłówku. Rozliczenie ustalenia znaczy
  wpisanie decyzji: naprawione, zaakceptowane, odroczone — każda z uzasadnieniem.
- **Nie stempluj `status: impl_reviewed`**, dopóki ustalenia są `PENDING`. Stempel znaczy
  „przejrzane i rozliczone", nie „przejrzane".
- Zielony przebieg **nadal nie zwalnia z przeczytania raportu**. Bramka łapie brak decyzji, nie
  złą decyzję — a przy F1 okazało się, że **proponowana w przeglądzie naprawa była
  niewystarczająca** i test nadal świecił na czerwono.

```sh
git show origin/<galaz>:context/changes/<id>/reviews/impl-review.md | grep -E "Verdict|Decision"
```

### Przypomnienia

- `npm install` zakazane → `npm ci`. Playwright poza repo:
  `cd ~/.mealplan-e2e && NODE_PATH="$HOME/.mealplan-e2e/node_modules" npx playwright test`
- `git add -A` zakazane. Stage po ścieżkach, wypisz je w Dzienniku.
- `--no-verify` zakazane. `10x get` zakazane.
- Znacznik czasu z `date -u +%H:%M`, wklejany **w tej samej komendzie**, w której piszesz wpis.
- **`wrangler dev` trzyma `dist/client`** — ubij go i wszystkie `workerd.exe` **przed**
  `expo export`, inaczej EBUSY. Nocą wymagało to pętli po drzewie procesów, nie jednego
  `taskkill`; proces rodzic `wrangler dev` odradza `workerd`.
- Harness używa `localhost`, nie `127.0.0.1` — `azp` porównywane jako łańcuch znaków.
- **`ActionButton` renderuje się jako prawdziwy `<button>`** (od S-03). Nowy lokator w harnessie
  bierz przez `getByRole`, nie `div[tabindex]`.
- Warunek produkcyjny (`secret`, zmienna buildu, `migrations apply --remote`) wchodzi **przed**
  commitem fazy, która go potrzebuje.
- Praca przez PR; w pojedynkę scalasz sam, ale **dopiero po przeczytaniu werdyktu przeglądu**.

---

## 2. Zadania

### P1 — F1: zapis bez strażnika kasuje wykluczenia · ~20 min · KRYTYCZNE

**To jedyna pozycja, która dotyczy działającej produkcji.** Reszta kolejki może poczekać, ta nie.

**Mechanizm awarii**, potwierdzony w kodzie na `main`:

1. Ekran wchodzi ze stanem `entries: []` i robi jedno `GET /api/preferences`.
2. Użytkownik wpisuje czas przygotowania i klika liczbę posiłków, **zanim odpowiedź wróci**.
   Pierwsza zmiana ustawia `touched.current = true`.
3. Odpowiedź dochodzi, widzi `touched.current === true` i **świadomie nie nadpisuje pól** —
   to jest poprawne, chroni przed wyścigiem z S-02. Skutek uboczny: `entries` zostaje `[]`.
4. `handleSave` ([preferences.tsx:248](../src/app/(app)/preferences.tsx)) sprawdza **tylko**
   `validation.ok`. Oba pola liczbowe są poprawne, więc żądanie wychodzi z `exclusions: []`.
5. `replaceExclusions` kasuje **wszystkie** wpisy `source = 'preferences'` i wstawia nadesłane —
   czyli nic.

Lista wykluczeń znika bez komunikatu, a użytkownik widzi „Zapisano". `ActionButton` blokuje się
wyłącznie na `busy`, więc nic tego nie zatrzymuje. **Ta sama luka dotyczy stanów `offline`
i `error`**: wtedy też nie wiemy, co jest w bazie, a zapis i tak zastąpi to pustką.

**Naprawa** — strażnik plus widoczny powód, nie sam strażnik:

- w `handleSave`, przed czymkolwiek: `if (load.kind !== 'ready') { … return; }` z komunikatem
  pod przyciskiem („Poczekaj, aż preferencje się wczytają" / „Brak połączenia — nie wiadomo, co
  jest zapisane"). Cichy `return` zamieniłby utratę danych na przycisk, który nic nie robi.
- `ActionButton` ma być **widocznie** zablokowany, dopóki `load.kind !== 'ready'` —
  `busy={saving || load.kind !== 'ready'}` z własną etykietą.

**Gotowe, gdy:** E2E odtwarza scenariusz 1–5 (opóźniony `GET` + szybkie wypełnienie + zapis)
i dowodzi, że wcześniej zapisane wykluczenie **przeżyło**; `npm test`, `tsc`, `expo lint`,
`check-conventions` czyste; pełny zestaw E2E zielony.

> Test musi być **czerwony przed naprawą**. Najpierw odtwórz utratę danych, potem napraw.

### P2 — reszta ustaleń przeglądu i domknięcie werdyktu · ~1 h

- **F2** — komentarz w [text-field.tsx:30](../src/components/ui/text-field.tsx) obiecuje
  `aria-errormessage`, którego implementacja nie ustawia. Preferuj **dołożenie atrybutu**
  (generowany `id` na tekście błędu, `aria-errormessage` na polu) — to domyka pętlę błędu dla
  czytnika ekranu tak, jak zapowiada. Jeśli React Native Web nie przepuści `id` na `ThemedText`,
  **popraw komentarz** i zapisz w Dzienniku, że wybrano wariant tańszy i dlaczego. Komentarz,
  który kłamie, jest gorszy niż brak komentarza.
- **F3** — brak testu: **usunięcie wykluczenia GRUPOWEGO** przeżywa przeładowanie. Test dla
  składnikowego istnieje (`usunięcie wykluczenia też przeżywa przeładowanie`), grupowy nie —
  a to inny rodzaj wpisu i inna gałąź `toggleGroup`.
- **F4** — brak testu „walidacja zatrzymuje zapis **przed siecią**" dla `maxPrepMinutes`.
  Wzorzec jest w `profile-screen.spec.ts` (dwa testy `F4`) i istnieje dlatego, że ten błąd raz
  już pojechał na produkcję. Wpisz wartość spoza 5–240, sprawdź błąd pod polem i **zero żądań
  `PUT`**.
- Poprawka akapitu o `0004 --remote` w `follow-ups/review-fixes.md` (§0 tej kolejki — dowód
  jedną komendą, praca zerowa).
- **Dopiero teraz** wpisz `Decision:` przy każdym z czterech ustaleń w
  `reviews/impl-review.md` i zostaw `status: impl_reviewed` w `change.md` jako prawdziwy.

### P3 — domknięcie S-03 · ~1–2 h

Trzy kryteria są dziś jawnie niesprawdzone i tak są opisane w planie — nie udawaj, że zniknęły.

- **1.6** — konto A nie widzi wykluczeń konta B. Wymaga **drugiego konta testowego** Clerka
  (`+clerk_test`). To samo konto zamyka przy okazji **2.9 z S-02** (`BLOCKED-MANUAL` od S-02)
  i fazę 3 z `test-plan.md`. Najwyższy zwrot z całego P3.
- **2.9** — Expo Go: zakładka z ikoną, wyszukiwarka używalna jedną ręką. Warstwy natywnej harness
  nie pokrywa; emulator Androida stoi na obrazie API 35 (nie 36.1) i wymaga firmowego DNS.
- **2.10** — czytelność listy przy 20 wpisach. Ocena wizualna, nie test.
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
przepisywać**. Trzymaj się tego: skrypt, który kopiuje próg, zasieje dania, których walidator
potem nie przyjmie.

Ręczne i nie do pominięcia: **przegląd gramatur** dwudziestu dań (od największej rozbieżności
`modelKcalHint`), przeczytanie trzech przepisów jak przepisu, i **decyzja skalowania** właściciela
na podstawie raportu pilotowego. Bez niej faza 4 nie startuje.

### P5 — F-01 faza 4: skalowanie puli · duże

Reszta puli do minimów (≥ 12 śniadań, ≥ 18 obiadów, ≥ 18 kolacji, ≥ 12 przekąsek), seed
`--remote`, `seed/FEASIBILITY.md`, opis puli i skryptów w `CLAUDE.md`.

Tu wraca odroczone z przeglądu fazy 1: **pole `meta` w `all<T>()`** w
[env.ts](../src/server/env.ts) razem z pomiarem CPU — sensowne dopiero, gdy jest co mierzyć.

### P6 — S-04: generator planu · nie zaczynaj przed P4

Blokują go **dwie decyzje właściciela** (§4), a nie kod. Planowanie da się zacząć wcześniej,
wdrożenie nie.

---

## 3. Czego NIE robić

- **Nie implementuj S-04 przed zamknięciem P4.** Blokada z `CLAUDE.md` obowiązuje: nie ma z czego
  wybierać ani czym liczyć kalorii.
- **Nie seeduj dań `--remote` bez `reviewedBy`.** Bramka w `seed-dishes.mjs` ma odmawiać — to jest
  jej jedyne zadanie.
- **Nie stempluj statusów przed zamknięciem ustaleń.** Dokładnie tak powstał dług z P1.
- **Nie rób `10x get`** — synchronizuje `.claude/skills/` i kasuje resztę.
- **Nie ruszaj ustawień repozytorium.**
- Nie archiwizuj `dish-source-and-seed-pool` — będzie w toku aż do P5.

---

## 4. Decyzje właściciela, które blokują tę pracę

1. **Otwarte pytanie 4 PRD** — próg i **treść komunikatu**, gdy planu nie da się ułożyć w ±10%.
   Kierunek jest w US-01, brakuje brzmienia. Blokuje S-04, nie blokuje P1–P5.
2. **Otwarte pytanie 6** — przejście na Workers Paid. **Nie blokuje planowania S-04, blokuje jego
   wdrożenie**: plan darmowy daje 10 ms CPU na żądanie, a generator liczy kombinacje.
3. **Decyzja skalowania** po raporcie pilotowym z P4 — ile dań i w jakim rozkładzie.
4. **F2, drobiazg**: dołożyć `aria-errormessage` czy poprawić komentarz. Jeśli nie odpowiesz,
   wykonawca wybierze implementację i zapisze to w Dzienniku.

---

## 5. Dziennik

Dopisuj po **każdym** zadaniu i przy każdej blokadzie.

```
### <HH:MM UTC> — <ID> <tytuł>
Wynik: ok | blocked | failed | pominięte
Co zrobione: <jedno–trzy zdania>
Co zacommitowane: <ścieżki — dowód, że nie było `git add -A`>
Werdykt przeglądu: <PASS/REJECTED + czy ustalenia mają Decision>
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
zmiany i przez to przepuściła PR #10 — trzy defekty, opisane w §1. Usunięta też przyczyna
migotania testów: `openPreferences` czekało na ODPOWIEDŹ, a nie na jej ZASTOSOWANIE.
Co zacommitowane: `src/components/ui/text-field.tsx`, `tests/e2e/preferences-screen.spec.ts`,
`context/changes/dietary-preferences/reviews/impl-review.md`,
`context/changes/dish-source-and-seed-pool/follow-ups/review-fixes.md`,
`.github/workflows/impl-review.yml`
Werdykt przeglądu: zielony; wszystkie ustalenia mają decyzje
PR: #15, #16, #17
Do decyzji: zostaje P3 — drugie konto testowe zakładam sam adresem `+clerk_test`, bez maila
właściciela.
