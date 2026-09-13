-- Migracja wstecz dla `0003_dish_pool.sql`. Leży w `down/`, bo wrangler czyta tylko najwyższy
-- poziom `migrations/` i tego podkatalogu nie widzi — uruchamia ją wyłącznie człowiek:
--
--   npx wrangler d1 export mealplan --remote --output kopia.sql   # NAJPIERW kopia
--   npx wrangler d1 execute mealplan --remote --file migrations/down/0003_dish_pool.down.sql
--
-- Istnieje, bo `wrangler rollback` cofa kod, a NIE schemat.
--
-- `DELETE` z `d1_migrations` jest częścią cofnięcia, nie ozdobą: bez niego księga wranglera dalej
-- twierdzi, że `0003` jest zastosowana, więc `migrations apply` NIE odtworzy tabel.
--
-- To cofnięcie KASUJE CAŁĄ PULĘ DAŃ. W odróżnieniu od `0002` nie kasuje danych użytkowników —
-- pula jest odtwarzalna ze skryptu seedującego i plików w `seed/`, więc koszt jest czasowy,
-- nie nieodwracalny. Mimo to kopia przed uruchomieniem jest tania.
--
-- KOLEJNOŚĆ MA ZNACZENIE. Tabele zależne idą przed tymi, do których się odwołują:
-- `dish_ingredient` wskazuje i na `dish`, i na `ingredient`, więc musi zniknąć jako pierwsza
-- (razem z `dish_step` i `dish_meal_slot`), potem `dish`, a `ingredient` na końcu. Odwrotna
-- kolejność poleci na `FOREIGN KEY constraint failed`.
--
-- Nie koliduje z `0001` ani `0002`: pula dań nie ma żadnego dowiązania do `app_user`.

DROP TABLE IF EXISTS dish_ingredient;
DROP TABLE IF EXISTS dish_step;
DROP TABLE IF EXISTS dish_meal_slot;
DROP TABLE IF EXISTS dish;
DROP TABLE IF EXISTS ingredient;

DELETE FROM d1_migrations WHERE name = '0003_dish_pool.sql';
