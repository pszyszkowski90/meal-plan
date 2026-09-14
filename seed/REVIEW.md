# Przegląd gramatur — co ten stempel naprawdę znaczy

Każde danie w `seed/dishes/` ma pole `reviewedBy`, a `scripts/seed-dishes.mjs` **odmawia** seeda
`--remote` dla dania bez niego. Ten plik mówi, co ten stempel obejmuje, a czego **nie** — żeby
nikt nie odczytał go jako gwarancji szerszej, niż jest.

## Kto przeglądał

Wszystkie 58 dań: `agent (upoważnienie właściciela 14.09.2026)`.

Decyzja D14 zakładała pierwotnie, że gramatury przegląda **człowiek**. Właściciel przekazał ten
przegląd agentowi 14.09.2026, po przedstawieniu kosztu — świadome rozluźnienie, nie skrót agenta.
Konsekwencja jest jedna i trzeba ją nazwać wprost: **człowiek wyszedł z pętli, więc sita są jedyną
obroną**. Dlatego są ostrzejsze, niż zakładał pierwotny plan.

## Co sito faktycznie łapie

| Sito | Co wykrywa | Gdzie mieszka |
| --- | --- | --- |
| Opis USDA przy `fdcId` | podmianę składnika na inny produkt (`169251` surowe → `169252` gotowane) | `distill-usda.mjs` |
| Nagłówek kolumn CSV | przestawione kolumny dające wiarygodne, ale błędne makra | `distill-usda.mjs` |
| Atwater na składniku i daniu | źle zmapowany wiersz USDA, błąd rzędu ×10 | `src/lib/dish-macros.ts` |
| Energia porcji 150–1500 kcal | błąd ×10 i ×0,1, składnik podpięty pod wodę | `src/lib/dish-validation.ts` |
| Gęstość 0,3–5 kcal/g | gramaturę przesuniętą o rząd | `src/lib/dish-validation.ts` |
| `modelKcalHint` ±20% | gramaturę, która nie dowozi zamierzonego pasma | `seed-dishes.mjs` |

## Czego sito NIE łapie — i to jest tu najważniejsze

- **Liczby wymyślonej konsekwentnie.** Pierwszy seed składników (13.09) miał makra z pamięci
  modelu; **osiem z 35 nie zgadzało się z żadnym wierszem USDA**, a mimo to przeszło sito
  Atwatera, bo były wewnętrznie spójne. Dlatego makra muszą pochodzić z wiersza, a nie z oceny —
  sito jest siatką na błędy rzędu wielkości, nie detektorem prawdy.
- **Przepisu, który się nie da ugotować.** Walidator sprawdza, że kroki istnieją i nie są puste.
  Że mają sens, nie sprawdza nic.
- **Tego, czy porcja jest realna dla człowieka.** 300 g suchego makaronu przejdzie każde sito
  i będzie porcją dla trzech osób.

## Co ten przegląd wykrył

**Trzy dania odrzucone** przez sito `modelKcalHint` (rozjazd deklaracji z wyliczeniem powyżej 20%):

| Danie | Deklarowane | Wyliczone | Rozjazd |
| --- | ---: | ---: | ---: |
| sałatka grecka z kurczakiem | 700 kcal | 511 kcal | 27% |
| sałatka z tuńczykiem i awokado | 500 kcal | 367 kcal | 27% |
| kanapki z fetą i oliwkami | 600 kcal | 469 kcal | 22% |

Wszystkie trzy **warzywne**. Przyczyną nie był zły przepis, tylko systematyczne przeszacowanie
energii dań warzywnych przez autora. Mimo to zostały **odrzucone, a nie poprawione gramaturą**:
reguła jest mechaniczna po to, żeby „to była tylko pomyłka w szacunku" nie stało się furtką.

**Jedno danie poprawione:** `banan-z-maslem-orzechowym` miał `prepMinutes: 3`, poniżej dolnej
granicy walidatora. Podniesione do 5 — to nie jest naginanie pod sito kaloryczne, tylko korekta
pola, które realnie wynosi tyle, ile minimum.

## Zastrzeżenie do `modelKcalHint`

Dla **45 dań** deklaracja była ślepym oszacowaniem zapisanym przed policzeniem; największy rozjazd
wśród nich to 19%, tuż pod progiem.

Dla **11 dań z fazy 4** deklaracja jest **celem projektowym**, nie ślepym oszacowaniem — te dania
powstały porcjowane do pasma kalorycznego, bo sufit dnia był za niski (patrz
[FEASIBILITY.md](FEASIBILITY.md)). Ich zerowy rozjazd **nie dowodzi trafności szacowania**. Sito
robi tam inną, węższą robotę: pilnuje, że gramatura dowozi zamierzone pasmo.

Rozróżnienie jest zapisane, bo raport bez niego czytałoby się jako dowód, że szacowanie się
poprawiło — a ono się nie poprawiło.
