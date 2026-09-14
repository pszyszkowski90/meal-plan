# Kolejka: generator planu (S-04) i domknięcie fundamentu

Plik operacyjny i **jedyne źródło stanu** tej paczki prac — jak `pool-queue.md` dla puli dań.
Sesja przeżyje kompresję kontekstu tylko wtedy, gdy po każdym kroku dopisze wpis do Dziennika
na końcu. Nie trzymaj stanu w pamięci rozmowy.

Kolejność jest uszeregowana **kosztem niezrobienia**, nie tematem.

## Jak to uruchomić

```
/loop Wykonuj kolejne zadanie z notes/plan-queue.md. Trzymaj się sekcji Zasady. Po każdym zadaniu dopisz wpis do Dziennika na końcu pliku, otwórz PR, przeczytaj werdykt przeglądu i scal po zielonych bramkach. Nie zaczynaj G6 i nie czekaj na decyzje właściciela z sekcji 4 — pomiń, co zablokowane, i opisz to w Dzienniku.
```

Kolejne zadanie do wzięcia: **G3, faza 4** (ekran `/plan`, zakładka i E2E przeglądarkowe).

---

## 0. Stan wyjściowy — zmierzony 14.09.2026, nie założony

| Co | Stan |
|---|---|
| `main` | `c2201a8`; PR-y #20–#28 scalone 14.09 |
| Produkcja | zdrowa: `/api/health` → `{"ok":true,"d1":true}`, `/` 200, 404 dla nieznanej, `/api/account` 401 |
| D1 produkcyjna | **58 dań**, 51 składników (wszystkie z `usda_fdc_id`), 8 grup wykluczeniowych |
| Migracje `--remote` | `0001`–`0005` zastosowane, `migrations list` czysto |
| S-01, S-02, S-03 | `done`, zarchiwizowane |
| F-01 | fazy 1–4 wykonane, **plan ma zero oczekujących pozycji**, ale zmiana **nie jest zarchiwizowana** |
| S-04 | `proposed` — **nic nie istnieje**: brak change foldera, brak migracji, brak kodu |
| E2E | 44 testy, pełny zestaw zielony; `npm test` 100/100 |
| `test-plan.md` §3 | wszystkie cztery fazy `complete` |
| Konta testowe | A i B działają, poświadczenia w `~/.mealplan-e2e/.env`, poza repo |
| Bramka przeglądu | działa — zablokowała scalenie cztery razy w paczce puli, za każdym razem zasadnie |

**Czego NIE ma, a brzmi jakby było:** `seed/FEASIBILITY.md` mówi, że każdy z pięciu celów
kalorycznych jest osiągalny — to jest **własność puli**, nie dowód, że generator ją znajdzie.
Wyszukiwanie w raporcie jest przycinane i liczy złożenia jednego dnia; S-04 układa **siedem dni**
i musi jeszcze unikać powtórzeń.

---

## 1. Zasady

Pełny zestaw w `pool-queue.md` §1 — obowiązuje bez zmian. Tu nowe plus te, o które najłatwiej
się potknąć.

### Guardrail ±10% jest OGRANICZENIEM, nie preferencją

`CLAUDE.md` mówi to wprost i to jest jedyna reguła tej paczki, której złamanie unieważnia produkt:

- suma kalorii dnia mieści się w ±10% celu — **także po pojedynczej podmianie dania**,
- żaden posiłek nie zawiera pozycji z listy wykluczeń,
- żaden posiłek nie przekracza zadeklarowanego maksymalnego czasu przygotowania,
- gdy planu nie da się ułożyć — **błąd nazywający, którego z trzech ograniczeń nie da się
  spełnić**, i **żadnego planu częściowego**.

Ostatni punkt jest tym, który najłatwiej po cichu złamać: „prawie się zmieściło" jest kuszące
i niewidoczne dla użytkownika.

### Makra liczy `src/lib/dish-macros.ts`, nigdy zapytanie

Ta sama zasada, co przy celu kalorycznym: jedno źródło prawdy, zero dryfu. Generator ma czytać
`dish_ingredient` i wołać `computeDishMacros` — nie `SUM()` w SQL-u. Kopia arytmetyki w zapytaniu
rozjedzie się przy pierwszej korekcie gramatury, a guardrail liczy się z tego, co zastał.

Wzorzec jest już w repo: `scripts/check-pool-feasibility.mjs` robi dokładnie to i dlatego jego
raport zgadza się z tym, co pokaże ekran.

### Limit 10 ms CPU jest ostrzem, nie spowolnieniem

`infrastructure.md` §rejestr ryzyk: przekroczenie **zabija wywołanie**, nie spowalnia je.
Generator przeszukuje kombinacje pod trzema ograniczeniami naraz, więc to jest jedyne miejsce
w tym projekcie, gdzie ten limit realnie grozi.

