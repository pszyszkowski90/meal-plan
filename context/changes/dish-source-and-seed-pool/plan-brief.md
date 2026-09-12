# Źródło przepisów z makrami i zseedowana pula dań — krótki plan

> Pełny plan: `context/changes/dish-source-and-seed-pool/plan.md`
> Decyzja o źródle: `context/changes/dish-source-and-seed-pool/options.md`
> Badanie: `context/changes/dish-source-and-seed-pool/research.md`

## Co i dlaczego

Aplikacja dostaje własną pulę dań w D1 — nazwy, gramatury, kroki, czas i **makra policzone
deterministycznie z tabeli USDA**. To odblokowuje wszystko, co stoi: generator planu (S-04),
gotowanie krok po kroku (S-06) i listę zakupów (S-07). PRD nazywa ±10% kalorii **ograniczeniem
twardym**, więc produkt nie może stać na makrach, które same są zgadywane.

## Punkt wyjścia

S-01 i S-02 są na produkcji: D1 ma migracje i warstwę repozytorium, jest uwierzytelnianie,
profil i cel kaloryczny. Pula dań nie istnieje — nie ma **ani jednego dania**, a typ D1 w repo
nie ma nawet `all()`, więc nie da się odczytać wielu wierszy. To będzie pierwszy w tym repo byt
**współdzielony** (dane nie-per-użytkownik).

> Uwaga: sekcja „stan bazy kodu" w `research.md` pochodzi z 8.09 i jest nieaktualna — opisuje repo
> sprzed S-01. Wnioski o **opcjach źródła** pozostają w mocy.

## Pożądany stan końcowy

W D1 leży ≥ 60 dań rozłożonych na pory posiłku, każde z polską nazwą, czasem przygotowania,
składnikami z gramaturą, krokami w kolejności i makrami policzonymi z USDA. Istnieje **zmierzony
dowód**, czy z tej puli da się złożyć dzień w ±10% dla celów od 1600 do 3200 kcal — albo jawna
informacja, że nie, wraz z liczbą brakujących dań. Zero kodu generatora.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego | Źródło |
|---|---|---|---|
| Źródło przepisów i makr | Hybryda: model autoryzuje raz poza runtime, USDA liczy makra | Jedyna opcja, która **jednocześnie** czyni ±10% egzekwowalnym, spełnia FR-016, pozwala sumować jednostki i działa offline | options.md / D14 |
| Model na żądanie (opcja A) | Odrzucona | MAPE energii ~36%, niedeterminizm, ~2 min na tydzień planu, jednostki „szczypta" nie do zsumowania | Badanie |
| API przepisów (opcja D) | Odrzucona | Blokada **licencyjna**, nie techniczna: zakaz przechowywania makr i instrukcji kłóci się z wymaganiem offline | Badanie |
| Gdzie żyją makra dania | Liczone z `dish_ingredient`, **nie przechowywane** na `dish` | Ta sama zasada, co cel kaloryczny w S-02: jedno źródło, zero dryfu | Plan |
| Kroki przygotowania | Osobne rekordy z `position` | FR-016 wymaga przechodzenia krok po kroku; blok tekstu do dzielenia w runtime to pułapka | Plan |
| Model wykluczeń | Jedna tabela z polem `kind` (`ingredient` / `dish`) | FR-004 i FR-011 zasilają **jedną** listę; „nie jem grzybów" i „nie jem risotto" to różne zdania | options.md |
| Przepisy jako dane w repo | `seed/dishes/*.json` + zapisany prompt | Pula daje się rozszerzyć powtarzalnie, a przegląd człowieka ma co przeglądać | Plan |

## Zakres

**W zakresie:** schemat czterech tabel + migracja `0003`; `all()` w typie D1; podzbiór USDA
w `ingredient`; czysty moduł liczący makra z testem; autorstwo i przegląd ≥ 60 dań; walidator
i skrypt seedujący; repozytorium odczytu puli; pomiar wykonalności ±10%.

**Poza zakresem:** generator planu i dobór dań (S-04); tabela wykluczeń (S-03 — ten plan dostarcza
tylko `dish_ingredient`, na którym tamta stanie); ekran przeglądania dań, zdjęcia, oceny;
wywoływanie modelu w runtime; pełny import USDA; warianty porcji.

## Architektura / Podejście

```
model (raz, poza aplikacją)  →  seed/dishes/*.json  →  przegląd człowieka  →  walidator
                                                                                  │
USDA FoodData Central (CC0)  →  scripts/import-usda.js  →  ingredient            │
                                                                │                 ▼
                                                                └──────→  D1: dish, dish_ingredient, dish_step
                                                                                  │
                                                          src/lib/dish-macros.ts ←┘  (makra liczone, nie przechowywane)
                                                                                  │
                                                          repository/dishes.ts ────┘  → S-04
```

Worker **nigdy nie woła modelu**. W runtime czyta wyłącznie D1.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Schemat | Migracja `0003`, cztery tabele, `all()` w typie D1 | Brak — addytywna, nie dotyka danych użytkowników |
| 2. Warstwa makr | Podzbiór USDA + czysty moduł liczący, z testem | Błąd mapowania składnik → USDA daje wiarygodnie wyglądające, ale błędne makra |
| 3. Pula | ≥ 60 dań z krokami, po przeglądzie człowieka | Model myli gramatury nawet przy poprawnych nazwach — przegląd jest obowiązkowy |
| 4. Dowód | Odczyt z aplikacji + pomiar wykonalności ±10% | **Może wyjść, że pula jest za mała** — i to jest wartość tej fazy |

**Wymagania wstępne:** S-01 i S-02 (`done`); plik źródłowy USDA pobrany raz przez człowieka;
dostęp do modelu do jednorazowego autorstwa (~0,50 USD).
**Szacowany wysiłek:** ~10–15 h, z czego większość to autorstwo i **przegląd gramatur**, nie kod.

## Otwarte ryzyka i założenia

- Błąd mapowania składnik → USDA to najpoważniejsze ryzyko rezydualne; łagodzone przeglądem
  człowieka i zapytaniem kontrolnym na wartości spoza zakresu.
- Pula może okazać się za mała dla skrajnych celów — faza 4 wykryje to **przed** budową generatora.
- Nuda po kilku tygodniach (60 dań) — poza MVP, ale zapisany prompt ma czynić rozszerzenie tanim.
- Zakładam stabilność licencji USDA CC0 w horyzoncie MVP.

## Kryteria sukcesu (podsumowanie)

- Z puli da się odczytać dania z makrami, a makra zgadzają się z niezależnym liczeniem z USDA.
- Istnieje liczba, nie przeczucie, odpowiadająca na pytanie „czy guardrail ±10% jest osiągalny".
- Żadna kaloria w systemie nie pochodzi z odpowiedzi modelu językowego.
