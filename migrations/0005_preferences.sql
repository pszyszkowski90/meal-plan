-- Migration number: 0005 	 2026-09-13T20:49:21.678Z
--
-- Preferencje żywieniowe (S-03 faza 1): czego użytkownik nie chce jeść, ile najwyżej chce gotować
-- i na ile posiłków dzieli dzień. Wraz z celem kalorycznym (`0002`) i pulą dań (`0003`) to komplet
-- wejść generatora planu (S-04) — sam generator tu NIE powstaje.
--
-- SEDNEM jest JEDNA lista wykluczeń o trzech rodzajach wpisu (decyzja D21, rozszerzenie D14).
-- PRD wymaga jednego mechanizmu: wykluczenia z preferencji (FR-004) i oznaczenia dań z planu
-- (FR-011) zasilają tę samą tabelę, rozróżnione kolumną `source`. Osobne tabele na rodzaj
-- wykluczenia byłyby dwoma mechanizmami tylnymi drzwiami.
--
-- DLACZEGO OSOBNA TABELA OD PROFILU: `user_profile` ma kontrakt pilnowany przez `validateProfile`
-- i wzór Mifflin-St Jeor. `meals_per_day` nie jest wejściem tego wzoru, a dołożenie go tam
-- rozjechałoby S-02 — ten sam powód, dla którego cel kaloryczny nie jest utrwalany.
--
-- CHECK SĄ WYŁĄCZNIE WYLICZENIOWE I STRUKTURALNE, nigdy zakresowe. To precedens z `0002:24-34`
-- i ustalenie F1 przeglądu S-02: SQLite nie ma `ALTER TABLE … DROP CONSTRAINT`, więc korekta
-- granicy kosztuje przebudowę tabeli, a rozjazd między DDL a modułem walidującym wychodzi
-- użytkownikowi jako 500 zamiast błędu pod polem — nierozróżnialnie od awarii D1.
--   * `meals_per_day` 3-6 ZOSTAJE jako CHECK — to enumeracja czterech dopuszczalnych wartości,
--     domykająca rzutowanie `as MealsPerDay` w `preferences.ts` dokładnie tak, jak `sex`
--     i `activity_level` domykają swoje w `user-profile.ts`.
--   * `max_prep_minutes` ma tu WYŁĄCZNIE niezmiennik strukturalny (`> 0`), jak `dish.prep_minutes`
--     w `0003`. Zakres 5-240 żyje w `PreferenceBounds` w `src/lib/preferences.ts` i nigdzie indziej.
--
-- ON DELETE CASCADE wszędzie, gdzie właścicielem jest tożsamość — obietnica z `0002:18-22`
-- (Preferencje S-03 i plany S-04 mają się dowiązać tak samo) jest tu spłacana.
--
-- Migracja wstecz leży w `migrations/down/0005_preferences.down.sql`.

-- Jeden wiersz na konto, jak `user_profile` — stąd `user_id` jako klucz główny.
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  max_prep_minutes INTEGER NOT NULL CHECK (max_prep_minutes > 0),
  meals_per_day INTEGER NOT NULL CHECK (meals_per_day BETWEEN 3 AND 6),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Słownik grup wykluczeniowych — DANE WSPÓŁDZIELONE, bez `user_id`, jak pula dań w `0003`.
