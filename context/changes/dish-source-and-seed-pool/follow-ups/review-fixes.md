# Poprawki z przeglądów — F-01

Rzeczy rozstrzygnięte w triażu jako „zrobić, ale nie teraz". Każda ma nazwany **moment**, w którym
przestaje być odroczeniem, a zaczyna być zaległością.

## Z przeglądu fazy 1 (13.09.2026)

### ~~F1 — indeks na `dish_ingredient(ingredient_id)`~~ — ZROBIONE 13.09.2026

**Co**: `CREATE INDEX idx_dish_ingredient_ingredient ON dish_ingredient(ingredient_id);`
w osobnej migracji `0004`. Osobna, bo `0003` jest już zastosowana na produkcji, a migracji
zastosowanej się nie edytuje — wrangler rozpoznaje je po nazwie w `d1_migrations` i nie zauważyłby
zmiany treści.

**Dlaczego**: `PRIMARY KEY (dish_id, ingredient_id)` indeksuje `dish_id` jako pierwszy, więc
zapytanie „które dania zawierają ten składnik" — czyli cały odsiew wykluczeń — nie może użyć
indeksu jako prefiksu. Zmierzone `EXPLAIN QUERY PLAN`: `SCAN` przy filtrze po `ingredient_id`
kontra `SEARCH` przy filtrze po `dish_id`.

**Zrobione wcześniej, niż zakładało odroczenie — i to była dobra zmiana zdania.** Powodem nie było
ryzyko wydajności (tabela nadal jest pusta), tylko **numeracja migracji**: S-03 faza 1 została
odblokowana decyzją D21 i miała zająć numer `0004`. Zostawienie indeksu „na potem" znaczyłoby
wybór między przenumerowaniem preferencji później a pamiętaniem o luce. Indeks wszedł jako `0004`,
preferencje przesunięte na `0005`.

Migracja: `migrations/0004_dish_ingredient_index.sql` + para wsteczna. Zastosowana **`--local`**.

**Zweryfikowane, nie założone:** `EXPLAIN QUERY PLAN` po migracji daje
`SEARCH dish_ingredient USING INDEX idx_dish_ingredient_ingredient (ingredient_id=?)` zamiast
`SCAN`. Para wsteczna sprawdzona w obie strony: po jej uruchomieniu indeks znika, `migrations list
--local` znów pokazuje `0004` jako zaległą, a ponowne `apply` ją odtwarza.

~~**`--remote` NIE wykonane i to jest świadome.**~~ **Wykonane 13.09.2026** — dokładnie tak, jak
zapowiadał ten akapit: „razem z migracją preferencji". `migrations apply --remote` przy `0005`
zabrało zaległe `0004`, bo wrangler stosuje wszystkie zaległe migracje po kolei, nie tylko
najnowszą. Potwierdzone 14.09.2026 zapytaniem o księgę:

```sh
npx wrangler d1 execute mealplan --remote --command "select name from d1_migrations order by id;"
# 0001_app_user.sql, 0002_user_profile.sql, 0003_dish_pool.sql,
# 0004_dish_ingredient_index.sql, 0005_preferences.sql
```

Zostawione przekreśleniem, a nie usunięte: pierwotne rozumowanie („warunek produkcyjny wchodzi
przed fazą, która go POTRZEBUJE") było poprawne i nadal obowiązuje — zmienił się fakt, nie reguła.

**Czego nadal nie wiem**: czy przy ~800 wierszach (sto dań × osiem składników) indeks będzie
odróżnialny od skanu w czasie. Możliwe, że nie — i wtedy uzasadnieniem zostaje wyłącznie budżet
10 ms CPU przy wielokrotnym odpytywaniu przez generator (S-04). Pomiar należy do fazy 4.

### F4 — `meta` w typie `all<T>()`

**Co**: rozszerzyć `all<T>()` w `src/server/env.ts` o `meta?: { rows_read?: number; duration?: number }`.

**Kiedy**: razem z pomiarem budżetu CPU w fazie 4. Nie na zapas — dziś nikt tych pól nie czyta.
