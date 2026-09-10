-- Migracja wstecz dla `0001_app_user.sql`. Leży w `down/`, bo wrangler czyta tylko najwyższy
-- poziom `migrations/` i tego podkatalogu nie widzi — uruchamia ją wyłącznie człowiek:
--
--   npx wrangler d1 export mealplan --remote --output kopia.sql   # NAJPIERW kopia
--   npx wrangler d1 execute mealplan --remote --file migrations/down/0001_app_user.down.sql
--
-- Istnieje, bo `wrangler rollback` cofa kod, a NIE schemat.
--
-- `DELETE` z `d1_migrations` jest częścią cofnięcia, nie ozdobą: bez niego księga wranglera dalej
-- twierdzi, że `0001` jest zastosowana, więc `migrations apply` NIE odtworzy tabeli. Środowisko
-- zostałoby z działającym kodem i „no such table: app_user" na każdym uwierzytelnionym żądaniu.

DROP TABLE IF EXISTS app_user;

DELETE FROM d1_migrations WHERE name = '0001_app_user.sql';
