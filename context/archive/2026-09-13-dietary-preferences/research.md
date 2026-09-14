---
date: 2026-09-13T12:56:44+02:00
researcher: Paweł Szyszkowski (z Claude Code)
git_commit: 39c7f7cc345206fb35e95b6e00a2d089a2c62d27
branch: main
repository: meal-plan
topic: "Ugruntowanie planu S-03: wzorzec trasy i repozytorium, stan prymitywów formularza oraz droga wykluczenia składnikowego od ekranu do zapytania odsiewającego"
tags: [research, codebase, external, dietary-preferences, exclusions, fr-004, fr-006, fr-007, s-03, accessibility, expo-router]
status: complete
last_updated: 2026-09-13
last_updated_by: Paweł Szyszkowski (z Claude Code)
---

# Research: ugruntowanie planu S-03 (preferencje żywieniowe)

**Date**: 2026-09-13 12:56 (+02:00)
**Researcher**: Paweł Szyszkowski (z Claude Code)
**Git Commit**: 39c7f7cc345206fb35e95b6e00a2d089a2c62d27
**Branch**: main
**Repository**: meal-plan

> **Odniesienia do plików są ścieżkami w repo, nie permalinkami.** `origin/main` stoi na `974e38b`,
> a commit tego badania nie jest wypchnięty — permalink prowadziłby do 404.

> **Jak czytać ten dokument.** Sekcja 2 to ustalenia **z bazy kodu**, każde z `plik:linia`.
> Sekcja 3 to ustalenia **spoza repo** — dokumentacja Expo przez Context7 i publikacje o modelach
> wykluczeń przez exa.ai — każde z adresem źródła. Rozdział jest celowy: plan S-03 powstał z samej
> decyzji D14 i nie miał ugruntowania w żadnej z tych dwóch warstw.

## Research Question

Folder zmiany `dietary-preferences` nie miał `research.md`; plan powstał wprost z decyzji D14.
Pytanie badawcze ma trzy części:

1. **Wewnętrzna:** jaki dokładnie jest wzorzec, który nowa trasa `/api/preferences`, repozytorium
   `preferences.ts` i ekran `preferences.tsx` mają skopiować, i w jakim stanie są prymitywy
   formularza, które plan obiecuje przy okazji naprawić (ustalenie F6 przeglądu S-02)?
2. **Zewnętrzna:** jak produkty i standardy danych żywieniowych rozwiązują wykluczenia
   składnikowe — wybór z listy kontra wolny tekst, i czy warstwa kategorii wystarcza? To jest
   **jawnie otwarte ryzyko** planu ([plan.md:225-229](plan.md)).
3. **Rozstrzygająca:** czy któreś z tych ustaleń koryguje plan, czy plan zbiega się bez zmian?

## Summary

1. **Twarda zależność S-03 jest spełniona.** F-01 faza 1 weszła (commit `c848474`), a migracja
   `0003_dish_pool.sql` została zastosowana `--local` **i** `--remote`. Tabele `ingredient`,
   `dish` i `dish_ingredient` istnieją na produkcji. Są natomiast **puste**: fazy 2–4 F-01 są
   nietknięte, `src/lib/dish-macros.ts` i `src/lib/dish-validation.ts` nie istnieją, skryptu
   seedującego nie ma.
2. **Wzorzec odniesienia jest ciaśniejszy, niż opisuje go plan.** `Cache-Control: no-store` nie
   jest własnością trasy, tylko jednego helpera, przez który przechodzą **wyłącznie odpowiedzi
   sukcesu**. `requireUserId` musi stać **wewnątrz** `try`, bo woła `getWorkerEnv()`, które rzuca
   poza runtime workerd. Walidacja zwraca mapę polskich komunikatów per pole, nie kody błędów.
3. **Plan myli się w jednym miejscu: `ingredient.category` nie udźwignie wykluczeń.** Plan
   wskazuje ją jako koło ratunkowe dla ryzyka „grzyby kontra pieczarki". Kolumna istnieje, ale jej
   enum to **jedenaście kategorii sklepowych** wprowadzonych pod listę zakupów. Grzyby to
   `warzywa`, orzechy to `suche`. Część przypadków (`nabial`, `ryby`) zadziała — i to jest
   najgorszy możliwy układ, bo mechanizm **wygląda** na działający.
4. **Ten sam wniosek płynie z trzech niezależnych stron.** Kategorie USDA FoodData Central
   (~25 grup SR Legacy) chowają grzyby w „Vegetables and Vegetable Products"; enum w tym repo
   chowa je w `warzywa`; a publikacje o filtrowaniu składnikowym mówią wprost, że taksonomia
   zbudowana pod jeden cel nie obsługuje drugiego i że lekarstwem są **rodziny pokarmowe
   zdefiniowane pod regułę**, nie lista synonimów. Zbieżność trzech źródeł waży więcej niż
   którekolwiek z nich osobno.
5. **Moment jest korzystny i nie powtórzy się.** `ingredient` jest pusta. Warstwa grup dodana
   teraz kosztuje migrację; dodana po zaseedowaniu i ręcznym przejrzeniu puli kosztuje backfill
   każdego składnika przez człowieka.
6. **Trzy mniejsze rozjazdy do naniesienia:** `max_prep_minutes` 5–240 w planie kontra zamierzone
   5–120 dla `dish.prep_minutes`; `CHECK` na zakres liczbowy wbrew precedensowi, który plan sam
   cytuje; oraz naprawa dostępności opisana wyłącznie jako `aria-labelledby`, choć `TextField`
   renderuje się także natywnie.

---

