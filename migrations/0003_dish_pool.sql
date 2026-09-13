-- Migration number: 0003 	 2026-09-13T09:23:48.824Z
--
-- Pula dań (F-01): pierwsze w tym repo dane WSPÓŁDZIELONE — nie należą do żadnego konta, więc
-- żadna z tych tabel nie ma `user_id`. To celowe odstępstwo od reguły „każda funkcja repozytorium
-- filtruje po `userId`": tę pulę czytają wszyscy i nikt jej nie zapisuje z aplikacji. Wypełnia ją
-- skrypt seedujący, nie trasa API.
--
-- Źródło treści rozstrzygnięte decyzją D14: model językowy autoryzuje przepisy RAZ, poza runtime,
-- człowiek przegląda gramatury, a makra liczy skrypt z tabeli USDA. Worker nigdy nie woła modelu.
--
-- Czego tu ŚWIADOMIE nie ma:
--
--   * Makr na `dish`. Makra dania liczy się z `dish_ingredient` modułem `src/lib/dish-macros.ts` —
--     ta sama zasada, co cel kaloryczny w `0002`: jedno źródło prawdy, zero dryfu. Kolumna z sumą
--     rozjechałaby się przy pierwszej korekcie gramatury.
--   * Kolumny `servings`. Konwencja: KAŻDY przepis jest na jedną porcję. Dwuznaczność
--     „makra dania" kontra „makra porcji" łamałaby guardrail ±10% o cichy czynnik.
--   * Zakresów liczbowych w `CHECK` (np. `prep_minutes BETWEEN 5 AND 120`). Powód ten sam, co
--     w `0002`: ich źródłem prawdy jest moduł walidacji (`src/lib/dish-validation.ts`), a SQLite
--     nie ma `ALTER TABLE … DROP CONSTRAINT`, więc korekta progu kosztowałaby przebudowę tabeli.
--     Zostają wyłącznie niezmienniki STRUKTURALNE (`> 0`, `>= 1`) i wyliczenia.
--
-- `ingredient.name` ZAWIERA STAN produktu („ryż biały, suchy"). To nie jest kosmetyka nazewnicza:
-- USDA rozróżnia ryż surowy (~365 kcal/100 g) od ugotowanego (~130), czyli różnicę rzędu 180% —
-- wielokrotność całego budżetu ±10%. Ani przegląd gramatur przez człowieka, ani próg „zdrowego
-- rozsądku" tego nie wykryją, bo gramatura jest poprawna, a wynik mieści się w zakresie. Jedyną
-- obroną jest jednoznaczna tożsamość składnika. Przepisy podają gramaturę PRZED obróbką.
--
-- `dish.slug` (nie `name`) jest tożsamością dania. Poprawka literówki w nazwie wyświetlanej nie
-- może tworzyć drugiego dania, a od S-04 `plan_item.dish_id` będzie na to wrażliwy.
--
-- `dish_meal_slot` jest relacją WIELE-DO-WIELU, a nie kolumną na `dish`. Obiad i kolacja to
-- w praktyce kulinarnej w dużej mierze ten sam zbiór; przypisanie dania do jednej pory dzieliłoby
-- pulę czterokrotnie dokładnie wtedy, gdy wykluczenia i limit czasu już ją przerzedziły.
--
-- `ON DELETE CASCADE` wszędzie od `dish` w dół: danie jest właścicielem swoich składników, kroków
-- i przypisań do pór. Skrypt seedujący przepisuje te trzy tabele w całości przy każdej zmianie
-- treści dania, więc kaskada jest jego normalną ścieżką, nie sytuacją awaryjną.
--
-- Migracja wstecz leży w `migrations/down/0003_dish_pool.down.sql`.

CREATE TABLE ingredient (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  usda_fdc_id INTEGER,
  kcal_per_100g REAL NOT NULL,
  protein_per_100g REAL NOT NULL,
  carbs_per_100g REAL NOT NULL,
  fat_per_100g REAL NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'warzywa', 'owoce', 'mieso', 'ryby', 'nabial', 'jaja',
    'pieczywo', 'suche', 'tluszcze', 'przyprawy', 'inne'
  )),
  grams_per_piece REAL CHECK (grams_per_piece IS NULL OR grams_per_piece > 0)
);

CREATE TABLE dish (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  prep_minutes INTEGER NOT NULL CHECK (prep_minutes > 0),
  created_at TEXT NOT NULL
);

CREATE TABLE dish_meal_slot (
  dish_id INTEGER NOT NULL REFERENCES dish(id) ON DELETE CASCADE,
  meal_slot TEXT NOT NULL CHECK (meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  PRIMARY KEY (dish_id, meal_slot)
);

CREATE TABLE dish_ingredient (
  dish_id INTEGER NOT NULL REFERENCES dish(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredient(id),
  grams REAL NOT NULL CHECK (grams > 0),
  PRIMARY KEY (dish_id, ingredient_id)
);

CREATE TABLE dish_step (
  dish_id INTEGER NOT NULL REFERENCES dish(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 1),
  text TEXT NOT NULL,
  PRIMARY KEY (dish_id, position)
);

-- Generator (S-04) startuje od „które dania pasują do tej pory posiłku" i dopiero potem liczy
-- makra, więc to jest ścieżka gorąca. Pozostałe tabele mają klucze główne zaczynające się od
-- `dish_id`, co wystarcza za indeks.
CREATE INDEX idx_dish_meal_slot_slot ON dish_meal_slot(meal_slot);
