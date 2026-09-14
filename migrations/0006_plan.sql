-- Migration number: 0006 	 2026-09-14T16:45:00.000Z
--
-- Tygodniowy jadłospis (S-04 faza 1): gdzie ląduje plan wygenerowany pod cel kaloryczny (`0002`),
-- preferencje (`0005`) i pulę dań (`0003`). Sam generator tu NIE powstaje — to jest wyłącznie
-- miejsce, w którym jego wynik ma się utrwalić.
--
-- JEDEN PLAN NA KONTO, stąd `user_id` jako klucz główny `plan` — ten sam kształt co `user_profile`
-- (`0002`) i `user_preferences` (`0005`). PRD §Non-Goals wyklucza śledzenie w czasie i historię,
-- więc tabela z wieloma planami na konto byłaby zakresem, którego produkt nie ma. Wygenerowanie
-- nowego planu ZASTĘPUJE poprzedni.
--
-- `plan_item` MA KLUCZ NATURALNY i wiąże się przez `user_id`, a nie przez surogat `plan_id`.
-- Skoro plan jest jeden na konto, `user_id` JEST jego identyfikatorem i po wstawieniu nagłówka
-- nie ma czego odczytywać — cały zapis (dwa `DELETE` plus wstawienia) mieści się w jednym
-- `batch()`, bez rundy `RETURNING`. Skutek uboczny jest tym, po co to robimy: izolacja kont
-- filtruje po `user_id` BEZPOŚREDNIO na obu tabelach, bez pośredniego złączenia przez nagłówek.
-- D1 nie ma RLS, więc filtr w SQL-u jest jedyną granicą między kontami i im krótsza droga do
-- niego, tym mniej miejsc, w których da się go zgubić.
--
-- `target_kcal` JEST UTRWALONE i to NIE łamie reguły „cel kaloryczny nie jest utrwalany".
-- Tamta reguła (`0002:6-9`) zakazuje trzymania WYLICZENIA Z PROFILU, żeby ekran i generator nie
-- rozjechały się o kopię — dlatego cel dalej liczy `src/lib/calorie-target.ts` przy odczycie.
-- Tutaj zapisujemy co innego: FAKT HISTORYCZNY o tym, przeciw jakiej liczbie ten plan ułożono.
-- Bez niego, gdy użytkownik zmieni wagę, nie da się odróżnić planu WADLIWEGO (nigdy nie trafiał
-- w ±10%) od NIEAKTUALNEGO (trafiał, ale w poprzedni cel) — a to są dwie zupełnie różne rzeczy
-- do powiedzenia użytkownikowi.
--
-- `seed` istnieje, żeby powtórne wygenerowanie dawało INNY tydzień, a zgłoszony błąd dało się
-- odtworzyć co do dania. Generator jest deterministyczny WZGLĘDEM ziarna.
--
-- CHECK SĄ WYŁĄCZNIE WYLICZENIOWE I STRUKTURALNE, nigdy zakresowe — precedens `0002:24-34`
-- i ustalenie F1 przeglądu S-02. SQLite nie ma `ALTER TABLE … DROP CONSTRAINT`, więc korekta
-- granicy kosztuje przebudowę tabeli, a rozjazd między DDL a modułem walidującym wychodzi
-- użytkownikowi jako 500 nieodróżnialne od awarii D1.
--   * `day_index BETWEEN 1 AND 7` to ENUMERACJA siedmiu dopuszczalnych wartości, nie zakres
--     do strojenia: horyzont tygodnia jest w FR-008 i nie jest parametrem produktu.
--   * `meals_per_day BETWEEN 3 AND 6` powtarza enumerację z `0005:37` — plan musi zgadzać się
--     z preferencjami, wobec których powstał.
--   * `slot_index >= 1` to niezmiennik strukturalny, jak `dish_step.position >= 1` w `0003:80`.
--   * Okno ±10% i granice kaloryczne NIE WCHODZĄ do DDL. Żyją w `src/lib/plan-generator.ts`.
--
-- ON DELETE CASCADE do `app_user` — obietnica z `0002:18-22` („plany S-04 mają się dowiązać
-- tak samo") jest tu spłacana. Klucz obcy do `dish` BEZ kaskady, ta sama decyzja co
-- `dish_ingredient` (`0003:73`): danie używane przez czyjś plan nie powinno dać się usunąć po
-- cichu. Przeseedowanie puli, które je usunie, ma paść na kluczu obcym, a nie zostawić plan
-- ze zwisającą pozycją.
--
-- Migracja wstecz leży w `migrations/down/0006_plan.down.sql`.

-- Nagłówek planu: jeden wiersz na konto.
CREATE TABLE plan (
  user_id TEXT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  target_kcal INTEGER NOT NULL,
  meals_per_day INTEGER NOT NULL CHECK (meals_per_day BETWEEN 3 AND 6),
  seed TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Pozycje planu: `7 × meals_per_day` wierszy na konto.
--
-- `slot_index` jest osobną kolumną od `meal_slot`, bo pora POWTARZA SIĘ w dniu: przy sześciu
-- posiłkach dzień ma trzy przekąski. Sam `meal_slot` w kluczu głównym ograniczyłby dzień do
-- czterech pozycji i uczyniłby pięć oraz sześć posiłków niewyrażalnymi.
CREATE TABLE plan_item (
  user_id TEXT NOT NULL REFERENCES plan(user_id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL CHECK (day_index BETWEEN 1 AND 7),
  slot_index INTEGER NOT NULL CHECK (slot_index >= 1),
  meal_slot TEXT NOT NULL CHECK (meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  dish_id INTEGER NOT NULL REFERENCES dish(id),
  PRIMARY KEY (user_id, day_index, slot_index)
);

-- Odczyt planu z przepisami idzie od pozycji do dania, a wyświetlenie listy zakupów (S-07) pójdzie
-- tą samą drogą. Bez tego indeksu złączenie `plan_item` z `dish` skanuje po `dish_id` — ten sam
-- powód, dla którego powstała migracja `0004`.
CREATE INDEX idx_plan_item_dish ON plan_item(dish_id);
