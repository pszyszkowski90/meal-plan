<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Źródło dań z makrami i minimalna pula (F-01)

- **Plan**: `context/changes/dish-source-and-seed-pool/plan.md`
- **Zakres**: Faza 1 z 4 — „Schemat puli dań"
- **Data**: 2026-09-13
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 2 ostrzeżenia, 2 obserwacje

> **Dlaczego ten przegląd powstaje z opóźnieniem.** Faza 1 weszła commitem `c848474`, została
> zastosowana `--local` **i `--remote`**, i **nie była recenzowana** — w odróżnieniu od wszystkich
> ośmiu poprzednich faz tego repo. Schemat stoi na produkcji od kilku godzin. To jest ten przypadek,
> przed którym ostrzega lekcja o przeglądzie: nieprzejrzana faza nie zatrzymuje się na granicy
> środowiska.

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | WARNING |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | PASS |
| Architektura | WARNING |
| Spójność wzorców | PASS |
| Kryteria sukcesu | WARNING |

## Weryfikacja kryteriów sukcesu — uruchomiona, nie odczytana

| Kryterium | Wynik | Dowód |
|---|---|---|
| 1.1 `migrations apply --local` | PASS | `migrations list --local` → „No migrations to apply!" |
| 1.2 `migrations list --local` bez zaległych | PASS | jw. |
| 1.3 `tsc --noEmit` czyste po `all()` | PASS | 0 błędów |
| 1.4 Para wsteczna usuwa pięć tabel i wpis | PASS (statycznie) | `down/0003` ma pięć `DROP` w kolejności FK + `DELETE FROM d1_migrations` |
| 1.5 `INSERT` łamiący `CHECK` odrzucony | PASS | `category='nieistniejaca'` → `CHECK constraint failed: category IN (`; `prep_minutes=0` → `CHECK constraint failed: prep_minutes > 0` |
| 1.6 (ręczne) `.schema` — pięć tabel | PASS | `dish`, `dish_ingredient`, `dish_meal_slot`, `dish_step`, `ingredient` obecne |

Dodatkowo zweryfikowano **`migrations list --remote`** → „No migrations to apply!", czyli produkcja
faktycznie ma `0003`. Wpis w Progressie nie był podpisem na ślepo.

Wiersze próbne wstawione podczas weryfikacji zostały usunięte; `SELECT COUNT(*) FROM dish` → 0.

## Ustalenia

### F1 — Odsiew po składniku skanuje całą tabelę `dish_ingredient`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Architektura
- **Lokalizacja**: `migrations/0003_dish_pool.sql:71-76`
- **Szczegóły**: `dish_ingredient` ma `PRIMARY KEY (dish_id, ingredient_id)`, czyli indeks
  z `dish_id` jako pierwszą kolumną. Zapytanie „które dania zawierają ten składnik" — czyli
  **dokładnie to, co robi wykluczenie składnikowe** w `listAllowedDishes` (S-03) i generator
  (S-04) — filtruje po `ingredient_id`, czyli po drugiej kolumnie. SQLite nie może użyć takiego
  indeksu jako prefiksu. Zmierzone `EXPLAIN QUERY PLAN`:

  ```
  WHERE ingredient_id = ?  →  SCAN dish_ingredient USING COVERING INDEX …
  WHERE dish_id = ?        →  SEARCH dish_ingredient USING COVERING INDEX … (dish_id=?)
  ```

  SCAN kontra SEARCH. Plan fazy 1 przewidział indeks na `dish_meal_slot(meal_slot)`, ale nie ten —
  to jest **luka planu**, nie odstępstwo wykonawcy. Dziś nie boli (tabela jest pusta), a przy puli
  rzędu stu dań to ~800 wierszy. Ma jednak znaczenie dla otwartego pytania mapy drogowej o budżet
  10 ms CPU planu darmowego Workers: generator odpytuje odsiew **wielokrotnie na jeden plan**.
- **Poprawka**: `CREATE INDEX idx_dish_ingredient_ingredient ON dish_ingredient(ingredient_id);`
  w osobnej migracji, **przed fazą 4** (pomiar wykonalności) — nie teraz.
  - Siła: Jedna linia, zamienia SCAN na SEARCH na ścieżce, którą deptać będą S-03 i S-04.
  - Kompromis: Kolejna migracja do zastosowania na produkcji; numer `0004` jest już zajęty przez
    preferencje w planie S-03, więc wejdzie jako `0005` albo wymusi przenumerowanie.
  - Pewność: HIGH — plan zapytania zmierzony, nie założony.
  - Martwy punkt: Nie zmierzono realnego czasu przy pełnej puli, bo pula nie istnieje. Indeks przy
    800 wierszach może być nieodróżnialny od skanu; decyduje dopiero faza 4.
- **Decyzja**: ODROCZONE — dopisane do `follow-ups/review-fixes.md`. Dodanie indeksu do pustej
  tabeli dziś to migracja na produkcję bez mierzalnej korzyści; właściwy moment to faza 4, która
  i tak mierzy wykonalność.