## 2. Ustalenia z bazy kodu

### 2.1 Wzorzec trasy — `profile+api.ts`

Trasa eksportuje dokładnie dwie funkcje, `GET` (`src/app/api/profile+api.ts:72`) i `PUT` (`:87`),
oraz trzy prywatne helpery przed nimi.

- **`Cache-Control: no-store` żyje w jednym miejscu** — helperze `profileJson` (`:48-50`). Obie
  ścieżki sukcesu przez niego przechodzą (`:81`, `:125`), a odpowiedzi 401/400/500 używają gołego
  `Response.json` i nagłówka **nie mają**. Uzasadnienie — heurystyczne cache'owanie danych
  osobowych wg RFC 9111 — stoi w komentarzu `:39-47`; test E2E przypina to
  w `tests/e2e/profile-api.spec.ts:67`.
- **`requireUserId` stoi wewnątrz `try`** (`:73-77`), wbrew temu, co robi `account+api.ts:15-18`.
  Powód jest zapisany w `:66-70`: `requireUserId` woła `getWorkerEnv()`, które **rzuca** poza
  runtime workerd, a poza `try` to odrzucenie uciekało bez wpisu `[api/profile]` w logu.
- **Dwa kształty zwrotu rozróżnia `instanceof Response`** (`:74`); po tej bramce TypeScript zawęża
  typ do `{ userId: string }`.
- **`PUT` ma własne, osobne `try` na `requireUserId`** (`:90-99`), żeby `try` ścieżki danych nie
  połknął błędów 400.
- **Brak wiersza to stan, nie błąd** — `GET` bez profilu zwraca **200** z `{ profile: null,
  target: null }`, nie 404 (`:63-65`).
- **Log nie zawiera `userId` ani ciała żądania** (`:57-61`), znacznik to `[api/<trasa>]`.
- **`PUT` zwraca identyczny kontrakt co `GET`** (`:13-16`), żeby ekran niczego nie scalał.
- Kolejność w `PUT` (`:101-123`): parsowanie JSON we własnym `try` (zepsuty JSON to 400
  `invalid_json`, nie 500) → `validateProfile` → `ensureAppUser` przed zapisem (klucz obcy) →
  `profileJson`.

### 2.2 Wzorzec repozytorium — `user-profile.ts`

- Nagłówek modułu (`src/server/repository/user-profile.ts:1-14`) dokłada regułę, której nie ma
  w `CLAUDE.md`: interpolacja do `prepare(` wolno **wyłącznie** dla identyfikatorów trzymanych
  w stałych modułu; wartości zawsze przez `bind(...)`.
- Typ domenowy nie jest redefiniowany — `UserProfile extends ProfileInput` (`:18-21`), gdzie
  `ProfileInput` pochodzi z `@/lib/calorie-target`. Wiersz bazy ma osobny, **nieeksportowany** typ
  snake_case (`:23-32`).
- `SELECT_COLUMNS` jest jedyną interpolacją (`:34`), reużytą w `select` i w `returning`.
- „Brak wiersza" = `null`, nigdy wyjątek (`:60`).
- Zapis to jeden upsert `on conflict … do update … returning` (`:88-98`) — jedna podróż do bazy.
- **Szczegół, którego plan nie odnotowuje:** ścieżka zapisu woła `ensureAppUser`, nie
  `touchAppUser` (`src/app/api/profile+api.ts:121`, uzasadnienie `:116-120`). `touchAppUser` woła
  wyłącznie `account+api.ts:21`.

### 2.3 Wzorzec czystego modułu — `calorie-target.ts`

**Nie ma pliku `profile-validation.ts`.** Typy, granice, walidacja i wzór siedzą w jednym module
`src/lib/calorie-target.ts` (291 linii), importowanym i przez ekran, i przez trasę. Moduł
**nie importuje niczego** — jest pakowany do klienta, do `dist/server` i uruchamiany przez runner
Node z okrajaniem typów, stąd zakaz `enum` i `namespace` (`:1-15`).

Dla S-03 wiążące są cztery rzeczy:

- `ProfileBounds` (`:35-40`) jest **jedynym** źródłem prawdy o zakresach i **celowo nie jest
  kopiowany do `CHECK`**.
- `ProfileValidation` to **unia rozróżniana po `ok`** (`:67-69`).
- Błędy to `Partial<Record<keyof ProfileInput, string>>` — **polskie komunikaty dla człowieka,
  keyowane nazwą pola**, nie kody. Akumulowane, bez wczesnego wyjścia (`:225-227`). Komunikaty
  interpolują `ProfileBounds`, żeby treść i granica nie mogły się rozjechać.
- Kontrakt sieciowy `ProfileResponse` mieszka **w module lib**, nie w trasie (`:99-102`).

Test (`src/lib/calorie-target.test.ts:53-63`) przypina **które pole** błądzi, nigdy treść
komunikatu — to zostawia swobodę redakcyjną. `package.json` łapie każdy `src/lib/*.test.ts`
automatycznie, więc `src/lib/preferences.ts` dostanie pokrycie bez zmiany konfiguracji.

### 2.4 Stan schematu D1 — co S-03 zastaje

`ingredient` (`migrations/0003_dish_pool.sql:42-55`), pola istotne dla tej zmiany:

```sql
name TEXT NOT NULL UNIQUE,
category TEXT NOT NULL CHECK (category IN (
  'warzywa','owoce','mieso','ryby','nabial','jaja',
  'pieczywo','suche','tluszcze','przyprawy','inne')),
```

