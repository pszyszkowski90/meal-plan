# Brief: Moduł 2, Lekcja 3 — przegląd implementacji

> Brief pisany z **jedenastu** raportów przeglądu leżących w tym repo, a nie z jednego przebiegu.
> Powstał po nadrobieniu zaległości: faza 1 F-01 weszła na produkcję **bez przeglądu** i to było
> jedyne takie miejsce w historii repo — zanim napisałem ten brief, przejrzałem ją.

## Co lekcja wprowadza

Łańcuch `/10x-implement → /10x-impl-review → triaż → (/10x-lesson | napraw | pomiń | nie zgadzam się)`.
Przegląd jest **bramką jakości, nie listą zadań do odhaczenia**: świadome pominięcie ustalenia
o niskim wpływie jest prawidłowym wynikiem, a nie zaniedbaniem.

Dwa wymiary każdego ustalenia, celowo rozdzielone:
- **Ważność** — jak źle, jeśli zignorujesz (KRYTYCZNE / OSTRZEŻENIE / OBSERWACJA).
- **Wpływ** — ile uwagi wymaga *decyzja* (NISKI / ŚREDNI / WYSOKI).

To rozdzielenie robi całą robotę. KRYTYCZNE o niskim wpływie to jednolinijkowa poprawka, którą
stosuje się bez myślenia. OSTRZEŻENIE o wysokim wpływie to stawka architektoniczna, przy której
trzeba usiąść. Zlanie tych dwóch w jedną „ważność" produkuje albo panikę przy drobiazgach, albo
przespanie kompromisu.

## Co ten łańcuch zostawił w MealPlanie — liczby

| Rodzaj | Ile raportów | Krytyczne | Ostrzeżenia | Obserwacje |
|---|---:|---:|---:|---:|
| `plan-review` | 3 | **9** | 16 | 8 |
| `impl-review` | 8 | **2** | 27 | 30 |

**Żaden z jedenastu przeglądów nie wrócił czysty.** Ani jeden.

### Ustalenie, którego się nie spodziewałem

**Przeglądy planu złapały dziewięć ustaleń krytycznych, przeglądy implementacji dwa.** I to jest
argument za tym, żeby recenzować plan, zanim cokolwiek powstanie — na tym etapie „naprawa" znaczy
przepisanie akapitu, a nie migracji.

Rekordzista: przegląd planu F-01 — **6 krytycznych, 10 ostrzeżeń, 4 obserwacje**, wszystkie
krytyczne naprawione w wersji 2 planu. To dwadzieścia ustaleń w dokumencie, który nie miał jeszcze
ani linijki kodu.

Do tego oba ustalenia krytyczne z przeglądów implementacji były **higieną commita, nie logiką**:
- S-01 faza 1: niespójny lockfile plus `clerk` CLI w `dependencies`,
- S-02 faza 1: **hasło w postaci jawnej** i 19 artefaktów Playwrighta w commicie.

Oba o **niskim wpływie** — oczywiste poprawki. Czyli: implementacja w tym repo psuła się rzadko
w sposób krytyczny, a często w sposób wymagający rozmowy (27 ostrzeżeń). Krytyczne rzeczy albo
wychodziły wcześniej, na przeglądzie planu, albo były pomyłką przy `git add`.

### Gdzie wypadają ustalenia krytyczne

Obydwa werdykty **ODRZUCONY** padły na **fazę 1** swojej zmiany (S-01 i S-02). Pierwsza faza jest
tą, w której powstaje schemat, konfiguracja i commit założycielski — i to tam ląduje hasło
w repozytorium albo zepsuty lockfile. Faza trzecia bywa pełna obserwacji o UX, ale nie krytyków.

## Faza, która nie została przejrzana — i co to pokazało

F-01 faza 1 (migracja `0003`, pięć tabel, rozszerzenie typu D1) weszła commitem `c848474`,
została zastosowana `--local` **i `--remote`**, i nie miała przeglądu. Nadrobiłem go dziś.

Werdykt: **WYMAGA UWAGI** — 0 krytycznych, 2 ostrzeżenia, 2 obserwacje. Czyli: produkcji nic nie
groziło. Ale dwie rzeczy wyszły dopiero teraz, obie **zmierzone, nie wydedukowane**:

1. **Odsiew po składniku skanuje całą tabelę.** `dish_ingredient` ma `PRIMARY KEY (dish_id,
   ingredient_id)`, a wykluczenie składnikowe pyta po `ingredient_id` — czyli po drugiej kolumnie.
   `EXPLAIN QUERY PLAN` mówi `SCAN` zamiast `SEARCH`. To luka **planu**, nie wykonawcy: plan
   przewidział indeks na `dish_meal_slot`, ale nie ten. Odroczone do fazy 4, bo tabela jest pusta.
2. **Kryterium weryfikacyjne, które nie potrafiło wykryć własnego odstępstwa** — patrz niżej.