**Dlatego pomiar CPU nie jest dodatkiem do S-04, tylko jego częścią** (G4). Bez liczby decyzja
o Workers Paid jest zgadywaniem, a z liczbą jest arytmetyką.

### Przypomnienia

- `npm install` zakazane → `npm ci`. Playwright poza repo:
  `cd ~/.mealplan-e2e && NODE_PATH="$HOME/.mealplan-e2e/node_modules" npx playwright test`
- `git add -A` zakazane. Stage po ścieżkach, wypisz je w Dzienniku.
- `--no-verify` zakazane. `10x get` zakazane.
- Znacznik czasu z `date -u +%H:%M`, wklejany **w tej samej komendzie**, w której piszesz wpis.
- **Przed `expo export` ubij `workerd.exe` i proces `wrangler dev`** — pętla `taskkill`
  w `pool-queue.md` §1; jeden strzał nie wystarcza, bo rodzic odradza dziecko.
- **Zapytanie do `wrangler --command` musi być JEDNĄ LINIĄ.** Znak nowej linii urywa polecenie,
  a objaw to `wrangler zwrócił 1` z pustym stderr.
- **`npm run x > plik` wkleja do pliku nagłówek npm.** Potrzebne `--silent` albo wywołanie
  wprost przez `node`.
- **Najpierw składniki, potem dania** — `seed-dishes.mjs` waliduje wobec pliku, nie wobec bazy.
- Warunek produkcyjny (`secret`, zmienna buildu, `migrations apply --remote`) wchodzi **przed**
  commitem fazy, która go potrzebuje.

---

## 2. Zadania

### G1 — Archiwizacja F-01 i statusy · ~30 min · **zrobione 14.09**

Plan `dish-source-and-seed-pool` ma **zero oczekujących pozycji** w obu fazach, a zmiana dalej
leży w `context/changes/`. To ten sam dług, co przy S-03: status opisuje zamiar, nie stan.

- `/10x-archive dish-source-and-seed-pool`
- `roadmap.md`: F-01 → `done` (dziś `implementing`), wpis w sekcji „Zrobione"
- tabela „Przekazanie do backlogu": F-01 → zrobione, S-04 → gotowe do `/10x-plan`
- **Osobny PR**, przed G3 — archiwizacja przenosi raport przeglądu poza `context/changes/`,
  więc zrobiona razem z pracą wyłączyłaby bramkę werdyktu (to samo, co przy S-03)

### G2 — PRD kłamie o czterech z pięciu Otwartych pytań · ~45 min · **zrobione 14.09**

`prd.md` §Open Questions wymienia pięć pytań, z których **cztery są rozstrzygnięte od 13.09**,
a PRD dalej opisuje je jako blokujące (`Blokuje: tak — cały generator planu`):

| Pytanie | Stan faktyczny |
|---|---|
| 1. Skąd przepisy i makra | **Rozstrzygnięte** — D14: model autoryzuje poza runtime, makra z USDA |
| 2. Czy źródło daje kroki | **Rozstrzygnięte** — jesteśmy autorem, `dish_step` |
| 3. Co, gdy planu nie da się ułożyć | **Delegowane agentowi** (`pool-queue.md` §4) — treść i próg do napisania w G3 |
| 4. Rozdział wykluczeń składnikowych od daniowych | **Rozstrzygnięte** — D14 + D21, jedna tabela `exclusion` z `kind` |
| 5. Uzasadnienie celu kalorycznego i nadpisanie | **Rozstrzygnięte i WDROŻONE** — S-02, ekran profilu |

To nie jest kosmetyka: PRD jest dokumentem, do którego sięga `/10x-plan` przy S-04. Pytanie
opisane jako blokujące, które nie blokuje, każe planować obejście problemu, którego nie ma.

Przy okazji sprawdź `roadmap.md` §Otwarte pytania — ma tę samą listę i tę samą nieaktualność.

### G3 — S-04: generator tygodniowego planu · duże · **sedno paczki** · **w toku: faza 3 z 4**

Pełna ścieżka 10x: `/10x-new first-weekly-plan` → `/10x-research` → `/10x-plan` →
`/10x-plan-review` → `/10x-implement`. **Nie skracaj jej** — to pierwsza zmiana w tym repo,
w której guardrail produktowy jest liczony, a nie tylko deklarowany.

Rzeczy, o które ta zmiana się rozbije, jeśli nie zostaną nazwane w planie:

- **Schemat.** `plan` i `plan_item` z `user_id` (D1 nie ma RLS — filtrowanie w SQL-u jest jedyną
  izolacją). Migracja `0006` plus para wsteczna w `migrations/down/`.
- **Siedem dni, nie jeden.** Raport wykonalności liczy złożenia jednego dnia. Plan tygodniowy
  musi jeszcze unikać powtórzeń — a to jest inne zadanie i inny koszt CPU.
