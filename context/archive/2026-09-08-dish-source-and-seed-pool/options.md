# Opcje i konsekwencje — źródło przepisów, makra i model wykluczeń

> Dokument decyzyjny dla Otwartych pytań PRD **1, 2, 3 i 4**. Dowody zebrane w
> [`research.md`](research.md) (396 linii, badanie z 8.09.2026) — tutaj wyłącznie **konsekwencje
> wyboru** dla rzeczy, które PRD nazywa ograniczeniami twardymi.
>
> **Uwaga o zakresie.** Kolejka nocna prosiła o „OP 1–3", ale opisała przy tym treść Otwartego
> pytania **4** z PRD (wykluczenia składnikowe kontra daniowe). Rozstrzygam oba — OP 3
> (niewykonalny plan) i OP 4 (model wykluczeń) są ze sobą sprzężone: próg, przy którym plan staje
> się niewykonalny, zależy wprost od tego, jak liczone są wykluczenia.

## 1. Dlaczego to blokuje wszystko inne

Trzy ograniczenia z PRD są **twarde, nie preferencyjne**: suma kalorii dnia w ±10% celu, zero
pozycji z listy wykluczeń, zero przekroczeń maksymalnego czasu przygotowania. Wszystkie trzy
sprawdzają dane, które przychodzą ze źródła przepisów. **Jeśli źródło podaje złe makra, guardrail
±10% sprawdza liczbę, która sama jest błędna** — a produkt obiecuje coś, czego nie dotrzymuje,
i nikt tego nie zauważy, bo test przejdzie.

## 2. Opcje dla OP 1 — konsekwencje, nie opis

| Konsekwencja dla… | A. Model na żądanie | B. Ręczna pula | E. Hybryda (model autoryzuje raz, USDA liczy) |
|---|---|---|---|
| **Guardrail ±10%** | **Nieegzekwowalny.** Badania 2025–2026: MAPE energii ~36%, 13 z 16 składników z błędem > 10%. Sprawdzamy błędną liczbę | Egzekwowalny — makra wpisane raz i zweryfikowane | **Egzekwowalny** — makra liczone deterministycznie z tabeli USDA |
| **Limit CPU Workera (10 ms)** | OK — oczekiwanie na `fetch` nie liczy się do CPU… | OK przy przycinaniu wyszukiwania | OK — zapytanie do D1 to I/O, nie CPU |
| | …ale **~2 min ściennego czasu** na tydzień planu to porażka produktowa, nie techniczna | | Dobór dań w ms |
| **FR-016 (kroki)** | Tak, wymuszone schematem — ale kroki nieweryfikowane | Tak | **Tak** — kroki powstają raz i przechodzą przegląd człowieka |
| **Sumowanie jednostek w liście zakupów** | **Największy problem.** Model zwraca „szczypta", „garść", „2 średnie" — tego nie da się zsumować między daniami | Kontrolujemy jednostki przy wpisywaniu | **Rozwiązane u źródła:** mapowanie na USDA wymusza gramaturę, więc sumowanie to dodawanie liczb |
| **Offline (NFR)** | Plan zapisany lokalnie — OK | OK | OK |
| **Determinizm i testowalność** | **Nie.** 80 różnych odpowiedzi na 1000 wywołań przy temperaturze 0 | Tak | Tak — pula jest danymi, nie wywołaniem |
| **Koszt** | 0,01–0,10 USD za plan, rośnie liniowo z użyciem | 0 | **~0,50 USD jednorazowo** |
| **Nakład (solo, 4 tygodnie)** | Mało kodu, ale walidacja makr jest nierozwiązywalna | 25–60 h pisania 40–80 przepisów | **10–15 h** (autorstwo + przegląd + mapowanie) |
| **Ryzyko rezydualne** | Produkt kłamie o kaloriach | Nuda: 60 dań wyczerpuje się po kilku tygodniach | Błąd mapowania składnik → USDA; **wymaga przeglądu ilości przez człowieka** |

**Opcja D (zewnętrzne API przepisów) odpada na licencji, nie na technice.** Spoonacular zabrania
przechowywania składników, instrukcji i wartości odżywczych (cache ≤ 1 h); Edamam dopuszcza cache
wyłącznie id i nazwy oraz tylko zapytania inicjowane przez człowieka. Wymaganie „raz wygenerowany
plan działa bez sieci" jest z tymi warunkami **niepogodzalne**. To blokada prawna — żadna ilość
kodu jej nie obejdzie.

**Opcja C (same USDA)** nie jest alternatywą, tylko **warstwą makr** pod opcję B lub E.

## 3. OP 2 — kroki przygotowania: pochodna OP 1

Pytanie brzmi „czy wybrane źródło daje instrukcję rozbitą na kroki". Odpowiedź zależy wyłącznie
od OP 1 i rozstrzyga się sama:

- A: tak, ale kroki są niezweryfikowane i niedeterministyczne.
- B/E: tak, bo **my jesteśmy autorem** — kroki powstają jako tablica, a nie blok tekstu.
- D: Spoonacular tak, TheMealDB i Tasty **nie** (jeden blok tekstu) — kolejny powód odrzucenia.

