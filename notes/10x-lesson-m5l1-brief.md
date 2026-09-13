# Brief: Moduł 5, Lekcja 1 — wewnętrzne narzędzia i automatyzacje

> **Lekcja świadomie nieprzerobiona na MealPlanie.** Treść lekcji dostępna. Skille, które zostawiła
> (`/10x-opportunity-map`, `/10x-mom-test`), **są zainstalowane** i nieużyte.

## Co lekcja wprowadza

Klasyfikowanie **powtarzającego się tarcia zespołowego** przed zbudowaniem czegokolwiek, przy
pomocy mapy okazji. Cztery kroki i jedna mocna reguła domyślna:

- **domyślnie SaaS, kiedy wystarcza** — budowanie własnego narzędzia jest wyjątkiem, nie odruchem;
- własne, cienkie narzędzie wewnętrzne **tylko tam, gdzie ból jest lokalny i międzysystemowy**,
  czyli tam, gdzie żaden dostawca nie zna Twojego układu systemów;
- zdefiniowanie **pierwszej użytecznej wersji**, a nie docelowej;
- skierowanie obiecujących pomysłów na dalsze ścieżki Modułu 5.

Do tego `/10x-mom-test` — rozmowa o problemie, w której nie wolno pytać, czy pomysł się podoba.

## Dlaczego nie daje się jej przerobić na MealPlanie

Lekcja dotyczy **tarcia w zespole**, a nie tego produktu. MealPlan jest projektem jednoosobowym
i nie ma „powtarzającego się bólu międzysystemowego" do skatalogowania — jest jedna osoba, jedno
repo i jeden przepływ pracy.

Mapa okazji zwróciłaby albo pustkę, albo listę rzeczy, które i tak już są zrobione: bramki jakości
(warstwy 1–4), harness E2E, `check-conventions.js`. To nie są „narzędzia wewnętrzne" w sensie
lekcji, tylko część tego repozytorium.

`/10x-mom-test` wymaga **rozmówcy**, który ma problem. Tu autor i użytkownik to ta sama osoba,
więc test Mamy z definicji nie działa: jego cała wartość polega na tym, że rozmówca nie jest
emocjonalnie związany z pomysłem.

## Co musiałoby być prawdą, żeby się nadawała

Zespół i powtarzalne tarcie mierzone czymś więcej niż wrażeniem — np. „trzy osoby tracą po pół
godziny tygodniowo na tę samą ręczną czynność". Albo MealPlan z realnymi użytkownikami, gdzie
`/10x-mom-test` miałby kogo pytać i o co.

## Co z niej zabieram mimo to

1. **Regułę „domyślnie SaaS" ten projekt zastosował, zanim poznałem lekcję — i to była
   najważniejsza decyzja infrastrukturalna.** Aneks w `infrastructure.md` (1.09.2026) wybiera
   **Clerka** zamiast własnej warstwy auth na D1. Konsekwencje są dokładnie takie, jakie lekcja
   obiecuje: hasła, sesje, maile, limit prób i Google SSO są cudzym problemem, a repo zostaje
   z jedną funkcją weryfikującą podpis JWT. Gdybym budował to sam, byłby to największy i najbardziej
   ryzykowny kawałek projektu — i nadal nie byłoby puli dań.
2. **„Pierwsza użyteczna wersja, nie docelowa."** To samo kryterium wymusza plan F-01: pula ma być
   „na tyle duża, żeby generator miał z czego wybierać, i ani trochę większa", z decyzją skalowania
   **po** pilocie dwudziestu dań, a nie przed.
3. **Nie pytaj, czy pomysł się podoba.** Przenoszę to na przeglądy: pytanie „czy ten plan jest
   dobry" daje potakiwanie, a pytanie „które kryterium przechodzi, mimo że funkcja nie działa"
   dało dziś dwa realne ustalenia.
