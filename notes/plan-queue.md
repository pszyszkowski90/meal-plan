# Kolejka: generator planu (S-04) i domknięcie fundamentu

Plik operacyjny i **jedyne źródło stanu** tej paczki prac — jak `pool-queue.md` dla puli dań.
Sesja przeżyje kompresję kontekstu tylko wtedy, gdy po każdym kroku dopisze wpis do Dziennika
na końcu. Nie trzymaj stanu w pamięci rozmowy.

Kolejność jest uszeregowana **kosztem niezrobienia**, nie tematem.

## Jak to uruchomić

```
/loop Wykonuj kolejne zadanie z notes/plan-queue.md. Trzymaj się sekcji Zasady. Po każdym zadaniu dopisz wpis do Dziennika na końcu pliku, otwórz PR, przeczytaj werdykt przeglądu i scal po zielonych bramkach. Nie zaczynaj G6 i nie czekaj na decyzje właściciela z sekcji 4 — pomiń, co zablokowane, i opisz to w Dzienniku.
```

Kolejne zadanie do wzięcia: **G2**.

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

### G2 — PRD kłamie o czterech z pięciu Otwartych pytań · ~45 min · **następne do wzięcia**

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

### G3 — S-04: generator tygodniowego planu · duże · **sedno paczki**

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