### F2 — Kryterium 1.5 nie potrafiło odróżnić zaplanowanego ograniczenia od wdrożonego

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `context/changes/dish-source-and-seed-pool/plan.md` — kryterium 1.5
- **Szczegóły**: Kontrakt fazy 1 wymieniał `prep_minutes` **5–120** jako `CHECK`. Wdrożono
  `prep_minutes > 0`. Kryterium weryfikacyjne brzmi: „`INSERT` z `category` spoza enuma
  i `prep_minutes = 0` odrzucony przez bazę" — i przechodzi **w obu światach**, bo `0` łamie
  zarówno `> 0`, jak i `BETWEEN 5 AND 120`. Sprawdzone: `prep_minutes = 999` **przechodzi**
  („1 command executed successfully"), czyli zaplanowane ograniczenie nie istnieje, a kryterium
  tego nie widzi.

  To jest **druga taka konstrukcja znaleziona dziś w tym repo** — kryterium 1.7 planu S-03 żądało
  wykluczenia „grzyby", czego jego własny model danych nie potrafi wyrazić. Wspólny kształt:
  kryterium sformułowane tak, że przechodzi niezależnie od tego, czy rzecz działa.
- **Poprawka**: Kryterium testujące zakres musi trafiać **w oba końce i tuż za nie** (0, 4, 5, 120,
  121), a nie w jedną wartość spełniającą kilka różnych ograniczeń naraz.
- **Decyzja**: ZAPISANE JAKO LEKCJA — wzorzec powtarzalny, trafia do `lessons.md`.

### F3 — Odstępstwo `prep_minutes`: uzasadnione, ale warunek bezpieczeństwa nie był nazwany

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🔎 ŚREDNI
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: `migrations/0003_dish_pool.sql:61`, uzasadnienie w Progressie planu
- **Szczegóły**: Wykonawca świadomie nie wpisał zakresu 5–120 do DDL i **uzasadnił to w Progressie**:
  zakres jest regułą produktową, a nie niezmiennikiem bazy; komentarz w `0002` wprost zakazuje
  kopiowania zakresów liczbowych do DDL; SQLite nie ma `ALTER TABLE … DROP CONSTRAINT`, więc
  korekta progu kosztowałaby przebudowę tabeli. **Podtrzymuję tę decyzję** — jest zgodna
  z precedensem (ustalenie F1 przeglądu fazy 2 S-02, gdzie cztery takie `CHECK`-i **usunięto**),
  a plan rzeczywiście przeczył sam sobie: powoływał się na tę zasadę zdanie wcześniej.

  Czego uzasadnienie **nie powiedziało**: odstępstwo jest bezpieczne wyłącznie wtedy, gdy zakres
  ma właściciela gdzie indziej **i** gdy istnieje tylko jedna droga zapisu. Pierwszy warunek został
  spełniony dopiero w fazie 2 (`src/lib/dish-validation.ts`, `DishBounds.prepMinutes`) — między
  fazą 1 a 2 zakres nie miał właściciela nigdzie. Drugi warunek zależy od fazy 3: skrypt seedujący
  musi być **jedyną** drogą zapisu, bo `wrangler d1 execute` wstawi 999 bez mrugnięcia
  (sprawdzone).
- **Poprawka**: Dopisać oba warunki do komentarza migracji albo do planu fazy 3 — „seed jest jedyną
  drogą zapisu do `dish`" powinno być regułą, nie założeniem.
- **Decyzja**: ZAAKCEPTOWANE — odstępstwo podtrzymane, warunek nazwany w tym raporcie i w Dzienniku.

### F4 — Typ `all<T>()` jest węższy niż kontrakt D1 i zgubi `meta`

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja
- **Lokalizacja**: `src/server/env.ts:24-29`
- **Szczegóły**: Zadeklarowano `all<T>(): Promise<{ results: T[] }>`, z uczciwym komentarzem, że
  `results` to jedyne pole, którego repo używa. D1 zwraca też `meta` z `rows_read` i `duration`.
  Otwarte pytanie mapy drogowej o budżet 10 ms CPU będzie chciało dokładnie tych liczb, a wtedy
  typ trzeba będzie rozszerzyć.
- **Poprawka**: Rozszerzyć o `meta?: { rows_read?: number; duration?: number }` wtedy, gdy faza 4
  będzie mierzyć — nie na zapas.
- **Decyzja**: POMINIĘTE — świadomie, wraca razem z pomiarem z fazy 4.

## Czego przegląd NIE znalazł

Warto zapisać, żeby kolejny przegląd nie szukał tego od nowa:

- **Zero ryzyk wstrzyknięcia** — faza 1 to czysty DDL, bez konkatenacji i bez danych użytkownika.
- **Migracja wsteczna jest poprawna**: pięć `DROP` w kolejności odwrotnej do zależności FK
  (`dish_ingredient` → `dish_step` → `dish_meal_slot` → `dish` → `ingredient`) plus `DELETE
  FROM d1_migrations`, bez którego `migrations apply` nie odtworzyłby tabel.
- **Zgodność wzorców z `0001` i `0002`** — ten sam nagłówek z uzasadnieniem, ta sama polityka
  `CHECK` (enumeracje i niezmienniki strukturalne, zero zakresów), ta sama para w `down/`.
- **Brak `user_id` w pięciu tabelach jest celowy i udokumentowany** — to pierwsze dane
  współdzielone w repo, czytane przez wszystkich, zapisywane wyłącznie skryptem.
