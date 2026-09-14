# Plan implementacji: źródło przepisów z makrami i zseedowana pula dań

> Zmiana: `dish-source-and-seed-pool` (F-01 mapy drogowej, kamień M-01) · Odnośniki PRD: FR-008,
> FR-009, FR-016, Open Questions 1, 2, 4 · Wymaganie wstępne: S-01, S-02 (oba `done`)
> Decyzja o źródle: [`options.md`](options.md), zapisana jako D14 w `notes/night-decisions.md`.
> **Wersja 2** (13.09.2026) — po przeglądzie planu, który zwrócił WYMAGA UWAGI z sześcioma
> ustaleniami krytycznymi. Co się zmieniło: patrz [`reviews/plan-review.md`](reviews/plan-review.md).

## Przegląd

Aplikacja dostaje **własną pulę dań w D1**: nazwy, gramatury składników, kroki przygotowania, czas
i makra policzone deterministycznie z tabeli USDA. Po tej zmianie generator planu (S-04) ma z czego
układać tydzień, a guardrail ±10% ma liczby, którym wolno ufać.

Ta zmiana **nie generuje planów** — dostarcza dane i dowód, że da się z nich złożyć dzień
w granicy ±10%.

## Analiza stanu obecnego

**Uwaga: [`research.md`](research.md) powstał 8.09.2026 i jego sekcja o stanie bazy kodu jest
nieaktualna.** Opisuje repo bez migracji, bez repozytorium i bez tras z tokenem. S-01 i S-02 od
tego czasu weszły na produkcję. Wnioski badania o **opcjach źródła** pozostają aktualne.

Co **jest** dzisiaj:

- **Migracje D1** — `0001_app_user.sql`, `0002_user_profile.sql`, każda z parą w `migrations/down/`.
  Komentarz w `0002` uzasadnia, dlaczego zakresy liczbowe **nie** wchodzą do `CHECK`, ale wyliczenia
  (`sex`, `activity_level`) już tak — ta granica obowiązuje też tutaj.
- **Warstwa repozytorium** — `src/server/repository/`; **żadna funkcja nie przyjmuje `env`**,
  wszystkie wołają `getWorkerEnv()` w środku (`app-users.ts`, `user-profile.ts`).
- **Czysty moduł z testem** — `src/lib/calorie-target.ts` + `.test.ts` na `node --test`.
- **`npm test`** — `node --test src/lib/*.test.ts`; glob obejmuje **wyłącznie `src/lib/`**.
- **Harness E2E** — `tests/e2e/`, 20 testów, Playwright poza repo.

Czego **nie ma**, a ta zmiana potrzebuje:

- **`all<T>()` w typie D1.** `src/server/env.ts` deklaruje `bind`, `first` i `run` (interfejs
  `D1PreparedStatement`, ok. linie 20–24). Pula to wiele wierszy.
- Tabel z danymi **nieużytkownika**. `app_user` i `user_profile` są per-konto; pula jest
  współdzielona i tylko do odczytu. To pierwszy taki byt w repo.
- Skryptów innych niż `check-lockfile.js` i `reset-project.js`. Oba są CommonJS; `package.json`
  nie ma `"type"`.

## Pożądany stan końcowy

1. Migracja `0003` tworzy schemat puli, z parą w `down/`.
2. W D1 (lokalnie i na produkcji) leży pula dań spełniająca **minima per pora posiłku** (niżej),
   każde danie z polską nazwą, czasem, składnikami z gramaturą, krokami w kolejności i makrami
   policzonymi z USDA.
3. Makra liczy **jeden moduł** (`src/lib/dish-macros.ts`) — nigdy SQL, nigdy skrypt osobno,
   nigdy model.
4. Istnieje **zmierzony dowód wykonalności ±10%** w trzech scenariuszach (bez filtrów, z limitem
   czasu, z limitem czasu i wykluczeniami) — albo jawna informacja, ilu dań brakuje i na której porze.
5. Zero kodu generatora planu. Zero tras API.

### Kluczowe odkrycia

- `src/server/env.ts` — `D1PreparedStatement` **nie ma `all()`**. Warunek wstępny odczytu puli.
- `src/server/repository/*.ts` — **żadna funkcja nie przyjmuje `env`**. Kontrakt z `env` jako
  argumentem wprowadziłby drugi styl w dwuplikowym katalogu.
- `npm test` widzi wyłącznie `src/lib/*.test.ts` — logika warta testu **musi** tam mieszkać,
  inaczej nie obejmie jej ani test, ani `tsc` (`tsconfig.json` nie zawiera `.js`).
- `scripts/check-lockfile.js` sprawdza **spójność wewnętrzną** lockfile'a — przechodzi na zielono
  także po dodaniu zależności. Dowodem „nie dołożyliśmy zależności" jest `git diff --exit-code`.