`dish` (`:57-63`) — `slug` jest tożsamością, `prep_minutes INTEGER NOT NULL CHECK (prep_minutes > 0)`.
`dish_ingredient` (`:71-76`) z `PRIMARY KEY (dish_id, ingredient_id)` — to jest tabela, na której
stanie zapytanie odsiewające S-03.

Polityka `CHECK` jest jednoznaczna i pochodzi z ustalenia F1 przeglądu fazy 2 S-02: **tylko
enumeracje i niezmienniki strukturalne, nigdy zakresy liczbowe**
(`migrations/0002_user_profile.sql:24-34`). Powód: SQLite nie ma `ALTER TABLE … DROP CONSTRAINT`,
a rozjazd wychodzi użytkownikowi jako 500 zamiast błędu pod polem.

`0002` zapowiada wprost (`:22`), że preferencje S-03 mają podpiąć się tak samo:
`REFERENCES app_user(id) ON DELETE CASCADE`.

`src/server/env.ts:29` — `all<T>()` zostało dodane do ręcznego typu D1 pod pulę dań. To jest odczyt
wielowierszowy, którego użyje `listAllowedDishes`.

### 2.5 Stan prymitywów formularza — ustalenie F6 potwierdzone

**`TextField` nie nadaje polom żadnej nazwy.** Cały render to
`src/components/ui/text-field.tsx:23-45`: `label` jest **rodzeństwem** `ThemedText`, a `TextInput`
dostaje `{...rest}` i nic więcej — bez `accessibilityLabel`, `nativeID`, `aria-label`,
`aria-labelledby`, `aria-describedby` i `accessibilityRole`. `error` nie jest z polem powiązany.
`profile.tsx` nigdy nie przekazuje `accessibilityLabel` ręcznie.

**`ChoiceField` jest zrobiony dobrze poza jednym brakiem** — `accessibilityRole="radiogroup"`,
`accessibilityRole="radio"`, `accessibilityState={{ checked }}` i `accessibilityLabel` na każdej
opcji (`src/components/ui/choice-field.tsx:49-58`). Brakuje **nazwy samej grupy**: `label` jest
tylko wizualnym rodzeństwem (`:45-47`).

Skutek jest zmierzony, nie teoretyczny. Harness adresuje pola **pozycyjnie**
(`tests/e2e/support/profile-form.ts:16-34`), np. `page.locator('input[inputmode="numeric"]').nth(0)`,
podczas gdy opcje wyboru adresuje `getByRole('radio', { name })` (`:36-42`). Różnica między tymi
dwoma liniami jest całą treścią ustalenia F6.

**Inwentarz `src/components/ui/` (7 plików):** `ActionButton` (ma `busy`), `TextField`,
`ChoiceField`, `AuthScreen`, `Collapsible`, `GlobalErrors`, `GoogleSignInButton`. **Nie ma
prymitywu listy, wyszukiwarki, karty, przełącznika, modala ani wskaźnika postępu.** Karty są
doraźne: `ThemedView type="backgroundElement"` plus lokalny `styles.card`.

### 2.6 Wzorce ekranu, które S-03 musi odtworzyć

- **Strażnik `touched`** (`src/app/(app)/profile.tsx:103`, stosowany `:107-139`): odpowiedź `GET`
  stosuje się wyłącznie przy `body.profile && !touched.current`. `touched.current = true` ustawia
  `markEdited()` wołane z **każdego** handlera zmiany (`:192-195`) **i** pierwsza linia
  `handleSave()` (`:198`).
- **Dwa różne warianty strażnika, do świadomego wyboru.** `profile.tsx` używa `requested` (raz na
  montaż). `index.tsx` używa `isFocused` + `fetchedForFocus` + **licznika przebiegów**
  `const run = ++runId.current` (`src/app/(app)/index.tsx:119-131`), bo odświeża się przy każdym
  wejściu na zakładkę. Wariant z flagą `cancelled` z cleanupu jest **zakazany** — dał zawieszenie
  ekranu na zawsze (`context/foundation/lessons.md`, ustalenie F2 przeglądu fazy 3).
- **`setState` wyłącznie w callbackach obietnicy**, nigdy w ciele efektu — inaczej
  `react-hooks/set-state-in-effect`, które w tym repo jest **błędem lintu**, nie ostrzeżeniem.
- **Liczby trzymane jako łańcuchy** (`ageText`, `weightText`…), żeby `"70,"` dało się wpisać
  (`:71-87`).
- **`offline` jest osobnym stanem ładowania**, nie wariantem błędu (`:53-57`). Przy `OfflineError`
  w zapisie **wartości zostają w formularzu** (`:236-239`).
- **Błąd pokazuje się dopiero po `blur` albo po próbie zapisu** (`errorFor`, `:156-183`); błąd
  serwera ma pierwszeństwo przed lokalnym.

### 2.7 Zakładki — co kosztuje trzecia

Natywnie (`src/components/app-tabs.tsx:10-35`): `NativeTabs.Trigger name="preferences"` **plus PNG
w trzech gęstościach** z `renderingMode="template"`. Reguła `name` = nazwa pliku trasy jest
zapisana w komentarzu `:23-27`.
Na webie (`src/components/app-tabs.web.tsx:16-32`): `TabTrigger name="preferences"
href="/preferences"` — **bez ikony**, web renderuje sam tekst. Nazewnictwo nie jest wspólne:
natywnie `name="index"`, na webie `name="home"` z `href="/"`.

**Test `3.13` (`tests/e2e/profile-screen.spec.ts:240-250`) jest inwentarzem zakładek** — dodanie
trzeciej wymaga rozszerzenia jego oczekiwań. Plan tego nie wymienia.