- **Powtórzenia.** Czy to samo danie może wrócić w tygodniu, a jeśli tak, to jak często?
  Pula ma 58 dań, więc bez powtórzeń tydzień × 4 posiłki = 28 pozycji jest wykonalny, ale przy
  limicie 30 minut obiadów zostaje **12** — i wtedy nie jest.
- **Komunikat porażki** (Otwarte pytanie 3, delegowane agentowi). Ma nazwać, **którego z trzech
  ograniczeń** nie da się spełnić. Napisz go jako dane, nie jako `throw new Error('...')`
  rozsiane po kodzie.
- **Determinizm.** Czy dwa wywołania z tym samym profilem dają ten sam plan? Jeśli tak — łatwiej
  testować; jeśli nie — potrzebne ziarno, żeby dało się odtworzyć błąd.

Kryteria, które **muszą** znaleźć się w planie, bo to one bronią guardraila:

- plan, którego dzień wychodzi poza ±10%, **nie powstaje** — test na profilu skrajnym
- plan zawierający wykluczony składnik **nie powstaje** — test na koncie z 5 wykluczeniami
- plan z daniem powyżej limitu czasu **nie powstaje**
- gdy nie da się ułożyć — **błąd nazywający ograniczenie i zero planu częściowego**
- konto A nie widzi planu konta B (wzorzec: `tests/e2e/account-isolation.spec.ts`)

### G4 — Pomiar CPU i pole `meta` w `all<T>()` · ~1 h · **wejście do jedynej decyzji właściciela**

Odblokowane dopiero przez G3 — wcześniej nie ma czego mierzyć. Ustalenie F4 przeglądu fazy 1 F-01.

- pole `meta` w `all<T>()` w `src/server/env.ts` (D1 zwraca `meta.duration`)
- pomiar CPU generatora na **realnej puli 58 dań**, nie na próbce
- scenariusz najgorszy: limit 30 minut + 5 wykluczeń + cel 3200 kcal (najwęższe przejście)
- **wynik zapisz liczbą w Dzienniku** — to jest wejście do decyzji z §4

Jeśli pomiar pokaże przekroczenie 10 ms: **nie zgaduj i nie optymalizuj na ślepo** — przedstaw
liczbę właścicielowi (§4, punkt 1) i opisz, co zostało zmierzone.

### G5 — S-05: podmiana dania i trwałe odrzucenie · średnie

Dopiero po zielonym G3. FR-010 i FR-011.

**Uwaga, która psuje tę zmianę, jeśli zostanie przeoczona:** oznaczenie dania z planu zasila
**tę samą** listę wykluczeń co preferencje (`exclusion` z `source='plan'`), a nie drugi,
równoległy mechanizm. PRD jest w tym jednoznaczne, `options.md` §4 też. Dwa mechanizmy to
gwarantowany rozjazd przy pierwszym odsiewie.

Drugie: **podmiana pojedynczego dania też musi zmieścić dzień w ±10%** — `CLAUDE.md` mówi to
wprost. To jest trudniejsze niż generowanie od zera, bo trzy pozostałe posiłki są ustalone.

### G6 — S-06 / S-07 · NIE ZACZYNAJ w tej paczce

Tryb gotowania krok po kroku i lista zakupów. Oba są odblokowane przez F-01, ale ta paczka ma
skończyć się na działającym generatorze i podmianie — nie na czterech zmianach naraz.

---

## 3. Czego NIE robić

- **Nie licz makr w SQL-u.** `computeDishMacros` z `src/lib/` albo nic.
- **Nie zwracaj planu częściowego.** Nigdy, pod żadnym warunkiem, nawet „na razie".
- **Nie rozdzielaj wykluczeń z planu i z preferencji** na dwa mechanizmy.
- **Nie optymalizuj CPU przed pomiarem.** Najpierw liczba, potem decyzja.
- **Nie stempluj statusów przed zamknięciem ustaleń.** Tak powstał dług z P1 poprzedniej paczki.
- **Nie rób `10x get`** — synchronizuje `.claude/skills/` i kasuje resztę.
- **Nie ruszaj ustawień repozytorium** ani nie dodawaj współpracowników.
- **Nie przechodź na instancję Production Clerka** — wymaga własnej domeny i jest osobną zmianą
  (`CLAUDE.md`). `pk_test` na `workers.dev` jest świadomym stanem, nie usterką.

---

## 4. Co agent rozstrzyga sam, a co należy do właściciela

**Domyślnie rozstrzyga agent.** Ta sekcja ma jedną pozycję i jedną warunkową.

### Agent rozstrzyga sam i tylko odnotowuje w Dzienniku

