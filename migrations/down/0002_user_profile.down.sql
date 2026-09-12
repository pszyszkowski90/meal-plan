-- Migracja wstecz dla `0002_user_profile.sql`. Leży w `down/`, bo wrangler czyta tylko najwyższy
-- poziom `migrations/` i tego podkatalogu nie widzi — uruchamia ją wyłącznie człowiek:
--
--   npx wrangler d1 export mealplan --remote --output kopia.sql   # NAJPIERW kopia
--   npx wrangler d1 execute mealplan --remote --file migrations/down/0002_user_profile.down.sql
--
-- Istnieje, bo `wrangler rollback` cofa kod, a NIE schemat.
--
-- `DELETE` z `d1_migrations` jest częścią cofnięcia, nie ozdobą: bez niego księga wranglera dalej
-- twierdzi, że `0002` jest zastosowana, więc `migrations apply` NIE odtworzy tabeli. Środowisko
-- zostałoby z działającym kodem i „no such table: user_profile" na każdym żądaniu do `/api/profile`.
--
-- To cofnięcie KASUJE profile wszystkich użytkowników. Kopia przed uruchomieniem nie jest
-- formalnością.
--
-- Uruchamiaj PRZED `0001_app_user.down.sql` — odwrotna kolejność nie przejdzie, bo klucz obcy
-- `user_profile.user_id → app_user.id` blokuje usunięcie `app_user`.

DROP TABLE IF EXISTS user_profile;

DELETE FROM d1_migrations WHERE name = '0002_user_profile.sql';
