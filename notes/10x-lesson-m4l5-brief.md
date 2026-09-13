# Brief: Moduł 4, Lekcja 5 — modernizacja legacy z DDD

> **Lekcja świadomie nieprzerobiona na MealPlanie** — z jednym zastrzeżeniem, bo jeden z jej trzech
> promptów opisuje coś, co ten projekt **już robi, nie nazywając tego**. Treść lekcji dostępna.

## Co lekcja wprowadza

Agenta w roli **trenera modelowania dziedziny**, który wydobywa domenę, której kod legacy nigdy nie
nazwał. Trzy prompty wielokrotnego użytku, każdy z artefaktem w `context/domain/`:

- **destylacja języka wszechobecnego** → mapa rozjazdu między modelem a kodem;
- **niezmiennik → agregat-strażnik** — wzięcie jednej reguły, która musi być zawsze prawdziwa,
  i uczynienie jej niemożliwą do złamania przez konstrukcję;
- **warstwa antykorupcyjna** — odizolowanie przeciekającej zależności.

Do tego **Event Storming moderowany przez agenta** na wspólnej tablicy, a wynikowe artefakty DDD
wchodzą jako wejście do **drugiego cyklu, po MVP**: `/10x-shape` → `/10x-roadmap` →
`/10x-research` → `/10x-plan`.

## Dlaczego nie daje się jej przerobić na MealPlanie

Punkt wyjścia lekcji to **kod, który ma domenę, ale jej nie nazywa**. Tutaj jest odwrotnie:
**domena jest nazwana, a kodu domenowego prawie nie ma.**

- Język wszechobecny leży spisany w `prd.md` (FR-001…FR-016 z wyzwaniami sokratejskimi)
  i w `options.md` — destylacja zwróciłaby ten sam słownik, z którego by startowała.
- Mapa rozjazdu model-kod byłaby prawie pusta, bo kodu produktowego jest tyle, co `calorie-target.ts`,
  `dish-macros.ts`, `dish-validation.ts` i trzy trasy API. Generator planu (S-04), czyli miejsce,
  gdzie domena naprawdę zamieszka, **jeszcze nie istnieje** — jest zablokowany do czasu powstania
  puli dań.
- Warstwa antykorupcyjna nie ma czego izolować: jedyna zewnętrzna zależność to Clerk, a granica
  z nim jest już wąska i celowa (`src/server/auth.ts` weryfikuje wyłącznie podpis JWT,
  `CLERK_SECRET_KEY` nie wchodzi do projektu).
- Event Storming wymaga **kilku osób przy tablicy**. Projekt jest jednoosobowy.

## Co musiałoby być prawdą, żeby się nadawała

Drugi cykl **po MVP**, kiedy S-04 i S-05 już istnieją i domena planowania posiłków ma wreszcie kod,
który można zestawić ze słownikiem. Lekcja sama się tam kieruje — jej ostatni krok to podanie
artefaktów DDD do `/10x-shape` w kolejnym cyklu.

## Co z niej zabieram mimo to

1. **„Niezmiennik → agregat-strażnik" opisuje to, co dziś zbudowałem, nie wiedząc, że to ma nazwę.**
   `src/lib/dish-validation.ts` bierze reguły, które muszą być zawsze prawdziwe (niezmiennik
   Atwatera, próg kaloryczny na porcję, gęstość energetyczna) i czyni je **niemożliwymi do obejścia
   na drodze zapisu** — danie łamiące którąkolwiek po prostu nie przechodzi. To samo robi
   `calorie-target.ts` z granicami profilu. Nazwanie tego wzorca pomaga: **jeśli niezmiennik ma
   strażnika, to musi być dokładnie jeden** — i stąd bierze się dzisiejsze ustalenie, że odstępstwo
   `prep_minutes` jest bezpieczne tylko przy jednej drodze zapisu.
2. **Model i kod rozjeżdżają się cicho.** Lekcja robi z tego osobny artefakt; to repo ma ten sam
   problem w mniejszej skali i rozwiązuje go regułą „granice w TypeScripcie, enumeracje w SQL-u"
   — jedno źródło prawdy zamiast dwóch, które mogą się rozejść.
3. **Warstwa antykorupcyjna jako test granicy.** Pytanie „co by trzeba było odizolować, gdyby Clerk
   zniknął" ma dziś dobrą odpowiedź — `src/server/auth.ts` i `src/lib/api.ts` — i to jest dowód,
   że granica jest w dobrym miejscu, a nie zaproszenie do refaktoryzacji.