-- Wypełnia go seed, nie użytkownik: grupa „grzyby" znaczy to samo dla wszystkich kont.
--
-- Istnieje, bo wykluczenie po `ingredient.category` NIE DZIAŁA: enum tej kolumny to kategorie
-- SKLEPOWE pod listę zakupów (`0003:50-53`) — grzyby siedzą w `warzywa`, orzechy w `suche`.
-- Wykluczenie grzybów wycięłoby wszystkie warzywa. `nabial` i `ryby` akurat by zadziałały,
-- czyli mechanizm WYGLĄDAŁBY na działający — najgorszy możliwy układ.
CREATE TABLE exclusion_group (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

-- Przypisanie składnika do grupy, wiele do wielu.
--
-- Klucz obcy do `ingredient` BEZ ON DELETE CASCADE: składnik używany przez dania nie powinien
-- dać się usunąć po cichu — ta sama decyzja co w `dish_ingredient` (`0003:73`).
CREATE TABLE ingredient_group (
  ingredient_id INTEGER NOT NULL REFERENCES ingredient(id),
  group_id INTEGER NOT NULL REFERENCES exclusion_group(id) ON DELETE CASCADE,
  PRIMARY KEY (ingredient_id, group_id)
);

-- JEDNA lista wykluczeń, trzy rodzaje wpisu.
--
-- `kind` rozstrzyga, które z `ingredient_id` / `dish_id` / `group_id` jest wypełnione, a CHECK
-- spójności pilnuje, że DOKŁADNIE JEDNO — inaczej wiersz z `kind='ingredient'` i wypełnionym
-- `dish_id` byłby cichą niespójnością, którą odsiew zinterpretowałby po swojemu.
--
-- Wykluczenie składnikowe wskazuje `ingredient_id`, NIGDY tekstu. Dopasowanie po nazwie łamie
-- guardrail przy pierwszym risotto z borowikami — nazwa dania nie musi wymieniać składnika.
--
-- `source` służy WYŁĄCZNIE prezentacji (skąd wpis się wziął) i NIGDY nie wpływa na dobór dań;
-- inaczej powstałyby dwa mechanizmy wbrew PRD. `listAllowedDishes` tej kolumny nie czyta.
CREATE TABLE exclusion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('ingredient', 'dish', 'group')),
  ingredient_id INTEGER REFERENCES ingredient(id),
  dish_id INTEGER REFERENCES dish(id),
  group_id INTEGER REFERENCES exclusion_group(id),
  source TEXT NOT NULL CHECK (source IN ('preferences', 'plan')),
  created_at TEXT NOT NULL,
  CHECK (
    (kind = 'ingredient' AND ingredient_id IS NOT NULL AND dish_id IS NULL AND group_id IS NULL) OR
    (kind = 'dish'       AND dish_id       IS NOT NULL AND ingredient_id IS NULL AND group_id IS NULL) OR
    (kind = 'group'      AND group_id      IS NOT NULL AND ingredient_id IS NULL AND dish_id IS NULL)
  )
);

-- Dwukrotne wykluczenie tego samego nie tworzy duplikatu.
--
-- Indeks UNIQUE, nie UNIQUE w ciele tabeli, i to jest istotne: w SQLite NULL nie jest równy
-- żadnemu NULL-owi, więc zwykłe ograniczenie na krotce z trzema kolumnami, z których dwie zawsze
-- są puste, NIE ZŁAPAŁOBY NICZEGO — każdy wiersz byłby inny. COALESCE sprowadza puste kolumny
-- do zera i dopiero wtedy para (użytkownik, wskazany byt) jest naprawdę unikalna.
-- `source` do klucza NIE wchodzi: ten sam składnik wykluczony raz z preferencji, a raz przy planie
-- to jedno wykluczenie, nie dwa.
CREATE UNIQUE INDEX idx_exclusion_unique ON exclusion (
  user_id,
  kind,
  COALESCE(ingredient_id, 0),
  COALESCE(dish_id, 0),
  COALESCE(group_id, 0)
);

-- Każde zapytanie odsiewające startuje od wykluczeń tego użytkownika.
CREATE INDEX idx_exclusion_user ON exclusion(user_id);

-- Odsiew pyta, które składniki należą do tej grupy, czyli po DRUGIEJ kolumnie klucza głównego —
-- bez tego indeksu byłby SCAN całej tabeli (ustalenie F1 przeglądu fazy 1 F-01, przez które
-- powstała migracja `0004`).
CREATE INDEX idx_ingredient_group_group ON ingredient_group(group_id);