### 2.8 Bramka konwencji — co odrzuci nowe pliki

`scripts/check-conventions.js`: `sql-outside-repository` (`prepare(` tylko w
`src/server/repository/`, `:142-147`), `worker-env-in-route` (`:148-153`), `global-this`
(`:154-159`), `import-parent` — zero `../` (`:122-126`), `migration-pair` — `0004_*.sql` **musi**
mieć parę w `down/` (`:237-273`), a do tego `screen-fetch`, `raw-color` i `tab-parity`.
Komentarze są usuwane przed dopasowaniem, więc komentarz może cytować zakazany wzorzec.

---

## 3. Ustalenia spoza repo

### 3.1 Dokumentacja Expo (Context7)

> **Zastrzeżenie o wiarygodności:** Context7 indeksuje `/expo/expo` do gałęzi `sdk-56`, a serwis
> `/websites/expo_dev_versions` oddaje `versions/latest`. To jest dokumentacja **najnowsza**, nie
> przypięta do v57 — wskazówka, nie kontrakt SDK 57.

- **`NativeTabs.Trigger`: `name` jest wymagane w pliku layoutu i nie ma żadnego efektu w pliku
  ekranu** (docs.expo.dev/versions/latest/sdk/router/native-tabs). Potwierdza regułę z `CLAUDE.md`.
- **`expo-router/ui`: `TabTrigger` wewnątrz `TabList` wymaga `href`, a lista triggerów — cytat —
  „also defines what routes are present in the `Tabs`"** (docs.expo.dev/versions/latest/sdk/router/ui).
  To jest **mechaniczne uzasadnienie** reguły „edytuj oba pliki `app-tabs`": na webie brak wpisu
  znaczy, że trasa w zakładkach **nie istnieje**, a nie że jest tylko niewidoczna.
- **Natywne zakładki same stosują dolne insety.** Na Androidzie treść ekranu jest automatycznie
  owijana w `SafeAreaView` z dolnym insetem, na iOS pierwszy zagnieżdżony `ScrollView` ma włączone
  automatyczne dopasowanie insetu; wyłącza to `disableAutomaticContentInsets`. Patrz Otwarte
  pytania — to może oznaczać podwójną rezerwę w tym repo.
- `hidden` na triggerze **remountuje nawigator i resetuje stan** — istotne, gdyby zakładka
  Preferencje miała się pojawiać warunkowo.

### 3.2 Modele wykluczeń składnikowych (exa.ai)

Cztery niezależne źródła zbiegają się na tych samych wnioskach.

**(a) Dopasowanie po nazwie zawsze przecieka, w obie strony.**
Kanoniczny przykład to *farro*: reguła bezglutenowa wymieniająca wheat, barley i rye nie znajduje
farro, orkiszu, kamutu ani freekeh — „Solving the first problem with a keyword list is easy.
Solving the second requires knowing what things are, not what they are called"
(recipyapp.com/blog/how-ai-checks-ingredients-for-allergens-2026). Lista „ukrytych składników"
u recibites.app: żelatyna, sos rybny i anchois, serwatka i kazeina, słód (czyli jęczmień), alkohol
w ekstrakcie waniliowym. **To jest ryzyko S-03, tylko odwrócone** — użytkownik wyklucza pojęcie
szerokie („grzyby"), a baza trzyma nazwy wąskie z określonym stanem („pieczarki, świeże").

**(b) Lekarstwem jest warstwa rodzin pokarmowych, nie lista synonimów.**
Recipy opisuje kaskadę, w której warstwa druga rozwiązuje składnik do „food families" i sprawdza
rodziny względem reguły — bo lista synonimów zawsze będzie w tyle za rzeczywistością, a taksonomia
nie. To samo w modelu danych recipe-api.com/blog/allergen-data-recipe-apps (klucz kanoniczny,
etykieta, aliasy oraz informacja, czy dopasowanie jest `exact`, `derived` czy `declared`) i w spisie
wymagań dydaktycznych TalTech, gdzie każdy składnik należy do kategorii, a tagi alergenów wiszą
**na składniku**, nie na przepisie.

**(c) „Nie znaleziono" to nie „bezpieczne" — trzeci stan jest obowiązkowy.**
Checker ma trzy odpowiedzi, nie dwie: potwierdzone naruszenie, potwierdzone przejście i **unknown**;
„A keyword matcher that finds nothing has learned nothing" (Recipy). Recipe-API dopowiada, że
`unknown` musi być **wartością**, nie brakiem pola, bo „missing fields are easy for clients to
misread as safe". Składnik nierozpoznany przez taksonomię **nie staje się dozwolony domyślnie**.

**(d) Zapisany tag nie jest dowodem w momencie doboru.**
„Checks run at request time, not at tag time. Stored dietary and allergen tags are retrieval
projections used to narrow the candidate pool. They are never read back as serving-time proof"
(Recipy) — tag jest o jeden zły import od bycia fałszywym.

**(e) Różne kategorie reguł znoszą różną niepewność.** Alergia medyczna blokuje i alarmuje,
preferencja stylu życia może być podana z zastrzeżeniem. **W MealPlanie tego stopniowania nie ma
i nie powinno być:** PRD nazywa wykluczenia ograniczeniem twardym (`context/foundation/prd.md:189-190`),
więc produkt stoi po stronie najostrzejszej polityki niezależnie od tego, czy powodem jest alergia,
czy niechęć. To świadomy wybór, nie przeoczenie — ale wart nazwania, bo upraszcza S-04.

### 3.3 Czy USDA daje warstwę kategorii za darmo?

