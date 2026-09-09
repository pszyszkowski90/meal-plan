-- Migracja wstecz dla `0001_app_user.sql`. Leży w `down/`, bo wrangler czyta tylko najwyższy
-- poziom `migrations/` i tego podkatalogu nie widzi — uruchamia ją wyłącznie człowiek:
--
--   npx wrangler d1 execute mealplan --remote --file migrations/down/0001_app_user.down.sql
--
-- Istnieje, bo `wrangler rollback` cofa kod, a NIE schemat.

DROP TABLE IF EXISTS app_user;