FR-016 wymaga przechodzenia krok po kroku w trakcie gotowania, więc kroki muszą być **osobnymi
rekordami z kolejnością**, a nie polem tekstowym do podziału po kropkach w runtime.

## 4. OP 4 — model wykluczeń: „nie jem grzybów" kontra „nie jem risotto"

To są **dwa różne zdania o świecie** i model danych musi je rozróżniać, inaczej guardrail
o wykluczeniach będzie łamany:

- **„Nie jem grzybów"** = wykluczenie **składnikowe**. Wyklucza *każde* danie zawierające grzyby —
  także takie, którego nazwa o grzybach nie mówi (risotto, sos, pierogi).
- **„Nie jem risotto"** = wykluczenie **daniowe**. Wyklucza jedną pozycję; ryż i parmezan zostają
  dozwolone.

Kluczowe: **PRD wymaga JEDNEJ listy wykluczeń** — FR-004 (preferencje) i FR-011 (oznaczenie dania
z planu) zasilają ten sam mechanizm, nie dwa równoległe. Jedna lista **nie znaczy** jeden typ wpisu.

### Proponowany model danych

```
exclusion
  id
  user_id            -- filtrowanie po nim jest jedyną izolacją (D1 nie ma RLS)
  kind               -- 'ingredient' | 'dish'
  ingredient_id      -- wypełnione gdy kind='ingredient'
  dish_id            -- wypełnione gdy kind='dish'
  source             -- 'preferences' (FR-004) | 'plan' (FR-011)  — tylko do UI, nie do logiki
  created_at
```

Jedna tabela, jedno zapytanie filtrujące, dwa rodzaje wpisu. `source` istnieje wyłącznie po to,
żeby ekran preferencji mógł pokazać „to wykluczyłeś z planu 12.09", i **nigdy** nie wpływa
na dobór dań — inaczej powstałyby dwa mechanizmy tylnymi drzwiami.

Dobór dania odrzuca je, gdy:

```
dish_id ∈ (wykluczenia daniowe użytkownika)
  OR  dish zawiera składnik ∈ (wykluczenia składnikowe użytkownika)
```

**Konsekwencja, którą trzeba przyjąć świadomie:** to wymaga tabeli `dish_ingredient` z prawdziwymi
identyfikatorami składników. Dopasowywanie po nazwie („czy tytuł zawiera słowo grzyb") złamie
guardrail przy pierwszym „risotto z borowikami" — i to jest dokładnie ten tryb awarii, przed którym
ostrzega wyzwanie sokratejskie przy FR-004. Ta sama tabela jest potrzebna liście zakupów (FR-012,
FR-013), więc koszt jest wspólny, nie dodatkowy.

## 5. OP 3 — co, gdy planu nie da się ułożyć

PRD już przesądza kierunek (US-01: jawny komunikat) i `CLAUDE.md` dopowiada regułę: **zwróć błąd
nazywający, którego z trzech ograniczeń nie da się spełnić, i nie zwracaj planu ani planu
częściowego.** Do rozstrzygnięcia zostaje próg i treść.

Propozycja: generator raportuje **pierwsze** ograniczenie, które zawiodło, wraz z liczbą dostępnych
dań po odsiewie:

| Sytuacja | Komunikat |
|---|---|
| Po wykluczeniach zostało < N dań na porę posiłku | „Twoje wykluczenia nie zostawiają dość dań na śniadania — zostało 2. Usuń któreś wykluczenie albo zwiększ limit czasu." |
| Dania są, ale żadna kombinacja nie trafia w ±10% | „Nie da się ułożyć dnia w granicy ±10% od 2 759 kcal przy tych daniach." |
| Limit czasu odsiewa wszystko | „Przy limicie 20 minut zostaje za mało dań." |

Progu nie zgaduję — **wynika z rozmiaru puli i musi zostać zmierzony**, gdy pula powstanie.
To zadanie dla S-04, nie dla F-01.

## 6. Rekomendacja

**Opcja E (hybryda).** Model językowy autoryzuje przepisy raz, poza runtime — polskie nazwy,
gramatury, kroki, czas przygotowania. Człowiek przegląda ilości (obowiązkowo — zbiegają się na tym
cztery niezależne źródła w badaniu). Makra liczy skrypt deterministycznie z **USDA FoodData Central**
(domena publiczna CC0, bez share-alike). Runtime czyta wyłącznie D1.

Jedyna opcja, która **jednocześnie** czyni guardrail ±10% egzekwowalnym, spełnia FR-016, pozwala
sumować jednostki w liście zakupów, działa offline i jest deterministyczna — czyli testowalna.

**Cena, którą płacimy świadomie:** 10–15 h nakładu przed pierwszym wygenerowanym planem,
obowiązkowy przegląd ilości przez człowieka i ryzyko błędu w mapowaniu składnik → USDA.