| Rzecz | Dlaczego to nie jest decyzja właściciela |
|---|---|
| **Treść i próg komunikatu „planu nie da się ułożyć"** (PRD, pytanie 3) | Kształt jest rozstrzygnięty w `CLAUDE.md`: komunikat nazywa, którego z trzech ograniczeń nie da się spełnić. Brakuje słów — string, rzecz odwracalna. |
| **Czy danie może się powtórzyć w tygodniu i jak często** | Parametr doboru, odwracalny stałą. Pula ma 58 dań; przy limicie czasu obiadów zostaje 12, więc jakieś powtórzenia będą konieczne. Zmierz i zapisz. |
| **Determinizm generatora** | Decyzja implementacyjna o testowalności, nie produktowa. |
| **Kształt schematu `plan`/`plan_item`** | Wzorzec jest w repo (`0005`), a migracja wsteczna czyni ją odwracalną. |
| **Porządki w PRD i roadmapie (G2)** | Doprowadzenie dokumentu do stanu faktycznego nie jest zmianą decyzji — decyzje już zapadły, tylko nie zostały odnotowane. |

### Naprawdę należy do właściciela

1. **Workers Paid, 5 USD/mc** — jego pieniądze. **Ale nie jest to bloker „na zapas":** pytaj
   **dopiero po pomiarze z G4** i **tylko z liczbą w ręku**. Jeśli pomiar zmieści się w 10 ms,
   decyzji nie ma. Jeśli nie — przedstaw: zmierzone CPU, scenariusz, o ile przekracza.

2. **Ustawienia repozytorium** — gdyby kiedykolwiek były potrzebne.

### Przeniesione z poprzedniej paczki, świadomie odłożone

- **Stronicowanie katalogu składników i debounce wyszukiwarki** (F6 przeglądu S-03 fazy 2).
  Katalog ma 51 pozycji; filtrowanie po stronie klienta jest niezauważalne. **Próg powrotu:
  150 składników albo `GET /api/catalog` powyżej 100 kB.** Nie ruszaj wcześniej — to byłaby
  optymalizacja bez pomiaru.