- D1 **nie ma jawnych transakcji**; atomową jednostką jest wykonanie/batch. Skrypty nie mają
  `bind()` poza runtime Workera.
- `research.md` §2 — oczekiwanie na D1 nie liczy się do limitu 10 ms CPU; przycinane wyszukiwanie
  nad ~60 daniami mieści się poniżej 1 ms.

## Czego NIE robimy

- **Generatora planu ani doboru dań pod cel w kodzie produkcyjnym** — to S-04. Skrypt pomiarowy
  z fazy 4 jest **diagnostyką jednorazową**: wolno mu być zachłannym i brzydkim, nie jest
  przekazywany dalej jako kod. Do S-04 idą **liczby z raportu**, nie algorytm.
- **Repozytorium i tras API dla puli.** Nic w tej zmianie nie uruchomiłoby `listDishes` —
  `npm test` widzi tylko `src/lib/`, a tras świadomie nie ma. Odczyt puli z aplikacji należy
  do S-04, która go pierwsza potrzebuje.
- **Tabeli wykluczeń** — model w [`options.md`](options.md) §4, implementacja w S-03.
  F-01 dostarcza `dish_ingredient`, na którym tamta zmiana stanie.
- **Wywoływania modelu w runtime.** Model autoryzuje przepisy raz, poza aplikacją.
- **Pełnego importu USDA**, zdjęć dań, ocen, wariantów porcji.

## Krytyczne szczegóły implementacji

- **Makra liczy `dish-macros.ts`, nigdy nic innego.** Zapytania kontrolne i skrypt pomiarowy
  **czytają wiersze i wołają ten moduł**. Policzenie makr drugi raz w SQL-u odtworzyłoby dokładnie
  ten błąd, który przegląd fazy 2 S-02 zgłosił dla zdublowanych `CHECK`-ów — a rozjazd zaokrągleń
  zapaliłby kryteria na czerwono z powodu artefaktu, nie defektu.
