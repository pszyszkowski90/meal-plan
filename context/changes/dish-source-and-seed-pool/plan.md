# Plan implementacji: źródło przepisów z makrami i zseedowana pula dań

> Zmiana: `dish-source-and-seed-pool` (F-01 mapy drogowej, kamień M-01) · Odnośniki PRD: FR-008,
> FR-009, FR-016, Open Questions 1, 2, 4 · Wymaganie wstępne: S-01, S-02 (oba `done`)
> Decyzja o źródle: [`options.md`](options.md), zapisana jako D14 w `notes/night-decisions.md`.

## Przegląd

Aplikacja dostaje **własną pulę dań w D1**: nazwy, gramatury składników, kroki przygotowania, czas
i makra policzone deterministycznie z tabeli USDA. Po tej zmianie generator planu (S-04) ma z czego
układać tydzień, a guardrail ±10% ma liczby, którym wolno ufać.

Ta zmiana **nie generuje planów** — dostarcza dane i dowód, że da się z nich złożyć dzień
w granicy ±10%.

## Analiza stanu obecnego

**Uwaga: [`research.md`](research.md) powstał 8.09.2026 i jego sekcja o stanie bazy kodu jest
nieaktualna.** Opisuje repo bez migracji, bez repozytorium i bez tras z tokenem. S-01 i S-02 od
tego czasu weszły na produkcję. Wnioski badania o **opcjach źródła** pozostają aktualne — zdezaktualizował
się wyłącznie opis infrastruktury.

Co **jest** dzisiaj:

- **Migracje D1** — [`0001_app_user.sql`](../../../migrations/0001_app_user.sql),
  [`0002_user_profile.sql`](../../../migrations/0002_user_profile.sql), każda z parą w
  [`migrations/down/`](../../../migrations/down/). Wzorzec numerowania i pary wstecznej jest ustalony.
- **Warstwa repozytorium** — [`src/server/repository/`](../../../src/server/repository/), reguła
  „`userId` pierwszym argumentem, filtrowanie w SQL-u, `prepare(` wyłącznie tutaj".
- **Moduł liczący** — [`calorie-target.ts`](../../../src/lib/calorie-target.ts) jako wzorzec czystego
  modułu z testem na `node --test`.
- **Harness E2E** — [`tests/e2e/`](../../../tests/e2e/), 20 testów.

Czego **nie ma**, a ta zmiana potrzebuje:

- **`all<T>()` w typie D1.** [`env.ts:21-27`](../../../src/server/env.ts) deklaruje `bind`, `first`
  i `run`. Pula dań to z definicji **wiele wierszy** — bez `all()` nie da się jej odczytać.
- Jakiejkolwiek tabeli z danymi nieużytkownika. `app_user` i `user_profile` są per-konto; pula dań
  jest **współdzielona i tylko do odczytu** dla wszystkich użytkowników. To pierwszy taki byt w repo.
- Skryptów innych niż `check-lockfile.js` i `reset-project.js`.

## Pożądany stan końcowy

1. Migracja `0003` tworzy `ingredient`, `dish`, `dish_ingredient`, `dish_step`, z parą w `down/`.
2. W D1 (lokalnie i na produkcji) leży **co najmniej 60 dań** rozłożonych na pory posiłku,
   każde z: polską nazwą, czasem przygotowania, listą składników z **gramaturą**, krokami
   w kolejności i makrami policzonymi z USDA.
3. Makra dania są sumą makr jego składników — policzoną **skryptem, nie wpisaną ręcznie** i nie
   pochodzącą od modelu.
4. `npm test` przypina regułę liczenia makr; zmiana gramatury zmienia wynik w przewidywalny sposób.
5. Istnieje **zmierzony dowód**, że z tej puli da się złożyć dzień w ±10% dla profili brzegowych
   (najniższy i najwyższy realny cel kaloryczny) — albo jawna informacja, że nie, wraz z liczbą
   brakujących dań.
6. Zero kodu generatora planu.

### Kluczowe odkrycia

- [`env.ts:21-27`](../../../src/server/env.ts) — typ `D1PreparedStatement` **nie ma `all()`**.
  Rozszerzenie typu jest warunkiem wstępnym fazy 4, nie kosmetyką.