- **`--allowedTools` dla recenzenta CI** (F3 raportu z PR #20). Agent przeglądu ma zgodę na
  `git commit`, ale nie na `node`/`npm`, więc nie odtwarza `tsc` ani `npm test` i opiera się na
  bramce jakości. Rozszerzenie flagi **zastępuje** domyślny zestaw narzędzi, a skutku nie da się
  sprawdzić na PR-ze, który tę zmianę wprowadza. Zostaje otwarte świadomie.

---

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

### 16:02 UTC — G1 Archiwizacja F-01 i statusy
Wynik: ok
Co zrobione: `dish-source-and-seed-pool` przeniesione do
`context/archive/2026-09-08-dish-source-and-seed-pool/` (9 plików, git rozpoznał jako `R` —
historia zachowana), `change.md` ostemplowane `status: archived` + `archived_at`. W `roadmap.md`
F-01 zamknięte w trzech miejscach: tabela „W skrócie" → `done`, linia `- **Status:**` w bloku
`### F-01` → `done` z liczbami z produkcji, wpis w sekcji „Zrobione". W tabeli „Przekazanie
do backlogu" F-01 → **Zrobione**, a S-04 → `yes` (wszystkie trzy wymagania wstępne zamknięte).
Sekcja „Otwarte pytania dotyczące mapy drogowej" **celowo nietknięta** — należy do G2.
Co zacommitowane: `context/changes/dish-source-and-seed-pool/` → `context/archive/2026-09-08-dish-source-and-seed-pool/`
(change.md, options.md, plan.md, plan-brief.md, research.md, follow-ups/review-fixes.md,
reviews/impl-review.md, reviews/impl-review-phase-1.md, reviews/plan-review.md),
`context/foundation/roadmap.md`, `notes/plan-queue.md`. Stage po ścieżkach, zero `git add -A`.
Werdykt przeglądu: przeczytany, bez blokerów. Jedno ustalenie — cztery martwe odnośniki
do starej ścieżki `context/changes/dish-source-and-seed-pool/` (`CLAUDE.md` 32 i 38,
`roadmap.md` 131 i 203). Zasadne, bo psuje je dokładnie ten PR. Naprawione na gałęzi przed
scaleniem, plus piąty odnośnik, którego recenzent nie widział (`notes/night-decisions.md:267` —
też żywy wskaźnik do `options.md`). Odnośniki w Dziennikach `notes/*-queue.md` **zostawione**:
zapisują, co zacommitowano w danym dniu, więc są faktem historycznym, nie martwym linkiem.
PR: #30
Do decyzji: —
Uwaga operacyjna: `git mv` padło na Windowsie `Permission denied` (dwa razy, także po ponowieniu).
Obejściem było `Move-Item` w PowerShellu plus `git add` po obu ścieżkach — git i tak wykrył
dziewięć zmian nazwy. Warto o tym pamiętać przy kolejnych archiwizacjach w tym repo.

### 16:16 UTC — G2 PRD i mapa drogowa doprowadzone do stanu faktycznego
Wynik: ok
Co zrobione: `prd.md` §Open Questions przepisane — cztery z pięciu pytań oznaczone jako
rozstrzygnięte, z datą, numerem decyzji i miejscem wdrożenia; numeracja 1–5 zachowana, bo
odwołują się do niej `CLAUDE.md` i zarchiwizowane zmiany. Jedyne, co zostaje otwarte, to
**treść i próg** komunikatu z pytania 3 — z jawnym „Właściciel: agent" i „Blokuje: nic",
zamiast dotychczasowego „Blokuje: tak — cały generator planu".
W `roadmap.md` ta sama operacja na §Otwarte pytania (pięć z sześciu zamkniętych) plus cztery
miejsca, które powtarzały tę samą nieaktualność: wiersz strumienia B, wiersz S-06 w tabeli
przekazania, blok „Niewiadome" S-04 i „Ryzyko" S-06.
**Znalezione przy okazji, warte zapamiętania:** obie listy pytań mają **rozjechaną numerację** —
pytanie 3 mapy to pytanie 4 PRD i odwrotnie, a pytanie 6 istnieje tylko w mapie. Dopisana
ramka ostrzegawcza w `roadmap.md`, bo cytowanie „Otwartego pytania 3" bez nazwy dokumentu
wskazuje dwie różne rzeczy.
**Własność pytania 3 doprecyzowana**: mapa mówiła „Właściciel: użytkownik", a `plan-queue.md` §4
przekazuje je agentowi. Zapisane po stronie agenta w obu dokumentach — inaczej G3 stanąłby
czekając na decyzję, której nikt nie ma podjąć.
**Pytanie 6 (Workers Paid) zostaje otwarte i u właściciela**, ale przeformułowane: pytamy
dopiero po pomiarze z G4 i tylko z liczbą w ręku, bo bez niej to bloker „na zapas".
Co zacommitowane: `context/foundation/prd.md`, `context/foundation/roadmap.md`,
`notes/plan-queue.md`. Stage po ścieżkach, zero `git add -A`. Zero zmian w kodzie i danych.
Werdykt przeglądu: PR otwarty, werdykt czytany przed scaleniem.
PR: #31
Do decyzji: —

### 17:05 UTC — G3 S-04, ścieżka 10x do planu + faza 1 (schemat)
Wynik: ok
Co zrobione: pełna ścieżka `/10x-new` → `/10x-research` → `/10x-plan` → `/10x-plan-review`,
bez skracania, plus **faza 1 z czterech** (migracja `0006`).

**Badanie znalazło trzy rzeczy, które wywróciły założenia tej kolejki** (`research.md` §E):
1. Kolejka zakładała, że wąskim gardłem powtórzeń jest **12 obiadów** przy limicie 30 minut.
   Zmierzone: wykluczenie **nabiału** przy tym samym limicie zostawia **2 śniadania**. Zakaz
   powtórzeń zamieniłby zwyczajny profil w błąd — powtórzenia muszą być dozwolone.
2. Pula ma **twardy sufit kaloryczny zależny od liczby posiłków**: przy 3 posiłkach maksimum dnia
   to 2542 kcal, więc cel 3200 jest nieosiągalny (potrzeba ≥ 2880). To porażka, której **nie
   powoduje** ani wykluczenie, ani limit czasu — komunikat mówiący „usuń wykluczenie" byłby
   nieprawdą.
3. `all<T>()` w `src/server/env.ts:29` **nie ma pola `meta`**. G4 zaczyna od tej linijki, a nie
   od dopisania pomiaru.

**Przegląd planu zwrócił DO PRZEMYŚLENIA — i słusznie.** Dziesięć ustaleń, sześć krytycznych,
wszystkie przyjęte (`reviews/plan-review.md`). Trzy najważniejsze:
- **Pierwsza reguła powtórzeń była arytmetycznie zła.** `ceil(7 / |pula|)` liczyło od liczby dni,
  a pora „snack" jest wybierana `7 × (posiłki − 3)` razy. Przy sześciu posiłkach reguła nie
  przepuszczała **żadnego** zmierzonego scenariusza, łącznie z pustym — czyli wywracała jedyną
  konfigurację, w której 3200 kcal jest osiągalne. Poprawione na `ceil(picks / |pula|)`
  **plus relaksacja**: rozmaitość ustępuje guardrailowi, a nie odwrotnie.
- **Dwa z czterech twardych ograniczeń nie miały żadnego kryterium na ścieżce sukcesu.**
  Wykluczenia i limit czasu występowały wyłącznie w scenariuszach porażki, więc literówka
  w `NOT EXISTS` przeszłaby cały zestaw na zielono. Dodane 2.6, 3.6 i 3.7, dwa ostatnie
  z wymogiem sprawdzenia **celowym zepsuciem**.
- **Ziarno wykluczało się z przycinaniem.** DFS po liście posortowanej rosnąco jest
  deterministyczny z konstrukcji; ziarno mogło coś zmienić tylko przez przestawienie kolejności,
  co unieważnia `break` — jedyną odpowiedź planu na limit 10 ms CPU. Rozstrzygnięte: ziarno
  wyznacza **punkt startowy z zawinięciem**, co daje dwa ciągi rosnące i zachowuje przycinanie.

Faza 1: migracja `0006` z `plan` i `plan_item` plus para wsteczna. Wszystkie siedem kryteriów
zaliczone **wykonaniem, nie odczytem kodu**: 14 sprawdzeń ograniczeń (`day_index` 0/1/7/8,
`meals_per_day` 2/7, `slot_index` 0, enum pory, klucz obcy do `dish`, duplikat klucza głównego,
obie kaskady), przebieg wstecz i z powrotem z potwierdzeniem, że wpis znika z `d1_migrations`
i wraca. `.schema` obejrzany.

**Migracja zastosowana na produkcji PRZED commitem** (`migrations list --remote` → „No migrations
to apply!", trzy obiekty w `sqlite_master`) — twarda reguła `CLAUDE.md`.

Co zacommitowane: `context/changes/first-weekly-plan/` (change.md, research.md, plan.md,
reviews/plan-review.md), `migrations/0006_plan.sql`, `migrations/down/0006_plan.down.sql`,
`context/foundation/roadmap.md` (S-04 → `planning`), `notes/plan-queue.md`.
Stage po ścieżkach, zero `git add -A`. `package-lock.json` nietknięty.
Werdykt przeglądu: przegląd **planu** przeczytany i rozliczony przed implementacją; werdykt
przeglądu implementacji z CI — po otwarciu PR.
PR: #32
Do decyzji: —
Uwaga: powtórzenia, determinizm, kształt schematu i treść komunikatu porażki rozstrzygnięte
**przez agenta** na podstawie pomiarów, zgodnie z §4. Zero pytań do właściciela.

### 17:33 UTC — G3 faza 2: czysty moduł generatora
Wynik: ok
Co zrobione: `src/lib/plan-generator.ts` (655 linii) i `src/lib/plan-generator.test.ts` —
30 nowych testów, `npm test` **130/130**. Wszystkie 17 kryteriów fazy 2 zaliczone.
Moduł importuje **wyłącznie** `./dish-validation.ts` (typ `MealSlot`), zgodnie z 2.16.
Stała `CalorieTolerance = 0.1` ma wreszcie jedno miejsce w repo — dotąd żyła jako liczba
w skrypcie `.mjs` i jako proza w `CLAUDE.md`.

**Zestaw sprawdzony CELOWYM ZEPSUCIEM — i pierwsze dwie próby niczego nie złapały.**
To jest najważniejsza rzecz z tej fazy:
1. Zdjęcie sprawdzenia okna w punkcie końcowym: **130/130 dalej zielone**. Powód: przy ostatniej
   pozycji `minRest` i `maxRest` są zerowe, więc przycinanie samo wpuszcza wyłącznie sumy z okna.
2. Zdjęcie przycinania górną granicą: **też 130/130 zielone** — łapie je sprawdzenie końcowe.
   Guardrail ma więc DWIE niezależne bramki i żadna nie przepuści dnia poza oknem w pojedynkę.
   Zapisane w komentarzu przy pętli, żeby nikt nie usunął jednej jako „martwego kodu".
3. Rozluźnienie `CalorieTolerance` do 0,5: **7 testów na czerwono**. To jest realny tryb awarii
   i zestaw go łapie.
4. Zdjęcie odsiewu wykluczeń: 3 czerwone. Zdjęcie limitu czasu: 4 czerwone.

**Kryterium 2.6 wymagało poprawki, bo w pierwszej wersji NIE łapało zepsutego odsiewu.**
Pula miała dania odrzucone o innych kaloriach niż dopuszczone, więc generator omijał je sam —
nie mieściły się w oknie — i zepsuty filtr przechodził na zielono. To jest dokładnie ten tryb
z `lessons.md`: kryterium przechodzące niezależnie od tego, czy rzecz działa. Poprawione: dania
odrzucone mają **te same kalorie** co dopuszczone i **niższe `id`**, więc po sortowaniu stoją
w liście pierwsze i zepsuty odsiew sięga po nie natychmiast. Po poprawce oba zepsucia łapane.

Co zacommitowane: `src/lib/plan-generator.ts`, `src/lib/plan-generator.test.ts`.
Stage po ścieżkach. `package-lock.json` nietknięty (sprawdzone `git diff --exit-code`).
Bramki: `npm test` 130/130, `tsc --noEmit` czysto, `expo lint` czysto,
`check-conventions` czysto (51 plików), `check-lock` czysto.
Werdykt przeglądu: patrz wpis o przeglądzie niżej.
PR: #33
Do decyzji: —

### 18:10 UTC — G3 faza 2, przegląd implementacji i poprawki
Wynik: ok
Co zrobione: **zadanie przeglądu w CI padło dwa razy** na PR #33 (2 min 31 s i 4 min 21 s),
za każdym razem w tym samym miejscu — po wykryciu planu, na etapie zbierania dowodów, bez
zapisania raportu. Diff ma 1207 linii nowego kodu plus plan powyżej tysiąca. Bramka czyta PLIK,
nie komentarz, więc bez raportu przepuściłaby PR **bez żadnego przeglądu**.
Zamiast obejść bramkę etykietą, przegląd wykonał agent adwersaryjny **lokalnie** — z prawem do
`npm test`, `tsc`, `check-conventions` i mutowania kopii modułu, czyli z większymi możliwościami
weryfikacji niż ma zadanie CI. Raport z decyzjami: `reviews/impl-review.md`.

Werdykt: **WYMAGA UWAGI** → po poprawkach **APPROVED**. Jedenaście ustaleń, dziewięć przyjętych
i naprawionych, dwa odłożone świadomie z powodem.

**F1 było realnym defektem i najdroższą rzeczą tej fazy.** Pora uboższa niż potrzeby dnia
(dwie przekąski przy sześciu posiłkach, gdzie dzień potrzebuje trzech różnych) **omijała krok 1
diagnozy**, bo żaden filtr nie był winny, a krok 2 jej nie łapał — `sumTop` po cichu sumowało
tyle dań, ile było, licząc brakujące posiłki jako 0 kcal. Sprawa spadała do przeszukiwania:
**39 561 węzłów, 19 ms** i werdykt `combination`. Trzy rzeczy złe naraz: zły powód (rada
„poluzuj filtry", choć żaden nie odsiewa), sprzeczny ładunek (przy porze całkiem pustej
`visitedNodes: 0`, czyli „przestrzeń wyczerpana" bez ani jednego węzła — kryterium 2.12 asertuje
`visitedNodes > 0`, więc kod potrafił wyemitować werdykt, który jego własne kryterium odrzuca)
i **koszt powyżej limitu 10 ms CPU**, czyli 500 zamiast obiecanego 422. Po poprawce ta sama
sonda: **1 ms** i `reason: 'calories'`.

**F2**: `DefaultNodeBudget = 200 000` kupowało **~12 ms**, czyli więcej niż 10 ms, których miało
bronić. Obniżone do 100 000 (~5,7 ms w tym samym pomiarze). Właściwa kalibracja na `workerd`
nadal należy do G4 — to było poprawienie wartości startowej na stronę bezpieczną, nie pomiar.

**Cztery ustalenia to luki w POKRYCIU, nie defekty** — i każda była mutacją, którą zestaw
przepuszczał: relaksacja (kryterium 2.10 było odhaczone, a jego test jej nie uruchamiał), kierunek
dolnego przycięcia (`continue` → `break` dawało fałszywe „nie da się" i zostawiało 30/30 zielone),
rozstrzygacz remisu w diagnozie i próg `needed`. Wszystkie cztery mają teraz testy, a każdy
sprawdzony **uruchomieniem swojej mutacji**.

**F5** to realna poprawka: limit użyć był kluczowany samym daniem, więc danie z pory obfitej
przenosiło tamten hojny limit do pory ciasnej — **39 z 58 dań realnej puli ma więcej niż jedną
porę**. Klucz to teraz para (danie, pora). Pierwsza próba zmieniła tylko odczyt, nie zasiew
i dekrementację — i **zestaw to złapał**, dwa testy powtórzeń zaczerwieniły się natychmiast.
Uczciwa adnotacja zapisana w komentarzu testu: samej mutacji klucza zestaw **nie łapie**, bo
limit jest miękki i różnica obu kluczy jest statystyczna, nie deterministyczna.

Przy okazji: `expo lint` wywrócił się pięcioma błędami `react-hooks/rules-of-hooks`, bo funkcja
pomocnicza nazywała się `useKey` — preset czyta każdą nazwę zaczynającą się od `use` jako hook
Reacta, niezależnie od tego, że plik nie ma z Reactem nic wspólnego. Przemianowana na `usageKey`,
powód zapisany w kodzie.

Co zacommitowane: `src/lib/plan-generator.ts`, `src/lib/plan-generator.test.ts`,
`context/changes/first-weekly-plan/reviews/impl-review.md`,
`context/changes/first-weekly-plan/plan.md`, `notes/plan-queue.md`. Stage po ścieżkach.
Bramki: `npm test` **136/136** (było 130), `tsc --noEmit`, `expo lint`, `check-conventions` czysto.
Werdykt przeglądu: przeczytany, wszystkie jedenaście ustaleń ma decyzję.
PR: #33
Do decyzji: —

### 19:08 UTC — G3 faza 3: repozytorium i trasa /api/plan
Wynik: ok
Co zrobione: `src/server/repository/plans.ts` (cztery funkcje) i `src/app/api/plan+api.ts`
(`GET`/`POST`), plus `tests/e2e/plan-api.spec.ts`, `tests/e2e/support/d1.ts` i dopisanie
`/api/plan` do `DataRoutes` oraz testu izolacji planu do `account-isolation.spec.ts`.
**Pełny zestaw E2E: 56/56** (było 44 przed tą paczką, 45 po fazie 1).

**Trzy rzeczy złapane własnym sprawdzaniem, zanim dotknął ich przegląd:**

1. **Ziarno było losowane DWA RAZY** — raz dla generatora, raz przy zapisie. Kolumna `plan.seed`
   wyglądałaby na użyteczną i kłamała przy pierwszej próbie odtworzenia zgłoszonego błędu.
   Teraz jedno `randomUUID()` idzie w oba miejsca.
2. **Pierwsza wersja kryterium 3.10 była BŁĘDNA.** Żądała `plan_item = 0` po nieudanym
   generowaniu, czyli zakładała, że konto wchodzi w test bez planu. Nieudane generowanie **nie ma
   prawa skasować działającego planu** — użytkownik straciłby tydzień pracy produktu za to, że
   zmienił cel na nieosiągalny. Właściwą własnością jest NIEZMIENNOŚĆ: tyle samo wierszy przed i po.
3. **Testy liczyły wiersze GLOBALNIE**, a baza jest współdzielona z kontem B z testu izolacji.
   Czerwieniły się dopiero, gdy do zestawu doszedł test z drugim kontem — czyli z powodu, którego
   nie ma w kodzie produktu. Wszystkie zapytania zawężone do `user_id` odczytanego z roszczenia
   `sub` tokenu, czyli DOKŁADNIE tej wartości, której używa `requireUserId`.

**Dwa celowe zepsucia, oba złapane** — każde przez pełny cykl: zepsucie → ubicie `workerd`
→ `expo export` → potwierdzenie zepsucia W ARTEFAKCIE (`grep` po `dist/server/`) → `wrangler dev`
→ przebieg testów:
- zdjęty warunek `NOT EXISTS` wykluczeń grupowych → **3.6 na czerwono**;
- zdjęty filtr `user_id` z obu `DELETE` w `savePlan` → **3.8 na czerwono**.
Drugie jest ważniejsze, niż wygląda: `POST` **zastępuje** plan, więc bez tego filtra konto B
skasowałoby plan konta A **wygenerowaniem własnego**, a A zobaczyłby po prostu „brak planu".

**Napotkane EBUSY przy `expo export`** — dokładnie lekcja z `lessons.md`. `taskkill` na `workerd`
nie wystarczył, bo `dist/client` trzymał proces `wrangler dev`; ubicie po `CommandLine` przez
PowerShell załatwiło sprawę. Bez tego build cicho serwowałby STARY artefakt, a zepsucie „przeszłoby
na zielono" nie dotarłszy do serwera.

**Kryterium 3.4 jest pokryte częściowo i tak zapisane w planie.** Gałąź `profile_missing` (409)
jest **nieosiągalna z harnessu**: konto testowe ma profil, a repo nie ma trasy kasującej profil
ani preferencje. Dopisanie takiej trasy wyłącznie po to, żeby test miał co wywołać, powiększałoby
powierzchnię produktu pod test. Zamiast tego kryterium dowodzi własności osiągalnej — że udany
`POST` zapisuje dokładnie `7 × mealsPerDay` pozycji — plus niezmiennika całej tabeli: każdy
nagłówek planu ma tyle pozycji, ile wynika z jego `meals_per_day`.

Co zacommitowane: `src/server/repository/plans.ts`, `src/app/api/plan+api.ts`,
`tests/e2e/plan-api.spec.ts`, `tests/e2e/support/d1.ts`, `tests/e2e/data-boundary.spec.ts`,
`tests/e2e/account-isolation.spec.ts`, `context/changes/first-weekly-plan/plan.md`,
`notes/plan-queue.md`. Stage po ścieżkach. `package-lock.json` nietknięty.
Bramki: `npm test` 136/136, `tsc --noEmit`, `expo lint`, `check-conventions` (53 pliki),
`check-lock` — wszystkie czysto. E2E 56/56 przeciw `wrangler dev` na zbudowanym `dist/`.
Werdykt przeglądu: PR otwarty, werdykt czytany przed scaleniem.
PR: #34
Do decyzji: —