F-01 i tak pobiera makra z USDA FoodData Central, więc pytanie jest zasadne. **Odpowiedź brzmi nie.**

- FDC **ma** tabelę `food_category` („Foods of defined similarity"; pola `id`, `code`,
  `description`, oraz `food.food_category_id`) — fdc.nal.usda.gov, *Download Field Descriptions*.
- Ale granulacja to grupy SR Legacy, rzędu 25 pozycji w rodzaju „Vegetables and Vegetable
  Products". **Grzyby siedzą tam razem z całą resztą warzyw.** Dokumentacja *Foundation Foods*
  sama przyznaje, że grupy są utrzymywane „to provide historical reference and continuity",
  a trwające prace nad ontologią zmienią system grupowania.
- **FoodOn** (foodon.org) daje hierarchię ponad 9 600 generycznych kategorii produktów, wyrosłą
  z LanguaL, w OBO Foundry; FDC „now provides FoodOn identifiers and categories for its Foundation
  Foods database entries" (semantic-web-journal.net, *OBO Foundry Food Ontology*). **FoodOn
  rozwiązałby „grzyby"** — ale import obcej ontologii z 9 600 klasami do MVP z pulą rzędu stu dań
  jest nieproporcjonalny.

---

## 4. Wpływ na plan S-03

> **Sprostowanie naniesione tego samego dnia, po kontroli krzyżowej** (`/10x-frame`, Krok 5 —
> niezależne wyszukiwanie bez podania wiodącej hipotezy; wynik w [frame.md](frame.md)).
>
> Pierwsza wersja tej sekcji pisała o „warunku działania FR-004" i sugerowała, że bez warstwy grup
> **łamany jest guardrail**. **To jest nadinterpretacja i prostuję ją.** Guardrail PRD jest
> zdefiniowany względem **zapisanej listy**, nie względem intencji użytkownika:
> „Żaden posiłek … nie zawiera **pozycji z listy wykluczeń**" (`context/foundation/prd.md:82`,
> podobnie `:62`), a FR-004 mówi dosłownie o „potrawach i składnikach" (`:117`) — nie o pojęciach
> ani kategoriach. Jeśli użytkownik wykluczy wiersz „pieczarki, świeże", a generator poda danie
> z „borowikami, suszonymi", to **guardrail w obecnym brzmieniu nie jest złamany**. Złamane jest
> zdanie użytkownika „nie jem grzybów" — którego PRD nigdy nie obiecał reprezentować.
>
> Właściwa nazwa problemu to więc **luka wymagań między słownikiem FR-004 a słownikiem, którym
> mówi użytkownik**, a nie defekt zapytania odsiewającego ani błąd integralności danych.
> Konsekwencja praktyczna jest istotna: pierwszym artefaktem do zmiany jest **PRD i Otwarte
> pytanie 4** (`prd.md:229-231`), a dopiero potem schemat.
>
> Drugie sprostowanie, z tego samego źródła: `prd.md:203-205` wyklucza z zakresu „alergie
> kliniczne" i diety lecznicze. Koszt przeoczonego grzyba to **zaufanie, nie bezpieczeństwo**.
> Sekcja §3.2(e) pozostaje w mocy co do polityki, ale waga tego problemu jest niższa niż
> guardrailu ±10%, który jest jedynym ograniczeniem tego produktu stykającym się z liczbami,
> a nie z preferencją.

### 4.1 Poprawka wymagana — zdanie o `ingredient.category` jest błędne

`plan.md:225-229` mówi: *„Bez warstwy synonimów albo kategorii wykluczenie będzie dziurawe — do
rozstrzygnięcia w fazie 2, ewentualnie przez wykluczanie na poziomie `ingredient.category`."*

To zdanie wskazuje na rozwiązanie, którego tam nie ma. Enum `ingredient.category` to **kategorie
sklepowe**, wprowadzone ustaleniem F14 przeglądu planu F-01 pod listę zakupów
(`migrations/0003_dish_pool.sql:50-53`). Zderzenie z rzeczywistymi wykluczeniami:

| Wykluczenie użytkownika | Kategoria w enumie | Co wycięłoby wykluczenie po kategorii |
|---|---|---|
| grzyby | `warzywa` | **wszystkie warzywa** |
| orzechy | `suche` | **ryż, kasze, mąkę, strączki** |
| nabiał | `nabial` | poprawnie |
| ryby | `ryby` | poprawnie |

Dwa przypadki działają, dwa są katastrofalne — czyli mechanizm **wygląda** na działający. To jest
dokładnie ten tryb awarii, przed którym ostrzega wyzwanie sokratejskie przy FR-004.

### 4.2 Co z tego wynika dla fazy 1, a nie — jak zakładał plan — dla fazy 2

Ryzyko było zaplanowane do rozstrzygnięcia **w fazie 2** (ekran). Badanie przesuwa je do **fazy 1**
(schemat), z dwóch powodów:

1. To jest decyzja **modelu danych**, nie UI. Ekran może co najwyżej pokazać to, co model umie
   wyrazić.
2. `ingredient` jest **pusta**. Dziś to migracja; po zaseedowaniu i ręcznym przejrzeniu puli
   (faza 3 F-01 wymaga `reviewedBy` na każdym daniu) to backfill przez człowieka.

**Proporcjonalna odpowiedź przy puli rzędu stu dań** to nie import FoodOn i nie lista synonimów,
tylko **mała, ręcznie kuratorowana warstwa grup wykluczeniowych po polsku** — grzyby, orzechy,
nabiał, ryby, owoce morza, strączki, gluten, wieprzowina i podobne. Rząd wielkości: kilkanaście do
dwudziestu kilku grup, przypinanych do `ingredient` przy seedowaniu.

