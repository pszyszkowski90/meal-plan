# `seed/` — dane źródłowe puli

Treść, z której powstaje pula dań, leży tutaj jako **dane w repozytorium**, a nie w kodzie
skryptów. Powód jest praktyczny: makra składników i gramatury przepisów mają być czytelne w diffie
i przeglądalne przez człowieka, a skrypty mają wyłącznie je przenosić.

## Pliki

| Plik | Kto pisze | Co zawiera |
| --- | --- | --- |
| `ingredients.json` | **człowiek** | mapowanie polska nazwa → `fdcId` USDA, kategoria, grupy wykluczeniowe |
| `usda-subset.json` | `scripts/distill-usda.mjs` | destylat: cztery makra na 100 g dla wymienionych `fdcId` |

## Potok składników

```sh
# 1. Pobranie zbioru USDA — RAZ, przez człowieka. 6 MB spakowane, 38 MB po rozpakowaniu.
mkdir -p .usda
curl -L -o .usda/sr-legacy.zip \
  https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
cd .usda && unzip -q sr-legacy.zip && cd ..

# 2. Destylacja do repozytorium (35 wierszy zamiast 38 MB)
npm run distill:usda

# 3. SQL — skrypt PISZE NA STDOUT, niczego sam nie stosuje
npm run --silent import:usda > .wrangler/ingredients.sql
npx wrangler d1 execute mealplan --local  --file .wrangler/ingredients.sql
npx wrangler d1 execute mealplan --remote --file .wrangler/ingredients.sql
```

`.usda/` jest w `.gitignore` — do repozytorium trafia wyłącznie destylat.

**`--silent` jest obowiązkowe.** Bez niego `npm run` dokłada na stdout własny nagłówek, który
ląduje w pliku `.sql` i wywraca całość na `near ">": syntax error at offset 1`. Wywołanie wprost
przez `node ./scripts/import-usda.mjs` jest wolne od tej pułapki.

## Dlaczego zbiorczy plik, a nie API

`DEMO_KEY` USDA daje 30 zapytań na godzinę — mniej, niż mamy składników, więc jeden pełny przebieg
by się nie zmieścił. Klucz osobisty wprowadziłby poświadczenie tam, gdzie ma go nie być. Zbiorczy
plik pobiera się bez klucza, jest deterministyczny i wersjonowalny.

## Sprawdzenie, które ratuje przed cichą podmianą składnika

`ingredients.json` zapisuje przy każdym `fdcId` **opis z tabeli USDA**, a destylacja przerywa, gdy
opis w zbiorze się z nim nie zgadza. To nie jest formalność: `169251` to „Mushrooms, white, raw",
a `169252` — „Mushrooms, white, **cooked**, boiled, drained". Pomyłka w jednej cyfrze podmienia
surowe na gotowane, czyli zmienia kalorie o rząd, a sito Atwatera tego nie złapie, bo oba wiersze
są wewnętrznie spójne. Bez sprawdzenia opisu ta pomyłka byłaby niewykrywalna.

## Skąd wzięły się rozjazdy w makrach

Pierwszy seed składników (13.09.2026) miał makra **wpisane z pamięci modelu**, bez `usda_fdc_id`.
Weryfikacja wobec tabeli USDA (14.09.2026) pokazała, że **osiem z trzydziestu pięciu** nie zgadza
się z żadnym wierszem:

| Składnik | Było | USDA | Rozjazd |
| --- | --- | --- | --- |
| boczek wędzony, surowy | 541 kcal, 37 g B | 393 kcal, 13,7 g B | −27% kcal, −63% białka |
| tuńczyk w wodzie, z puszki, odsączony | 116 kcal, 25,5 g B | 86 kcal, 19,4 g B | −26% kcal |
| serek wiejski (cottage), 2% tłuszczu | 103 kcal | 81 kcal | −21% kcal |
| krewetki, surowe | 85 kcal, 20,1 g B | 71 kcal, 13,6 g B | −16% kcal, −32% białka |
| papryka czerwona, surowa | 31 kcal | 26 kcal | −16% kcal |
| pierś z kurczaka, surowa | 120 kcal | 108 kcal | −10% kcal |
| soczewica czerwona, sucha | 1,1 g T | 2,17 g T | dwukrotnie |
| chleb pszenny jasny | 265 kcal | 266 kcal | zaokrąglenie |

Wszystkie osiem **przeszło sito Atwatera**, bo były wewnętrznie spójne — sito łapie błędy mapowania
rzędu ×10, a nie liczby wymyślone konsekwentnie. To jest dokładnie powód, dla którego makra muszą
pochodzić z wiersza USDA, a nie z pamięci.

## Trzy zmiany nazw i dlaczego nazwa jest tożsamością

Dwie pozycje nazywały produkt, którego wiersz USDA nie opisuje, więc nazwa została doprowadzona
do tego, co naprawdę jest w bazie:

- `twaróg półtłusty` → `serek wiejski (cottage), 2% tłuszczu` — USDA nie ma twarogu, a wiersz,
  który mu odpowiada składem najbliżej, opisuje serek typu cottage. Zostawienie polskiej nazwy
  przy tych makrach byłoby kłamstwem o produkcie.
- `tuńczyk w wodzie, z puszki` → `tuńczyk w wodzie, z puszki, odsączony` — wiersz dotyczy
  odsączonych kawałków, a zalewa waży.
- `boczek wędzony` → `boczek wędzony, surowy` — stan wchodzi do nazwy tak samo jak przy mięsie.

Zmiana nazwy idzie osobnym `UPDATE` **przed** wstawieniem. Bez tego przemianowany składnik wjechałby
jako nowy wiersz, a stary — z błędnymi makrami i cudzymi wykluczeniami wskazującymi jego `id` —
zostałby w bazie na zawsze.