- [`0002_user_profile.sql`](../../../migrations/0002_user_profile.sql) — wzorzec migracji z
  ograniczeniami `CHECK`; przegląd fazy 2 S-02 (ustalenie F1) odnotował, że **powielanie granic
  walidacji w `CHECK`** jest dublowaniem źródła prawdy. Tutaj `CHECK` ma pilnować wyłącznie
  niezmienników bazy (dodatnia gramatura, kolejność kroków), nie reguł produktowych.
- [`app-users.ts`](../../../src/server/repository/app-users.ts) — komentarz nagłówkowy nazywa regułę
  repozytorium. Pula dań jest **wyjątkiem od reguły `userId`**: to dane współdzielone, więc funkcje
  odczytu puli nie przyjmują `userId`. Ten wyjątek musi być w komentarzu, inaczej kolejny przegląd
  zgłosi go jako naruszenie izolacji.
- [`calorie-target.ts`](../../../src/lib/calorie-target.ts) — wzorzec „czysty moduł + test"; liczenie
  makr z gramatur należy do tej samej kategorii i tam powinno zamieszkać.
- `research.md` §2 — oczekiwanie na D1 **nie liczy się do limitu 10 ms CPU** Workera; przycinane
  wyszukiwanie nad ~60 daniami mieści się poniżej 1 ms. Plan Free wystarcza.

## Czego NIE robimy

- **Generatora planu tygodniowego ani żadnego doboru dań pod cel** — to S-04. Tutaj powstaje
  wyłącznie pomiar wykonalności, nie algorytm.
- **Ekranu przeglądania dań, wyszukiwarki, zdjęć** — pula jest na razie niewidoczna dla użytkownika.
- **Tabeli wykluczeń** — model rozpisany w [`options.md`](options.md) §4, ale implementacja należy
  do `dietary-preferences` (S-03). F-01 dostarcza `dish_ingredient`, na którym tamta zmiana stanie.
- **Wywoływania modelu językowego w runtime.** Model autoryzuje przepisy **raz, poza aplikacją**;
  Worker nigdy nie woła modelu. To jest sedno decyzji D14.
- **Pełnego importu USDA.** Wchodzi wyłącznie podzbiór składników faktycznie używanych w puli.
- **Zdjęć dań, ocen, ulubionych, wariantów porcji** — poza MVP.

## Podejście do implementacji

Cztery fazy od danych do dowodu:

1. **Schemat** — migracja i typ D1. Nic nie zależy od treści.
2. **Warstwa makr** — podzbiór USDA w `ingredient` plus czysty moduł liczący makra dania
   z gramatur. Deterministyczne i testowalne bez żadnych dań.
3. **Pula** — autorstwo przez model poza runtime, przegląd człowieka, walidacja, seed.
4. **Dowód** — odczyt z aplikacji i pomiar wykonalności ±10%.