**To jest jednak zmiana kontraktu danych ustalonego decyzją D14**, która rozstrzygnęła model
wykluczeń jako „jedna tabela z polem `kind` (`ingredient` / `dish`)". Dołożenie trzeciego rodzaju
wpisu albo osobnej tabeli grup **wykracza poza mandat badania**, więc nie nanoszę tego do planu
jako rozstrzygnięcia — tylko jako **nazwane, umocowane dowodami otwarte pytanie**. Badanie
dostarcza dowody, nie zastępuje decyzji właściciela.

**Dwie rzeczy, które kontrola krzyżowa dołożyła do tego rachunku** (szczegóły w [frame.md](frame.md)):

- **Koszt zmiany D14 jest dziś niski na mocy samej D14:** „decyzja żyje w dokumentach, zero kodu.
  Wyrzucenie `options.md` i planu cofa wszystko" (`notes/night-decisions.md:290-292`).
- **Wariant (b) — rozwinięcie grupy przy seedowaniu — jest dziurawy z powodu, który da się
  wskazać w planie F-01:** zbiór identyfikatorów jest migawką, a pula **ma rosnąć** (faza 4 F-01
  celuje w ≥ 12 śniadań, ≥ 18 obiadów, ≥ 18 kolacji, ≥ 12 przekąsek —
  `../dish-source-and-seed-pool/plan.md:342-345`). Składnik dodany po rozwinięciu nie zostanie
  objęty wykluczeniem i **nikt się o tym nie dowie**.

### 4.3 Kryterium 1.7 jest dziś zaprojektowane tak, żeby przejść niezależnie od tego, czy produkt działa

Kryterium automatyczne 1.7 (`plan.md:151-152`) brzmi: *„`listAllowedDishes` odsiewa danie, którego
NAZWA nie zawiera wykluczonego składnika — test na »risotto z borowikami« przy wykluczeniu
»grzyby«"*, a ręczny krok 1 (`plan.md:247`) powtarza: *„Dodaj wykluczenie »grzyby«"*.

**W modelu danych tego samego planu nie da się dodać wykluczenia »grzyby«.** `kind='ingredient'`
wskazuje `ingredient_id` (FK do `ingredient`), a w `ingredient` nie ma i — wobec reguły, że nazwa
niesie stan (`migrations/0003_dish_pool.sql:23-27`) — nie będzie wiersza „grzyby". Są „pieczarki,
świeże" i „borowiki, suszone".

Kryterium da się więc zaliczyć **wyłącznie** wykluczając wprost `ingredient_id` dla „borowiki,
suszone" — co zakłada, że użytkownik już wie, że borowik jest grzybem, czyli **fałszuje dokładnie
tę część, którą kryterium ma udowodnić**. Test przejdzie na zielono, dowodząc jedynie, że `JOIN`
łączy. Tabele są dziś puste, więc fixture napisze ta sama osoba, która pisze asercję.

