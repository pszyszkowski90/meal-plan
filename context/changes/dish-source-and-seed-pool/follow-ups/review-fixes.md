# Poprawki z przeglądów — F-01

Rzeczy rozstrzygnięte w triażu jako „zrobić, ale nie teraz". Każda ma nazwany **moment**, w którym
przestaje być odroczeniem, a zaczyna być zaległością.

## Z przeglądu fazy 1 (13.09.2026)

### F1 — indeks na `dish_ingredient(ingredient_id)`

**Co**: `CREATE INDEX idx_dish_ingredient_ingredient ON dish_ingredient(ingredient_id);`
w osobnej migracji (numer `0004` jest zajęty przez preferencje w planie S-03 — wejdzie jako `0005`
albo wymusi przenumerowanie).

**Dlaczego**: `PRIMARY KEY (dish_id, ingredient_id)` indeksuje `dish_id` jako pierwszy, więc
zapytanie „które dania zawierają ten składnik" — czyli cały odsiew wykluczeń — nie może użyć
indeksu jako prefiksu. Zmierzone `EXPLAIN QUERY PLAN`: `SCAN` przy filtrze po `ingredient_id`
kontra `SEARCH` przy filtrze po `dish_id`.

**Kiedy przestaje być odroczeniem**: **przed fazą 4**, która mierzy wykonalność puli. Dziś tabela
jest pusta, więc migracja na produkcję dałaby zero mierzalnej korzyści przy niezerowym ryzyku.
Faza 4 i tak mierzy — indeks ma tam być, zanim padnie pierwsza liczba.

**Czego nie wiem**: czy przy ~800 wierszach (sto dań × osiem składników) indeks w ogóle będzie
odróżnialny od skanu. Możliwe, że nie — i wtedy uzasadnieniem zostaje wyłącznie budżet 10 ms CPU
przy wielokrotnym odpytywaniu przez generator (S-04).

### F4 — `meta` w typie `all<T>()`

**Co**: rozszerzyć `all<T>()` w `src/server/env.ts` o `meta?: { rows_read?: number; duration?: number }`.

**Kiedy**: razem z pomiarem budżetu CPU w fazie 4. Nie na zapas — dziś nikt tych pól nie czyta.
