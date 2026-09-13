-- Migracja wstecz dla `0004_dish_ingredient_index.sql`. Leży w `down/`, bo wrangler czyta tylko
-- najwyższy poziom `migrations/` i tego podkatalogu nie widzi — uruchamia ją wyłącznie człowiek:
--
--   npx wrangler d1 execute mealplan --remote --file migrations/down/0004_dish_ingredient_index.down.sql
--
-- Kopia zapasowa NIE jest tu potrzebna, w odróżnieniu od `0002` i `0003`: usunięcie indeksu
-- **nie dotyka ani jednego wiersza danych**. To jedyna migracja wstecz w tym repo, która jest
-- w pełni bezkosztowa — najgorsze, co się stanie, to powrót do `SCAN` w odsiewie wykluczeń.
--
-- `DELETE` z `d1_migrations` jest częścią cofnięcia, nie ozdobą: bez niego księga wranglera dalej
-- twierdzi, że `0004` jest zastosowana, więc `migrations apply` NIE odtworzy indeksu.

DROP INDEX IF EXISTS idx_dish_ingredient_ingredient;

DELETE FROM d1_migrations WHERE name = '0004_dish_ingredient_index.sql';
