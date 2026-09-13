-- Migracja wstecz dla `0005_preferences.sql`. Leży w `down/`, bo wrangler czyta tylko najwyższy
-- poziom `migrations/` i tego podkatalogu nie widzi — uruchamia ją wyłącznie człowiek:
--
--   npx wrangler d1 export mealplan --remote --output kopia.sql   # NAJPIERW kopia
--   npx wrangler d1 execute mealplan --remote --file migrations/down/0005_preferences.down.sql
--
-- Istnieje, bo `wrangler rollback` cofa kod, a NIE schemat.
--
-- DELETE z `d1_migrations` jest częścią cofnięcia, nie ozdobą: bez niego księga wranglera dalej
-- twierdzi, że `0005` jest zastosowana, więc `migrations apply` NIE odtworzy tabel. Środowisko
-- zostałoby z działającym kodem i błędem „no such table: user_preferences" na każdym żądaniu
-- do `/api/preferences`.
--
-- To cofnięcie KASUJE wykluczenia i preferencje wszystkich użytkowników ORAZ słownik grup.
-- Kopia przed uruchomieniem nie jest formalnością.
--
-- KOLEJNOŚĆ USUWANIA jest wymuszona kluczami obcymi i idzie od strony zależnej: `exclusion`
-- wskazuje na `exclusion_group`, `ingredient_group` też — więc słownik grup ginie ostatni.
-- Indeksy giną razem ze swoimi tabelami, nie trzeba ich usuwać osobno.
--
-- Uruchamiaj PRZED `0003_dish_pool.down.sql` i `0001_app_user.down.sql` — odwrotna kolejność
-- nie przejdzie, bo klucze obce do `ingredient`, `dish` i `app_user` blokują usunięcie tamtych.

DROP TABLE IF EXISTS exclusion;

DROP TABLE IF EXISTS ingredient_group;

DROP TABLE IF EXISTS exclusion_group;

DROP TABLE IF EXISTS user_preferences;

DELETE FROM d1_migrations WHERE name = '0005_preferences.sql';