Wniosek praktyczny: przegląd po fakcie **nadal ma wartość** (znalazł dwie rzeczy, których nikt nie
widział), ale kosztuje więcej — schemat jest już na produkcji, więc poprawka F1 wymaga nowej
migracji zamiast edycji pliku, który jeszcze nie został zastosowany.

## Odstępstwo, które podtrzymałem — i dlaczego to jest wynik przeglądu

Kontrakt fazy 1 wymieniał `prep_minutes` **5–120** jako `CHECK`. Wdrożono `prep_minutes > 0`.

Łatwo byłoby zgłosić to jako dryf i kazać naprawić. **Nie zrobiłem tego**, bo wykonawca uzasadnił
odstępstwo w Progressie i uzasadnienie jest lepsze niż plan: zakres 5–120 to reguła produktowa,
a nie niezmiennik bazy; komentarz w `0002` **wprost zakazuje** kopiowania zakresów liczbowych
do DDL; SQLite nie ma `ALTER TABLE … DROP CONSTRAINT`, więc korekta progu kosztowałaby przebudowę
tabeli. Co więcej, ustalenie F1 przeglądu fazy 2 S-02 kazało **usunąć** cztery dokładnie takie
`CHECK`-i. Plan przeczył sam sobie — powoływał się na tę zasadę zdanie wcześniej.

Czego uzasadnienie **nie powiedziało** i co dołożyłem: odstępstwo jest bezpieczne tylko przy dwóch
warunkach — zakres musi mieć właściciela gdzie indziej (spełnione dopiero w fazie 2,
`DishBounds.prepMinutes`) i musi istnieć **jedna droga zapisu** (zależy od fazy 3; sprawdziłem, że
`wrangler d1 execute` wstawia `prep_minutes = 999` bez mrugnięcia).

To jest dla mnie sedno lekcji o triażu: **prawidłowym wynikiem przeglądu bywa „zgadzam się
z wykonawcą przeciwko planowi"** — pod warunkiem, że zapiszesz, co czyni tę zgodę prawdziwą.

## Wzorzec, który wyszedł dwa razy tego samego dnia

Ustalenie F2 mojego przeglądu: **kryterium 1.5 przechodziło niezależnie od tego, czy zaplanowane
ograniczenie istnieje.** Testowało `prep_minutes = 0` — wartość odrzucaną zarówno przez `> 0`, jak
i przez `BETWEEN 5 AND 120`. Zaplanowanego zakresu nie ma, a kryterium świeci na zielono.

Kilka godzin wcześniej, w innym zadaniu, trafiłem na ten sam kształt w planie S-03: kryterium 1.7
żądało wykluczenia „grzyby" nad modelem, który potrafi wskazać wyłącznie `ingredient_id`, a wiersza
„grzyby" nie ma i nie będzie.

Dwa wystąpienia w dwóch niezależnych planach to nie przypadek, tylko wzorzec — więc poszło do
[`lessons.md`](../context/foundation/lessons.md) jako reguła: *czy istnieje świat, w którym to
kryterium przechodzi, a funkcja nie działa?* Jeśli tak, kryterium jest do przepisania.

To jest dokładnie ta ścieżka triażu, o której mówi lekcja — „zapisz jako powtarzającą się regułę"
zamiast „napraw i zapomnij".

## Czego ten łańcuch NIE załatwia

- **Przegląd nie zastępuje uruchomienia.** Przegląd planu F-01 sam zaznacza: *„recenzent czytał
  wyłącznie kod i dokumenty — nie uruchamiał żadnego polecenia"*. Mój przegląd fazy 1 **uruchomił**
  każde kryterium (`migrations list` lokalnie i zdalnie, oba `INSERT`-y łamiące `CHECK`,
  `EXPLAIN QUERY PLAN`) i tylko dlatego F1 i F2 w ogóle wyszły. Przegląd czytany jest tańszy
  i słabszy; warto wiedzieć, który się robi.
- **Przegląd nie pilnuje, żeby fazę w ogóle przejrzeć.** Faza 1 F-01 ominęła łańcuch nie dlatego,
  że przegląd zawiódł, tylko dlatego, że nikt go nie wywołał. Dopiero bramka w CI (m5l3) jest
  warstwą, której nie da się pominąć — i te dwie lekcje dobrze się uzupełniają.

## Co zabieram

1. **Recenzuj plan, zanim powstanie kod.** Dziewięć ustaleń krytycznych z trzech przeglądów planu
   kontra dwa z ośmiu przeglądów implementacji. Naprawa akapitu jest tańsza niż naprawa migracji.
2. **Uruchamiaj kryteria, nie czytaj ich.** Oba moje ustalenia wymagały wykonania polecenia.
3. **Rozdzielaj ważność od wpływu.** Oba ustalenia krytyczne w historii tego repo miały NISKI
   wpływ — były groźne i jednocześnie trywialne do naprawienia.
4. **Zgoda z wykonawcą przeciwko planowi jest prawidłowym wynikiem** — o ile zapiszesz warunki,
   przy których pozostaje prawdziwa.
5. **Drugie wystąpienie tego samego kształtu to już reguła**, nie kolejna poprawka.