To jest ta sama klasa fałszywej zieleni, którą repo ma już zapisaną w
`context/foundation/lessons.md` („Zatrzymaj serwer…": *„Był dowodem, że nic nie zostało
sprawdzone"*), i ta sama klasa wewnętrznej sprzeczności planu, co `prep_minutes` 5–120 w F-01 —
złapana dopiero przy implementacji fazy 1.

**Ustalenie niezależne od tego, który wariant z Otwartego pytania 1 wygra:** kryterium 1.7 trzeba
przeredagować tak, żeby mierzyło zdolność użytkownika do wyrażenia pojęcia nad **realną** pulą,
a nie zdolność zapytania do złączenia dwóch tabel. To jedyna poprawka z tego badania, którą warto
nanieść **zanim** właściciel cokolwiek rozstrzygnie.

### 4.4 Poprawki drobniejsze

- **Rozjazd zakresów czasu.** Plan daje `max_prep_minutes` `CHECK` 5–240 (`plan.md:95-96`),
  a F-01 zamierza `dish.prep_minutes` 5–120 (dziś w bazie tylko `> 0`; zakres ma trafić do
  `src/lib/dish-validation.ts` w fazie 2). Jeśli żadne danie nie przekracza 120 minut, preferencja
  z przedziału 121–240 jest sufitem, który nigdy nie zwiąże. Do pogodzenia albo do jawnego
  uzasadnienia.
- **Zakres `CHECK` w planie łamie precedens, który plan sam cytuje.** Plan powołuje się na
  ustalenie F1 przeglądu S-02 („nie powielaj granic walidacji w `CHECK`", `plan.md:55-56`),
  a dwie strony dalej przepisuje `meals_per_day` 3–6 i `max_prep_minutes` 5–240 do DDL.
  `meals_per_day` 3–6 broni się jako **enumeracja** czterech dopuszczalnych wartości, ale
  `max_prep_minutes` 5–240 to **zakres liczbowy** — dokładnie to, czego zakazuje komentarz
  w `migrations/0002_user_profile.sql:29-34`.
- **`aria-labelledby` nie wystarczy.** Plan opisuje naprawę F6 jako „generowany `id` + powiązanie
  etykiety (`aria-labelledby`)" (`plan.md:152-154`). `TextField` renderuje się także natywnie,
  gdzie atrybuty `aria-*` nie działają — tam nazwę nadaje `accessibilityLabel`. Naprawa musi
  obsłużyć **obie** platformy, inaczej czytnik ekranu na urządzeniu zostaje z „pole edycji" mimo
  zielonego kryterium 2.8, które jest testem **przeglądarkowym**.
- **Test inwentarza zakładek.** `3.13` w `profile-screen.spec.ts` wylicza zakładki; trzecia go
  zepsuje. Plan nie wymienia tego wśród zmian.

### 4.5 Czego badanie nie zmieniło

Trzon planu zbiega się i zostaje bez zmian: jedna tabela wykluczeń z polem `kind`, `source`
wyłącznie do prezentacji, preferencje w tabeli osobnej od `user_profile`, kształt trasy
i repozytorium jeden do jednego z profilem, walidacja w czystym module z testem, strażnik `touched`
od pierwszej linii, `Cache-Control: no-store`, oraz `listAllowedDishes` jako dowód modelu przed
S-04. Badanie zewnętrzne **wzmocniło** decyzję D14 o wskazywaniu `ingredient_id` zamiast tekstu —
to jest dokładnie ta rzecz, którą cztery niezależne źródła nazywają warunkiem działania, a nie
usprawnieniem.

---

## Code References

- `src/app/api/profile+api.ts:48-50` — `profileJson`, jedyne miejsce z `Cache-Control: no-store`
- `src/app/api/profile+api.ts:57-61` — `internalError`, log bez `userId` i bez ciała
- `src/app/api/profile+api.ts:66-77` — dlaczego `requireUserId` stoi wewnątrz `try`
- `src/app/api/profile+api.ts:101-123` — kolejność w `PUT`: JSON, walidacja, `ensureAppUser`, zapis
- `src/server/repository/user-profile.ts:1-14` — reguły warstwy, w tym zakaz interpolacji wartości
- `src/server/repository/user-profile.ts:88-98` — upsert jedną podróżą, `returning`
- `src/server/auth.ts:42-49` — `hasAllowedParty`; brak `azp` znaczy klient natywny
- `src/server/auth.ts:89-109` — `requireUserId`, rozdział 401 od 500
- `src/lib/calorie-target.ts:35-40` — `ProfileBounds`, jedyne źródło prawdy o zakresach
- `src/lib/calorie-target.ts:67-69` — `ProfileValidation` jako unia po `ok`
- `src/lib/calorie-target.ts:159-242` — `validateProfile`, akumulacja błędów per pole
- `src/lib/calorie-target.test.ts:53-63` — test przypina pole, nie treść komunikatu
- `src/server/env.ts:29` — `all<T>()` dodane pod pulę dań; odczyt wielowierszowy dla S-03
- `migrations/0002_user_profile.sql:22-34` — polityka `CHECK` i zapowiedź podpięcia S-03
- `migrations/0003_dish_pool.sql:42-55` — `ingredient` z enumem kategorii sklepowych
- `migrations/0003_dish_pool.sql:71-76` — `dish_ingredient`, podstawa zapytania odsiewającego
- `src/components/ui/text-field.tsx:23-45` — brak jakiejkolwiek nazwy dostępnościowej
- `src/components/ui/choice-field.tsx:45-58` — poprawne role, brak nazwy grupy
- `src/app/(app)/profile.tsx:103-139` — strażnik `touched` w działaniu
- `src/app/(app)/index.tsx:119-131` — wariant z licznikiem przebiegów
- `src/components/app-tabs.tsx:23-27` — reguła `name` = nazwa pliku trasy
- `src/components/app-tabs.web.tsx:16-32` — web wiąże `href`, bez ikon
- `tests/e2e/support/profile-form.ts:16-34` — pozycyjne obejścia wymuszone brakiem nazw
- `tests/e2e/profile-screen.spec.ts:240-250` — test inwentarza zakładek
- `scripts/check-conventions.js:142-159`, `:237-273` — reguły, które odrzucą nowe pliki

## Architecture Insights

1. **Granice mieszkają w TypeScripcie, enumeracje w SQL-u.** Konsekwentnie w `0002` i `0003`.
   Powód jest operacyjny — SQLite nie upuszcza `CHECK` — nie estetyczny.
2. **Kontrakt sieciowy mieszka w module `lib`, nie w trasie.** Ekran i trasa nie mogą się
   rozjechać, a test jednostkowy widzi kontrakt.
3. **Prywatność jest egzekwowana w helperach, nie w dyscyplinie.** `no-store` w jednym helperze,
   log bez `userId` w drugim — wzorzec do skopiowania, nie do wymyślenia od nowa.
4. **„Brak danych" jest wszędzie stanem, nie błędem** — `null` z repozytorium, 200 z trasy,
   `profile: null` w kontrakcie. Preferencje mają ten sam kształt: konto bez preferencji jest
   normalne, nie wyjątkowe.
5. **Prymitywy dostępności są rozwarstwione:** `ChoiceField` zrobiony dobrze, `TextField` nie
   zrobiony wcale. S-03 dokłada pola, więc albo naprawia u źródła, albo pogłębia dług.
6. **Czasy życia w efektach są tematem, na którym to repo już raz się przewróciło.** Dwa warianty
   strażnika są celowo różne, a trzeci — flaga `cancelled` z cleanupu — jest zakazany.

## Historical Context (from prior changes)

- `context/changes/dish-source-and-seed-pool/options.md:55-96` — §4, model wykluczeń: jedna tabela,
  `kind`, `source` tylko do prezentacji; wprost, że dopasowanie po nazwie „złamie guardrail przy
  pierwszym »risotto z borowikami«".
- `context/changes/dish-source-and-seed-pool/options.md:98-114` — §5, komunikat o niewykonalnym
  planie; próg **należy zmierzyć** i należy do S-04.
- `notes/night-decisions.md:260-296` — D14: wykluczenia dostają jedną tabelę z `kind`, a granicą
  decyzji jest **planowanie, nie implementacja**.
- `context/archive/2026-09-12-profile-and-calorie-target/reviews/impl-review-phase-2.md:42-78` —
  F1, usunięcie zakresów liczbowych z `CHECK`. Precedens, który plan S-03 cytuje, a którego
  `max_prep_minutes` 5–240 nie dotrzymuje.
- `.../impl-review-phase-2.md:80-107` — F2, `Cache-Control: no-store` dla danych osobowych.
- `.../impl-review-phase-3.md:118-133` — F6, brak nazw dostępnościowych; PENDING, przypisane do
  tej zmiany.
- `.../impl-review-phase-3.md:34-76` — F1 i F2 fazy 3, czyli skąd wzięły się dwa warianty strażnika
  efektu i dlaczego trzeci jest zakazany.
- `context/changes/dish-source-and-seed-pool/plan.md:426-459` — Progress fazy 1 z odstępstwem na
  `prep_minutes` i potwierdzeniem zastosowania `--local` oraz `--remote`.
- `context/changes/dish-source-and-seed-pool/plan.md:78-79` — F-01 jawnie zostawia tabelę wykluczeń
  S-03 i dostarcza `dish_ingredient`.
- `context/changes/dish-source-and-seed-pool/research.md:316-323` — brak kanonicznego słownika
  składników był zgłoszony **przed** F-01 jako rzecz, którą F-01 ma wprowadzić.

## Related Research

- [`../dish-source-and-seed-pool/research.md`](../dish-source-and-seed-pool/research.md) — źródło
  przepisów i makr; ten dokument jest jego kontynuacją po stronie użytkownika.
- [`../dish-source-and-seed-pool/options.md`](../dish-source-and-seed-pool/options.md) — §4 i §5.

## Open Questions

1. ~~**Czy model wykluczeń dostaje warstwę grup — i w jakiej postaci?**~~
   **ROZSTRZYGNIĘTE 13.09.2026 — decyzja D21: wariant (a), osobna tabela grup.** Powód wyboru:
   wariant (b) przecieka przy rosnącej puli — zbiór identyfikatorów jest migawką, a faza 4 F-01
   celuje w ≥ 60 dań, więc składnik dodany po rozwinięciu nie zostałby objęty i nikt by się o tym
   nie dowiedział. Kontrakt migracji w [plan.md](plan.md), faza 1. Poniżej oryginalne brzmienie
   pytania, dla śladu rozumowania: Dowody z §3.2, §3.3 i §4.1
   mówią, że bez niej FR-004 działa tylko dla części przypadków. Trzy warianty:
   (a) trzeci rodzaj wpisu `kind='group'` plus tabele `exclusion_group` i `ingredient_group`;
   (b) grupa rozwijana **przy seedowaniu** do listy `ingredient_id` — `exclusion` zostaje wtedy
   dwuwartościowe zgodnie z D14, ale użytkownik traci informację „wykluczyłem grzyby", a składnik
   dodany później **nie** zostanie objęty;
   (c) świadoma akceptacja dziury w MVP, nazwana w PRD.
   **Właściciel: użytkownik.** Modyfikuje kontrakt z D14, więc nie rozstrzygam tego badaniem.

   **Uzupełnione po kontroli krzyżowej:** pytanie jest **najpierw wymaganiowe, potem schematowe**.
   FR-004 mówi o „potrawach i składnikach", a nie o pojęciach, więc kolejność brzmi: rozstrzygnij
   Otwarte pytanie 4 PRD (`context/foundation/prd.md:229-231`) i dopiero wtedy schemat.
   Wariant (c) nie jest wykrętem — jest dopuszczalną odpowiedzią MVP, pod warunkiem że dziura
   **zostanie nazwana w PRD**, a nie przemilczana. Dowody ważą na korzyść wariantu (a), bo (b)
   przecieka przy rosnącej puli; szczegóły w [frame.md](frame.md).
2. **Czy `max_prep_minutes` i `dish.prep_minutes` mają wspólny zakres?** Jeśli dania kończą się
   na 120 minutach, górna połowa 5–240 nigdy nie zwiąże.
3. **Czy rezerwa `BottomTabInset` nie jest podwójna na natywnym?** `src/constants/theme.ts:66` daje
   50 na iOS i 80 na Androidzie, `profile.tsx:251-275` dodaje to **do** `safeAreaInsets.bottom`,
   a dokumentacja Expo mówi, że natywne zakładki stosują dolny inset same. Na webie
   `BottomTabInset` wynosi 0, więc reguła z `CLAUDE.md` może być uzasadniona wyłącznie webem.
   **Rozstrzygają wyłącznie oględziny na urządzeniu** — nie zmieniam niczego na podstawie samej
   dokumentacji.
4. **Jak wygląda stan „nie wiem" w tym produkcie?** Źródła zewnętrzne są zgodne, że „nie
   znaleziono" nie może znaczyć „bezpieczne". Tutaj pula jest własna i ręcznie przejrzana, więc
   nierozpoznanych składników z definicji nie ma — ale to założenie warto zapisać, bo przestanie
   być prawdziwe przy pierwszym imporcie z zewnątrz.
5. **Czy potrzebny jest prymityw listy i wyszukiwarki?** `src/components/ui/` nie ma żadnego,
   a S-03 potrzebuje obu. Do rozstrzygnięcia w fazie 2: prymityw wielokrotnego użytku czy kod
   lokalny ekranu.
