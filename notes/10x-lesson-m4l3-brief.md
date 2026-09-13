# Brief: Moduł 4, Lekcja 3 — analiza funkcjonalności z mapą i ast-grep

> **Lekcja świadomie nieprzerobiona na MealPlanie** — ale z jednym elementem, który **oddzieliłem
> i zabieram**, bo dotyczy realnego problemu w tym repo. Treść lekcji dostępna.

## Co lekcja wprowadza

Zamianę mapy projektu (m4l2) w **ugruntowaną analizę funkcjonalności**. `/10x-research` dostaje
mapę jako pakiet wejściowy i uruchamia trzy równoległe podagenty: **ślad end-to-end**, **luki
w pokryciu testami** i **promień rażenia** zmiany. Wynik ma jawne sekcje „Feature overview"
i „Technical debt".

Druga połowa lekcji jest osobnym narzędziem: **weryfikacja przez `ast-grep`**. Każde twierdzenie
strukturalne z raportu („nikt tego nie woła", „ten wzorzec występuje w pięciu miejscach") zostaje
**potwierdzone albo obalone liczbą** z zapytania po drzewie składniowym. Lekcja zestawia precyzję
AST z „literalną uczciwością" grepa: grep widzi tekst, `ast-grep` widzi kod.

## Dlaczego nie daje się jej przerobić na MealPlanie

Twardą przeszkodą jest **pakiet wejściowy**: analiza startuje z mapy z m4l2, a mapy nie ma i nie
będzie (patrz brief m4l2). Bez niej zostaje zwykły `/10x-research` — a ten w tym repo już działa
i został dziś użyty w zadaniu A1.

Do tego „Technical debt" zakłada dług do znalezienia. Repo ma 66 testów, jedenaście raportów
przeglądu i rejestr `lessons.md`; dług, który ktoś nazwał, siedzi w `follow-ups/` i w Otwartych
pytaniach, a nie czeka na odkrycie.

## Co musiałoby być prawdą, żeby się nadawała

Istniejąca mapa repo **i** funkcjonalność, której nikt nie rozumie na tyle, żeby powiedzieć, co się
stanie po jej ruszeniu. W MealPlanie promień rażenia każdej zmiany daje się dziś przeczytać
z `CLAUDE.md` i `check-conventions.js`.

## Co z niej zabieram mimo to — i to jest konkret do zrobienia

**`ast-grep` rozwiązuje problem, na który dziś wpadłem dwa razy.**

1. **Fałszywy alarm z grepa.** Sprawdzając, czy poprawka trafiła do zbudowanego bundla, `grep`
   nie znalazł polskich napisów („Wróć", „Uzupełnij"), bo bundler zapisuje znaki spoza ASCII
   inaczej, niż szuka powłoka. Wyglądało to **dokładnie jak realna awaria wdrożenia**.
   Rozstrzygnęła dopiero sonda w Node na wzorcu czysto ASCII.
2. **`check-conventions.js` stoi na wyrażeniach regularnych po tekście** — z własnym,
   ręcznie napisanym usuwaniem komentarzy (`:36-103`), żeby komentarz cytujący zakazany wzorzec
   nie wywracał bramki. To jest **obejście problemu, który `ast-grep` ma rozwiązany z definicji**:
   zapytanie po drzewie składniowym nie widzi komentarzy, bo komentarze nie są kodem.

**Do rozważenia (nie robię tego teraz, bo to zmiana narzędzia, nie zadanie z kolejki):** przepisanie
reguł `sql-outside-repository`, `worker-env-in-route`, `global-this` i `manual-memo`
z wyrażeń regularnych na `ast-grep`. Zyskałoby to odporność na komentarze, łańcuchy znaków
i formatowanie — a stracił: jedną zależność więcej, czego to repo unika ze względu na lockfile.
**Ten kompromis jest realny i dlatego zostawiam go jako decyzję, nie rekomendację.**
