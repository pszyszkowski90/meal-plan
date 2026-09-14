# Instrukcja autorska dla przepisów

Ten plik jest **jedynym miejscem z regułami pisania dań**. Model językowy autoryzuje przepisy
**raz, poza runtime** (decyzja D14) — Worker nigdy go nie woła, w runtime czyta wyłącznie D1.
Stąd forma: przepis jest **danymi w repozytorium**, a nie odpowiedzią generowaną na żądanie.

## Kształt pliku

Jeden plik na danie: `seed/dishes/<slug>.json`. **Nazwa pliku JEST `slug`-iem** i musi zgadzać się
z polem `slug` w środku — `slug`, nie `name`, jest tożsamością dania, bo poprawka literówki
w nazwie wyświetlanej nie może tworzyć drugiego dania.

```json
{
  "slug": "kurczak-z-ryzem-i-brokulem",
  "name": "Kurczak z ryżem i brokułem",
  "mealSlots": ["lunch", "dinner"],
  "prepMinutes": 35,
  "modelKcalHint": 620,
  "reviewedBy": "agent (upoważnienie właściciela 14.09.2026)",
  "reviewedAt": "2026-09-14",
  "ingredients": [
    { "ingredientName": "pierś z kurczaka, surowa", "grams": 150 }
  ],
  "steps": ["Ryż wsyp do wrzącej, osolonej wody i gotuj 15 minut."]
}
```

## Reguły, których złamanie jest błędem

### 1. Każdy przepis jest na JEDNĄ porcję

Konwencja z migracji `0003`: nie ma kolumny `servings`. Dwuznaczność „makra dania" kontra „makra
porcji" łamałaby guardrail ±10% o cichy czynnik — i to taki, którego nikt nie zobaczy, bo obie
liczby wyglądają sensownie.

### 2. Gramatura jest PRZED obróbką, a nazwa składnika niesie stan

`ryż biały, suchy` to ~365 kcal/100 g, ugotowany ~130 — różnica rzędu 180%, czyli **wielokrotność
całego budżetu ±10%**. Przepis podaje 80 g ryżu **suchego**, nigdy 200 g ugotowanego. Ta sama
zasada dotyczy mięsa (surowe), strączków (suche) i makaronu (suchy).

Ani przegląd gramatur, ani próg „zdrowego rozsądku" tego nie wykryje: gramatura jest poprawna,
a wynik mieści się w zakresie. Jedyną obroną jest jednoznaczna tożsamość składnika.

### 3. Składnik wskazuje NAZWĘ z tabeli `ingredient`, co do znaku

Walidator dopasowuje dokładnym łańcuchem znaków i odrzuca danie z nieznaną nazwą. Pula składników:
`seed/ingredients.json`. Nowego składnika nie wymyślaj w przepisie — dopisz go najpierw do
mapowania razem z `fdcId` z USDA (instrukcja w `seed/README.md`).

### 4. Makra nie są treścią przepisu

**Nie podawaj makr ani kalorii jako prawdy.** Liczy je skrypt z tabeli USDA, z gramatur. Jedyne
pole liczbowe o energii to `modelKcalHint` i ono **nigdy nie trafia do D1** — patrz niżej.

### 5. `modelKcalHint` to DEKLARACJA, nie wynik

To ma być **niezależne oszacowanie autora**, zapisane zanim policzy je skrypt. Po to istnieje:
rozjazd deklaracji z wyliczeniem porządkuje przegląd — dania z największą rozbieżnością ogląda się
najpierw. Bez tego przegląd to setki liczb bez priorytetu.

Wpisanie tu wyniku obliczenia **niszczy jedyny sygnał, jaki to pole niesie**. Pole ma wtedy zawsze
0% rozjazdu i przestaje cokolwiek szeregować.

**Rozjazd powyżej 20% oznacza ODRZUCENIE dania** i zapisanie powodu — nie korektę gramatury pod
sito. Naginanie gramatur, żeby danie przeszło, jest obchodzeniem własnego guardraila.

### 6. `reviewedBy` zapisuje prawdę o tym, kto sprawdzał

Bramka `--remote` w `scripts/seed-dishes.mjs` **odmawia** seeda dla dania bez `reviewedBy`
i `reviewedAt`. Ma odróżniać danie sprawdzone od niesprawdzonego, a nie udawać, że ktoś je oglądał.

**Nigdy nie wpisuj tam cudzego nazwiska.** Gdy przegląd robi agent, wpis brzmi
`agent (upoważnienie właściciela 14.09.2026)` — to jest świadome rozluźnienie D14, podjęte przez
właściciela po przedstawieniu kosztu, i ma zostać widoczne w danych.

### 7. Kroki to osobne rekordy, w kolejności

FR-016 wymaga instrukcji rozbitej na kroki, bo tryb gotowania (S-06) prowadzi użytkownika
krok po kroku. Jeden krok to jedna czynność — nie akapit z trzema.

## Sita, przez które przechodzi każde danie

Liczy je `src/lib/dish-validation.ts`; skrypt seedujący **nie ma własnej kopii progów**.

| Sito | Zakres | Co łapie |
| --- | --- | --- |
| Atwater na składniku | ±10% albo 12 kcal/100 g | wiersz USDA źle zmapowany |
| Atwater na daniu | jak wyżej | ten sam błąd, po zsumowaniu |
| Energia porcji | 150–1500 kcal | błąd ×10 i ×0,1, składnik podpięty pod wodę |
| Gęstość energetyczna | 0,3–5 kcal/g | gramatura przesunięta o rząd |
| Czas przygotowania | 5–120 minut | wartość poza sensem kulinarnym |

Sita łapią błędy **mapowania i rzędu wielkości**. Nie wykryją liczby wymyślonej konsekwentnie —
i dlatego reguła 2 (stan w nazwie) oraz reguła 5 (uczciwy `modelKcalHint`) nie są formalnościami.

## Pory posiłku

`breakfast`, `lunch`, `dinner`, `snack`. Danie może mieć kilka i **zwykle powinno**: obiad
i kolacja to w praktyce kulinarnej w dużej mierze ten sam zbiór, a przypisanie do jednej pory
dzieli pulę dokładnie wtedy, gdy wykluczenia i limit czasu już ją przerzedziły.