Kolejność jest celowa: faza 2 jest testowalna **zanim** powstanie choć jedno danie, a faza 4 może
zaświecić na czerwono („pula za mała") bez psucia niczego, co już działa.

## Krytyczne szczegóły implementacji

- **Makra liczy skrypt, nigdy model.** To jest cała treść decyzji D14. Jeśli na którymkolwiek etapie
  liczba kalorii dania pochodzi z odpowiedzi modelu, zmiana straciła sens — guardrail ±10% wróci do
  sprawdzania liczby, która sama jest błędna (badania: MAPE energii ~36%).
- **Przegląd ilości przez człowieka jest obowiązkowy, nie zalecany.** Cztery niezależne źródła
  w `research.md` §7 zbiegają się w tym samym ostrzeżeniu: model myli się w gramaturach nawet wtedy,
  gdy nazwy składników są poprawne. Faza 3 nie ma prawa zakończyć się bez tego kroku.
- **Migracja `--remote` przed commitem fazy, która jej używa.** Push na `main` wdraża natychmiast
  (reguła z `CLAUDE.md`, przećwiczona przy `0001` i `0002`).
- **Seed nie jest migracją.** Dane puli wchodzą osobnym skryptem, nie plikiem w `migrations/` —
  inaczej każda zmiana treści dania wymagałaby nowej migracji, a `down/` musiałby umieć ją cofnąć.

## Faza 1: Schemat puli dań

### Przegląd

Cztery tabele i rozszerzenie typu D1. Po tej fazie schemat stoi, ale jest pusty.

### Wymagane zmiany

#### 1. Migracja

**Plik**: `migrations/0003_dish_pool.sql` + `migrations/down/0003_dish_pool.down.sql`

**Cel**: schemat dla puli dań — danych **współdzielonych**, bez `user_id`.

**Kontrakt**:
- `ingredient` — `id`, `name` (polska, unikalna), `usda_fdc_id`, makra **na 100 g**
  (`kcal`, `protein_g`, `carbs_g`, `fat_g`), `category` (do kategorii sklepowych z FR-013).
- `dish` — `id`, `name`, `meal_slot` (`breakfast` | `lunch` | `dinner` | `snack`),
  `prep_minutes`, `servings`, `created_at`. Makra **nie są tu przechowywane** — liczy się je
  z `dish_ingredient` (ta sama zasada, co cel kaloryczny w S-02: jedno źródło, zero dryfu).
- `dish_ingredient` — `dish_id`, `ingredient_id`, `grams`, klucz główny na parze.
- `dish_step` — `dish_id`, `position`, `text`; unikalność na (`dish_id`, `position`) — FR-016
  wymaga kroków jako osobnych rekordów z kolejnością, nie bloku tekstu.
- `CHECK` wyłącznie na niezmiennikach bazy (`grams > 0`, `position >= 1`, `prep_minutes > 0`),
  **nie** na regułach produktowych — patrz ustalenie F1 przeglądu fazy 2 S-02.
- Klucze obce z `ON DELETE CASCADE` z `dish` na `dish_ingredient` i `dish_step` (usunięcie dania
  usuwa jego części; ustalenie F7 tamtego przeglądu dotyczyło braku jawnego `ON DELETE`).

#### 2. Typ D1 z odczytem wielu wierszy

**Plik**: `src/server/env.ts`

**Cel**: pula to wiele wierszy; bez `all()` nie da się jej przeczytać.

**Kontrakt**: dodać `all<T = unknown>(): Promise<{ results: T[] }>` do `D1PreparedStatement`,
w kształcie zgodnym z runtime D1. Reszta pliku bez zmian — to jedyne miejsce w repo dotykające
`globalThis`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npx wrangler d1 migrations apply mealplan --local` stosuje `0003` bez błędu
- `npx wrangler d1 migrations list mealplan --local` bez zaległych
- `npx tsc --noEmit` czyste po rozszerzeniu typu
- Para wsteczna: ręczne uruchomienie `0003_dish_pool.down.sql` usuwa cztery tabele i wpis
  z `d1_migrations`

#### Weryfikacja ręczna

- Schemat obejrzany przez `wrangler d1 execute mealplan --local --command ".schema"` — cztery tabele,
  klucze obce obecne

---

## Faza 2: Warstwa makr z USDA

### Przegląd

Składniki z prawdziwymi makrami i deterministyczna reguła liczenia makr dania z gramatur.
Testowalna, zanim powstanie choć jedno danie.

### Wymagane zmiany

#### 1. Moduł liczący

**Plik**: `src/lib/dish-macros.ts` + `src/lib/dish-macros.test.ts`

**Cel**: z listy (składnik, gramatura) policzyć makra dania i kalorie na porcję.

**Kontrakt**: `computeDishMacros(items: { per100g: Macros; grams: number }[], servings: number)`
→ `{ perDish: Macros; perServing: Macros }`. Czysty moduł — zero importów z Reacta, D1 i `@/server`,
dokładnie jak `calorie-target.ts`. Zaokrąglanie zdefiniowane wprost i **przypięte testem**
(ta sama lekcja, co w S-02: zaokrąglanie jest częścią kontraktu, nie detalem).

#### 2. Import podzbioru USDA

**Plik**: `scripts/import-usda.js`

**Cel**: wypełnić `ingredient` makrami z USDA FoodData Central (CC0) dla składników używanych w puli.

**Kontrakt**: wejściem jest lista polskich nazw z mapowaniem na `fdcId`; wyjściem `INSERT`-y do
`ingredient`. Skrypt jest **idempotentny** (`on conflict(name) do update`) i **offline** —
plik źródłowy USDA pobiera człowiek raz, skrypt go tylko czyta. Bez sieci w trakcie działania,
żeby dało się go powtórzyć bez dostępu do internetu.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm test` przechodzi z nowym plikiem testu; pokrywa: sumowanie wielu składników, podział na
  porcje, zaokrąglanie, gramatura 0, pusta lista
- `npx tsc --noEmit` i `npx expo lint` czyste
- Skrypt uruchomiony dwa razy z rzędu daje ten sam stan `ingredient` (idempotencja)

#### Weryfikacja ręczna

- Dla trzech składników sprawdzonych ręcznie w USDA wartości w `ingredient` zgadzają się ze źródłem
- `npm run check-lock` czyste — import USDA **nie dokłada zależności** do `package.json`

---

## Faza 3: Autorstwo i zseedowanie puli

### Przegląd

Model autoryzuje przepisy raz, poza aplikacją. Człowiek przegląda ilości. Walidator odrzuca to,
czego nie da się zseedować. Skrypt wgrywa do D1.

### Wymagane zmiany

#### 1. Materiał źródłowy puli

**Plik**: `seed/dishes/*.json` (nowy katalog, wersjonowany)

**Cel**: przepisy jako **dane w repo**, a nie efekt wywołania modelu w nieznanym momencie.

**Kontrakt**: jeden plik na danie: nazwa, `meal_slot`, `prep_minutes`, `servings`, tablica
składników (polska nazwa + gramatura), tablica kroków w kolejności. **Zero pól z makrami** —
makra liczy faza 2. Prompt użyty do autorstwa zapisany obok w `seed/PROMPT.md`, żeby pula dała się
rozszerzyć powtarzalnie.

#### 2. Walidator i seed

**Plik**: `scripts/seed-dishes.js`

**Cel**: odrzucić wadliwe dania **przed** wejściem do bazy i wgrać resztę.

**Kontrakt**: waliduje każdy plik (znane składniki, gramatury dodatnie, ≥ 1 krok, `prep_minutes`
w zakresie, `meal_slot` z listy), **przerywa z listą błędów** zamiast wgrywać połowę, a przy
powodzeniu wstawia danie, jego składniki i kroki w jednej transakcji. Idempotentny po nazwie dania.

#### 3. Przegląd człowieka

**Plik**: `seed/REVIEW.md`

**Cel**: udokumentować, że ilości zostały sprawdzone — krok obowiązkowy z D14.

**Kontrakt**: lista dań z datą przeglądu i podpisem osoby; dania nieprzejrzane **nie wchodzą**
do puli produkcyjnej.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Walidator odrzuca celowo zepsute danie (nieznany składnik, gramatura 0, zero kroków) z czytelnym
  komunikatem i **niczego nie wgrywa**
- Po seedzie `--local`: ≥ 60 dań, każde ma ≥ 1 składnik i ≥ 1 krok (zapytanie kontrolne)
- Żadne danie nie ma makr spoza zakresu zdroworozsądkowego (np. > 2000 kcal na porcję) — zapytanie
  kontrolne łapie błąd gramatury rzędu ×1000
- `npm test`, `npx tsc --noEmit`, `npx expo lint` czyste

#### Weryfikacja ręczna

- **Człowiek przejrzał gramatury** wszystkich dań i podpisał `seed/REVIEW.md`
- Trzy losowe dania przeczytane jako przepis: czy da się z tego ugotować, czy kroki mają sens
- Rozkład na pory posiłku jest użyteczny (nie 55 obiadów i 5 śniadań)

---

## Faza 4: Dowód, że z puli da się ułożyć dzień

### Przegląd

Odczyt puli z aplikacji i **pomiar**, czy guardrail ±10% jest w ogóle osiągalny. Ta faza ma prawo
zakończyć się werdyktem „pula za mała" — i to jest jej wartość.

### Wymagane zmiany

#### 1. Repozytorium puli

**Plik**: `src/server/repository/dishes.ts`

**Cel**: odczyt dań z makrami — jedyne miejsce z SQL-em dla puli.

**Kontrakt**: `listDishes(env, filter?)` → dania z policzonymi makrami na porcję.
**Świadomy wyjątek od reguły repozytorium: BRAK argumentu `userId`**, bo pula jest współdzielona
i tylko do odczytu. Komentarz nagłówkowy musi ten wyjątek nazwać i uzasadnić, inaczej kolejny
przegląd zgłosi go jako naruszenie izolacji danych.

#### 2. Pomiar wykonalności

**Plik**: `scripts/check-pool-feasibility.js`

**Cel**: odpowiedzieć liczbą, nie przeczuciem, na pytanie „czy z tej puli da się trafić w ±10%".

**Kontrakt**: dla zestawu celów kalorycznych (np. 1600, 2000, 2400, 2800, 3200 kcal) i typowej
liczby posiłków szuka kombinacji mieszczącej się w ±10%; raportuje odsetek trafień, medianę
odchylenia i cele, dla których nie znalazł nic. Wyszukiwanie **przycinane**, nie pełna enumeracja —
`research.md` §8 ostrzega, że naiwne C(60,4) × 7 może przebić 10 ms CPU; tutaj biegnie poza
Workerem, ale ten sam algorytm trafi do S-04.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `listDishes` zwraca dania z makrami; wynik zgodny z liczeniem modułu z fazy 2 dla trzech dań
  sprawdzonych punktowo
- Pomiar wykonalności kończy się raportem dla wszystkich pięciu celów
- `npx tsc --noEmit`, `npx expo lint`, `npm test` czyste
- `npx wrangler d1 migrations list mealplan --remote` bez zaległych **przed** commitem fazy

#### Weryfikacja ręczna

- Raport wykonalności przeczytany i **oceniony przez właściciela**: czy odsetek trafień jest
  akceptowalny, czy pula wymaga rozszerzenia przed S-04
- Pula zseedowana na produkcji i policzona zapytaniem `--remote`

---

## Strategia testowania

### Testy jednostkowe (`npm test`)

- `dish-macros.ts` — sumowanie, porcje, zaokrąglanie, przypadki brzegowe (0 g, pusta lista,
  jeden składnik, dziesięć składników)
- Wyrocznia **z wymagania, nie z implementacji**: wartości oczekiwane liczone ręcznie z tabeli USDA
  dla jednego znanego dania i wpisane jako stałe (lekcja m3l2 — problem wyroczni)

### Sprawdzenia skryptami

- Walidator na celowo zepsutych daniach (nieznany składnik, gramatura 0, brak kroków, zły `meal_slot`)
- Idempotencja: dwa przebiegi seeda dają ten sam stan
- Zapytania kontrolne po seedzie: liczba dań, rozkład na pory, brak dań bez składników lub kroków

### Kroki testowania ręcznego

1. Zastosuj `0003` lokalnie, obejrzyj schemat, cofnij parą z `down/`, zastosuj ponownie
2. Uruchom import USDA dwa razy, porównaj stan `ingredient`
3. Zepsuj jedno danie w `seed/dishes/`, sprawdź, że walidator przerywa i nic nie wgrywa
4. Przeczytaj trzy dania jak przepis i oceń wykonalność w kuchni
5. Przeczytaj raport wykonalności i zdecyduj, czy pula jest dość duża dla S-04

## Uwagi dotyczące wydajności

Oczekiwanie na D1 nie liczy się do limitu 10 ms CPU Workera (`research.md` §2), więc odczyt puli
jest bezpieczny. Ryzyko leży w **doborze dań**, czyli w S-04: naiwna pełna enumeracja
(C(60,4) × 7 dni ≈ 3,4 mln sprawdzeń) może przebić limit. Skrypt z fazy 4 mierzy to poza Workerem
i dostarcza S-04 gotowy, przycinany algorytm zamiast domysłu.

## Uwagi dotyczące migracji

`0003` jest **addytywna** — nie dotyka `app_user` ani `user_profile`, więc nie ma ryzyka dla danych
użytkowników. Para wsteczna usuwa cztery tabele i wpis z `d1_migrations`. Seed nie jest migracją:
dane puli wchodzą skryptem, więc zmiana treści dania nie wymaga nowej migracji.

## Otwarte ryzyka i założenia

- **Błąd mapowania składnik → USDA** jest najpoważniejszym ryzykiem rezydualnym: zła pozycja
  w tabeli daje wiarygodnie wyglądające, ale błędne makra. Łagodzone przeglądem człowieka
  i zapytaniem kontrolnym na wartości spoza zakresu.
- **Pula może okazać się za mała** dla skrajnych celów kalorycznych. Faza 4 wykryje to **przed**
  budową generatora, a nie po.
- **Nuda** — 60 dań wyczerpuje się po kilku tygodniach. Poza zakresem MVP, ale `seed/PROMPT.md`
  ma sprawiać, że rozszerzenie puli jest powtarzalne, a nie jednorazowym wysiłkiem.
- **Zakładam, że licencja USDA CC0 nie zmieni się** w horyzoncie MVP.

## Referencje

- Decyzja o źródle: [`options.md`](options.md), D14 w `notes/night-decisions.md`
- Badanie: [`research.md`](research.md) (sekcja o stanie bazy kodu nieaktualna — patrz wyżej)
- Wzorzec migracji: [`0002_user_profile.sql`](../../../migrations/0002_user_profile.sql)
- Wzorzec czystego modułu z testem: [`calorie-target.ts`](../../../src/lib/calorie-target.ts)
- Wzorzec repozytorium: [`app-users.ts`](../../../src/server/repository/app-users.ts)

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw kroków.

### Phase 1: Schemat puli dań

#### Automated

- [ ] 1.1 `migrations apply --local` stosuje `0003` bez błędu
- [ ] 1.2 `migrations list --local` bez zaległych
- [ ] 1.3 `npx tsc --noEmit` czyste po rozszerzeniu typu D1 o `all()`
- [ ] 1.4 Para wsteczna usuwa cztery tabele i wpis z `d1_migrations`

#### Manual

- [ ] 1.5 Schemat obejrzany przez `.schema` — cztery tabele, klucze obce obecne

### Phase 2: Warstwa makr z USDA

#### Automated

- [ ] 2.1 `npm test` przechodzi z testem `dish-macros`, pokrywa przypadki brzegowe
- [ ] 2.2 `npx tsc --noEmit` i `npx expo lint` czyste
- [ ] 2.3 Import USDA uruchomiony dwa razy daje ten sam stan `ingredient`
- [ ] 2.4 `npm run check-lock` czyste — bez nowych zależności

#### Manual

- [ ] 2.5 Trzy składniki sprawdzone ręcznie w USDA zgadzają się z `ingredient`

### Phase 3: Autorstwo i zseedowanie puli

#### Automated

- [ ] 3.1 Walidator odrzuca zepsute danie z czytelnym komunikatem i nic nie wgrywa
- [ ] 3.2 Po seedzie `--local` ≥ 60 dań, każde z ≥ 1 składnikiem i ≥ 1 krokiem
- [ ] 3.3 Zapytanie kontrolne nie znajduje dań z makrami spoza zakresu zdroworozsądkowego
- [ ] 3.4 `npm test`, `npx tsc --noEmit`, `npx expo lint` czyste

#### Manual

- [ ] 3.5 Człowiek przejrzał gramatury wszystkich dań i podpisał `seed/REVIEW.md`
- [ ] 3.6 Trzy losowe dania przeczytane jako przepis — da się z nich ugotować
- [ ] 3.7 Rozkład na pory posiłku jest użyteczny

### Phase 4: Dowód, że z puli da się ułożyć dzień

#### Automated

- [ ] 4.1 `listDishes` zwraca makra zgodne z modułem z fazy 2 dla trzech dań
- [ ] 4.2 Pomiar wykonalności kończy się raportem dla pięciu celów kalorycznych
- [ ] 4.3 `npx tsc --noEmit`, `npx expo lint`, `npm test` czyste
- [ ] 4.4 `migrations list --remote` bez zaległych przed commitem fazy

#### Manual

- [ ] 4.5 Raport wykonalności oceniony przez właściciela
- [ ] 4.6 Pula zseedowana na produkcji i policzona zapytaniem `--remote`