- **Stan składnika (surowy / ugotowany) jest częścią jego tożsamości.** USDA rozróżnia ryż surowy
  (~365 kcal/100 g) od ugotowanego (~130). Różnica jest wielokrotnością całego budżetu ±10%,
  a **ani przegląd gramatur, ani próg górny jej nie wykryje** — gramatura jest poprawna, wynik
  mieści się w zdroworozsądkowym zakresie. Konwencja: `ingredient.name` **zawsze zawiera stan**
  („ryż biały, suchy"), a przepisy podają gramaturę produktu **przed obróbką**.
- **Tożsamość dania to `slug`, nie nazwa wyświetlana.** Poprawka literówki w nazwie nie może tworzyć
  drugiego dania, a od S-04 `plan_item.dish_id` będzie na to wrażliwy.
- **Migracja `--remote` przed commitem fazy, która jej używa.** Push na `main` wdraża natychmiast.
- **Seed nie jest migracją** — dane wchodzą skryptem, więc zmiana treści dania nie wymaga migracji.

## Faza 1: Schemat puli dań

### Przegląd

Schemat i rozszerzenie typu D1. Po tej fazie schemat stoi, ale jest pusty. Nic tu nie zależy
od treści dań.

### Wymagane zmiany

#### 1. Migracja

**Plik**: `migrations/0003_dish_pool.sql` + `migrations/down/0003_dish_pool.down.sql`

**Cel**: schemat dla puli — danych współdzielonych, bez `user_id`.

**Kontrakt**:
- `ingredient` — `id`, `name` **UNIQUE** (polska, **zawiera stan**: „ryż biały, suchy”),
  `usda_fdc_id`, makra **na 100 g** (`kcal`, `protein_g`, `carbs_g`, `fat_g`),
  `category` **NOT NULL** z `CHECK` na zamkniętej liście (niżej), opcjonalne `grams_per_piece`
  (do prezentacji „2 jajka" zamiast „110 g" — FR-013/FR-016; `NULL` = produkt ważony).
- `dish` — `id`, **`slug` NOT NULL UNIQUE** (z nazwy pliku), `name` (wyświetlana, zmienna),
  `prep_minutes`, `created_at`. **Bez `servings`** — konwencja: *każdy przepis jest na jedną
  porcję* (patrz „Czego NIE robimy": warianty porcji poza MVP; dwuznaczność `perDish`/`perServing`
  łamałaby ±10% o cichy czynnik). **Bez kolumny makr** — liczone z `dish_ingredient`.
- `dish_meal_slot` — `dish_id`, `meal_slot`, klucz główny na parze, `CHECK` na wyliczeniu
  (`breakfast`/`lunch`/`dinner`/`snack`). **Relacja wiele-do-wielu, nie kolumna na `dish`**:
  obiad i kolacja to w praktyce ten sam zbiór, a przypisanie dania do jednego slotu dzieli pulę
  czterokrotnie dokładnie wtedy, gdy wykluczenia i limit czasu już ją przerzedziły.
- `dish_ingredient` — `dish_id`, `ingredient_id`, `grams`, klucz główny na parze.
- `dish_step` — `dish_id`, `position`, `text`, UNIQUE(`dish_id`, `position`).
- `CHECK` wyłącznie na niezmiennikach bazy (`grams > 0`, `position >= 1`, `prep_minutes` 5–120)
  **oraz na wyliczeniach** (`meal_slot`, `category`) — granica z komentarza w `0002`.
- `ON DELETE CASCADE` z `dish` na `dish_meal_slot`, `dish_ingredient`, `dish_step`.

**Zamknięty enum `category`** (roadmapa F-01 wymaga kategorii sklepowej; bez enuma S-07 dostanie
120 wierszy z `NULL` albo 40 wariantów literowych): `warzywa`, `owoce`, `mieso`, `ryby`, `nabial`,
`jaja`, `pieczywo`, `suche` (kasze, makarony, ryż, strączki), `tluszcze`, `przyprawy`, `inne`.

#### 2. Typ D1 z odczytem wielu wierszy

**Plik**: `src/server/env.ts`

**Cel**: pula to wiele wierszy.

**Kontrakt**: dodać `all<T = unknown>(): Promise<{ results: T[] }>` do `D1PreparedStatement`.
Reszta pliku bez zmian.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npx wrangler d1 migrations apply mealplan --local` stosuje `0003` bez błędu
- `npx wrangler d1 migrations list mealplan --local` bez zaległych
- `npx tsc --noEmit` czyste po rozszerzeniu typu
- Para wsteczna usuwa pięć tabel i wpis z `d1_migrations`; ponowne zastosowanie przechodzi
- `INSERT` z `category` spoza enuma i z `prep_minutes = 0` jest odrzucony przez bazę

#### Weryfikacja ręczna

- `.schema` obejrzany — pięć tabel, klucze obce i `CHECK`-i obecne

---

## Faza 2: Czyste moduły — makra i walidacja

### Przegląd

Cała logika warta testu ląduje w `src/lib/`, gdzie widzi ją `npm test` **i** `tsc`.
Faza jest w pełni testowalna, zanim powstanie choć jedno danie i zanim cokolwiek dotknie USDA.

### Wymagane zmiany

#### 1. Moduł liczący makra

**Plik**: `src/lib/dish-macros.ts` + `src/lib/dish-macros.test.ts`

**Cel**: z listy (makra na 100 g, gramatura) policzyć makra dania.

**Kontrakt**: `computeDishMacros(items: { per100g: Macros; grams: number }[]) → Macros`.
Czysty moduł — zero importów z Reacta, D1 i `@/server`. Zaokrąglanie zdefiniowane wprost
i **przypięte testem**.

#### 2. Moduł walidacji

**Plik**: `src/lib/dish-validation.ts` + `src/lib/dish-validation.test.ts`

**Cel**: orzec, czy danie nadaje się do seeda — **i wyłapać błędy makr, których człowiek nie widzi**.

**Kontrakt**: `validateDish(input, knownIngredients)` → `{ ok: true, value } | { ok: false, errors }`.
Sprawdza kształt (znane składniki, `grams > 0`, ≥ 1 krok, `prep_minutes` 5–120, ≥ 1 `meal_slot`
z enuma) **oraz trzy sita energetyczne**:
1. **Niezmiennik Atwatera**: `kcal ≈ 4·białko + 4·węgle + 9·tłuszcz` (±10%) — na poziomie składnika
   i dania. Wiersz USDA, który tego nie spełnia, jest prawie zawsze źle zmapowany.
2. **Próg dolny i górny na porcję** (np. 150–1500 kcal) — sam próg górny łapie wyłącznie błąd ×1000.
3. **Gęstość energetyczna dania** poza 0,3–5,0 kcal/g — sygnał alarmowy (czysty tłuszcz ≈ 9,
   warzywa ≈ 0,2).

Te trzy łapią klasy błędów (×10, ×0,1, zły wiersz USDA, składnik zmapowany na wodę), których
nie wykryje ani przegląd gramatur, ani próg „zdroworozsądkowy”.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm test` przechodzi; `dish-macros` pokrywa: wiele składników, zaokrąglanie, 0 g, pustą listę
- `dish-validation` pokrywa: nieznany składnik, `grams = 0`, zero kroków, zły `meal_slot`,
  `prep_minutes` poza zakresem, **naruszenie Atwatera**, gęstość poza zakresem
- Wyrocznia liczona **ręcznie z tabeli USDA** dla jednego znanego dania i wpisana jako stała —
  nigdy odczytana z implementacji
- `npx tsc --noEmit` i `npx expo lint` czyste

#### Weryfikacja ręczna

- Brak — faza jest w całości automatyczna

---

## Faza 3: Pilot — 20 dań przez cały potok

### Przegląd

**Najważniejsza faza tego planu.** Przepuszcza mały podzbiór przez *cały* potok (autorstwo →
mapowanie USDA → walidacja → seed → pomiar) i kończy się **jawną decyzją**, zanim ktokolwiek
napisze i przejrzy pozostałe 40 dań.

Powód: przegląd gramatur to większość nakładu tej zmiany i jest nieodwracalny. Jeśli pomiar po
60 daniach powie „potrzeba 90, w tym 20 więcej śniadań", cały ten nakład trzeba powtórzyć.
Pilot kosztuje kilka godzin i ratuje całą fazę 4 w złym scenariuszu.

### Wymagane zmiany

#### 1. Materiał źródłowy i prompt

**Pliki**: `seed/dishes/<slug>.json` (20 sztuk), `seed/PROMPT.md`

**Cel**: przepisy jako **dane w repo**, powtarzalnie rozszerzalne.

**Kontrakt**: jeden plik na danie; nazwa pliku **jest** `slug`. Pola: `name`, `mealSlots[]`,
`prepMinutes`, składniki (**polska nazwa ze stanem** + `grams`), kroki w kolejności,
`reviewedBy` i `reviewedAt` (patrz §4), oraz `modelKcalHint` — **pole jawnie nieautorytatywne**,
którego seed **nigdy nie zapisuje do D1**. Służy wyłącznie do uszeregowania przeglądu: dania,
w których deklaracja modelu rozjeżdża się z wyliczeniem z USDA o > 20%, człowiek ogląda najpierw.
Bez tego przegląd to 480 liczb bez priorytetu. `PROMPT.md` zapisuje regułę stanu składnika
i zakaz podawania makr jako prawdy.

#### 2. Destylat USDA i import

**Pliki**: `scripts/distill-usda.mjs`, `seed/usda-subset.json`, `scripts/import-usda.mjs`

**Cel**: makra składników w repo, odtwarzalne bez internetu i bez plików rzędu setek MB.

**Kontrakt**: `distill-usda.mjs` czyta **raz** pobrany przez człowieka plik USDA (poza repo,
w `.gitignore`) i destyluje go do małego, **wersjonowanego** `seed/usda-subset.json`
(`fdcId`, nazwa źródłowa, cztery makra na 100 g) dla składników wymienionych w
`seed/ingredients.json` — mapowania polska nazwa → `fdcId`, które jest osobnym, wersjonowanym
artefaktem i **głównym nośnikiem ryzyka rezydualnego** tej zmiany. `import-usda.mjs` czyta
destylat i produkuje SQL. Bez zależności — parser CSV pisany ręcznie, wyłącznie dla potrzebnych
kolumn.

#### 3. Seed

**Plik**: `scripts/seed-dishes.mjs`

**Cel**: wgrać zwalidowane dania; nigdy połowy.

**Kontrakt**: woła `validateDish` z `src/lib/` (import relatywny — Node zdejmuje typy z `.ts`,
tak jak już robi to `npm test`; **żadnej logiki walidacji ani liczenia makr w skrypcie**).
Przy błędzie **przerywa z pełną listą** i nie wgrywa nic. Przy powodzeniu produkuje plik `.sql`
zapisany przez `fs.writeFileSync(..., 'utf8')` — **nigdy przez przekierowanie powłoki**, które na
Windowsie dokłada BOM i psuje polskie znaki. Wgranie: `npx wrangler d1 execute mealplan
--local|--remote --file …`.

**Idempotencja po `slug`**: `on conflict(slug) do update` dla `dish`, a `dish_meal_slot`,
`dish_ingredient` i `dish_step` **przepisywane w całości** (`delete … where dish_id = ?`
przed wstawieniem). Bez tego usunięcie składnika z JSON-a zostawia osierocony wiersz, a danie
zachowuje po cichu stare, błędne kalorie — dokładnie ten tryb awarii, przed którym chroni cała zmiana.
Escapowanie apostrofów jest obowiązkowe (brak `bind()` poza Workerem).

**Wpisy w `package.json` → `scripts`**: `seed:dishes`, `import:usda`, `distill:usda`.

#### 4. Bramka przeglądu w danych, nie w prozie

**Cel**: uczynić obowiązkowy przegląd gramatur **egzekwowalnym**.

**Kontrakt**: `seed-dishes.mjs` **odmawia** seeda w trybie `--remote` dla dania bez `reviewedBy`
i `reviewedAt`, i raportuje listę. `seed/REVIEW.md` zostaje jako narracja, ale przestaje być
jedynym mechanizmem. To jedyne miejsce, gdzie sedno decyzji D14 dostaje techniczne oparcie zamiast
dyscypliny.

#### 5. Pomiar pilotowy i decyzja

**Plik**: `scripts/check-pool-feasibility.mjs`

**Cel**: odpowiedzieć liczbą, czy kierunek się trzyma — **zanim** powstanie reszta puli.

**Kontrakt**: czyta pulę z D1 (`wrangler d1 execute --json`), woła `computeDishMacros`
z `src/lib/` (**nie liczy makr sam**) i dla celów 1600/2000/2400/2800/3200 kcal raportuje odsetek
trafień w ±10% w **trzech scenariuszach**: bez filtrów, z limitem 30 min, z limitem 30 min plus
3–5 wykluczeń składnikowych. Dodatkowo raportuje **liczbę dań ocalałych na porę posiłku** w każdym
scenariuszu — to liczba, której S-03 i S-04 potrzebują do ustalenia progu z `options.md` §5.
Wyszukiwanie przycinane, nie pełna enumeracja.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Walidator odrzuca celowo zepsute danie (nieznany składnik, 0 g, zero kroków, naruszenie Atwatera)
  z czytelną listą i **nic nie wgrywa**
- Seed uruchomiony dwa razy daje ten sam stan bazy; **usunięcie składnika z JSON-a i ponowny seed
  usuwa go też z `dish_ingredient`** (test osieroconego wiersza)
- Seed w trybie `--remote` **odmawia** dla dania bez `reviewedBy`
- Po seedzie `--local`: 20 dań, każde z ≥ 1 składnikiem, ≥ 1 krokiem i ≥ 1 porą posiłku
- Polskie znaki w bazie nieuszkodzone (zapytanie kontrolne na nazwie ze znakiem diakrytycznym)
- `npm test`, `npx tsc --noEmit`, `npx expo lint` czyste
- `git diff --exit-code package-lock.json` — dowód, że nie doszła żadna zależność
  (`check-lock` tego **nie** mierzy)

#### Weryfikacja ręczna

- Człowiek przejrzał gramatury 20 dań, zaczynając od tych z największą rozbieżnością
  `modelKcalHint`, i wpisał `reviewedBy`/`reviewedAt`
- Trzy dania przeczytane jako przepis — da się z nich ugotować
- **DECYZJA SKALOWANIA**: raport pilotowy przeczytany; właściciel rozstrzyga „skalujemy do
  docelowej puli / zmieniamy rozkład por posiłku / zmieniamy podejście". Faza 4 **nie startuje**
  bez tej decyzji.

---

## Faza 4: Skalowanie puli i pomiar końcowy

### Przegląd

Dopiero po zielonym pilocie: autorstwo i przegląd reszty dań do rozmiaru wskazanego decyzją
z fazy 3, seed na produkcję i raport końcowy.

### Wymagane zmiany

#### 1. Reszta puli

**Pliki**: kolejne `seed/dishes/<slug>.json`, `seed/ingredients.json`, `seed/REVIEW.md`

**Cel**: pula spełniająca minima per pora posiłku.

**Kontrakt**: bez nowego kodu — ten sam potok. Minima domyślne (do korekty decyzją z fazy 3):
**≥ 12 śniadań, ≥ 18 obiadów, ≥ 18 kolacji, ≥ 12 przekąsek** (dania mogą liczyć się do wielu
por dzięki `dish_meal_slot`). Walidacja mapowań jest **pętlą**: seed → lista braków → uzupełnienie
`seed/ingredients.json` → seed.

#### 2. Raport końcowy i produkcja

**Cel**: pula na produkcji plus liczba, na której stanie S-04.

**Kontrakt**: `migrations apply --remote` przed commitem fazy; seed `--remote` (odmówi dla dań
nieprzejrzanych); `check-pool-feasibility.mjs` uruchomiony na pełnej puli, raport zapisany
do `seed/FEASIBILITY.md`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Minima per pora posiłku spełnione (zapytanie kontrolne)
- Wszystkie dania mają `reviewedBy`; seed `--remote` przechodzi bez odmów
- `npx wrangler d1 migrations list mealplan --remote` bez zaległych **przed** seedem
- Raport wykonalności wygenerowany dla pięciu celów × trzech scenariuszy
- `npm test`, `npx tsc --noEmit`, `npx expo lint` czyste; `git diff --exit-code package-lock.json`

#### Weryfikacja ręczna

- Raport wykonalności **oceniony przez właściciela**: czy odsetek trafień w scenariuszu
  z wykluczeniami jest akceptowalny dla S-04
- Pula policzona na produkcji zapytaniem `--remote`
- `CLAUDE.md` opisuje pulę i skrypty (przy okazji: zdanie „Nie ma runnera testów" jest już
  nieaktualne)

---

## Strategia testowania

### Testy jednostkowe (`npm test`)

- `dish-macros` — sumowanie, zaokrąglanie, przypadki brzegowe. Wyrocznia **z tabeli USDA policzonej
  ręcznie**, nie z implementacji (lekcja m3l2 — problem wyroczni).
- `dish-validation` — każdy tryb odrzucenia osobno, w tym trzy sita energetyczne.

### Sprawdzenia skryptami

- Idempotencja seeda **wraz z usuwaniem osieroconych wierszy dzieci**
- Odmowa seeda `--remote` bez `reviewedBy`
- Zapytania kontrolne: liczba dań, rozkład na pory, dania bez składników lub kroków, polskie znaki

### Kroki testowania ręcznego

1. Zastosuj `0003` lokalnie, obejrzyj schemat, cofnij parą z `down/`, zastosuj ponownie
2. Zepsuj danie, sprawdź, że walidator przerywa i nic nie wgrywa
3. Usuń składnik z JSON-a, przeseeduj, sprawdź, że zniknął z bazy
4. Przeczytaj trzy dania jak przepis
5. Przeczytaj raport wykonalności i zdecyduj o rozmiarze puli

## Uwagi dotyczące wydajności

Odczyt puli to I/O, nie CPU — limit 10 ms Workera nie jest zagrożony (`research.md` §2). Ryzyko
leży w doborze dań w S-04: naiwna pełna enumeracja (C(60,4) × 7 ≈ 3,4 mln sprawdzeń) może przebić
limit. Skrypt z faz 3–4 mierzy to poza Workerem i przekazuje S-04 **liczby**, nie kod.

## Uwagi dotyczące migracji

`0003` jest addytywna — nie dotyka `app_user` ani `user_profile`. Para wsteczna usuwa pięć tabel
i wpis z `d1_migrations`. Seed nie jest migracją.

## Otwarte ryzyka i założenia

- **Mapowanie polska nazwa → `fdcId` (`seed/ingredients.json`) jest głównym ryzykiem rezydualnym.**
  Zła pozycja daje wiarygodnie wyglądające, błędne makra. Łagodzone: konwencja stanu składnika,
  niezmiennik Atwatera, gęstość energetyczna, uszeregowanie przeglądu przez `modelKcalHint`.
- **Do zweryfikowania eksperymentalnie przed fazą 3** (przegląd planu nie rozstrzygnął): czy
  `wrangler d1 execute --file` przyjmie `BEGIN TRANSACTION` na `--remote`, oraz czy Node w tej
  instalacji zaimportuje `.ts` z pliku `.mjs`. Oba są założeniami kontraktu skryptów.
- Pula może okazać się za mała — faza 3 wykryje to po 20 daniach, nie po 60.
- Zakładam stabilność licencji USDA CC0 w horyzoncie MVP.

## Referencje

- Decyzja o źródle: [`options.md`](options.md), D14 w `notes/night-decisions.md`
- Przegląd tego planu: [`reviews/plan-review.md`](reviews/plan-review.md)
- Badanie: [`research.md`](research.md) (sekcja o stanie bazy kodu nieaktualna)
- Wzorce: `migrations/0002_user_profile.sql`, `src/lib/calorie-target.ts`

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.

### Phase 1: Schemat puli dań

#### Automated

- [x] 1.1 `migrations apply --local` stosuje `0003` bez błędu — c848474
- [x] 1.2 `migrations list --local` bez zaległych — c848474
- [x] 1.3 `npx tsc --noEmit` czyste po rozszerzeniu typu D1 o `all()` — c848474
- [x] 1.4 Para wsteczna usuwa pięć tabel i wpis z `d1_migrations`; ponowne zastosowanie przechodzi — c848474
- [x] 1.5 `INSERT` z `category` spoza enuma i `prep_minutes = 0` odrzucony przez bazę — c848474

#### Manual

- [x] 1.6 `.schema` obejrzany — pięć tabel, klucze obce i `CHECK`-i obecne

> **Odstępstwo od litery planu (Minor), naniesione świadomie.** Kontrakt fazy 1 wymieniał
> `prep_minutes` **5–120** jako `CHECK`. Migracja ma tylko `prep_minutes > 0`, bo zakres 5–120 jest
> **regułą produktową**, a nie niezmiennikiem bazy — a komentarz w `0002_user_profile.sql` wprost
> zakazuje kopiowania zakresów liczbowych do DDL: ich źródłem prawdy jest moduł walidacji, SQLite
> nie ma `ALTER TABLE … DROP CONSTRAINT`, więc korekta progu kosztowałaby przebudowę tabeli,
> a rozjazd wychodzi użytkownikowi jako 500 zamiast błędu pod polem. Plan sam powoływał się na tę
> granicę zdanie wcześniej — to była jego wewnętrzna sprzeczność. Zakres 5–120 wejdzie do
> `src/lib/dish-validation.ts` w fazie 2. Kryterium 1.5 pozostaje spełnione: `prep_minutes = 0`
> jest odrzucane przez bazę.
>
> **Zweryfikowane ponad kryteria:** kaskada `ON DELETE` — usunięcie dania zabrało jego pory,
> składniki i kroki, a wiersz `ingredient` przetrwał (składniki są współdzielone, nie należą
> do dania). To jest ścieżka, na której stanie idempotencja skryptu seedującego w fazie 3.
>
> Migracja zastosowana **`--local` i `--remote`** (produkcja ma pięć nowych tabel, `migrations list
> --remote` bez zaległych). Jest addytywna — nie dotyka `app_user` ani `user_profile`.

### Phase 2: Czyste moduły — makra i walidacja

#### Automated

- [x] 2.1 `npm test` przechodzi; `dish-macros` pokrywa przypadki brzegowe i zaokrąglanie — 1c10a6a
- [x] 2.2 `dish-validation` pokrywa każdy tryb odrzucenia, w tym Atwatera i gęstość energetyczną — 1c10a6a
- [x] 2.3 Wyrocznia policzona ręcznie z USDA, nie odczytana z implementacji — 1c10a6a
- [x] 2.4 `npx tsc --noEmit` i `npx expo lint` czyste — 1c10a6a

> **Faza wykonana w osobnym `git worktree`** (gałąź `f01-phase2`, scalona przez `78586d8`) —
> ćwiczenie izolacji pracy z lekcji m2l5. Testy: 66/66 w całym `src/lib/` (było 34).
>
> **Ustalenie ponad kryteria — do rozstrzygnięcia PRZED fazą 3.** Sito Atwatera przy tolerancji
> ±10% **na poziomie składnika** odrzuca warzywa bogate w błonnik z prawdziwymi liczbami USDA.
> Brokuł surowy: 34 kcal deklarowane wobec 41,17 kcal z ogólnych współczynników (4/4/9) —
> odchylenie **21%**, ponad dwukrotność tolerancji. Przyczyna nie jest błędem danych: USDA liczy
> energię wielu warzyw **własnymi** współczynnikami, z odjęciem błonnika, a ogólny wzór Atwatera
> traktuje cały błonnik jak węglowodany przyswajalne. Sito działa więc zgodnie z kontraktem
> i jednocześnie odrzuca produkty poprawne.
>
> **ROZSTRZYGNIĘTE 13.09.2026 — decyzja D20. Faza 3 odblokowana.**
>
> Sito dostaje **próg bezwzględny obok względnego**: `|zadeklarowane − Atwater| ≤ max(10% ×
> zadeklarowane, 12 kcal)`. Wariant „luźniejsza tolerancja procentowa" został **sprawdzony
> i odrzucony** — szpinak ma 28,1% odchylenia, pieczarka 29,4%, więc próg musiałby sięgnąć ~35%
> i przestałby cokolwiek łapać. Przyczyną nie jest dziedzina, tylko matematyka: tolerancja
> względna załamuje się blisko zera.
>
> Próg bezwzględny rozdziela oba przypadki czysto, bo **skala błędu, którego szukamy, jest o rząd
> wielkości większa** niż nadwyżka błonnikowa: ryż ugotowany podpięty pod suchy daje różnicę
> 224 kcal, błąd ×10 na produkcie niskokalorycznym 166 kcal, a najgorsze uczciwe warzywo
> (brokuł) 7,2 kcal.
>
> Blok testowy „ZNANE OGRANICZENIE" **zastąpiony**: cztery warzywa z prawdziwymi liczbami USDA
> przechodzą, trzy klasy błędów nadal są odrzucane. Celowe zepsucie (próg = 0) zaczerwieniło
> dokładnie cztery testy warzywne. `npm test` 77/77.

### Phase 3: Pilot — 20 dań przez cały potok

#### Automated

> **Wiersze 3.0a–3.0d dopisane 14.09.2026**, po tym jak właściciel przekazał agentowi cały
> przegląd gramatur (`notes/pool-queue.md` §4). Człowiek wyszedł z pętli, więc sito zostało
> jedyną obroną i musiało stwardnieć: makra składnika mają pochodzić z wiersza USDA, a nie
> z pamięci modelu. Pierwotny plan tego nie wymagał, bo zakładał przegląd przez człowieka.

- [x] 3.0a Każdy składnik ma `usda_fdc_id` i makra z destylatu USDA — 35/35 lokalnie i na
      produkcji; osiem wierszy miało wcześniej makra niezgodne z jakimkolwiek wierszem USDA
- [x] 3.0b Destylacja odrzuca `fdcId`, którego opis nie zgadza się z mapowaniem — sprawdzone
      celowym zepsuciem (`169251` pieczarki surowe → `169252` gotowane)
- [x] 3.0c Dwa przebiegi importu składników dają ten sam stan bazy
- [x] 3.0d Zmiana nazwy składnika nie tworzy drugiego wiersza i nie osierocą wykluczeń —
      zero osieroconych, 20 przypisań do grup zachowanych po trzech zmianach nazw
- [x] 3.1 Walidator odrzuca zepsute danie z pełną listą błędów i nic nie wgrywa — sprawdzone
      celowo zepsutym plikiem: pięć błędów naraz (nieznany składnik, 0 g, zero kroków, zero pór,
      czas 200 min) i **żaden SQL nie powstał**, mimo że pozostałe 20 dań było poprawnych
- [x] 3.2 Dwa przebiegi seeda dają ten sam stan bazy — porównane zrzuty nazw, gramatur, pór
      i kroków, identyczne co do znaku
- [x] 3.3 Usunięcie składnika z JSON-a usuwa go też z `dish_ingredient` po przeseedowaniu —
      brokuł zdjęty z dania „kurczak z ryżem i brokułem”, po ponownym seedzie zostają cztery
      składniki zamiast pięciu, bez osieroconego wiersza
- [x] 3.4 Seed `--remote` odmawia dla dania bez `reviewedBy` — sprawdzone usunięciem pola
      z jednego dania: `--remote` przerywa i nie tworzy SQL-a, a `--local` przechodzi (praca
      w toku wolno, produkcja nie)
- [x] 3.5 Po seedzie 20 dań, każde z ≥ 1 składnikiem, krokiem i porą posiłku — lokalnie
      i na produkcji: 20 dań, 90 składników, 82 kroki, 33 przypisania do pór, zero niekompletnych
- [x] 3.6 Polskie znaki w bazie nieuszkodzone — nazwy i kroki sprawdzone w obu bazach
- [x] 3.7 `npm test` 100/100, `npx tsc --noEmit`, `npx expo lint`, `check-conventions` czyste
- [x] 3.8 `git diff --exit-code package-lock.json` — zero nowych zależności

#### Manual

- [x] 3.9 Gramatury 20 dań przejrzane, `reviewedBy` wpisane — przegląd wykonał **agent**
      (upoważnienie właściciela 14.09.2026), a szeregowanie po rozjeździe `modelKcalHint` działa:
      największy rozjazd to 10% (jogurt z jabłkiem), przy progu odrzucenia 20%. Żadne danie
      nie zostało odrzucone i żadnej gramatury nie naginano pod sito
- [x] 3.10 Trzy dania przeczytane jako przepis — soczewica z warzywami, omlet z serem
      i szpinakiem, łosoś z ziemniakami: gramatury na jedną porcję są realne (90 g suchej
      soczewicy, 150 g jaj to trzy sztuki, 150 g łososia to jeden filet), kroki idą w kolejności
      i nie mają luk
- [x] 3.11 DECYZJA SKALOWANIA podjęta **przez agenta** (upoważnienie z `notes/pool-queue.md` §4,
      które rezerwuje eskalację na potrzebę puli rzędu trzykrotnie większej): skalujemy do minimów
      z planu, ale z **poprawioną kompozycją kaloryczną**. Raport i uzasadnienie:
      [seed/FEASIBILITY.md](../../../seed/FEASIBILITY.md)

### Phase 4: Skalowanie puli i pomiar końcowy

#### Automated

- [x] 4.1 Minima per pora posiłku spełnione — **20 śniadań** (min 12), **29 obiadów** (min 18),
      **33 kolacje** (min 18), **15 przekąsek** (min 12), policzone na produkcji
- [x] 4.2 Wszystkie dania mają `reviewedBy`; seed `--remote` przeszedł bez odmów — 58 dań
- [x] 4.3 `migrations list --remote` bez zaległych przed seedem — „No migrations to apply!"
- [x] 4.4 Raport wykonalności dla pięciu celów × trzech scenariuszy **× czterech liczb posiłków**
      — [seed/FEASIBILITY.md](../../../seed/FEASIBILITY.md). Główny wynik: 3200 kcal przeszło
      **z nieosiągalnego (0% wszędzie) do 38%** przy sześciu posiłkach, a 2800 z 12% do 68%
- [x] 4.5 `npm test` 100/100, `npx tsc --noEmit`, `npx expo lint`, `check-conventions` czyste;
      `git diff --exit-code package-lock.json` bez zmian

#### Manual

- [x] 4.6 Raport wykonalności oceniony **przez agenta** (upoważnienie z `notes/pool-queue.md` §4).
      Werdykt: pula się broni — każdy z pięciu celów ma trafienia także po odfiltrowaniu limitu
      30 minut i czterech wykluczeń. Wąskie gardło, które **nie zniknęło**: obiady i kolacje
      w limicie 30 minut (27 → 10 i 31 → 14). To pierwsza rzecz do dołożenia przy dalszym wzroście
- [x] 4.7 Pula policzona na produkcji: **58 dań, 51 składników** (wszystkie z `usda_fdc_id`),
      255 powiązań składnikowych, 227 kroków, 93 przypisania do pór, zero niekompletnych,
      polskie znaki nietknięte
- [x] 4.8 `CLAUDE.md` opisuje pulę i skrypty — blokada S-04 zdjęta, potok `seed/` opisany
      tabelą artefaktów i czterema regułami, które psują guardrail ±10%
