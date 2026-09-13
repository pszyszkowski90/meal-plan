# Plan implementacji: preferencje żywieniowe

> Zmiana: `dietary-preferences` (S-03 mapy drogowej, kamień M-01) · Odnośniki PRD: FR-004, FR-006,
> FR-007, Open Question 4 · Wymagania wstępne: S-01, S-02 (`done`), **F-01 faza 1** (schemat puli)
> Model wykluczeń: [`../dish-source-and-seed-pool/options.md`](../dish-source-and-seed-pool/options.md) §4,
> decyzja D14 w `notes/night-decisions.md`.
>
> **Ugruntowany badaniem 13.09.2026: [research.md](research.md).** Trzon planu badanie potwierdziło.
> Naniesione poprawki: `ingredient.category` **nie** udźwignie wykluczeń (Otwarte ryzyka),
> `max_prep_minutes` 5–240 nie należy do `CHECK` (faza 1), naprawa dostępności musi objąć także
> warstwę natywną (faza 2), test inwentarza zakładek `3.13` wymaga rozszerzenia (faza 2).
> **Przeramowany 13.09.2026: [frame.md](frame.md).** Kontrola krzyżowa wykazała, że pierwotne
> nazwanie problemu („guardrail będzie łamany") jest **nadinterpretacją**: PRD definiuje guardrail
> względem **zapisanej listy**, a FR-004 mówi o „potrawach i składnikach", nie o pojęciach.
> Rzeczywisty problem to **luka wymagań**, nie defekt — więc kolejność brzmi
> **PRD → schemat → ekran**, a pierwszym artefaktem do zmiany jest Otwarte pytanie 4 PRD.
> **Faza 1 jest zablokowana** do czasu rozstrzygnięcia przez właściciela warstwy grup
> wykluczeniowych — [research.md](research.md), Otwarte pytania 1.

## Przegląd

Użytkownik wskazuje, **czego nie chce jeść**, ile najwyżej chce gotować i na ile posiłków dzieli
dzień. To trzy ostatnie wejścia, których brakuje generatorowi planu (S-04): cel kaloryczny dała
S-02, dania dała F-01, a tutaj powstaje reszta ograniczeń.

Sednem jest **jedna lista wykluczeń** o dwóch rodzajach wpisu — składnikowym i daniowym.

## Analiza stanu obecnego

Co **jest**:

- **Profil użytkownika** — `user_profile` (migracja `0002`), repozytorium `user-profile.ts`,
  trasa `profile+api.ts` z kontraktem `{ profile, target }` dla `GET` i `PUT`. To jest **wzorzec
  odniesienia** dla tej zmiany: ta sama granica danych, ten sam kształt trasy, ten sam sposób
  obsługi `OfflineError` / `NotSignedInError`.
- **Ekran profilu** — `src/app/(app)/profile.tsx` z `ChoiceField` (`radiogroup` + nazwane `radio`)
  i `TextField`. `ChoiceField` powstał w S-02 jako prymityw właśnie z myślą o trzecim użyciu tutaj
  (liczba posiłków).
- **Zakładki** — `app-tabs.tsx` i `app-tabs.web.tsx`; **dodanie zakładki wymaga edycji obu**.
- **Harness E2E** — `tests/e2e/` z helperami; wzorzec `openProfile()` (czekanie na odpowiedź
  przed pisaniem) przenosi się tu jeden do jednego.

Czego **nie ma**:

- Tabeli wykluczeń ani żadnej relacji użytkownik → składnik/danie.
- Wyszukiwarki składników. Wykluczenie składnikowe wymaga **wyboru z listy**, nie wpisania tekstu —
  a lista pochodzi z `ingredient` (F-01).
- Pól `max_prep_minutes` i `meals_per_day`. To są **preferencje**, nie dane do wzoru kalorycznego,
  więc nie należą do `user_profile` (jego kontrakt pilnuje `validateProfile` i zmiana kształtu
  wywróciłaby S-02).

## Pożądany stan końcowy

1. Zakładka **Preferencje** na obu platformach.
2. Użytkownik dodaje i usuwa wykluczenia dwóch rodzajów; ekran pokazuje **jedną listę**
   z oznaczeniem rodzaju, nie dwie osobne sekcje.
3. Ustawia maksymalny czas przygotowania i liczbę posiłków dziennie (3–6).
4. `GET`/`PUT /api/preferences` z jednym kontraktem; granica danych jak w `/api/profile`.
5. Wykluczenie składnikowe odsiewa **każde** danie zawierające ten składnik — dowiedzione testem
   na daniu, którego nazwa o składniku nie mówi.
6. Zero kodu generatora planu.

### Kluczowe odkrycia

- `options.md` §4 — `source` (`preferences` / `plan`) służy **wyłącznie** prezentacji i **nigdy**
  nie wpływa na dobór dań; inaczej powstaną dwa mechanizmy tylnymi drzwiami wbrew PRD.
- Przegląd S-02 (ustalenie F1) — nie powielaj granic walidacji w `CHECK`; wyliczenia tak, zakresy nie.
- Przegląd S-02 (F2) — trasa oddająca dane osobowe potrzebuje `Cache-Control: no-store`.
  Wykluczenia żywieniowe są daną wrażliwą (mogą ujawniać stan zdrowia lub wyznanie).
- Wyścig wykryty w S-02: odpowiedź początkowego `GET` nadpisuje to, co użytkownik zdążył wpisać.
  Ekran preferencji ma ten sam kształt — **strażnik `touched` obowiązuje od pierwszej linii**.
- `ChoiceField` przyjmuje `value: T | null` i renderuje `radiogroup` — gotowy do liczby posiłków.
- `TextField` **nie nadaje polom nazw dostępnościowych** (ustalenie F6 przeglądu S-02). Ta zmiana
  dokłada pola formularza, więc jest naturalnym miejscem, żeby to naprawić u źródła.

## Czego NIE robimy

- **Generatora planu i odsiewania dań w runtime** — S-04. Tutaj powstaje **zapytanie odsiewające
  i jego test**, ale nie użycie go do układania tygodnia.
- **Preferencji pozytywnych (FR-005)** — nice-to-have poza obowiązkowym zakresem MVP.
- **Oznaczania dań z planu (FR-011)** — to S-05; zasili tę samą tabelę z `source = 'plan'`.
  Tutaj powstaje wyłącznie schemat, który na to pozwoli.
- **Diet nazwanych** (wegetariańska, bezglutenowa) jako presetów — poza zakresem; użytkownik
  wyklucza konkretne składniki.
- **Komunikatu „planu nie da się ułożyć"** — próg i treść należą do S-04 (`options.md` §5).

## Krytyczne szczegóły implementacji

- **Wykluczenie składnikowe wskazuje `ingredient_id`, nigdy tekst.** Dopasowanie po nazwie złamie
  guardrail przy pierwszym „risotto z borowikami" — to jest dokładnie ten tryb awarii, przed którym
  ostrzega wyzwanie sokratejskie przy FR-004. Konsekwencja: ekran potrzebuje wyszukiwarki po
  `ingredient`, a nie pola tekstowego.
- **Jedna tabela, dwa rodzaje wpisu.** `kind` rozstrzyga, które z `ingredient_id` / `dish_id` jest
  wypełnione. Dwie osobne tabele oznaczałyby dwa mechanizmy — PRD wymaga jednego.
- **Preferencje to osobna tabela od profilu.** `user_profile` ma kontrakt pilnowany przez
  `validateProfile` i wzór kaloryczny; dołożenie tam `meals_per_day` rozjechałoby S-02.

## Faza 1: Schemat i granica danych

### Wymagane zmiany

#### 1. Migracja

**Plik**: `migrations/0004_preferences.sql` + para w `down/`

**Kontrakt**:
- `user_preferences` — `user_id` (PK, FK → `app_user`), `max_prep_minutes`, `meals_per_day`,
  `updated_at`. `CHECK` tylko na niezmiennikach (`meals_per_day` 3–6, `max_prep_minutes` 5–240).

  > **Skorygowane badaniem 13.09.2026** ([research.md](research.md) §4.3): ten zapis łamie
  > precedens, który plan sam cytuje dwie sekcje wyżej (ustalenie F1 przeglądu S-02 — „nie powielaj
  > granic walidacji w `CHECK`"). `meals_per_day` 3–6 broni się jako **enumeracja** czterech
  > dopuszczalnych wartości i zostaje. `max_prep_minutes` 5–240 to **zakres liczbowy** — dokładnie
  > to, czego zakazuje komentarz w `migrations/0002_user_profile.sql:29-34`, bo SQLite nie ma
  > `ALTER TABLE … DROP CONSTRAINT`, a rozjazd wychodzi użytkownikowi jako 500 zamiast błędu pod
  > polem. **Zakres przenieś do `src/lib/preferences.ts`**, w DDL zostaw najwyżej niezmiennik
  > strukturalny (`max_prep_minutes > 0`), analogicznie do `prep_minutes` w `0003`.
- `exclusion` — `id`, `user_id` (FK), `kind` (`CHECK` na `'ingredient'|'dish'`),
  `ingredient_id` (FK → `ingredient`, NULL dla `kind='dish'`), `dish_id` (FK → `dish`,
  NULL dla `kind='ingredient'`), `source` (`CHECK` na `'preferences'|'plan'`), `created_at`.
- `CHECK` spójności: dokładnie jedno z `ingredient_id` / `dish_id` niepuste, zgodnie z `kind`.
- Unikalność: (`user_id`, `kind`, `ingredient_id`, `dish_id`) — dwukrotne wykluczenie tego samego
  nie tworzy duplikatu.
- Indeks na `user_id` — każde zapytanie odsiewające startuje od niego.

#### 2. Repozytorium i trasa

**Pliki**: `src/server/repository/preferences.ts`, `src/app/api/preferences+api.ts`

**Kontrakt**: kształt jeden do jednego z `user-profile.ts` + `profile+api.ts`:
`userId` pierwszym argumentem, filtrowanie po nim w SQL-u, `prepare(` tylko w repozytorium,
`requireUserId` → repozytorium → JSON, `Cache-Control: no-store`, log błędu bez `userId` i bez ciała.
`GET` zwraca `{ preferences, exclusions }`; `PUT` przyjmuje ten sam kształt.
Walidacja w **czystym module** `src/lib/preferences.ts` z testem (jak `calorie-target.ts`) —
`npm test` widzi tylko `src/lib/`.

#### 3. Zapytanie odsiewające

**Plik**: `src/server/repository/preferences.ts`

**Cel**: udowodnić, że model wykluczeń działa — **zanim** S-04 na nim stanie.

**Kontrakt**: `listAllowedDishes(userId)` → dania po odsiewie wykluczeń **obu rodzajów** i limitu
czasu. To jedyna funkcja tej zmiany, którą przejmie S-04.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `migrations apply --local` stosuje `0004`; para wsteczna cofa; `migrations list --local` czysto
- `INSERT` łamiący `CHECK` spójności (`kind='ingredient'` z `dish_id`) odrzucony przez bazę
- Podwójne wykluczenie tego samego składnika nie tworzy drugiego wiersza
- `GET`/`PUT /api/preferences` bez `Authorization` → 401; z podrobionym tokenem → 401
- `GET` zwraca `Cache-Control: no-store`
- Konto A nie widzi wykluczeń konta B (test na dwóch tożsamościach)
- **`listAllowedDishes` odsiewa danie, którego NAZWA nie zawiera wykluczonego składnika** —
  test na „risotto z borowikami" przy wykluczeniu `ingredient_id` dla „borowiki, suszone"

  > **Przeredagowane 13.09.2026** ([frame.md](frame.md), wymiar F; [research.md](research.md) §4.3).
  > Poprzednie brzmienie żądało wykluczenia **„grzyby"** — a w modelu tego planu
  > (`kind='ingredient'` → `ingredient_id`) **nie ma czego wskazać**: w `ingredient` są „pieczarki,
  > świeże" i „borowiki, suszone", bo nazwa niesie stan (`migrations/0003_dish_pool.sql:23-27`).
  > Kryterium dało się zaliczyć wyłącznie wykluczając wprost borowiki, co **zakłada wiedzę, której
  > kryterium miało dowieść**, i przechodziło na zielono, dowodząc jedynie, że `JOIN` łączy.
  > Obecne brzmienie mierzy to, co faktycznie mierzy: **złączenie po identyfikatorze, nie po
  > nazwie**. Zdolność użytkownika do wyrażenia pojęcia „grzyby" to **osobne** kryterium, które
  > powstanie razem z rozstrzygnięciem Otwartego pytania 1 — patrz 1.10 niżej.
- **Wyrażenie pojęcia szerokiego** — kryterium do napisania po decyzji właściciela o warstwie
  grup. Nie da się go sformułować, zanim nie wiadomo, czy pojęcie jest wpisem w `exclusion`,
  rozwinięciem przy seedowaniu, czy świadomie pominiętą dziurą MVP.
- `npm test`, `npx tsc --noEmit`, `npx expo lint` czyste

#### Weryfikacja ręczna

- `migrations apply --remote` wykonane **przed** commitem fazy

---

## Faza 2: Ekran preferencji

### Wymagane zmiany

#### 1. Nazwy dostępnościowe w prymitywach

**Pliki**: `src/components/ui/text-field.tsx`, `src/components/ui/choice-field.tsx`

**Cel**: naprawić u źródła lukę zgłoszoną w przeglądzie S-02 (F6), zamiast ją pogłębiać.

**Kontrakt**: generowany `id` + powiązanie etykiety (`aria-labelledby`), `aria-describedby` dla
błędu, `aria-invalid` na polu w błędzie; nazwa dla `radiogroup` w `ChoiceField`. Po tej zmianie
harness może adresować pola przez `getByRole`, a obejścia pozycyjne w
`tests/e2e/support/profile-form.ts` znikają.

> **Uzupełnione badaniem 13.09.2026** ([research.md](research.md) §4.3). Same `aria-*` **nie
> wystarczą**: `TextField` renderuje się także natywnie, gdzie te atrybuty nie działają — tam nazwę
> nadaje `accessibilityLabel`. Naprawa musi obsłużyć **obie** platformy, inaczej czytnik ekranu na
> urządzeniu zostaje z „pole edycji" mimo zielonego kryterium 2.8, które jest testem
> **przeglądarkowym**. Stan wyjściowy potwierdzony: `TextField` nie ustawia dziś **żadnego**
> atrybutu dostępności (`src/components/ui/text-field.tsx:23-45`), a `ChoiceField` ma poprawne role
> i brakuje mu wyłącznie nazwy grupy (`src/components/ui/choice-field.tsx:45-58`).

#### 2. Ekran

**Plik**: `src/app/(app)/preferences.tsx`

**Kontrakt**: trasa w `(app)`; `ScrollView` z rezerwą `BottomTabInset + Spacing.*`;
jedno `GET` przy wejściu ze **strażnikiem `touched`** (wyścig z S-02); wyszukiwarka składników
po `ingredient` z wyborem z listy; jedna lista wykluczeń z oznaczeniem rodzaju i usuwaniem;
`TextField` na czas przygotowania; `ChoiceField` na liczbę posiłków (3–6);
`ActionButton` „Zapisz" z `busy`; obsługa 400/`OfflineError`/`NotSignedInError` jak w `profile.tsx`.
Żądania wyłącznie przez `useAuthedFetch()`.

#### 3. Zakładka na dwóch platformach

**Pliki**: `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx`, ikona w trzech gęstościach

**Kontrakt**: `NativeTabs.Trigger name="preferences"` (nazwa = nazwa pliku trasy) z ikoną PNG
`renderingMode="template"`; na webie `TabTrigger name="preferences" href="/preferences"`.
**Edycja obu plików** — inaczej trasa jest nieosiągalna na jednej platformie.

> **Uzupełnione badaniem 13.09.2026** ([research.md](research.md) §2.7, §3.1). Po pierwsze: obie
> reguły potwierdza dokumentacja Expo — `name` jest wymagane w pliku layoutu i nie ma efektu
> w pliku ekranu, a na webie lista triggerów „defines what routes are present in the `Tabs`",
> czyli brak wpisu znaczy, że trasa **nie istnieje**, a nie że jest niewidoczna. Po drugie, rzecz
> pominięta w planie: **test `3.13` w `tests/e2e/profile-screen.spec.ts:240-250` jest inwentarzem
> zakładek** i trzecia zakładka go zepsuje — jego oczekiwania trzeba rozszerzyć w tej samej
> zmianie. Po trzecie: web **nie ma ikon**, więc PNG w trzech gęstościach dotyczy wyłącznie
> warstwy natywnej.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npx tsc --noEmit` po regeneracji typed routes (`/preferences` w typie)
- `npx expo lint` czyste, bez `react-hooks/set-state-in-effect`
- `expo export` + `wrangler deploy --dry-run` bez modułów z `node_modules`
- Na `wrangler dev`: `GET /preferences` → HTML 200
- E2E: dodanie wykluczenia składnikowego, zapis, przeładowanie strony — wykluczenie zostaje
- E2E: **odpowiedź opóźnionego `GET` nie kasuje tego, co użytkownik wpisał** (regresja z S-02)
- E2E: offline przy zapisie → komunikat, sesja zachowana, wartości w polach zostają
- E2E: pola formularza adresowalne przez `getByRole` (dowód naprawy dostępności)

#### Weryfikacja ręczna

- Expo Go: zakładka Preferencje z ikoną, wyszukiwarka składników używalna jedną ręką
- Lista wykluczeń czytelna, gdy ma 20 pozycji

---

## Strategia testowania

### Testy jednostkowe (`npm test`)

- `src/lib/preferences.ts` — walidacja: `meals_per_day` poza 3–6, `max_prep_minutes` poza zakresem,
  wykluczenie bez identyfikatora, `kind` niezgodny z wypełnionym polem

### Testy E2E

- Rozszerzenie `tests/e2e/` o ścieżkę preferencji, wzorując się na `profile-screen.spec.ts`
- **Test izolacji na dwóch kontach** — jeśli do tego czasu powstanie drugie konto testowe,
  zamyka też kryterium 2.9 z S-02 (dziś `BLOCKED-MANUAL`)

### Kroki testowania ręcznego

1. Wyklucz „borowiki, suszone" (po identyfikatorze) i sprawdź, że `listAllowedDishes` odsiewa
   risotto z borowikami — danie, którego nazwa o składniku nie mówi. **Osobno zanotuj, ilu wpisów
   wymagałoby wyrażenie „nie jem grzybów"** nad realną pulą; to jest pomiar do Otwartego pytania 1,
   nie kryterium zaliczenia.
2. Ustaw limit 20 minut i sprawdź, ile dań zostaje
3. Wyloguj się i zaloguj na drugie konto — wykluczenia nie przeciekają

## Uwagi dotyczące migracji

`0004` jest addytywna. Klucze obce do `ingredient` i `dish` **wymagają schematu z F-01 fazy 1** —
to jedyna twarda zależność kolejnościowa tej zmiany.

## Otwarte ryzyka i założenia

- **Wyszukiwarka składników jest UX-owym ryzykiem tej zmiany.** Użytkownik myśli „nie jem grzybów",
  a w `ingredient` są „pieczarki, świeże" i „borowiki, suszone". Bez warstwy grup wykluczenie
  będzie dziurawe.

  > **Poprawione badaniem 13.09.2026** ([research.md](research.md) §4.1–§4.2). Poprzednia wersja
  > tego akapitu wskazywała `ingredient.category` jako możliwe wyjście „ewentualnie" i była
  > **błędna**. Enum tej kolumny to jedenaście **kategorii sklepowych** wprowadzonych pod listę
  > zakupów (`migrations/0003_dish_pool.sql:50-53`): grzyby są w `warzywa`, orzechy w `suche`.
  > Wykluczenie po kategorii wycięłoby wszystkie warzywa albo wszystkie produkty suche. `nabial`
  > i `ryby` akurat zadziałają — czyli mechanizm **wygląda** na działający, co jest najgorszym
  > możliwym układem. Kategorie USDA FoodData Central zawodzą identycznie (grzyby w „Vegetables
  > and Vegetable Products"), a trzy niezależne źródła zewnętrzne zgadzają się, że taksonomia
  > zbudowana pod jeden cel nie obsługuje drugiego.
  >
  > **Konsekwencja dla faz:** to jest decyzja **modelu danych**, nie UI, więc należy do **fazy 1**,
  > a nie — jak zakładał plan — do fazy 2. Ekran pokaże tylko to, co model umie wyrazić. Doszedł
  > też argument terminowy: `ingredient` jest dziś **pusta**, więc warstwa grup kosztuje migrację;
  > po zaseedowaniu i ręcznym przejrzeniu puli kosztuje backfill przez człowieka.
  >
  > **Blokada:** wybór wariantu modyfikuje kontrakt z decyzji D14 (jedna tabela, `kind` o dwóch
  > wartościach), więc **wymaga decyzji właściciela** — trzy warianty wyłożone w
  > [research.md](research.md), Otwarte pytania 1. Do czasu rozstrzygnięcia faza 1 nie jest gotowa
  > do implementacji.

- **Zakres `max_prep_minutes` wymaga pogodzenia z `dish.prep_minutes`.** Ten plan daje 5–240,
  a F-01 zamierza dla dania 5–120 (dziś w bazie tylko `> 0`; zakres trafia do
  `src/lib/dish-validation.ts` w fazie 2 F-01). Jeśli żadne danie nie przekracza 120 minut,
  preferencja z przedziału 121–240 jest sufitem, który nigdy nie zwiąże. Ustalone badaniem
  13.09.2026.
- ~~Zakładam, że F-01 faza 1 wejdzie przed tą zmianą.~~ **Potwierdzone 13.09.2026:** F-01 faza 1
  weszła (commit `c848474`), migracja `0003` zastosowana `--local` i `--remote`. Tabele istnieją,
  ale są **puste** — kryterium 1.7 („risotto z borowikami") wymaga własnych danych testowych,
  bo pula dań powstanie dopiero w fazach 2–4 F-01.

## Referencje

- Model wykluczeń: `../dish-source-and-seed-pool/options.md` §4
- Wzorzec trasy i repozytorium: `src/app/api/profile+api.ts`, `src/server/repository/user-profile.ts`
- Wzorzec ekranu i testów: `src/app/(app)/profile.tsx`, `tests/e2e/profile-screen.spec.ts`

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.

### Phase 1: Schemat i granica danych

#### Automated

- [ ] 1.1 `migrations apply --local` stosuje `0004`; para wsteczna cofa; `list --local` czysto
- [ ] 1.2 `INSERT` łamiący `CHECK` spójności odrzucony przez bazę
- [ ] 1.3 Podwójne wykluczenie tego samego składnika nie tworzy duplikatu
- [ ] 1.4 `GET`/`PUT /api/preferences` bez tokenu i z podrobionym tokenem → 401
- [ ] 1.5 `GET` zwraca `Cache-Control: no-store`
- [ ] 1.6 Konto A nie widzi wykluczeń konta B
- [ ] 1.7 `listAllowedDishes` odsiewa danie, którego nazwa nie zawiera wykluczonego składnika —
      wykluczenie po `ingredient_id` („borowiki, suszone"), nie po słowie „grzyby"
- [ ] 1.8 Wyrażenie pojęcia szerokiego — kryterium do napisania po decyzji z Otwartego pytania 1
- [ ] 1.9 `npm test`, `npx tsc --noEmit`, `npx expo lint` czyste

#### Manual

- [ ] 1.10 `migrations apply --remote` wykonane przed commitem fazy

### Phase 2: Ekran preferencji

#### Automated

- [ ] 2.1 `npx tsc --noEmit` po regeneracji typed routes
- [ ] 2.2 `npx expo lint` czyste, bez `react-hooks/set-state-in-effect`
- [ ] 2.3 `expo export` + `wrangler deploy --dry-run` bez modułów z `node_modules`
- [ ] 2.4 `GET /preferences` → HTML 200 na `wrangler dev`
- [ ] 2.5 E2E: wykluczenie przeżywa zapis i przeładowanie strony
- [ ] 2.6 E2E: opóźniony `GET` nie kasuje wpisanych wartości
- [ ] 2.7 E2E: offline przy zapisie — komunikat, sesja zachowana, wartości zostają
- [ ] 2.8 E2E: pola adresowalne przez `getByRole` (dowód naprawy dostępności)

#### Manual

- [ ] 2.9 Expo Go: zakładka Preferencje z ikoną, wyszukiwarka używalna jedną ręką
- [ ] 2.10 Lista wykluczeń czytelna przy 20 pozycjach
