-- Migracja wstecz dla `0006_plan.sql`. Leży w `down/`, bo wrangler czyta tylko najwyższy poziom
-- `migrations/` i tego podkatalogu nie widzi — uruchamia ją wyłącznie człowiek:
--
--   npx wrangler d1 export mealplan --remote --output kopia.sql   # NAJPIERW kopia
--   npx wrangler d1 execute mealplan --remote --file migrations/down/0006_plan.down.sql
--
-- Istnieje, bo `wrangler rollback` cofa kod, a NIE schemat.
--
-- DELETE z `d1_migrations` jest częścią cofnięcia, nie ozdobą: bez niego księga wranglera dalej
-- twierdzi, że `0006` jest zastosowana, więc `migrations apply` NIE odtworzy tabel. Środowisko
-- zostałoby z działającym kodem i błędem „no such table: plan" na każdym żądaniu do `/api/plan`.
--
-- To cofnięcie KASUJE jadłospisy wszystkich użytkowników. Odtworzenie ich nie jest utratą danych
-- nieodwracalną — plan da się wygenerować jeszcze raz — ale NIE BĘDZIE TO TEN SAM plan, bo ziarno
-- ginie razem z wierszem. Kopia przed uruchomieniem nadal nie jest formalnością.
--
-- KOLEJNOŚĆ USUWANIA jest wymuszona kluczem obcym i idzie od strony zależnej: `plan_item`
-- wskazuje na `plan`, więc nagłówek ginie drugi. Indeks ginie razem ze swoją tabelą, nie trzeba
-- go usuwać osobno.
--
-- Uruchamiaj PRZED `0003_dish_pool.down.sql` i `0001_app_user.down.sql` — odwrotna kolejność
-- nie przejdzie, bo klucze obce do `dish` i `app_user` blokują usunięcie tamtych.

DROP TABLE IF EXISTS plan_item;

DROP TABLE IF EXISTS plan;

DELETE FROM d1_migrations WHERE name = '0006_plan.sql';
