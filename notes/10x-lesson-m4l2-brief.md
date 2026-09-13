# Brief: Moduł 4, Lekcja 2 — mapa projektu

> **Lekcja świadomie nieprzerobiona na MealPlanie.** Ta sekcja opisuje, co wprowadza, dlaczego nie
> daje się jej tu uczciwie wykonać i co z niej zabieram mimo to. Treść lekcji dostępna — brief
> nie jest rekonstrukcją z artefaktów.

## Co lekcja wprowadza

Budowanie **mapy nieznanego repozytorium legacy** przez agenta, metodą **Wide Scan → Deep Focus**,
z wynikiem w `context/map/`. Trzy artefakty dowodowe, każdy z własnym promptem:

- **terytorialny** — historia gita: obszary gorące kontra zamrożone, pliki zmieniane razem;
- **strukturalny** — graf zależności, punkty wejścia, cykle (dependency-cruiser);
- **kontrybutorski** — kto co zna.

Składane w `repo-map.md`, dokument onboardingowy gotowy do podejmowania decyzji. Nacisk na
**dowody zamiast drzewa katalogów**, jawną sekcję `unknowns` i oszczędzanie okna kontekstu.

## Dlaczego nie daje się jej przerobić na MealPlanie

Lekcja celuje w repo, którego **nikt nie rozumie**. MealPlan jest jego przeciwieństwem, i to nie
przypadkiem:

- **43 pliki w `src/`** — całość mieści się w jednym przebiegu czytania, bez mapy.
- **Historia decyzji jest zapisana, nie do odkrycia** — `context/foundation/` (PRD, roadmapa,
  infrastruktura), `context/archive/` z jedenastoma raportami przeglądu, `notes/night-decisions.md`
  z D1–D19. Mapa miałaby odtwarzać *dlaczego*, a to *dlaczego* leży już spisane.
- **`CLAUDE.md` opisuje architekturę wprost**, łącznie z rozdwojoną warstwą nawigacji i granicą
  serwer/klient.
- **Artefakt kontrybutorski jest pusty z definicji** — projekt jednoosobowy. „Kto co zna"
  ma jedną odpowiedź.

## Co musiałoby być prawdą, żeby się nadawała

Repozytorium **odziedziczone**, bez `context/`, z historią gita liczoną w tysiącach commitów
i wieloma autorami — czyli sytuacja, w której git jest jedynym świadkiem intencji. Albo MealPlan
za dwa lata, jeśli `context/` przestanie być uzupełniane.

## Co z niej zabieram mimo to

1. **Warstwa terytorialna to jedyna, która ma tu jakąkolwiek wartość.** „Które pliki zmieniają się
   razem" jest pytaniem sensownym nawet przy małym repo — i dziś znam już odpowiedź z bólu:
   `app-tabs.tsx` i `app-tabs.web.tsx` **muszą** zmieniać się razem, a `plan.md` i `change.md`
   danej zmiany też. Reguła o parzystości zakładek w `check-conventions.js` to dokładnie
   zautomatyzowany wynik analizy współzmienności, tyle że napisany ręcznie.
2. **„Dowody zamiast drzewa katalogów"** — to samo kryterium stosowałem dziś w `research.md`:
   każde ustalenie z `plik:linia`, a nie „w `src/server/` jest warstwa serwerowa".
3. **Jawna sekcja `unknowns`.** Mój `research.md` i `frame.md` mają „Otwarte pytania" z tego samego
   powodu: dokument, który nie mówi, czego nie wie, każe czytelnikowi zgadywać, gdzie kończy się
   ustalenie, a zaczyna założenie.
